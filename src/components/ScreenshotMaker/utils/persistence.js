/**
 * IndexedDB persistence utilities for the ScreenshotMaker component.
 *
 * Migrated from the vanilla JS public/appscreen/app.js into a proper ES module.
 * All functions use the standard IndexedDB API wrapped in Promises.
 */

const DB_NAME = 'AppscreenDB';
const DB_VERSION = 1;
const PROJECTS_STORE = 'projects';
const META_STORE = 'meta';

/**
 * Opens the IndexedDB database. Creates the 'projects' and 'meta' object stores
 * on first run (upgrade).
 * @returns {Promise<IDBDatabase|null>} The database instance, or null on error.
 */
export function openDatabase() {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        resolve(null);
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const database = event.target.result;

        if (!database.objectStoreNames.contains(PROJECTS_STORE)) {
          database.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
        }

        if (!database.objectStoreNames.contains(META_STORE)) {
          database.createObjectStore(META_STORE, { keyPath: 'key' });
        }
      };

      request.onblocked = () => {
        console.warn('Database upgrade blocked. Please close other tabs.');
        resolve(null);
      };
    } catch (e) {
      console.error('Failed to open IndexedDB:', e);
      resolve(null);
    }
  });
}

/**
 * Reads the projects list and the current project id from the 'meta' store.
 * @param {IDBDatabase} db
 * @returns {Promise<{ projects: Array|null, currentProjectId: string|null }>}
 */
export function loadProjectsMeta(db) {
  return new Promise((resolve) => {
    if (!db) {
      resolve({ projects: null, currentProjectId: null });
      return;
    }

    try {
      const transaction = db.transaction([META_STORE], 'readonly');
      const store = transaction.objectStore(META_STORE);

      const projectsReq = store.get('projectsList');
      const currentReq = store.get('currentProjectId');

      transaction.oncomplete = () => {
        const projects = projectsReq.result ? projectsReq.result.value : null;
        const currentProjectId = currentReq.result ? currentReq.result.value : null;
        resolve({ projects, currentProjectId });
      };

      transaction.onerror = () => {
        resolve({ projects: null, currentProjectId: null });
      };
    } catch (e) {
      console.error('Error loading projects meta:', e);
      resolve({ projects: null, currentProjectId: null });
    }
  });
}

/**
 * Saves the projects array and currentProjectId to the 'meta' store.
 * @param {IDBDatabase} db
 * @param {Array} projects
 * @param {string} currentProjectId
 * @returns {Promise<void>}
 */
export function saveProjectsMeta(db, projects, currentProjectId) {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }

    try {
      const transaction = db.transaction([META_STORE], 'readwrite');
      const store = transaction.objectStore(META_STORE);
      store.put({ key: 'projectsList', value: projects });
      store.put({ key: 'currentProjectId', value: currentProjectId });

      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => {
        console.error('Error saving projects meta:', event.target.error);
        reject(event.target.error);
      };
    } catch (e) {
      console.error('Error saving projects meta:', e);
      reject(e);
    }
  });
}

/**
 * Saves the serialized state for a project into the 'projects' store.
 * The stateToSave should already be serialized (screenshots converted to
 * saveable format with data URLs instead of Image objects).
 * @param {IDBDatabase} db
 * @param {string} projectId
 * @param {object} stateToSave - A plain object ready for storage.
 * @returns {Promise<void>}
 */
export function saveProjectState(db, projectId, stateToSave) {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }

    try {
      const dataToStore = { ...stateToSave, id: projectId };
      const transaction = db.transaction([PROJECTS_STORE], 'readwrite');
      const store = transaction.objectStore(PROJECTS_STORE);
      store.put(dataToStore);

      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => {
        console.error('Error saving project state:', event.target.error);
        reject(event.target.error);
      };
    } catch (e) {
      console.error('Error saving project state:', e);
      reject(e);
    }
  });
}

/**
 * Loads the raw state data for a project from IndexedDB.
 * @param {IDBDatabase} db
 * @param {string} projectId
 * @returns {Promise<object|null>} The stored state object, or null if not found.
 */
export function loadProjectState(db, projectId) {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve(null);
      return;
    }

    try {
      const transaction = db.transaction([PROJECTS_STORE], 'readonly');
      const store = transaction.objectStore(PROJECTS_STORE);
      const request = store.get(projectId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('Error loading project state:', request.error);
        reject(request.error);
      };
    } catch (e) {
      console.error('Error loading project state:', e);
      reject(e);
    }
  });
}

/**
 * Deletes a project's state from IndexedDB.
 * @param {IDBDatabase} db
 * @param {string} projectId
 * @returns {Promise<void>}
 */
