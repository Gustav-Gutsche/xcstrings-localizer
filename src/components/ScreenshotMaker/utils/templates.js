// =============================================================================
// Templates — built-in presets and custom template persistence
// =============================================================================

const STORAGE_KEY = 'appscreen-custom-templates';

// =============================================================================
// Built-in Templates
// =============================================================================

export const BUILT_IN_TEMPLATES = [
  {
    id: 'minimal-light',
    name: 'Minimal Light',
    category: 'minimal',
    preview: { gradient: ['#ffffff', '#f5f5f7'] },
    background: { type: 'gradient', gradient: { angle: 180, stops: [{ color: '#ffffff', position: 0 }, { color: '#f5f5f7', position: 100 }] }, noise: false, noiseIntensity: 0, solid: '#ffffff', image: null, imageFit: 'cover', imageBlur: 0, overlayColor: '#000000', overlayOpacity: 0 },
    screenshot: { scale: 65, y: 60, x: 50, rotation: 0, cornerRadius: 24, use3D: false, shadow: { enabled: true, color: '#000000', blur: 60, opacity: 15, x: 0, y: 30 }, frame: { enabled: false, color: '#1d1d1f', width: 12, opacity: 100 } },
    text: { headlineSize: 90, headlineWeight: '700', headlineColor: '#1d1d1f', textAlign: 'center', position: 'top', offsetY: 10, offsetX: 0, lineHeight: 110, subheadlineSize: 45, subheadlineWeight: '400', subheadlineColor: '#86868b', subheadlineOpacity: 100, headlineFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'", subheadlineFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'" },
  },
  {
    id: 'bold-gradient',
    name: 'Bold Gradient',
    category: 'gradient',
    preview: { gradient: ['#667eea', '#764ba2'] },
    background: { type: 'gradient', gradient: { angle: 135, stops: [{ color: '#667eea', position: 0 }, { color: '#764ba2', position: 100 }] }, noise: false, noiseIntensity: 0, solid: '#667eea', image: null, imageFit: 'cover', imageBlur: 0, overlayColor: '#000000', overlayOpacity: 0 },
    screenshot: { scale: 70, y: 55, x: 50, rotation: 0, cornerRadius: 24, use3D: false, shadow: { enabled: true, color: '#000000', blur: 40, opacity: 30, x: 0, y: 20 }, frame: { enabled: false, color: '#1d1d1f', width: 12, opacity: 100 } },
    text: { headlineSize: 100, headlineWeight: '600', headlineColor: '#ffffff', textAlign: 'center', position: 'top', offsetY: 12, offsetX: 0, lineHeight: 110, subheadlineSize: 50, subheadlineWeight: '400', subheadlineColor: '#ffffff', subheadlineOpacity: 70, headlineFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'", subheadlineFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'" },
  },
  {
    id: 'dark-minimal',
    name: 'Dark Minimal',
    category: 'dark',
    preview: { gradient: ['#1a1a2e', '#16213e'] },
    background: { type: 'gradient', gradient: { angle: 180, stops: [{ color: '#1a1a2e', position: 0 }, { color: '#16213e', position: 100 }] }, noise: false, noiseIntensity: 0, solid: '#1a1a2e', image: null, imageFit: 'cover', imageBlur: 0, overlayColor: '#000000', overlayOpacity: 0 },
    screenshot: { scale: 68, y: 58, x: 50, rotation: 0, cornerRadius: 28, use3D: false, shadow: { enabled: true, color: '#000000', blur: 50, opacity: 40, x: 0, y: 25 }, frame: { enabled: false, color: '#ffffff', width: 2, opacity: 20 } },
    text: { headlineSize: 95, headlineWeight: '700', headlineColor: '#ffffff', textAlign: 'center', position: 'top', offsetY: 10, offsetX: 0, lineHeight: 115, subheadlineSize: 45, subheadlineWeight: '400', subheadlineColor: '#a1a1a6', subheadlineOpacity: 80, headlineFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'", subheadlineFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'" },
  },
  {
    id: 'sunset-warm',
    name: 'Sunset Warm',
    category: 'gradient',
    preview: { gradient: ['#fa709a', '#fee140'] },
    background: { type: 'gradient', gradient: { angle: 135, stops: [{ color: '#fa709a', position: 0 }, { color: '#fee140', position: 100 }] }, noise: false, noiseIntensity: 0, solid: '#fa709a', image: null, imageFit: 'cover', imageBlur: 0, overlayColor: '#000000', overlayOpacity: 0 },
    screenshot: { scale: 65, y: 55, x: 50, rotation: 0, cornerRadius: 20, use3D: false, shadow: { enabled: true, color: '#000000', blur: 35, opacity: 25, x: 0, y: 15 }, frame: { enabled: false, color: '#1d1d1f', width: 12, opacity: 100 } },
    text: { headlineSize: 100, headlineWeight: '800', headlineColor: '#ffffff', textAlign: 'center', position: 'top', offsetY: 12, offsetX: 0, lineHeight: 110, subheadlineSize: 48, subheadlineWeight: '400', subheadlineColor: '#ffffff', subheadlineOpacity: 80, headlineFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'", subheadlineFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'" },
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    category: 'gradient',
    preview: { gradient: ['#4facfe', '#00f2fe'] },
    background: { type: 'gradient', gradient: { angle: 135, stops: [{ color: '#4facfe', position: 0 }, { color: '#00f2fe', position: 100 }] }, noise: false, noiseIntensity: 0, solid: '#4facfe', image: null, imageFit: 'cover', imageBlur: 0, overlayColor: '#000000', overlayOpacity: 0 },
    screenshot: { scale: 70, y: 55, x: 50, rotation: 0, cornerRadius: 24, use3D: false, shadow: { enabled: true, color: '#000000', blur: 40, opacity: 30, x: 0, y: 20 }, frame: { enabled: false, color: '#1d1d1f', width: 12, opacity: 100 } },
    text: { headlineSize: 95, headlineWeight: '700', headlineColor: '#ffffff', textAlign: 'center', position: 'top', offsetY: 11, offsetX: 0, lineHeight: 115, subheadlineSize: 46, subheadlineWeight: '400', subheadlineColor: '#ffffff', subheadlineOpacity: 75, headlineFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'", subheadlineFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'" },
  },
  {
    id: 'forest-green',
    name: 'Forest Green',
    category: 'gradient',
    preview: { gradient: ['#13547a', '#80d0c7'] },
    background: { type: 'gradient', gradient: { angle: 135, stops: [{ color: '#13547a', position: 0 }, { color: '#80d0c7', position: 100 }] }, noise: false, noiseIntensity: 0, solid: '#13547a', image: null, imageFit: 'cover', imageBlur: 0, overlayColor: '#000000', overlayOpacity: 0 },
    screenshot: { scale: 70, y: 55, x: 50, rotation: 0, cornerRadius: 24, use3D: false, shadow: { enabled: true, color: '#000000', blur: 40, opacity: 30, x: 0, y: 20 }, frame: { enabled: false, color: '#1d1d1f', width: 12, opacity: 100 } },
    text: { headlineSize: 95, headlineWeight: '600', headlineColor: '#ffffff', textAlign: 'center', position: 'top', offsetY: 12, offsetX: 0, lineHeight: 110, subheadlineSize: 48, subheadlineWeight: '400', subheadlineColor: '#ffffff', subheadlineOpacity: 70, headlineFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'", subheadlineFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'" },
  },
  {
    id: 'sleek-noir',
    name: 'Sleek Noir',
    category: 'dark',
    preview: { gradient: ['#434343', '#000000'] },
    background: { type: 'gradient', gradient: { angle: 135, stops: [{ color: '#434343', position: 0 }, { color: '#000000', position: 100 }] }, noise: true, noiseIntensity: 5, solid: '#000000', image: null, imageFit: 'cover', imageBlur: 0, overlayColor: '#000000', overlayOpacity: 0 },
    screenshot: { scale: 65, y: 60, x: 50, rotation: 0, cornerRadius: 30, use3D: false, shadow: { enabled: true, color: '#000000', blur: 60, opacity: 50, x: 0, y: 30 }, frame: { enabled: true, color: '#333333', width: 2, opacity: 60 } },
    text: { headlineSize: 90, headlineWeight: '700', headlineColor: '#ffffff', textAlign: 'center', position: 'top', offsetY: 10, offsetX: 0, lineHeight: 115, subheadlineSize: 44, subheadlineWeight: '300', subheadlineColor: '#999999', subheadlineOpacity: 100, headlineFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'", subheadlineFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'" },
  },
  {
    id: 'playful-pink',
    name: 'Playful Pink',
    category: 'gradient',
    preview: { gradient: ['#ff758c', '#ff7eb3'] },
    background: { type: 'gradient', gradient: { angle: 135, stops: [{ color: '#ff758c', position: 0 }, { color: '#ff7eb3', position: 100 }] }, noise: false, noiseIntensity: 0, solid: '#ff758c', image: null, imageFit: 'cover', imageBlur: 0, overlayColor: '#000000', overlayOpacity: 0 },
    screenshot: { scale: 68, y: 56, x: 50, rotation: 0, cornerRadius: 22, use3D: false, shadow: { enabled: true, color: '#000000', blur: 35, opacity: 20, x: 0, y: 18 }, frame: { enabled: false, color: '#1d1d1f', width: 12, opacity: 100 } },
    text: { headlineSize: 100, headlineWeight: '800', headlineColor: '#ffffff', textAlign: 'center', position: 'top', offsetY: 12, offsetX: 0, lineHeight: 108, subheadlineSize: 48, subheadlineWeight: '400', subheadlineColor: '#ffffff', subheadlineOpacity: 80, headlineFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'", subheadlineFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'" },
  },
];

// =============================================================================
// Custom Template Persistence
// =============================================================================

/**
 * Saves the current screenshot's styling as a custom template to localStorage.
 * Extracts background, screenshot settings, and text styling (not content)
 * from the given screenshot object.
 *
 * @param {string} name - Display name for the template
 * @param {object} screenshot - The current screenshot object from state
 * @returns {object} The saved template object
 */
export function saveCustomTemplate(name, screenshot) {
  const { background, screenshot: ssSettings, text } = screenshot;

  // Extract text styling only (exclude content like headlines/subheadlines)
  const {
    headlines: _h,
    subheadlines: _s,
    ...textStyle
  } = JSON.parse(JSON.stringify(text || {}));

  // Build preview from background gradient or solid color
  let previewGradient = ['#cccccc', '#999999'];
  if (background?.type === 'gradient' && background.gradient?.stops?.length >= 2) {
    previewGradient = [
      background.gradient.stops[0].color,
      background.gradient.stops[background.gradient.stops.length - 1].color,
    ];
  } else if (background?.solid) {
    previewGradient = [background.solid, background.solid];
  }

  const template = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    category: 'custom',
    preview: { gradient: previewGradient },
    background: JSON.parse(JSON.stringify(background || {})),
    screenshot: JSON.parse(JSON.stringify(ssSettings || {})),
    text: textStyle,
  };

  const existing = loadCustomTemplates();
  existing.push(template);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

  return template;
}

/**
 * Loads custom templates from localStorage.
 *
 * @returns {Array} Array of custom template objects
 */
export function loadCustomTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Removes a custom template from localStorage by id.
 *
 * @param {string} id - The template id to remove
 */
export function deleteCustomTemplate(id) {
  const templates = loadCustomTemplates();
  const filtered = templates.filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}
