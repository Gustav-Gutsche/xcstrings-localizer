import { useReducer, useRef, useEffect, useCallback } from 'react';
import { DEFAULT_STATE } from '../constants';
import {
  openDatabase,
  saveProjectState,
  loadProjectState,
  serializeState,
  deserializeState,
  loadImagesForState,
} from '../utils/persistence';

// =============================================================================
// Action Types
// =============================================================================
export const SET_SCREENSHOTS = 'SET_SCREENSHOTS';
export const ADD_SCREENSHOT = 'ADD_SCREENSHOT';
export const REMOVE_SCREENSHOT = 'REMOVE_SCREENSHOT';
export const SELECT_SCREENSHOT = 'SELECT_SCREENSHOT';
export const REORDER_SCREENSHOTS = 'REORDER_SCREENSHOTS';
export const SET_BACKGROUND = 'SET_BACKGROUND';
export const SET_SCREENSHOT_SETTING = 'SET_SCREENSHOT_SETTING';
export const SET_TEXT_SETTING = 'SET_TEXT_SETTING';
export const SET_OUTPUT_DEVICE = 'SET_OUTPUT_DEVICE';
export const SET_CUSTOM_DIMENSIONS = 'SET_CUSTOM_DIMENSIONS';
export const SET_CURRENT_LANGUAGE = 'SET_CURRENT_LANGUAGE';
export const SET_PROJECT_LANGUAGES = 'SET_PROJECT_LANGUAGES';
export const ADD_PROJECT_LANGUAGE = 'ADD_PROJECT_LANGUAGE';
export const REMOVE_PROJECT_LANGUAGE = 'REMOVE_PROJECT_LANGUAGE';
export const SET_DEFAULTS = 'SET_DEFAULTS';
export const LOAD_STATE = 'LOAD_STATE';
export const RESET_STATE = 'RESET_STATE';
export const SET_LOCALIZED_IMAGE = 'SET_LOCALIZED_IMAGE';
export const REMOVE_LOCALIZED_IMAGE = 'REMOVE_LOCALIZED_IMAGE';
export const APPLY_STYLE_TO_ALL = 'APPLY_STYLE_TO_ALL';
export const TRANSFER_STYLE = 'TRANSFER_STYLE';
export const SET_PROJECTS = 'SET_PROJECTS';
export const SET_CURRENT_PROJECT_ID = 'SET_CURRENT_PROJECT_ID';
export const BATCH_UPDATE = 'BATCH_UPDATE';
export const APPLY_TEMPLATE = 'APPLY_TEMPLATE';
export const SET_OVERLAY_SETTING = 'SET_OVERLAY_SETTING';
export const UNDO = 'UNDO';
export const REDO = 'REDO';

// =============================================================================
// Helpers
// =============================================================================

/**
 * Sets a value on a (potentially nested) key within an object using
 * dot-notation (e.g. 'gradient.angle'). Returns a deep clone with the
 * value applied.
 */
function setNestedValue(obj, key, value) {
  const clone = JSON.parse(JSON.stringify(obj));
  if (!key.includes('.')) {
    clone[key] = value;
    return clone;
  }
  const parts = key.split('.');
  let current = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
  return clone;
}

/**
 * Deep-clone helper that handles non-JSON-safe values gracefully by
 * falling back to the original reference when JSON round-tripping would
 * lose data (e.g. Image objects stored in localizedImages).
 */
function deepClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return { ...obj };
  }
}

// =============================================================================
// Initial State
// =============================================================================
const initialState = {
  screenshots: [],
  selectedIndex: 0,
  transferTarget: null,
  outputDevice: 'iphone-6.9',
  currentLanguage: 'en',
  projectLanguages: ['en'],
  customWidth: 1290,
  customHeight: 2796,
  defaults: JSON.parse(JSON.stringify(DEFAULT_STATE.defaults)),
  projects: [],
  currentProjectId: null,
};

