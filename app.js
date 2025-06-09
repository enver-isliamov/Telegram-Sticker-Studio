import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

document.addEventListener('DOMContentLoaded', () => {
    // === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И СОСТОЯНИЕ ===
    const dom = {
        apiKeyInput: document.getElementById('api-key-input'),
        saveApiKeyBtn: document.getElementById('save-api-key-btn'),
        apiKeyStatus: document.getElementById('api-key-status'),
        selectFolderBtn: document.getElementById('select-folder-btn'),
        fileInput: document.getElementById('file-input'),
        addOutlineToggle: document.getElementById('add-outline-toggle'),
        keepFilenamesToggle: document.getElementById('keep-filenames-toggle'),
        statusArea: document.getElementById('status-area'),
        generalStatus: document.getElementById('general-status'),
        fileStatusList: document.getElementById('file-status-list'),
        stickerGrid: document.getElementById('sticker-grid'),
        downloadButtons: document.getElementById('download-buttons'),
        downloadPngBtn: document.getElementById('download-png-btn'),
        downloadWebpBtn: document.getElementById('download-webp-btn'),
        zipStatus: document.getElementById('zip-status'),
        langButtons: document.querySelectorAll('.lang-selector button')
    };

    let stickers = [];
    let generatedNames = new Set();
    let apiKey = null;
    let geminiAI = null;
    let translations = {};

    // === ИНИЦИАЛИЗАЦИЯ ===
    dom.selectFolderBtn.addEventListener('click', () => dom.fileInput.click());
    dom.fileInput.addEventListener('change', handleFileSelection);
    dom.saveApiKeyBtn.addEventListener('click', handleApiKeySave);
    dom.downloadPngBtn.addEventListener('click', () => handleBatchDownload('png'));
    dom.downloadWebpBtn.addEventListener('click', () => handleBatchDownload('webp'));
    dom.langButtons.forEach(btn => btn.addEventListener('click', (e) => loadLanguage(e.target.dataset.lang)));
    dom.stickerGrid.addEventListener('click', handleStickerGridClick);
    dom.stickerGrid.addEventListener('focusout', handleStickerNameChange);
    dom.stickerGrid.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleStickerNameChange(e);
            e.target.blur();
        }
    });

    loadLanguage('en');

    // === I18N (Интернационализация) ===
    async function loadLanguage(lang) {
        try {
            const response = await fetch(`i18n/${lang}.json`);
            if (!response.ok) throw new Error('Language file not found');
            translations = await response.json();
        } catch (error) {
            console.warn(`Could not load language ${lang}, falling back to English.`, error);
            const response = await fetch('i18n/en.json');
            translations = await response.json();
        } finally {
            updateUIText();
        }
    }

    function updateUIText() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            if (translations[key]) {
                el.textContent = translations[key];
            }
        });
    }

    // === УПРАВЛЕНИЕ API КЛЮЧОМ ===
    function handleApiKeySave() {
        const key = dom.apiKeyInput.value.trim();
        if (!key) {
            apiKey = null;
            geminiAI = null;
            dom.apiKeyStatus.textContent = translations.apiKeyNotice || 'AI naming is disabled.';
            dom.apiKeyStatus.className = '';
            return;
        }
        try {
            apiKey = key;
            geminiAI = new GoogleGenerativeAI(apiKey);
            dom.apiKeyStatus.textContent = 'API Key saved. AI naming is enabled. ✨';
            dom.apiKeyStatus.className = 'success';
        } catch (error) {
            apiKey = null;
            geminiAI = null;
            dom.apiKeyStatus.textContent = `Error initializing API: ${error.message}`;
            dom.apiKeyStatus.className = 'error';
            console.error('Gemini AI Init Error:', error);
        }
    }

    // === ОСНОВНОЙ КОНВЕЙЕР ОБРАБОТКИ ФАЙЛОВ ===
    async function handleFileSelection(event) {
        const files = event.target.files;
        if (files.length === 0) return;

        resetUI();
        dom.statusArea.classList.remove('hidden');
        dom.generalStatus.textContent = `Processing ${files.length} files...`;

        const processingPromises = Array.from(files).map(processFile);
        
        await Promise.all(processingPromises);
        
        dom.generalStatus.textContent = `Processing complete. ${stickers.length} stickers generated.`;
        renderStickers();

        if (stickers.length > 0) {
            dom.downloadButtons.classList.remove('hidden');
        }
    }

    function resetUI() {
        stickers = [];
        generatedNames.clear();
        dom.stickerGrid.innerHTML = '';
        dom.fileStatusList.innerHTML = '';
        dom.downloadButtons.classList.add('hidden');
        dom.zipStatus.classList.add('hidden');
    }

    // === ОБРАБОТКА ИЗОБРАЖЕНИЙ ===
    async function processFile(file) {
        const statusEl = document.createElement('li');
        statusEl.textContent = `${file.name}: Queued...`;
        dom.fileStatusList.appendChild(statusEl);

        const supportedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
        if (!supportedTypes.includes(file.type)) {
            statusEl.textContent = `${file.name}: ❌ Error: Unsupported file type.`;
            return;
        }

        try {
            statusEl.textContent = `${file.name}: Processing...`;
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
                 console.warn(`${file.name} is larger than 512KB (${(blob.size / 1024).toFixed(1)}KB), Telegram may reject it.`);
            }

            let nameStatus = '';
            const { name: suggestedName, status } = await getStickerName(file);
            nameStatus = status;
            
            statusEl.textContent = `${file.name}: ✅ Done. ${nameStatus}`;
            
            stickers.push({
                id: `${file.name}-${Date.now()}`,
                originalName: file.name,
                suggestedName,
                dataUrl,
                blob
            });

        } catch (error) {
            console.error(`Failed to process ${file.name}:`, error);
            statusEl.textContent = `${file.name}: ❌ Error: ${error.message}`;
        }
    }

    function getResizedDimensions(origWidth, origHeight, maxSize) {
        let width = origWidth;
        let height = origHeight;

        if (width > height) {
            if (width > maxSize) {
                height = Math.round(height * (maxSize / width));
                width = maxSize;
            }
        } else {
            if (height > maxSize) {
                width = Math.round(width * (maxSize / height));
                height = maxSize;
            }
        }
        return { width: Math.max(1, width), height: Math.max(1, height) };
    }

    function addTelegramOutline(ctx, image, width, height) {
        const silhouetteCanvas = document.createElement('canvas');
        silhouetteCanvas.width = width;
        silhouetteCanvas.height = height;
        const silhouetteCtx = silhouetteCanvas.getContext('2d');
        silhouetteCtx.drawImage(image, 0, 0, width, height);
        silhouetteCtx.globalCompositeOperation = 'source-in';
        silhouetteCtx.fillStyle = 'black';
        silhouetteCtx.fillRect(0, 0, width, height);
        
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 4;
        for (let i = 0; i < 4; i++) {
             ctx.drawImage(silhouetteCanvas, 0, 0);
        }
        ctx.restore();

        ctx.save();
        ctx.shadowColor = 'white';
        ctx.shadowBlur = 2;
        for (let i = 0; i < 8; i++) {
             ctx.drawImage(silhouetteCanvas, 0, 0);
        }
        ctx.restore();
    }
    
    // === ЛОГИКА ИМЕНОВАНИЯ ===
    async function getStickerName(file) {
        const originalBaseName = file.name.substring(0, file.name.lastIndexOf('.'));
        const finalExtension = '.png';

        let baseName = sanitizeFilename(originalBaseName);
        let status = 'Using sanitized filename.';

        if (!dom.keepFilenamesToggle.checked) {
            const prefix = String(stickers.length + 1).padStart(3, '0') + '_';
            
            if (geminiAI) {
                try {
                    const model = geminiAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
                    const prompt = `Suggest a very short, fun, unique name for a sticker. The original filename is "${originalBaseName}". The name should be 1-3 English words, alphanumeric with underscores. Be creative and quick. Example: "CuteCat".`;
                    const result = await model.generateContent(prompt);
                    const response = await result.response;
                    const aiName = response.text().trim();
                    
                    if (aiName) {
                        baseName = sanitizeFilename(aiName);
                        status = '✨ Named by AI.';
                    } else {
                       throw new Error("AI returned empty name.");
                    }
                } catch (err) {
                    console.error('AI Naming Error:', err);
                    status = 'AI name failed, using original filename.';
                }
            } else {
                 status = 'Using original filename (AI disabled).';
            }
            baseName = prefix + baseName;
        }

        let finalName = baseName + finalExtension;
        let counter = 1;
        while (generatedNames.has(finalName)) {
            finalName = `${baseName}_${counter}${finalExtension}`;
            counter++;
        }
        generatedNames.add(finalName);

        return { name: finalName, status };
    }

    function sanitizeFilename(name) {
        return name
            .replace(/\s+/g, '_')
            .replace(/[^\w-]/g, '')
            .substring(0, 60);
    }

    // === РЕНДЕРИНГ И ВЗАИМОДЕЙСТВИЕ С UI ===
    function renderStickers() {
        dom.stickerGrid.innerHTML = stickers.map(sticker => `
            <div class="sticker-card" data-id="${sticker.id}">
                <img src="${sticker.dataUrl}" alt="${sticker.suggestedName}">
                <div class="sticker-name" contenteditable="false" title="Click to edit">${sticker.suggestedName}</div>
                <small class="original-name">Original: ${sticker.originalName}</small>
                <a href="${sticker.dataUrl}" download="${sticker.suggestedName}" class="download-link">Download</a>
            </div>
        `).join('');
    }

    function handleStickerGridClick(e) {
        if (e.target.classList.contains('sticker-name') && !dom.keepFilenamesToggle.checked) {
            const nameEl = e.target;
            nameEl.contentEditable = true;
            nameEl.classList.add('editable');
            nameEl.focus();
            const selection = window.getSelection();
            const range = document.createRange();
            const text = nameEl.firstChild;
            const dotIndex = text.textContent.lastIndexOf('.');
            range.setStart(text, 0);
            range.setEnd(text, dotIndex > -1 ? dotIndex : text.length);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    function handleStickerNameChange(e) {
        const nameEl = e.target;
        if (!nameEl.classList.contains('sticker-name') || nameEl.contentEditable === 'false') return;

        nameEl.contentEditable = false;
        nameEl.classList.remove('editable');

        const stickerId = nameEl.closest('.sticker-card').dataset.id;
        const sticker = stickers.find(s => s.id === stickerId);
        if (!sticker) return;

        const oldName = sticker.suggestedName;
        const extension = oldName.substring(oldName.lastIndexOf('.'));
        let newBaseName = sanitizeFilename(nameEl.textContent.replace(extension, ''));
        
        if (!newBaseName) {
            nameEl.textContent = oldName;
            return;
        }

        let newName = newBaseName + extension;
        let counter = 1;
        generatedNames.delete(oldName);
        while (generatedNames.has(newName)) {
            newName = `${newBaseName}_${counter}${extension}`;
            counter++;
        }
        
        sticker.suggestedName = newName;
        generatedNames.add(newName);

        nameEl.textContent = newName;
        const downloadLink = nameEl.closest('.sticker-card').querySelector('.download-link');
        downloadLink.download = newName;
    }

    // === ПАКЕТНАЯ ЗАГРУЗКА ===
    async function handleBatchDownload(format) {
        if (stickers.length === 0) return;

        dom.zipStatus.classList.remove('hidden');
        dom.zipStatus.textContent = `Creating ${format.toUpperCase()} ZIP... Please wait.`;

        try {
            const zip = new JSZip();
            const folder = zip.folder("TelegramStickers");

            if (format === 'png') {
                for (const sticker of stickers) {
                    folder.file(sticker.suggestedName, sticker.blob);
                }
            } else if (format === 'webp') {
                const conversionPromises = stickers.map(async (sticker) => {
                    const webpBlob = await convertToWebP(sticker.dataUrl);
                    const webpName = sticker.suggestedName.replace(/\.png$/, '.webp');
                    folder.file(webpName, webpBlob);
                });
                await Promise.all(conversionPromises);
            }

            const zipBlob = await zip.generateAsync({ type: "blob" });
            downloadBlob(zipBlob, `TelegramStickers_${format}.zip`);
            dom.zipStatus.textContent = `ZIP file created successfully!`;
        } catch (error) {
            console.error('ZIP creation failed:', error);
            dom.zipStatus.textContent = `Error creating ZIP file: ${error.message}`;
        }
    }

    async function convertToWebP(dataUrl) {
        const image = new Image();
        await new Promise(resolve => {
            image.onload = resolve;
            image.src = dataUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        return new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.90));
    }
    
    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
});
