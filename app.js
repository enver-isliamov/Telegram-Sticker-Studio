document.addEventListener('DOMContentLoaded', () => {
    const dom = {
        selectFolderBtn: document.getElementById('select-folder-btn'),
        fileInput: document.getElementById('file-input'),
        addOutlineToggle: document.getElementById('add-outline-toggle'),
        stickerGrid: document.getElementById('sticker-grid'),
        downloadButtons: document.getElementById('download-buttons'),
        downloadPngBtn: document.getElementById('download-png-btn'),
        downloadWebpBtn: document.getElementById('download-webp-btn'),
        zipStatus: document.getElementById('zip-status'),
        langDropdownBtn: document.getElementById('lang-dropdown-btn'),
        langOptions: document.getElementById('lang-options'),
        // Элементы прогресс-бара
        progressContainer: document.getElementById('progress-container'),
        progressBar: document.getElementById('progress-bar'),
        progressText: document.getElementById('progress-text'),
    };

    let stickers = [];
    let generatedNames = new Set();
    let translations = {};

    // === ИНИЦИАЛИЗАЦИЯ ===
    dom.selectFolderBtn.addEventListener('click', () => dom.fileInput.click());
    dom.fileInput.addEventListener('change', handleFileSelection);
    dom.downloadPngBtn.addEventListener('click', () => handleBatchDownload('png'));
    dom.downloadWebpBtn.addEventListener('click', () => handleBatchDownload('webp'));
    dom.stickerGrid.addEventListener('click', handleStickerGridClick);
    dom.stickerGrid.addEventListener('focusout', handleStickerNameChange);
    dom.stickerGrid.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleStickerNameChange(e);
            e.target.blur();
        }
    });

    dom.langDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.langOptions.classList.toggle('hidden');
    });
    dom.langOptions.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            const lang = e.target.dataset.lang;
            loadLanguage(lang);
            dom.langDropdownBtn.querySelector('span').textContent = lang.toUpperCase();
            dom.langOptions.classList.add('hidden');
        }
    });
    document.addEventListener('click', () => {
        dom.langOptions.classList.add('hidden');
    });

    loadLanguage('ru');

    // === I18N (Интернационализация) ===
    async function loadLanguage(lang) {
        try {
            const response = await fetch(`i18n/${lang}.json`);
            if (!response.ok) throw new Error('Lang file not found');
            translations = await response.json();
        } catch (error) {
            console.warn(`Could not load lang ${lang}, falling back to 'ru'.`, error);
            const response = await fetch(`i18n/ru.json`);
            translations = await response.json();
        } finally {
            updateUIText();
        }
    }

    function updateUIText() {
        document.documentElement.lang = translations.langCode || 'ru';
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            if (translations[key]) el.textContent = translations[key];
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.dataset.i18nTitle;
            if (translations[key]) el.title = translations[key];
        });
        // Если стикеры уже отрисованы, обновить их текст
        if (stickers.length > 0) renderStickers();
    }
    
    // === ОБРАБОТКА ФАЙЛОВ ===
    async function handleFileSelection(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        resetUI();
        dom.progressContainer.classList.remove('hidden');
        
        let processedCount = 0;
        let hasErrors = false;
        const totalFiles = files.length;

        const updateProgressBar = () => {
            processedCount++;
            const percentage = Math.round((processedCount / totalFiles) * 100);
            dom.progressBar.style.width = `${percentage}%`;
            dom.progressText.textContent = `${translations.processing || 'Processing'}... ${processedCount} / ${totalFiles} (${percentage}%)`;
        };

        const processingPromises = files.map(file => 
            processFile(file).finally(updateProgressBar)
        );

        const results = await Promise.allSettled(processingPromises);
        results.forEach(result => {
            if (result.status === 'rejected') hasErrors = true;
        });
        
        // Финальное состояние прогресс-бара
        if (hasErrors) {
            dom.progressBar.classList.add('error');
            dom.progressText.textContent = translations.progressError || 'Finished with errors. Check console for details.';
        } else {
            dom.progressText.textContent = translations.processingComplete || 'Processing complete!';
            setTimeout(() => {
                dom.progressContainer.classList.add('hidden');
            }, 2000);
        }

        renderStickers();
        if (stickers.length > 0) dom.downloadButtons.classList.remove('hidden');
    }

    function resetUI() {
        stickers = [];
        generatedNames.clear();
        dom.stickerGrid.innerHTML = '';
        dom.downloadButtons.classList.add('hidden');
        dom.zipStatus.classList.add('hidden');
        dom.progressContainer.classList.add('hidden');
        dom.progressBar.classList.remove('error');
        dom.progressBar.style.width = '0%';
    }

    async function processFile(file) {
        const supportedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
        if (!supportedTypes.includes(file.type)) {
            console.error(`Unsupported file type: ${file.name} (${file.type})`);
            return Promise.reject(new Error('Unsupported type'));
        }

        try {
            const imageBitmap = await createImageBitmap(file);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const { width, height } = getResizedDimensions(imageBitmap.width, imageBitmap.height, 512);
            canvas.width = width;
            canvas.height = height;

            if (dom.addOutlineToggle.checked) {
                addTelegramOutline(ctx, imageBitmap, width, height);
            }

            ctx.drawImage(imageBitmap, 0, 0, width, height);

            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            const dataUrl = canvas.toDataURL('image/png');

            if (blob.size > 512 * 1024) {
                 console.warn(`${file.name} is larger than 512KB (${(blob.size / 1024).toFixed(1)}KB)`);
            }

            const suggestedName = getStickerName(file);
            
            // Синхронно добавляем в массив, чтобы порядок сохранялся
            stickers.push({ id: `${file.name}-${Date.now()}`, originalName: file.name, suggestedName, dataUrl, blob });
            return Promise.resolve();

        } catch (error) {
            console.error(`Failed to process ${file.name}:`, error);
            return Promise.reject(error);
        }
    }

    // ... (остальные функции getResizedDimensions, addTelegramOutline, getStickerName, sanitizeFilename, renderStickers, и т.д. остаются такими же, как в предыдущем ответе, но я их включу для полноты)

    function getResizedDimensions(origWidth, origHeight, maxSize) {
        let width = origWidth, height = origHeight;
        if (width > height) { if (width > maxSize) { height = Math.round(height * (maxSize / width)); width = maxSize; }
        } else { if (height > maxSize) { width = Math.round(width * (maxSize / height)); height = maxSize; } }
        return { width: Math.max(1, width), height: Math.max(1, height) };
    }

    function addTelegramOutline(ctx, image, width, height) {
        const silhouetteCanvas = document.createElement('canvas');
        silhouetteCanvas.width = width; silhouetteCanvas.height = height;
        const silhouetteCtx = silhouetteCanvas.getContext('2d');
        silhouetteCtx.drawImage(image, 0, 0, width, height);
        silhouetteCtx.globalCompositeOperation = 'source-in';
        silhouetteCtx.fillStyle = 'black'; silhouetteCtx.fillRect(0, 0, width, height);
        
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'; ctx.shadowBlur = 4;
        for (let i = 0; i < 4; i++) { ctx.drawImage(silhouetteCanvas, 0, 0); }
        ctx.restore();

        ctx.save();
        ctx.shadowColor = 'white'; ctx.shadowBlur = 2;
        for (let i = 0; i < 8; i++) { ctx.drawImage(silhouetteCanvas, 0, 0); }
        ctx.restore();
    }
    
    function getStickerName(file) {
        const originalBaseName = file.name.substring(0, file.name.lastIndexOf('.'));
        const finalExtension = '.png';
        const prefix = String(stickers.length + 1).padStart(3, '0') + '_';
        let baseName = prefix + sanitizeFilename(originalBaseName);
        
        let finalName = baseName + finalExtension;
        let counter = 1;
        while (generatedNames.has(finalName)) {
            finalName = `${baseName}_${counter}${finalExtension}`;
            counter++;
        }
        generatedNames.add(finalName);
        return finalName;
    }

    function sanitizeFilename(name) {
        return name.replace(/\s+/g, '_').replace(/[^\w-]/g, '').substring(0, 50);
    }

    function renderStickers() {
        // Сортируем стикеры по имени, чтобы они всегда были в одном порядке
        stickers.sort((a, b) => a.suggestedName.localeCompare(b.suggestedName));
        dom.stickerGrid.innerHTML = stickers.map(sticker => `
            <div class="sticker-card" data-id="${sticker.id}">
                <img src="${sticker.dataUrl}" alt="${sticker.suggestedName}">
                <div class="sticker-name" contenteditable="true" title="${translations.clickToEdit || 'Click to edit'}">${sticker.suggestedName}</div>
                <small class="original-name">Original: ${sticker.originalName}</small>
                <a href="${sticker.dataUrl}" download="${sticker.suggestedName}" class="download-link">${translations.download || 'Download'}</a>
            </div>
        `).join('');
    }

    function handleStickerGridClick(e) {
        if (e.target.classList.contains('sticker-name')) {
            const nameEl = e.target;
            nameEl.classList.add('editable');
            const selection = window.getSelection(), range = document.createRange();
            const text = nameEl.firstChild;
            if(text) {
                const dotIndex = text.textContent.lastIndexOf('.');
                range.setStart(text, 0); range.setEnd(text, dotIndex > -1 ? dotIndex : text.length);
                selection.removeAllRanges(); selection.addRange(range);
            }
        }
    }

    function handleStickerNameChange(e) {
        const nameEl = e.target;
        if (!nameEl.classList.contains('sticker-name')) return;
        nameEl.classList.remove('editable');
        const stickerId = nameEl.closest('.sticker-card').dataset.id;
        const sticker = stickers.find(s => s.id === stickerId);
        if (!sticker) return;

        const oldName = sticker.suggestedName;
        const extension = oldName.substring(oldName.lastIndexOf('.'));
        let newBaseName = sanitizeFilename(nameEl.textContent.replace(extension, ''));
        
        if (!newBaseName) { nameEl.textContent = oldName; return; }

        let newName = newBaseName + extension;
        let counter = 1;
        generatedNames.delete(oldName);
        while (generatedNames.has(newName)) { newName = `${newBaseName}_${counter}${extension}`; counter++; }
        
        sticker.suggestedName = newName;
        generatedNames.add(newName);
        nameEl.textContent = newName;
        const downloadLink = nameEl.closest('.sticker-card').querySelector('.download-link');
        downloadLink.download = newName;
    }

    async function handleBatchDownload(format) {
        if (stickers.length === 0) return;
        dom.zipStatus.classList.remove('hidden');
        dom.zipStatus.textContent = `${translations.creatingZip || 'Creating ZIP'}... ${translations.pleaseWait || 'Please wait.'}`;

        try {
            const zip = new JSZip();
            const folder = zip.folder("TelegramStickers");

            if (format === 'png') { for (const sticker of stickers) { folder.file(sticker.suggestedName, sticker.blob); }
            } else if (format === 'webp') {
                await Promise.all(stickers.map(async (sticker) => {
                    const webpBlob = await convertToWebP(sticker.dataUrl);
                    const webpName = sticker.suggestedName.replace(/\.png$/, '.webp');
                    folder.file(webpName, webpBlob);
                }));
            }

            const zipBlob = await zip.generateAsync({ type: "blob" });
            downloadBlob(zipBlob, `TelegramStickers_${format}.zip`);
            dom.zipStatus.textContent = `${translations.zipCreated || 'ZIP file created successfully!'}`;
        } catch (error) {
            console.error('ZIP creation failed:', error);
            dom.zipStatus.textContent = `${translations.zipError || 'Error creating ZIP file'}: ${error.message}`;
        }
    }

    async function convertToWebP(dataUrl) {
        const image = new Image();
        await new Promise(resolve => { image.onload = resolve; image.src = dataUrl; });
        const canvas = document.createElement('canvas');
        canvas.width = image.width; canvas.height = image.height;
        canvas.getContext('2d').drawImage(image, 0, 0);
        return new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.90));
    }
    
    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    }
});
