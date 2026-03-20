import { useRef, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { deviceConfigs } from '../constants';

/**
 * React hook that wraps Three.js 3D phone model rendering.
 * Provides imperative methods for initializing, rendering, and controlling
 * a 3D phone model scene. Does not manage React state directly.
 *
 * @param {React.RefObject} containerRef - Ref to the hidden div used as the Three.js mount point
 * @returns {Object} Stable object of imperative methods for controlling the 3D renderer
 */
export default function useThreeRenderer(containerRef) {
  // -------------------------------------------------------------------------
  // Refs for all mutable Three.js objects
  // -------------------------------------------------------------------------
  const threeRenderer = useRef(null);
  const threeScene = useRef(null);
  const threeCamera = useRef(null);

  const phoneModel = useRef(null);
  const phonePivot = useRef(null);
  const customScreenPlane = useRef(null);
  const screenMesh = useRef(null);

  const screenTexture = useRef(null);
  const baseModelScale = useRef(1);
  const basePositionOffset = useRef({ x: 0, y: 0, z: 0 });

  const currentDeviceModel = useRef('iphone');
  const phoneModelLoaded = useRef(false);
  const phoneModelLoading = useRef(false);

  const phoneModelCache = useRef({}); // { deviceType: { model, pivot, screenPlane, baseScale, loaded, loading, loadingPromise } }

  const isInitialized = useRef(false);

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Creates a canvas with the image clipped to a rounded rectangle.
   */
  function createRoundedScreenImage(image, cornerRadius) {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');

    const w = canvas.width;
    const h = canvas.height;
    const r = cornerRadius;

    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();

    ctx.clip();
    ctx.drawImage(image, 0, 0);

    return canvas;
  }

  /**
   * Creates the screen overlay plane geometry on the current phone model.
   * Attaches it as a child of phoneModel so it moves/rotates with the phone.
   */
  function createScreenOverlay() {
    // Dispose previous screen plane if any
    if (customScreenPlane.current) {
      if (customScreenPlane.current.parent) {
        customScreenPlane.current.parent.remove(customScreenPlane.current);
      }
      customScreenPlane.current.geometry.dispose();
      customScreenPlane.current.material.dispose();
    }

    const config = deviceConfigs[currentDeviceModel.current] || deviceConfigs.iphone;

    const aspectRatio = config.aspectRatio;
    const planeHeight = 4.3 * config.screenHeightFactor;
    const planeWidth = planeHeight * aspectRatio;

    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    const material = new THREE.MeshBasicMaterial({
      color: 0x111111,
      side: THREE.DoubleSide,
    });

    customScreenPlane.current = new THREE.Mesh(geometry, material);

    // Position at center of phone screen, slightly in front of glass
    const screenOffset = config.screenOffset;
    customScreenPlane.current.position.set(screenOffset.x, screenOffset.y, screenOffset.z);

    // Counter-rotate to cancel out any model base rotation
    const modelRot = config.modelRotation || { x: 0, y: 0, z: 0 };
    customScreenPlane.current.rotation.set(
      -modelRot.x * Math.PI / 180,
      -modelRot.y * Math.PI / 180,
      -modelRot.z * Math.PI / 180
    );

    // Add directly to phoneModel so it moves with it
    phoneModel.current.add(customScreenPlane.current);

    // Reset base position offset (pivot-based rotation makes this unnecessary)
    basePositionOffset.current.y = 0;
  }

  /**
   * Loads a phone model into the cache for side-preview rendering with different devices.
   * Returns a Promise that resolves with the cached entry.
   */
  function loadCachedPhoneModel(deviceType) {
    if (!deviceConfigs[deviceType]) return Promise.reject(new Error('Unknown device type'));

    const cache = phoneModelCache.current;

    if (cache[deviceType]?.loaded) {
      return Promise.resolve(cache[deviceType]);
    }
    if (cache[deviceType]?.loading) {
      return cache[deviceType].loadingPromise;
    }

    const config = deviceConfigs[deviceType];
    const loader = new GLTFLoader();

    cache[deviceType] = { loading: true, loaded: false };

    cache[deviceType].loadingPromise = new Promise((resolve, reject) => {
      loader.load(
        config.modelPath,
        (gltf) => {
          const model = gltf.scene;

          // Center and scale
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          model.position.sub(center);

          const maxDim = Math.max(size.x, size.y, size.z);
          const modelBaseScale = 3.75 / maxDim;
          model.scale.setScalar(modelBaseScale);

          // Create pivot
          const screenOffset = config.screenOffset;
          const pivot = new THREE.Group();
          model.position.set(
            -screenOffset.x * modelBaseScale,
            -screenOffset.y * modelBaseScale,
            -screenOffset.z * modelBaseScale
          );
          pivot.add(model);

          // Create screen plane
          const planeHeight = 4.3 * config.screenHeightFactor;
          const planeWidth = planeHeight * config.aspectRatio;

          const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
          const material = new THREE.MeshBasicMaterial({
            color: 0x111111,
            side: THREE.DoubleSide,
          });
          const screenPlane = new THREE.Mesh(geometry, material);
          screenPlane.position.set(screenOffset.x, screenOffset.y, screenOffset.z);

          const modelRot = config.modelRotation || { x: 0, y: 0, z: 0 };
          screenPlane.rotation.set(
            -modelRot.x * Math.PI / 180,
            -modelRot.y * Math.PI / 180,
            -modelRot.z * Math.PI / 180
          );
          model.add(screenPlane);

          cache[deviceType] = {
            model,
            pivot,
            screenPlane,
            baseScale: modelBaseScale,
            loaded: true,
            loading: false,
          };

          resolve(cache[deviceType]);
        },
        undefined,
        (error) => {
          console.error('Error loading cached ' + deviceType + ' model:', error);
          cache[deviceType] = { loading: false, loaded: false };
          reject(error);
        }
      );
    });

    return cache[deviceType].loadingPromise;
  }

  // -------------------------------------------------------------------------
  // Public methods (wrapped in useCallback for referential stability)
  // -------------------------------------------------------------------------

  /**
   * Creates the Three.js scene, camera, renderer, and lights.
   * Appends the renderer DOM element to containerRef and loads the initial phone model.
   */
  const initThreeJS = useCallback(() => {
    if (isInitialized.current) return;

    const container = containerRef?.current;
    if (!container) return;

    // Scene
    threeScene.current = new THREE.Scene();
    threeScene.current.background = new THREE.Color(0x667eea);

    // Camera
    const aspect = 400 / 700;
    threeCamera.current = new THREE.PerspectiveCamera(35, aspect, 0.1, 1000);
    threeCamera.current.position.set(0, 0, 6);

    // Renderer
    threeRenderer.current = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    threeRenderer.current.setSize(400, 700);
    threeRenderer.current.setPixelRatio(1);
    threeRenderer.current.outputColorSpace = THREE.SRGBColorSpace;
    threeRenderer.current.toneMapping = THREE.NoToneMapping;
    threeRenderer.current.autoClear = false;

    container.appendChild(threeRenderer.current.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    threeScene.current.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(2, 3, 4);
    threeScene.current.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-2, 1, 2);
    threeScene.current.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, -2, -3);
    threeScene.current.add(rimLight);

    isInitialized.current = true;

    // Load initial phone model
    loadPhoneModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  /**
   * Loads the GLB phone model for the current device type using GLTFLoader.
   * Centers, scales, creates a pivot for rotation around screen center,
   * and creates the screen overlay plane.
   *
   * @returns {Promise<void>} Resolves when the model is loaded and set up.
   */
  const loadPhoneModel = useCallback(() => {
    if (phoneModelLoading.current) return Promise.resolve();
    phoneModelLoading.current = true;

    const config = deviceConfigs[currentDeviceModel.current] || deviceConfigs.iphone;
    const loader = new GLTFLoader();

    return new Promise((resolve, reject) => {
      loader.load(
        config.modelPath,
        (gltf) => {
          phoneModelLoading.current = false;
          phoneModel.current = gltf.scene;

          // Center and scale
          const box = new THREE.Box3().setFromObject(phoneModel.current);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());

          phoneModel.current.position.sub(center);

          const maxDim = Math.max(size.x, size.y, size.z);
          baseModelScale.current = 3.75 / maxDim;
          phoneModel.current.scale.setScalar(baseModelScale.current);

          // Identify screen mesh (largest glass mesh)
          let glassMeshes = [];
          phoneModel.current.traverse((child) => {
            if (child.isMesh) {
              const matName = (child.material?.name || '').toLowerCase();
              if (matName === 'glass') {
                child.geometry.computeBoundingBox();
                const bb = child.geometry.boundingBox;
                const s = new THREE.Vector3();
                bb.getSize(s);
                const area = s.x * s.y;
                glassMeshes.push({ mesh: child, area });
              }
              const name = (child.name || '').toLowerCase();
              if (
                name.includes('screen') || name.includes('display') ||
                matName.includes('screen') || matName.includes('display') ||
                matName.includes('emission') || matName.includes('emissive')
              ) {
                screenMesh.current = child;
              }
            }
          });

          if (glassMeshes.length > 0) {
            glassMeshes.sort((a, b) => b.area - a.area);
            screenMesh.current = glassMeshes[0].mesh;
          }

          // Create pivot group for rotation around screen center
          const screenOffset = config.screenOffset;
          phonePivot.current = new THREE.Group();

          phoneModel.current.position.set(
            -screenOffset.x * baseModelScale.current,
            -screenOffset.y * baseModelScale.current,
            -screenOffset.z * baseModelScale.current
          );

          phonePivot.current.add(phoneModel.current);
          threeScene.current.add(phonePivot.current);

          // Screen overlay
          createScreenOverlay();

          phoneModelLoaded.current = true;

          console.log('Phone model loaded successfully');
          resolve();
        },
        (progress) => {
          if (progress.total) {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            console.log('Loading phone model... ' + percent + '%');
          }
        },
        (error) => {
          phoneModelLoading.current = false;
          console.error('Error loading phone model:', error);
          reject(error);
        }
      );
    });
  }, []);

  /**
   * Switches the active phone model between device types (e.g. 'iphone', 'samsung').
   * Disposes the current model and loads the new one.
   *
   * @param {string} deviceType - Key into deviceConfigs
   * @returns {Promise<void>} Resolves when the new model is loaded.
   */
  const switchPhoneModel = useCallback((deviceType) => {
    if (!deviceConfigs[deviceType]) {
      console.error('Unknown device type:', deviceType);
      return Promise.reject(new Error('Unknown device type: ' + deviceType));
    }

    // Skip if same device and already loaded or loading
    if (currentDeviceModel.current === deviceType && (phoneModelLoaded.current || phoneModelLoading.current)) {
      return Promise.resolve();
    }

    currentDeviceModel.current = deviceType;
    phoneModelLoading.current = false;

    // Remove current pivot from scene
    if (phonePivot.current && threeScene.current) {
      threeScene.current.remove(phonePivot.current);
      phonePivot.current.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose();
          child.material?.dispose();
        }
      });
      phonePivot.current = null;
      phoneModel.current = null;
    }

    // Clean up screen plane
    if (customScreenPlane.current) {
      if (customScreenPlane.current.parent) {
        customScreenPlane.current.parent.remove(customScreenPlane.current);
      }
      customScreenPlane.current.geometry?.dispose();
      customScreenPlane.current.material?.dispose();
      customScreenPlane.current = null;
    }

    screenMesh.current = null;
    phoneModelLoaded.current = false;

    const config = deviceConfigs[currentDeviceModel.current];
    const loader = new GLTFLoader();

    return new Promise((resolve, reject) => {
      loader.load(
        config.modelPath,
        (gltf) => {
          phoneModel.current = gltf.scene;

          const box = new THREE.Box3().setFromObject(phoneModel.current);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());

          phoneModel.current.position.sub(center);

          const maxDim = Math.max(size.x, size.y, size.z);
          baseModelScale.current = 3.75 / maxDim;
          phoneModel.current.scale.setScalar(baseModelScale.current);

          const screenOffset = config.screenOffset;
          phonePivot.current = new THREE.Group();

          phoneModel.current.position.set(
            -screenOffset.x * baseModelScale.current,
            -screenOffset.y * baseModelScale.current,
            -screenOffset.z * baseModelScale.current
          );

          phonePivot.current.add(phoneModel.current);
          threeScene.current.add(phonePivot.current);

          createScreenOverlay();

          phoneModelLoaded.current = true;

          console.log(deviceType + ' model loaded successfully');
          resolve();
        },
        (progress) => {
          if (progress.total) {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            console.log('Loading ' + deviceType + ' model... ' + percent + '%');
          }
        },
        (error) => {
          console.error('Error loading ' + deviceType + ' model:', error);
          reject(error);
        }
      );
    });
  }, []);

  /**
   * Updates the screen texture on the phone model with the given screenshot image.
   * Applies rounded corners using the current device's corner radius factor.
   *
   * @param {HTMLImageElement|HTMLCanvasElement} screenshotImage - The image to display on the screen
   */
  const updateScreenTexture = useCallback((screenshotImage) => {
    if (!phoneModel.current) return;
    if (!screenshotImage) return;

    // Dispose previous texture
    if (screenTexture.current) {
      screenTexture.current.dispose();
    }

    const config = deviceConfigs[currentDeviceModel.current] || deviceConfigs.iphone;
    const cornerRadius = Math.round(screenshotImage.width * config.cornerRadiusFactor);
    const roundedImage = createRoundedScreenImage(screenshotImage, cornerRadius);

    screenTexture.current = new THREE.Texture(roundedImage);
    screenTexture.current.needsUpdate = true;
    screenTexture.current.colorSpace = THREE.SRGBColorSpace;
    screenTexture.current.flipY = true;

    const screenMaterial = new THREE.MeshBasicMaterial({
      map: screenTexture.current,
      side: THREE.FrontSide,
      transparent: true,
    });

    if (customScreenPlane.current) {
      customScreenPlane.current.material.dispose();
      customScreenPlane.current.material = screenMaterial;
    }

    requestRenderInternal();
  }, []);

  /**
   * Sets the 3D rotation of the phone pivot from degree values.
   * Adds the device's base model rotation to the user's rotation.
   *
   * @param {number} rotX - X rotation in degrees
   * @param {number} rotY - Y rotation in degrees
   * @param {number} rotZ - Z rotation in degrees
   */
  const setRotation = useCallback((rotX, rotY, rotZ) => {
    if (!phonePivot.current) return;

    const config = deviceConfigs[currentDeviceModel.current] || deviceConfigs.iphone;
    const modelRot = config.modelRotation || { x: 0, y: 0, z: 0 };

    phonePivot.current.rotation.x = (rotX + modelRot.x) * Math.PI / 180;
    phonePivot.current.rotation.y = (rotY + modelRot.y) * Math.PI / 180;
    phonePivot.current.rotation.z = (rotZ + modelRot.z) * Math.PI / 180;

    requestRenderInternal();
  }, []);

  /**
   * Sets the model scale (percentage-based, where 100 = base scale).
   *
   * @param {number} scale - Scale percentage (e.g. 100 for 1x)
   */
  const setScale = useCallback((scale) => {
    if (!phoneModel.current) return;

    phoneModel.current.scale.setScalar(baseModelScale.current * (scale / 100));

    requestRenderInternal();
  }, []);

  /**
   * Renders the 3D phone with transparent background onto a target canvas
   * for compositing over a 2D background.
   *
   * @param {HTMLCanvasElement} targetCanvas - Canvas to draw onto
   * @param {number} width - Render width in pixels
   * @param {number} height - Render height in pixels
   * @param {Object} screenshotSettings - Settings object with scale, x, y, rotation3D, etc.
   */
  const renderToCanvas = useCallback((targetCanvas, width, height, screenshotSettings) => {
    if (!threeRenderer.current || !threeScene.current || !threeCamera.current || !phonePivot.current) return;

    const dims = { width: width || 1290, height: height || 2796 };

    // Store originals
    const originalBackground = threeScene.current.background;
    const originalPosition = phonePivot.current.position.clone();
    const originalScale = phonePivot.current.scale.clone();
    const originalRotation = phonePivot.current.rotation.clone();

    // Apply screenshot settings if provided
    if (screenshotSettings) {
      const ss = screenshotSettings;

      // Scale
      const screenshotScale = ss.scale / 100;
      phonePivot.current.scale.setScalar(screenshotScale);

      // Position
      const xOffset = ((ss.x - 50) / 50) * 2;
      const yOffset = -((ss.y - 50) / 50) * 3;
      phonePivot.current.position.set(
        xOffset + basePositionOffset.current.x,
        yOffset + basePositionOffset.current.y,
        basePositionOffset.current.z
      );

      // Rotation
      const rotation3D = ss.rotation3D || { x: 0, y: 0, z: 0 };
      const config = deviceConfigs[currentDeviceModel.current] || deviceConfigs.iphone;
      const modelRot = config.modelRotation || { x: 0, y: 0, z: 0 };
      phonePivot.current.rotation.set(
        (rotation3D.x + modelRot.x) * Math.PI / 180,
        (rotation3D.y + modelRot.y) * Math.PI / 180,
        (rotation3D.z + modelRot.z) * Math.PI / 180
      );
    }

    // Transparent background for compositing
    threeScene.current.background = null;
    threeRenderer.current.setClearColor(0x000000, 0);

    // Temporarily resize renderer
    const oldSize = { width: 400, height: 700 };
    threeRenderer.current.setSize(dims.width, dims.height);
    threeCamera.current.aspect = dims.width / dims.height;
    threeCamera.current.updateProjectionMatrix();

    threeRenderer.current.clear();
    threeRenderer.current.render(threeScene.current, threeCamera.current);

    // Composite onto target canvas
    const ctx = targetCanvas.getContext('2d');
    ctx.drawImage(threeRenderer.current.domElement, 0, 0, dims.width, dims.height);

    // Restore
    threeRenderer.current.setSize(oldSize.width, oldSize.height);
    threeCamera.current.aspect = oldSize.width / oldSize.height;
    threeCamera.current.updateProjectionMatrix();
    threeScene.current.background = originalBackground;
    phonePivot.current.position.copy(originalPosition);
    phonePivot.current.scale.copy(originalScale);
    phonePivot.current.rotation.copy(originalRotation);
  }, []);

  /**
   * Renders the 3D phone for a specific screenshot index, handling device switching
   * via the model cache and temporary texture swapping for side previews.
   *
   * @param {HTMLCanvasElement} targetCanvas - Canvas to draw onto
   * @param {number} width - Render width
   * @param {number} height - Render height
   * @param {number} screenshotIndex - Index of the screenshot to render
   * @param {Array} screenshots - Full array of screenshot objects
   * @param {Function} getScreenshotImageFn - Function(screenshot) => image element
   */
  const renderForScreenshot = useCallback((targetCanvas, width, height, screenshotIndex, screenshots, getScreenshotImageFn) => {
    if (!threeRenderer.current || !threeScene.current || !threeCamera.current) return;
    if (!screenshots || !screenshots[screenshotIndex]) return;

    const screenshot = screenshots[screenshotIndex];
    const ss = screenshot.screenshot;
    const dims = { width: width || 1290, height: height || 2796 };

    // Determine device type for this screenshot
    const screenshotDeviceType = ss.device3D || 'iphone';
    const config = deviceConfigs[screenshotDeviceType] || deviceConfigs.iphone;

    const useCurrentModel = screenshotDeviceType === currentDeviceModel.current && phonePivot.current;

    let pivotToUse, screenPlaneToUse;

    if (useCurrentModel) {
      pivotToUse = phonePivot.current;
      screenPlaneToUse = customScreenPlane.current;
    } else {
      // Use cached model for different device
      const cached = phoneModelCache.current[screenshotDeviceType];
      if (!cached?.loaded) {
        // Trigger loading; caller should re-render once loaded
        loadCachedPhoneModel(screenshotDeviceType).catch(() => {});
        return;
      }
      pivotToUse = cached.pivot;
      screenPlaneToUse = cached.screenPlane;

      // Add cached pivot to scene temporarily
      threeScene.current.add(pivotToUse);
    }

    // Store originals
    const originalBackground = threeScene.current.background;
    const originalPosition = pivotToUse.position.clone();
    const originalScale = pivotToUse.scale.clone();
    const originalRotation = pivotToUse.rotation.clone();

    // Hide current model if using a different one
    if (!useCurrentModel && phonePivot.current) {
      phonePivot.current.visible = false;
    }

    // Temporarily update screen texture for this screenshot
    const screenshotImage = getScreenshotImageFn ? getScreenshotImageFn(screenshot) : screenshot?.image;
    const oldMaterial = screenPlaneToUse ? screenPlaneToUse.material : null;

    if (screenshotImage && screenPlaneToUse) {
      const cornerRadius = Math.round(screenshotImage.width * config.cornerRadiusFactor);
      const roundedImage = createRoundedScreenImage(screenshotImage, cornerRadius);
      const newTexture = new THREE.Texture(roundedImage);
      newTexture.needsUpdate = true;
      newTexture.colorSpace = THREE.SRGBColorSpace;
      newTexture.flipY = true;

      const newMaterial = new THREE.MeshBasicMaterial({
        map: newTexture,
        side: THREE.FrontSide,
        transparent: true,
      });
      screenPlaneToUse.material = newMaterial;
    }

    // Apply rotation
    const rotation3D = ss.rotation3D || { x: 0, y: 0, z: 0 };
    const modelRot = config.modelRotation || { x: 0, y: 0, z: 0 };
    pivotToUse.rotation.set(
      (rotation3D.x + modelRot.x) * Math.PI / 180,
      (rotation3D.y + modelRot.y) * Math.PI / 180,
      (rotation3D.z + modelRot.z) * Math.PI / 180
    );

    // Apply scale and position
    const screenshotScale = ss.scale / 100;
    pivotToUse.scale.setScalar(screenshotScale);
    const xOffset = ((ss.x - 50) / 50) * 2;
    const yOffset = -((ss.y - 50) / 50) * 3;
    pivotToUse.position.set(
      xOffset + basePositionOffset.current.x,
      yOffset + basePositionOffset.current.y,
      basePositionOffset.current.z
    );

    // Transparent background
    threeScene.current.background = null;
    threeRenderer.current.setClearColor(0x000000, 0);

    // Resize renderer
    const oldSize = { width: 400, height: 700 };
    threeRenderer.current.setSize(dims.width, dims.height);
    threeCamera.current.aspect = dims.width / dims.height;
    threeCamera.current.updateProjectionMatrix();

    threeRenderer.current.clear();
    threeRenderer.current.render(threeScene.current, threeCamera.current);

    // Composite onto target canvas
    const ctx = targetCanvas.getContext('2d');
    ctx.drawImage(threeRenderer.current.domElement, 0, 0, dims.width, dims.height);

    // Restore renderer size
    threeRenderer.current.setSize(oldSize.width, oldSize.height);
    threeCamera.current.aspect = oldSize.width / oldSize.height;
    threeCamera.current.updateProjectionMatrix();

    // Restore scene and model
    threeScene.current.background = originalBackground;
    pivotToUse.position.copy(originalPosition);
    pivotToUse.scale.copy(originalScale);
    pivotToUse.rotation.copy(originalRotation);

    // Restore material
    if (oldMaterial && screenPlaneToUse) {
      if (screenPlaneToUse.material !== oldMaterial) {
        screenPlaneToUse.material.map?.dispose();
        screenPlaneToUse.material.dispose();
      }
      screenPlaneToUse.material = oldMaterial;
    }

    // Clean up cached model from scene and restore visibility
    if (!useCurrentModel) {
      threeScene.current.remove(pivotToUse);
      if (phonePivot.current) {
        phonePivot.current.visible = true;
      }
    }
  }, []);

  /**
   * Updates the Three.js scene background color.
   *
   * @param {Object} background - Background config with type ('solid'|'gradient'|other),
   *                               solid (hex string), gradient.stops array, etc.
   */
  const updateBackground = useCallback((background) => {
    if (!threeScene.current || !background) return;

    if (background.type === 'solid') {
      threeScene.current.background = new THREE.Color(background.solid);
    } else if (background.type === 'gradient') {
      const firstStop = background.gradient?.stops?.[0];
      if (firstStop) {
        threeScene.current.background = new THREE.Color(firstStop.color);
      }
    } else {
      // For image backgrounds, use a neutral fallback
      threeScene.current.background = new THREE.Color(0x1a1a2e);
    }

    requestRenderInternal();
  }, []);

  /**
   * Internal render helper (non-debounced, synchronous).
   */
  function requestRenderInternal() {
    if (threeRenderer.current && threeScene.current && threeCamera.current) {
      threeRenderer.current.clear();
      threeRenderer.current.render(threeScene.current, threeCamera.current);
    }
  }

  /**
   * Triggers a single render frame via requestAnimationFrame.
   */
  const requestRender = useCallback(() => {
    requestAnimationFrame(() => {
      requestRenderInternal();
    });
  }, []);

  /**
   * Disposes all Three.js resources (renderer, textures, geometries, materials).
   */
  const dispose = useCallback(() => {
    if (screenTexture.current) {
      screenTexture.current.dispose();
      screenTexture.current = null;
    }

    // Dispose cached models
    const cache = phoneModelCache.current;
    Object.keys(cache).forEach((key) => {
      const entry = cache[key];
      if (entry?.pivot) {
        entry.pivot.traverse((child) => {
          if (child.isMesh) {
            child.geometry?.dispose();
            child.material?.dispose();
          }
        });
      }
    });
    phoneModelCache.current = {};

    // Dispose current model
    if (phonePivot.current) {
      phonePivot.current.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose();
          child.material?.dispose();
        }
      });
      phonePivot.current = null;
      phoneModel.current = null;
    }

    if (customScreenPlane.current) {
      customScreenPlane.current.geometry?.dispose();
      customScreenPlane.current.material?.dispose();
      customScreenPlane.current = null;
    }

    if (threeRenderer.current) {
      threeRenderer.current.dispose();
      // Remove the canvas from the container
      if (threeRenderer.current.domElement?.parentNode) {
        threeRenderer.current.domElement.parentNode.removeChild(threeRenderer.current.domElement);
      }
      threeRenderer.current = null;
    }

    threeScene.current = null;
    threeCamera.current = null;
    screenMesh.current = null;

    isInitialized.current = false;
    phoneModelLoaded.current = false;
    phoneModelLoading.current = false;
  }, []);

  /**
   * Returns whether the phone model has finished loading.
   * @returns {boolean}
   */
  const isLoaded = useCallback(() => {
    return phoneModelLoaded.current;
  }, []);

  /**
   * Returns the current device type string (e.g. 'iphone', 'samsung').
   * @returns {string}
   */
  const getCurrentDevice = useCallback(() => {
    return currentDeviceModel.current;
  }, []);

  // -------------------------------------------------------------------------
  // Return stable API object
  // -------------------------------------------------------------------------

  // Use a ref so the returned object identity is stable across re-renders
  const apiRef = useRef(null);
  if (!apiRef.current) {
    apiRef.current = {
      initThreeJS,
      loadPhoneModel,
      switchPhoneModel,
      updateScreenTexture,
      setRotation,
      setScale,
      renderToCanvas,
      renderForScreenshot,
      updateBackground,
      requestRender,
      dispose,
      isLoaded,
      getCurrentDevice,
    };
  }

  // Keep the methods up to date (they are stable useCallbacks but just in case)
  apiRef.current.initThreeJS = initThreeJS;
  apiRef.current.loadPhoneModel = loadPhoneModel;
  apiRef.current.switchPhoneModel = switchPhoneModel;
  apiRef.current.updateScreenTexture = updateScreenTexture;
  apiRef.current.setRotation = setRotation;
  apiRef.current.setScale = setScale;
  apiRef.current.renderToCanvas = renderToCanvas;
  apiRef.current.renderForScreenshot = renderForScreenshot;
  apiRef.current.updateBackground = updateBackground;
  apiRef.current.requestRender = requestRender;
  apiRef.current.dispose = dispose;
  apiRef.current.isLoaded = isLoaded;
  apiRef.current.getCurrentDevice = getCurrentDevice;

  return apiRef.current;
}