// =============================================================================
// Reducer
// =============================================================================
function reducer(state, action) {
  switch (action.type) {
    // -- Screenshots ----------------------------------------------------------
    case SET_SCREENSHOTS:
      return { ...state, screenshots: action.payload.screenshots };

    case ADD_SCREENSHOT: {
      const newScreenshot = {
        ...action.payload.screenshot,
        background: deepClone(state.defaults.background),
        screenshot: deepClone(state.defaults.screenshot),
        text: deepClone(state.defaults.text),
        overlay: deepClone(state.defaults.overlay),
        overrides: {},
      };
      return {
        ...state,
        screenshots: [...state.screenshots, newScreenshot],
        selectedIndex: state.screenshots.length, // select newly added
      };
    }

    case REMOVE_SCREENSHOT: {
      const { index } = action.payload;
      const next = [...state.screenshots];
      next.splice(index, 1);
      let newIndex = state.selectedIndex;
      if (newIndex >= next.length) {
        newIndex = Math.max(0, next.length - 1);
      }
      return { ...state, screenshots: next, selectedIndex: newIndex };
    }

    case SELECT_SCREENSHOT:
      return { ...state, selectedIndex: action.payload.index };

    case REORDER_SCREENSHOTS: {
      const { fromIndex, toIndex } = action.payload;
      const reordered = [...state.screenshots];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      // Keep the selection following the moved item
      let updatedIndex = state.selectedIndex;
      if (state.selectedIndex === fromIndex) {
        updatedIndex = toIndex;
      } else if (
        fromIndex < state.selectedIndex &&
        toIndex >= state.selectedIndex
      ) {
        updatedIndex = state.selectedIndex - 1;
      } else if (
        fromIndex > state.selectedIndex &&
        toIndex <= state.selectedIndex
      ) {
        updatedIndex = state.selectedIndex + 1;
      }
      return { ...state, screenshots: reordered, selectedIndex: updatedIndex };
    }

    // -- Per-screenshot settings (operate on selectedIndex) -------------------
    case SET_BACKGROUND: {
      const { key, value } = action.payload;
      const idx = state.selectedIndex;
      if (!state.screenshots[idx]) return state;
      const updatedBg = setNestedValue(state.screenshots[idx].background, key, value);
      const screenshots = state.screenshots.map((s, i) =>
        i === idx ? { ...s, background: updatedBg } : s,
      );
      return { ...state, screenshots };
    }

    case SET_SCREENSHOT_SETTING: {
      const { key, value } = action.payload;
      const idx = state.selectedIndex;
      if (!state.screenshots[idx]) return state;
      const updatedSS = setNestedValue(state.screenshots[idx].screenshot, key, value);
      const screenshots = state.screenshots.map((s, i) =>
        i === idx ? { ...s, screenshot: updatedSS } : s,
      );
      return { ...state, screenshots };
    }

    case SET_TEXT_SETTING: {
      const { key, value } = action.payload;
      const idx = state.selectedIndex;
      if (!state.screenshots[idx]) return state;
      const updatedTxt = setNestedValue(state.screenshots[idx].text, key, value);
      const screenshots = state.screenshots.map((s, i) =>
        i === idx ? { ...s, text: updatedTxt } : s,
      );
      return { ...state, screenshots };
    }

    case SET_OVERLAY_SETTING: {
      const { key, value } = action.payload;
      const idx = state.selectedIndex;
      if (!state.screenshots[idx]) return state;
      const currentOverlay = state.screenshots[idx].overlay || deepClone(state.defaults.overlay);
      const updatedOverlay = { ...currentOverlay, [key]: value };
      const screenshots = state.screenshots.map((s, i) =>
        i === idx ? { ...s, overlay: updatedOverlay } : s,
      );
      return { ...state, screenshots };
    }

    // -- Localized images -----------------------------------------------------
    case SET_LOCALIZED_IMAGE: {
      const { screenshotIndex, lang, image, src, name } = action.payload;
      if (!state.screenshots[screenshotIndex]) return state;
      const target = state.screenshots[screenshotIndex];
      const localizedImages = {
        ...(target.localizedImages || {}),
        [lang]: { image, src, name },
      };
      const screenshots = state.screenshots.map((s, i) =>
        i === screenshotIndex ? { ...s, localizedImages, image: image || s.image } : s,
      );
      return { ...state, screenshots };
    }

    case REMOVE_LOCALIZED_IMAGE: {
      const { screenshotIndex, lang } = action.payload;
      if (!state.screenshots[screenshotIndex]) return state;
      const target = state.screenshots[screenshotIndex];
      const localizedImages = { ...(target.localizedImages || {}) };
      delete localizedImages[lang];
      const screenshots = state.screenshots.map((s, i) =>
        i === screenshotIndex ? { ...s, localizedImages } : s,
      );
      return { ...state, screenshots };
    }

    // -- Style operations -----------------------------------------------------
    case APPLY_STYLE_TO_ALL: {
      const source = state.screenshots[state.selectedIndex];
      if (!source) return state;
      const sourceBg = deepClone(source.background);
      const sourceSS = deepClone(source.screenshot);
      const sourceTextStyle = deepClone(source.text);
      const screenshots = state.screenshots.map((s, i) => {
        if (i === state.selectedIndex) return s;
        // Preserve text content (headlines/subheadlines) but apply style
        const mergedText = {
          ...sourceTextStyle,
          headlines: s.text?.headlines || sourceTextStyle.headlines,
          subheadlines: s.text?.subheadlines || sourceTextStyle.subheadlines,
        };
        return {
          ...s,
          background: deepClone(sourceBg),
          screenshot: deepClone(sourceSS),
          text: mergedText,
        };
      });
      return { ...state, screenshots };
    }

    case APPLY_TEMPLATE: {
      const { template } = action.payload;
      const idx = state.selectedIndex;
      if (!state.screenshots[idx]) return state;
      const current = state.screenshots[idx];
      const templateBg = deepClone(template.background);
      const templateSS = deepClone(template.screenshot);
      const templateText = deepClone(template.text);
      // Preserve text content (headlines/subheadlines) but overwrite styling
      const mergedText = {
        ...templateText,
        headlines: current.text?.headlines || templateText.headlines,
        subheadlines: current.text?.subheadlines || templateText.subheadlines,
      };
      const screenshots = state.screenshots.map((s, i) =>
        i === idx
          ? { ...s, background: templateBg, screenshot: templateSS, text: mergedText }
          : s,
      );
      return { ...state, screenshots };
    }

    case TRANSFER_STYLE: {
      const { fromIndex, toIndex } = action.payload;
      const source = state.screenshots[fromIndex];
      const dest = state.screenshots[toIndex];
      if (!source || !dest) return state;
      const mergedText = {
        ...deepClone(source.text),
        headlines: dest.text?.headlines || source.text?.headlines,
        subheadlines: dest.text?.subheadlines || source.text?.subheadlines,
      };
      const screenshots = state.screenshots.map((s, i) =>
        i === toIndex
          ? {
              ...s,
              background: deepClone(source.background),
              screenshot: deepClone(source.screenshot),
              text: mergedText,
            }
          : s,
      );
      return { ...state, screenshots, transferTarget: null };
    }

    // -- Output / dimensions --------------------------------------------------
    case SET_OUTPUT_DEVICE:
      return { ...state, outputDevice: action.payload.device };

    case SET_CUSTOM_DIMENSIONS:
      return {
        ...state,
        customWidth: action.payload.width ?? state.customWidth,
        customHeight: action.payload.height ?? state.customHeight,
      };

    // -- Language --------------------------------------------------------------
    case SET_CURRENT_LANGUAGE:
      return { ...state, currentLanguage: action.payload.language };

    case SET_PROJECT_LANGUAGES:
      return { ...state, projectLanguages: action.payload.languages };

    case ADD_PROJECT_LANGUAGE:
      if (state.projectLanguages.includes(action.payload.language)) return state;
      return {
        ...state,
        projectLanguages: [...state.projectLanguages, action.payload.language],
      };

    case REMOVE_PROJECT_LANGUAGE: {
      const filtered = state.projectLanguages.filter(
        (l) => l !== action.payload.language,
      );
      return {
        ...state,
        projectLanguages: filtered,
        currentLanguage:
          state.currentLanguage === action.payload.language
            ? filtered[0] || 'en'
            : state.currentLanguage,
      };
    }

    // -- Defaults -------------------------------------------------------------
    case SET_DEFAULTS:
      return { ...state, defaults: action.payload.defaults };

    // -- Full state operations ------------------------------------------------
    case LOAD_STATE:
      return { ...state, ...action.payload };

    case RESET_STATE:
      return {
        ...initialState,
        defaults: JSON.parse(JSON.stringify(DEFAULT_STATE.defaults)),
        projects: state.projects,
        currentProjectId: state.currentProjectId,
      };

    // -- Projects -------------------------------------------------------------
    case SET_PROJECTS:
      return { ...state, projects: action.payload.projects };

    case SET_CURRENT_PROJECT_ID:
      return { ...state, currentProjectId: action.payload.projectId };

    // -- Batch ----------------------------------------------------------------
    case BATCH_UPDATE:
      return { ...state, ...action.payload };

    default:
      return state;
  }
}

