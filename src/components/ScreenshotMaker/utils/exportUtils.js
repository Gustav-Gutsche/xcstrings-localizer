import JSZip from 'jszip';

/**
 * Wraps canvas.toBlob in a Promise.
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<Blob>}
 */
export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to convert canvas to blob'));
      }
    }, 'image/png');
  });
}

/**
 * Creates an object URL, triggers a download via a temporary link, then revokes the URL.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Returns a sanitised filename for a screenshot.
 * Uses the name from the first localised image entry when available,
 * otherwise falls back to "screenshot_N.png".
 * @param {object} screenshot
 * @param {number} index - zero-based index used for the fallback name
 * @returns {string}
 */
function getScreenshotFilename(screenshot, index) {
  const localizedImages = screenshot?.localizedImages || screenshot?.images;
  if (localizedImages && typeof localizedImages === 'object') {
    const keys = Object.keys(localizedImages);
    if (keys.length > 0) {
      const firstEntry = localizedImages[keys[0]];
      const name = firstEntry?.name || firstEntry?.filename;
      if (name) {
        // Ensure the name ends with .png
        return name.endsWith('.png') ? name : `${name}.png`;
      }
    }
  }
  return `screenshot_${index + 1}.png`;
}

/**
 * Downloads a single screenshot canvas as a PNG file.
 * @param {HTMLCanvasElement} canvas
 * @param {string} filename
 * @returns {Promise<void>}
 */
export async function exportScreenshot(canvas, filename) {
  const blob = await canvasToBlob(canvas);
  downloadBlob(blob, filename);
}

/**
 * Exports all screenshots for a specific language as a ZIP file.
 *
 * @param {Array} screenshots - Array of screenshot objects
 * @param {string} language - Language code to export
 * @param {number} outputWidth - Width of the output canvas
 * @param {number} outputHeight - Height of the output canvas
 * @param {Function} renderFn - (canvas, screenshot, width, height, language) => Promise<void>
 * @param {Function} [onProgress] - (current, total) => void
 * @returns {Promise<void>}
 */
export async function exportAllForLanguage(
  screenshots,
  language,
  outputWidth,
  outputHeight,
  renderFn,
  onProgress
) {
  const zip = new JSZip();
  const total = screenshots.length;

  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = outputWidth;
  offscreenCanvas.height = outputHeight;

  for (let i = 0; i < screenshots.length; i++) {
    await renderFn(offscreenCanvas, screenshots[i], outputWidth, outputHeight, language);

    const blob = await canvasToBlob(offscreenCanvas);
    const filename = getScreenshotFilename(screenshots[i], i);
    zip.file(filename, blob);

    if (onProgress) {
      onProgress(i + 1, total);
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  downloadBlob(content, `screenshots-${language}.zip`);
}

/**
 * Exports all screenshots for all languages as a ZIP with language-named folders.
 *
 * @param {Array} screenshots - Array of screenshot objects
 * @param {Array<string>} languages - Array of language codes
 * @param {number} outputWidth - Width of the output canvas
 * @param {number} outputHeight - Height of the output canvas
 * @param {Function} renderFn - (canvas, screenshot, width, height, language) => Promise<void>
 * @param {Function} [onProgress] - (current, total) => void
 * @returns {Promise<void>}
 */
export async function exportAllLanguages(
  screenshots,
  languages,
  outputWidth,
  outputHeight,
  renderFn,
  onProgress
) {
  const zip = new JSZip();
  const total = languages.length * screenshots.length;
  let completed = 0;

  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = outputWidth;
  offscreenCanvas.height = outputHeight;

  for (const language of languages) {
    for (let i = 0; i < screenshots.length; i++) {
      await renderFn(offscreenCanvas, screenshots[i], outputWidth, outputHeight, language);

      const blob = await canvasToBlob(offscreenCanvas);
      const filename = getScreenshotFilename(screenshots[i], i);
      zip.file(`${language}/${filename}`, blob);

      completed++;
      if (onProgress) {
        onProgress(completed, total);
      }
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  downloadBlob(content, 'screenshots-all-languages.zip');
}