export function deleteProjectState(db, projectId) {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }

    try {
      const transaction = db.transaction([PROJECTS_STORE], 'readwrite');
      const store = transaction.objectStore(PROJECTS_STORE);
      store.delete(projectId);

      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => {
        console.error('Error deleting project state:', event.target.error);
        reject(event.target.error);
      };
    } catch (e) {
      console.error('Error deleting project state:', e);
      reject(e);
    }
  });
}

/**
 * Converts runtime state into a saveable format suitable for IndexedDB storage.
 *
 * For each screenshot, localizedImages are converted so that only `src` (data URL)
 * and `name` are kept — Image objects are stripped out.
 *
 * @param {object} state - The full runtime state.
 * @returns {object} A plain object ready for JSON serialization / IndexedDB storage.
 */
export function serializeState(state) {
  const screenshotsToSave = (state.screenshots || []).map((s) => {
    const localizedImages = {};
    if (s.localizedImages) {
      Object.keys(s.localizedImages).forEach((lang) => {
        const langData = s.localizedImages[lang];
        if (langData?.src) {
          localizedImages[lang] = {
            src: langData.src,
            name: langData.name,
          };
        }
      });
    }

    return {
      src: s.image?.src || '',
      name: s.name,
      deviceType: s.deviceType,
      localizedImages,
      background: s.background,
      screenshot: s.screenshot,
      text: s.text,
      overrides: s.overrides,
    };
  });

  return {
    screenshots: screenshotsToSave,
    selectedIndex: state.selectedIndex,
    outputDevice: state.outputDevice,
    customWidth: state.customWidth,
    customHeight: state.customHeight,
    currentLanguage: state.currentLanguage,
    projectLanguages: state.projectLanguages,
    defaults: state.defaults,
  };
}

/**
 * Converts saved data back into a runtime-ready state structure.
 *
 * Image objects are NOT loaded here — localizedImages entries will contain `src`
 * and `name` but the `image` property will be null. Use `loadImagesForState` to
 * hydrate actual Image objects.
 *
 * @param {object} savedData - The raw data loaded from IndexedDB.
 * @returns {object} State object with placeholder image references.
 */
export function deserializeState(savedData) {
  if (!savedData) return null;

  const screenshots = (savedData.screenshots || []).map((s) => {
    const localizedImages = {};
    if (s.localizedImages) {
      Object.keys(s.localizedImages).forEach((lang) => {
        const langData = s.localizedImages[lang];
        if (langData?.src) {
          localizedImages[lang] = {
            image: null,
            src: langData.src,
            name: langData.name || s.name,
          };
        }
      });
    }

    return {
      image: null,
      name: s.name,
      deviceType: s.deviceType,
      localizedImages,
      background: s.background,
      screenshot: s.screenshot,
      text: s.text,
      overrides: s.overrides || {},
    };
  });

  return {
    screenshots,
    selectedIndex: savedData.selectedIndex || 0,
    outputDevice: savedData.outputDevice || 'iphone-6.9',
    customWidth: savedData.customWidth || 1320,
    customHeight: savedData.customHeight || 2868,
    currentLanguage: savedData.currentLanguage || 'en',
    projectLanguages: savedData.projectLanguages || ['en'],
    defaults: savedData.defaults || null,
  };
}

/**
 * Loads all Image objects from data URLs stored in the state's screenshots.
 *
 * For each screenshot's localizedImages, creates a new Image() and sets its src
 * to the stored data URL. Also sets the screenshot's top-level `image` property
 * to the first language's loaded image for legacy compatibility.
 *
 * @param {object} state - A deserialized state (as returned by `deserializeState`).
 * @returns {Promise<object>} The state with Image objects populated.
 */
export function loadImagesForState(state) {
  if (!state || !state.screenshots || state.screenshots.length === 0) {
    return Promise.resolve(state);
  }

  const screenshotPromises = state.screenshots.map((screenshot) => {
    const langKeys = Object.keys(screenshot.localizedImages || {});
    if (langKeys.length === 0) {
      return Promise.resolve(screenshot);
    }

    const langPromises = langKeys.map((lang) => {
      const langData = screenshot.localizedImages[lang];
      if (!langData || !langData.src) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          langData.image = img;
          resolve();
        };
        img.onerror = () => {
          console.warn(`Failed to load image for language "${lang}"`);
          resolve();
        };
        img.src = langData.src;
      });
    });

    return Promise.all(langPromises).then(() => {
      // Set legacy top-level image to the first language's loaded image
      const firstLang = langKeys[0];
      if (screenshot.localizedImages[firstLang]?.image) {
        screenshot.image = screenshot.localizedImages[firstLang].image;
      }
      return screenshot;
    });
  });

  return Promise.all(screenshotPromises).then((screenshots) => {
    return { ...state, screenshots };
  });
}
