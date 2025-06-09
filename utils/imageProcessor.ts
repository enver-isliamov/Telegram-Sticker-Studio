
import { ProcessedSticker } from '../types';

export async function processImageForSticker(file: File, addOutline: boolean): Promise<ProcessedSticker> {
    return new Promise((resolve, reject) => {
        const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            reject(new Error(`Unsupported file type: ${file.type}. Use PNG, JPG, WEBP, or GIF.`));
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            if (!event.target?.result) {
                reject(new Error('FileReader did not load file content.'));
                return;
            }

            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                const MAX_DIMENSION = 500; // Longest side will be 500px
                const { width: oWidth, height: oHeight } = img;
                let targetWidth: number;
                let targetHeight: number;

                if (oWidth === 0 || oHeight === 0) {
                    reject(new Error('Image has zero dimension. Cannot process.'));
                    return;
                }

                // Always scale so the longest side is MAX_DIMENSION
                if (oWidth >= oHeight) { // Width is longest or image is square
                    targetWidth = MAX_DIMENSION;
                    targetHeight = oHeight * (MAX_DIMENSION / oWidth);
                } else { // Height is longest
                    targetHeight = MAX_DIMENSION;
                    targetWidth = oWidth * (MAX_DIMENSION / oHeight);
                }
                
                // Ensure dimensions are at least 1px and integers
                targetWidth = Math.max(1, Math.round(targetWidth));
                targetHeight = Math.max(1, Math.round(targetHeight));

                canvas.width = targetWidth;
                canvas.height = targetHeight;
                ctx.clearRect(0, 0, canvas.width, canvas.height);


                if (addOutline) {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = targetWidth;
                    tempCanvas.height = targetHeight;
                    const tempCtx = tempCanvas.getContext('2d');

                    if (tempCtx) {
                        // 1. Create a silhouette on tempCanvas (black shape on transparent background)
                        tempCtx.drawImage(img, 0, 0, targetWidth, targetHeight);
                        tempCtx.globalCompositeOperation = 'source-in';
                        tempCtx.fillStyle = 'black'; // Color of the silhouette
                        tempCtx.fillRect(0, 0, targetWidth, targetHeight);
                        // tempCanvas now has the silhouette.

                        ctx.save();
                        const darkStrokeColor = 'rgba(0, 0, 0, 0.65)'; // Slightly softer dark
                        const whiteStrokeColor = 'white';
                        const strokePixelWidth = 1; // Desired final pixel width of each stroke band

                        // 2. Draw DARK outer stroke using shadow effect
                        // The tempCanvas (silhouette) is drawn at 0,0. Its shadow appears offset.
                        ctx.shadowColor = darkStrokeColor;
                        ctx.shadowBlur = 0; // For sharp stroke
                        const s = strokePixelWidth * 2; // Dark stroke is "wider", appears behind white
                        const outerOffsets = [
                            [-s, -s], [0, -s], [s, -s], [-s, 0], [s, 0], [-s, s], [0, s], [s, s]
                        ];
                        for (const [dx, dy] of outerOffsets) {
                            ctx.shadowOffsetX = dx;
                            ctx.shadowOffsetY = dy;
                            ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);
                        }
                        
                        // 3. Draw WHITE inner stroke using shadow effect
                        ctx.shadowColor = whiteStrokeColor;
                        const w = strokePixelWidth;
                        const innerOffsets = [
                           [-w, -w], [0, -w], [w, -w], [-w, 0], [w, 0], [-w, w], [0, w], [w, w]
                        ];
                        for (const [dx, dy] of innerOffsets) {
                            ctx.shadowOffsetX = dx;
                            ctx.shadowOffsetY = dy;
                            ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);
                        }
                        ctx.restore(); // Clears shadow settings
                    }
                }

                // 4. Draw the original image on top of everything
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Canvas toBlob failed: resulted in null blob.'));
                            return;
                        }
                        
                        const MAX_SIZE_KB = 512;
                        if (blob.size > MAX_SIZE_KB * 1024) {
                            console.warn(`Processed image ${file.name} is ${Math.round(blob.size / 1024)}KB. This may exceed Telegram's ${MAX_SIZE_KB}KB limit for stickers.`);
                        }
                        
                        const dataUrl = canvas.toDataURL('image/png'); 
                        resolve({ dataUrl, blob, filename: file.name });
                    },
                    'image/png', 
                    0.92 // Quality for PNG (often relates to compression effort not visual quality)
                );
            };
            img.onerror = (e) => reject(new Error(`Failed to load image: ${file.name}. Ensure it's a valid image file.`));
            img.src = event.target.result as string;
        };
        reader.onerror = () => reject(new Error(`FileReader failed for file: ${file.name}`));
        reader.readAsDataURL(file);
    });
}
