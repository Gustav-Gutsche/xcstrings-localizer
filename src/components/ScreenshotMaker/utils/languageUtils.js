// Language utilities for localized screenshot management
// Pure utility functions migrated from vanilla JS language-utils.js

import { languageFlags } from '../constants';

/**
 * Extract the base filename without language suffix.
 * e.g., "screenshot_de.png" -> "screenshot", "image-fr.png" -> "image"
 * @param {string} filename - The filename to parse
 * @returns {string} Base filename without language suffix and extension
 */
export function getBaseFilename(filename) {
  // Remove extension
  const withoutExt = filename.replace(/\.[^.]+$/, '');

  // All supported language codes from languageFlags
  const supportedLangs = Object.keys(languageFlags);

  // Sort by length (longest first) to match pt-br before pt
  const sortedLangs = [...supportedLangs].sort((a, b) => b.length - a.length);

  for (const lang of sortedLangs) {
    // Match patterns like: _pt-br, -pt-br, _pt_br, -pt_br, _de, -de
    const escapedLang = lang.replace('-', '[-_]?');
    const pattern = new RegExp(`[_-]${escapedLang}(?:[_-][a-z]{2})?$`, 'i');
    if (pattern.test(withoutExt)) {
      return withoutExt.replace(pattern, '');
    }
  }

  return withoutExt;
}

/**
 * Detect language code from filename.
 * Supports patterns like: screenshot_de.png, screenshot-fr.png, screenshot_pt-br.png
 * @param {string} filename - The filename to parse
 * @param {string[]} [supportedLangs] - Array of supported language codes. Defaults to languageFlags keys.
 * @returns {string} Language code (e.g., 'de', 'fr', 'pt-br') or 'en' as fallback
 */
export function detectLanguageFromFilename(filename, supportedLangs) {
  const langs = supportedLangs || Object.keys(languageFlags);

  // Normalize filename for matching
  const lower = filename.toLowerCase();

  // Check for longer codes first (pt-br, zh-tw, en-gb) to avoid false matches
  const sortedLangs = [...langs].sort((a, b) => b.length - a.length);

  for (const lang of sortedLangs) {
    // Match patterns like: _pt-br., -pt-br., _pt_br., -pt_br.
    // Also: _de., -de., _DE., -DE., _de-DE., etc.
    const escapedLang = lang.replace('-', '[-_]?');
    const pattern = new RegExp(`[_-]${escapedLang}(?:[_-][a-z]{2})?\\.`, 'i');
    if (pattern.test(lower)) {
      return lang;
    }
  }

  return 'en'; // fallback to English
}

/**
 * Get the appropriate image for a screenshot based on current language.
 * Falls back to first available language if current language has no image.
 * @param {Object} screenshot - The screenshot object
 * @param {string} currentLanguage - The current language code
 * @param {string[]} projectLanguages - Array of project language codes in order
 * @returns {Image|null} The Image object to use for rendering
 */
export function getScreenshotImage(screenshot, currentLanguage, projectLanguages) {
  if (!screenshot) return null;

  // Try current language first
  if (screenshot.localizedImages?.[currentLanguage]?.image) {
    return screenshot.localizedImages[currentLanguage].image;
  }

  // Fallback to first available language in project order
  for (const lang of projectLanguages) {
    if (screenshot.localizedImages?.[lang]?.image) {
      return screenshot.localizedImages[lang].image;
    }
  }

  // Fallback to any available language
  if (screenshot.localizedImages) {
    for (const lang of Object.keys(screenshot.localizedImages)) {
      if (screenshot.localizedImages[lang]?.image) {
        return screenshot.localizedImages[lang].image;
      }
    }
  }

  // Legacy fallback for old screenshot format
  return screenshot.image || null;
}

/**
 * Get list of languages that have images for a screenshot.
 * @param {Object} screenshot - The screenshot object
 * @returns {string[]} Array of language codes that have images
 */
export function getAvailableLanguagesForScreenshot(screenshot) {
  if (!screenshot?.localizedImages) return [];

  return Object.keys(screenshot.localizedImages).filter(
    (lang) => screenshot.localizedImages[lang]?.image
  );
}

/**
 * Check if a screenshot has images for all project languages.
 * @param {Object} screenshot - The screenshot object
 * @param {string[]} projectLanguages - Array of project language codes
 * @returns {boolean} True if all project languages have images
 */
export function isScreenshotComplete(screenshot, projectLanguages) {
  if (!screenshot?.localizedImages) return false;
  if (projectLanguages.length === 0) return true;

  return projectLanguages.every(
    (lang) => screenshot.localizedImages[lang]?.image
  );
}

/**
 * Migrate old screenshot format to new localized format.
 * Moves image to localizedImages under the detected language key.
 * @param {Object} screenshot - The screenshot object to migrate
 * @param {string} [detectedLang='en'] - Detected language from filename
 */
export function migrateScreenshotToLocalized(screenshot, detectedLang = 'en') {
  if (!screenshot) return;

  // Already migrated
  if (screenshot.localizedImages && Object.keys(screenshot.localizedImages).length > 0) {
    return;
  }

  // Initialize localizedImages if needed
  if (!screenshot.localizedImages) {
    screenshot.localizedImages = {};
  }

  // Move legacy image to localized storage
  if (screenshot.image) {
    screenshot.localizedImages[detectedLang] = {
      image: screenshot.image,
      src: screenshot.image.src,
      name: screenshot.name || 'screenshot.png',
    };
  }
}

/**
 * Get data URL for a screenshot image in a specific language, with fallbacks.
 * @param {Object} screenshot - The screenshot object
 * @param {string} lang - The desired language code
 * @param {string[]} projectLanguages - Array of project language codes in order
 * @returns {string|null} Data URL string or null if no image is available
 */
export function getScreenshotDataUrl(screenshot, lang, projectLanguages) {
  if (!screenshot) return null;

  // Try requested language first
  if (screenshot.localizedImages?.[lang]?.src) {
    return screenshot.localizedImages[lang].src;
  }

  // Fallback to first available language in project order
  for (const l of projectLanguages) {
    if (screenshot.localizedImages?.[l]?.src) {
      return screenshot.localizedImages[l].src;
    }
  }

  // Fallback to any available language
  if (screenshot.localizedImages) {
    for (const l of Object.keys(screenshot.localizedImages)) {
      if (screenshot.localizedImages[l]?.src) {
        return screenshot.localizedImages[l].src;
      }
    }
  }

  // Legacy fallback
  if (screenshot.image?.src) {
    return screenshot.image.src;
  }

  return null;
}