// =============================================================================
// Undo/Redo Higher-Order Reducer
// =============================================================================

const SKIP_HISTORY_ACTIONS = [
  SELECT_SCREENSHOT,
  SET_CURRENT_LANGUAGE,
  SET_PROJECTS,
  SET_CURRENT_PROJECT_ID,
  LOAD_STATE,
  BATCH_UPDATE,
];

function undoableReducer(wrappedReducer) {
  return function (state, action) {
    const { past, present, future } = state;

    switch (action.type) {
      case UNDO: {
        if (past.length === 0) return state;
        const previous = past[past.length - 1];
        const newPast = past.slice(0, -1);
        return { past: newPast, present: previous, future: [present, ...future] };
      }
      case REDO: {
        if (future.length === 0) return state;
        const next = future[0];
        const newFuture = future.slice(1);
        return { past: [...past, present], present: next, future: newFuture };
      }
      default: {
        const newPresent = wrappedReducer(present, action);
        if (newPresent === present) return state;

        if (SKIP_HISTORY_ACTIONS.includes(action.type)) {
          return { past, present: newPresent, future };
        }

        const newPast = [...past, present].slice(-50);
        return { past: newPast, present: newPresent, future: [] };
      }
    }
  };
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Core state management hook for the ScreenshotMaker component.
 *
 * Wraps useReducer with IndexedDB persistence helpers and convenience
 * accessors that mirror the vanilla JS `getBackground()`, `getScreenshotSettings()`,
 * and `getText()` functions.
 */
export default function useAppState() {
  const [undoState, dispatch] = useReducer(
    undoableReducer(reducer),
    { past: [], present: initialState, future: [] },
  );
  const state = undoState.present;
  const canUndo = undoState.past.length > 0;
  const canRedo = undoState.future.length > 0;
  const db = useRef(null);

  // Open the database once on mount
  useEffect(() => {
    let cancelled = false;
    openDatabase().then((database) => {
      if (!cancelled) {
        db.current = database;
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Persistence helpers
  // ---------------------------------------------------------------------------

  /**
   * Serializes the current state and writes it to IndexedDB for the active
   * project.
   */
  const saveState = useCallback(async () => {
    if (!db.current || !state.currentProjectId) return;
    const serialized = serializeState(state);
    await saveProjectState(db.current, state.currentProjectId, serialized);
  }, [state]);

  /**
   * Loads state for the given project from IndexedDB, hydrates Image objects,
   * and dispatches a LOAD_STATE action.
   *
   * @param {string} projectId
   */
  const loadState = useCallback(async (projectId) => {
    if (!db.current || !projectId) return;
    const raw = await loadProjectState(db.current, projectId);
    const deserialized = deserializeState(raw);
    if (!deserialized) return;
    const hydrated = await loadImagesForState(deserialized);
    dispatch({ type: LOAD_STATE, payload: hydrated });
  }, []);

  // ---------------------------------------------------------------------------
  // Convenience accessors — mirror the vanilla JS helpers
  // ---------------------------------------------------------------------------

  const getCurrentScreenshot = useCallback(() => {
    return state.screenshots[state.selectedIndex] || null;
  }, [state.screenshots, state.selectedIndex]);

  const getBackground = useCallback(() => {
    const s = state.screenshots[state.selectedIndex];
    return s ? s.background : state.defaults.background;
  }, [state.screenshots, state.selectedIndex, state.defaults.background]);

  const getScreenshotSettings = useCallback(() => {
    const s = state.screenshots[state.selectedIndex];
    return s ? s.screenshot : state.defaults.screenshot;
  }, [state.screenshots, state.selectedIndex, state.defaults.screenshot]);

  const getText = useCallback(() => {
    const s = state.screenshots[state.selectedIndex];
    return s ? s.text : state.defaults.text;
  }, [state.screenshots, state.selectedIndex, state.defaults.text]);

  return {
    state,
    dispatch,
    canUndo,
    canRedo,
    saveState,
    loadState,
    db,
    getCurrentScreenshot,
    getBackground,
    getScreenshotSettings,
    getText,
  };
}
