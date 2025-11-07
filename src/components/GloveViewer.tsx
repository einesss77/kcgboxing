import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { useCustomizationStore } from '../store/customizationStore';
import { generateTextTexture } from '../utils/GenerateTextTexture';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';


// ---------- helpers for masking finishes over overlays ----------

// load an image (for mask sizing)
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Build a WHITE mask for background, and punch BLACK where text/images are.
// We only need the background mask (white=finish ON, black=finish OFF).
async function buildBackgroundMask(
  z?: { text?: string; font?: string; size?: number; x?: number; y?: number; rotation?: number },
  imgs?: Array<{ url: string; transform: { x: number; y: number; scale: number; rotation: number } }>
) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // start white: finish ON everywhere
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 512);

  // knock out TEXT to black (finish OFF)
  if (z?.text) {
    ctx.save();
    ctx.translate(z.x ?? 256, z.y ?? 256);
    ctx.rotate(((z.rotation ?? 0) * Math.PI) / 180);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const family = (z.font || 'Arial').split(',')[0].replace(/^['"]|['"]$/g, '');
    ctx.font = `${z.size ?? 64}px "${family}"`;
    ctx.fillStyle = '#000000';
    ctx.fillText(z.text, 0, 0);
    ctx.restore();
  }

  // knock out IMAGES to black (use their transformed rect)
  if (imgs && imgs.length) {
    for (const image of imgs) {
      try {
        const bmp = await loadImage(image.url);
        const { x, y, scale, rotation } = image.transform || { x: 0, y: 0, scale: 1, rotation: 0 };

        ctx.save();
        ctx.translate((x ?? 0) + 256, (y ?? 0) + 256);
        ctx.rotate(((rotation ?? 0) * Math.PI) / 180);
        ctx.scale(scale ?? 1, scale ?? 1);
        ctx.fillStyle = '#000000';
        ctx.fillRect(-bmp.width / 2, -bmp.height / 2, bmp.width, bmp.height);
        ctx.restore();
      } catch {
        // ignore missing image
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

// Roughness is multiplied: final = material.roughness * tex.r.
// We want background roughness = R_bg (glossy), overlays = R_ov (diffuse).
// So set material.roughness = R_ov, and tex.r = R_bg / R_ov for background, 1.0 for overlays.
function makeRoughnessMap(backgroundMask: THREE.CanvasTexture, R_bg: number, R_ov: number) {
  const ratio = Math.min(1, Math.max(0, R_bg / Math.max(1e-6, R_ov)));

  const src = backgroundMask.image as HTMLCanvasElement;
  const w = src.width, h = src.height;

  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(src, 0, 0);

  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;

  // backgroundMask: white(255)=background, black(0)=overlays
  for (let i = 0; i < data.length; i += 4) {
    const isBg = data[i] > 127; // red channel
    const val = isBg ? Math.round(ratio * 255) : 255;
    data[i] = data[i + 1] = data[i + 2] = val;
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(cv);
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

// ----------------------------------------------------------------

function GloveViewer() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const { glove, textZones, customImages } = useCustomizationStore();

  // Auto-rotation state
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const isUserInteracting = useRef(false);
  const isDraggingRef = useRef(false); // Use ref for immediate access in event handlers
  const resumeTimeout = useRef<NodeJS.Timeout | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Track user-set rotation to preserve during auto-rotation
  let userSetRotationX = 0;
  let userSetRotationY = 0;
  let userSetRotationZ = 0;

  // For manual drag
  let lastMouseX = 0;
  let lastMouseY = 0;

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#111');

    const camera = new THREE.PerspectiveCamera(
      45,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.5, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // nicer highlight rolloff for metals
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;


    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const directional = new THREE.DirectionalLight(0xffffff, 1);
    directional.position.set(5, 10, 7);
    scene.add(ambient, directional);
    // Environment for metallic reflections
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = new RoomEnvironment();
    const envRT = pmrem.fromScene(env, 0.04);
    scene.environment = envRT.texture;


    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.enableDamping = true;
    controls.enabled = false; // Disable OrbitControls, we handle rotation manually
    controls.update();
    controlsRef.current = controls;

    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
    loader.setDRACOLoader(dracoLoader);

    loader.load('/Boxing_Gloves_13_Demo_0114.glb', (gltf) => {
      const model = gltf.scene;
      model.scale.set(0.1, 0.1, 0.1);
      model.position.set(0, 0.1, 0);
      modelRef.current = model;
      scene.add(model);
      updateMaterials();
    });

    // Pointer event handlers for manual rotation
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      isUserInteracting.current = true; // Always set to true when user starts dragging
      isDraggingRef.current = true; // Set ref immediately for event handlers
      setIsDragging(true);
      if (resumeTimeout.current) {
        clearTimeout(resumeTimeout.current);
        resumeTimeout.current = null;
      }

      // Store initial position
      if (event instanceof MouseEvent) {
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
      } else if (event.touches.length > 0) {
        lastMouseX = event.touches[0].clientX;
        lastMouseY = event.touches[0].clientY;
      }
    };

    const handlePointerMove = (event: MouseEvent | TouchEvent) => {
      // Only allow rotation when actively dragging (use ref for immediate access)
      if (!isDraggingRef.current || !modelRef.current) return;

      let currentX = 0;
      let currentY = 0;
      let isShiftPressed = false;

      if (event instanceof MouseEvent) {
        currentX = event.clientX;
        currentY = event.clientY;
        isShiftPressed = event.shiftKey;
      } else if (event.touches.length > 0) {
        currentX = event.touches[0].clientX;
        currentY = event.touches[0].clientY;
        // For touch, use two-finger drag for Z-axis rotation
        isShiftPressed = event.touches.length === 2;
      }

      // Calculate drag delta
      const deltaX = currentX - lastMouseX;
      const deltaY = currentY - lastMouseY;

      // Rotation sensitivity - 5x increased for highly responsive rotation
      // Allows user to easily rotate glove to any angle including completely sideways (90°)
      const rotationSpeed = 0.05;

      if (isShiftPressed) {
        // SHIFT MODE: Z-axis rotation (roll to side)
        // Horizontal drag → Z-axis rotation (makes glove lie on its side)
        modelRef.current.rotation.z += deltaX * rotationSpeed;

        // Vertical drag → still affects X-axis for fine control
        modelRef.current.rotation.x += deltaY * rotationSpeed;
      } else {
        // NORMAL MODE: X and Y axis rotation
        // Horizontal drag → Y-axis rotation (spin left/right)
        modelRef.current.rotation.y += deltaX * rotationSpeed;

        // Vertical drag → X-axis rotation (tilt up/down)
        modelRef.current.rotation.x += deltaY * rotationSpeed;
      }

      // Update last position
      lastMouseX = currentX;
      lastMouseY = currentY;
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false; // Clear ref immediately
      setIsDragging(false);

      // Save user's final rotation state to preserve during auto-rotation
      if (modelRef.current) {
        userSetRotationX = modelRef.current.rotation.x;
        userSetRotationY = modelRef.current.rotation.y;
        userSetRotationZ = modelRef.current.rotation.z;
      }

      // In manual mode, keep user interaction active to prevent auto-rotation
      if (!autoRotateEnabled) {
        isUserInteracting.current = true; // Keep it as interacting in manual mode
      } else {
        // In auto mode, resume rotation after a short delay
        isUserInteracting.current = false;
        if (resumeTimeout.current) {
          clearTimeout(resumeTimeout.current);
        }
        resumeTimeout.current = setTimeout(() => {
          isUserInteracting.current = false;
        }, 1500);
      }
    };

    // Add event listeners
    renderer.domElement.addEventListener('mousedown', handlePointerDown as any);
    renderer.domElement.addEventListener('mousemove', handlePointerMove as any);
    renderer.domElement.addEventListener('mouseup', handlePointerUp);
    renderer.domElement.addEventListener('touchstart', handlePointerDown as any);
    renderer.domElement.addEventListener('touchmove', handlePointerMove as any);
    renderer.domElement.addEventListener('touchend', handlePointerUp);

    const animate = () => {
      requestAnimationFrame(animate);
      // Auto-rotation logic
      if (modelRef.current && autoRotateEnabled && !isUserInteracting.current) {
        modelRef.current.rotation.y += 0.005; // Continuous Y-axis rotation
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', handlePointerDown as any);
      renderer.domElement.removeEventListener('mousemove', handlePointerMove as any);
      renderer.domElement.removeEventListener('mouseup', handlePointerUp);
      renderer.domElement.removeEventListener('touchstart', handlePointerDown as any);
      renderer.domElement.removeEventListener('touchmove', handlePointerMove as any);
      renderer.domElement.removeEventListener('touchend', handlePointerUp);
      envRT.dispose();
      pmrem.dispose();

      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [autoRotateEnabled]);

  const updateMaterials = async () => {
    if (!modelRef.current) return;

    modelRef.current.traverse(async (child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        const material = child.material;
        const name = child.name;

        // pick color by mesh name
        let gloveColorHex = '#ffffff';
        switch (name) {
          case 'Fingers': gloveColorHex = glove.fingersColor.hex; break;
          case 'InnerPalm': gloveColorHex = glove.innerPalmColor.hex; break;
          case 'OutterPalm': gloveColorHex = glove.outerPalmColor.hex; break;
          case 'InnerThumb': gloveColorHex = glove.innerThumbColor.hex; break;
          case 'OutterThumb': gloveColorHex = glove.outerThumbColor.hex; break;
          case 'Strap': gloveColorHex = glove.strapColor.hex; break;
          case 'Wrist': gloveColorHex = glove.wristColor.hex; break;
          case 'WristOutline': gloveColorHex = glove.wristOutlineColor.hex; break;
          case 'Outline': gloveColorHex = glove.outlineColor.hex; break;
        }

        // do not tint the texture; color comes from map
        material.color.set('#ffffff');

        // overlays for this mesh
        const zone = name as keyof typeof textZones;
        const z = textZones[zone];
        const hasText = !!z?.text;
        const images = (customImages[zone] ?? []).map(img => {
          if (!img.transform) {
            img.transform = { x: 0, y: 0, scale: 1, rotation: 0 };
          }
          return img;
        });

        // base color map (with optional overlays baked)
        if (hasText || images.length > 0) {
          const texture = await generateTextTexture({
            text: z?.text || '',
            font: z?.font,
            size: z?.size,
            textColor: z?.color,
            bgColor: gloveColorHex,
            x: z?.x,
            y: z?.y,
            rotation: z?.rotation,
            images
          });
          material.map = texture;
          (texture as any).colorSpace = THREE.SRGBColorSpace;
          texture.needsUpdate = true;
        } else {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 2;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = gloveColorHex;
          ctx.fillRect(0, 0, 2, 2);
          const baseTexture = new THREE.CanvasTexture(canvas);
          material.map = baseTexture;
          (baseTexture as any).colorSpace = THREE.SRGBColorSpace;
          baseTexture.needsUpdate = true;
        }

        // determine finish
        const selectedColor = (() => {
          switch (name) {
            case 'Fingers': return glove.fingersColor;
            case 'InnerPalm': return glove.innerPalmColor;
            case 'OutterPalm': return glove.outerPalmColor;
            case 'InnerThumb': return glove.innerThumbColor;
            case 'OutterThumb': return glove.outerThumbColor;
            case 'Strap': return glove.strapColor;
            case 'Wrist': return glove.wristColor;
            case 'WristOutline': return glove.wristOutlineColor;
            case 'Outline': return glove.outlineColor;
            default: return undefined;
          }
        })();

        const finish = selectedColor?.finish;
        const nameLower = (selectedColor?.name || '').toLowerCase();
        const isMetallic = finish === 'metallic' || nameLower.startsWith('metallic') || selectedColor?.price === 7;
        const isMatte = finish === 'matte' || nameLower.startsWith('matte');

        // clear any old PBR maps that could override our values
        material.metalnessMap = null as any;
        material.roughnessMap = null as any;

        // base defaults
        if (isMetallic) {
          material.metalness = 0.5;
          material.roughness = 0.2;
          (material as any).envMapIntensity = 0.65;
        } else if (isMatte) {
          material.metalness = 0.0;
          material.roughness = 0.6;
          (material as any).envMapIntensity = 0.5;
        } else {
          material.metalness = 0.0;
          material.roughness = 1.0;
          (material as any).envMapIntensity = 1;
        }

        // --- prevent metallic bleed onto overlays (text/images) ---
        if (isMetallic && (hasText || images.length > 0)) {
          // Build a mask where background is WHITE, overlays BLACK
          const bgMask = await buildBackgroundMask(
            z && {
              text: z.text,
              font: z.font,
              size: z.size,
              x: z.x,
              y: z.y,
              rotation: z.rotation
            },
            images.map(i => ({ url: i.url, transform: i.transform }))
          );

          // Metalness only on background
          material.metalness = 0.5;
          material.metalnessMap = bgMask;

          // Make background glossy (R_bg), overlays diffuse (R_ov)
          const R_bg = 0.22;
          const R_ov = 0.65;
          material.roughness = R_ov;
          material.roughnessMap = makeRoughnessMap(bgMask, R_bg, R_ov);
        }

        material.needsUpdate = true;
      }
    });
  };

  useEffect(() => {
    console.log('[GloveViewer] Glove, text, or images changed - updating materials');
    console.log('[GloveViewer] Current fingersColor:', glove.fingersColor);
    console.log('[GloveViewer] Current innerPalmColor:', glove.innerPalmColor);
    updateMaterials();
  }, [glove, textZones, customImages]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        ref={mountRef}
        style={{ width: '100%', height: '100%', backgroundColor: '#111' }}
      />

      {/* Auto-rotation toggle button */}
      <button
        onClick={() => {
          const newAutoState = !autoRotateEnabled;
          setAutoRotateEnabled(newAutoState);

          // When switching to auto mode, allow rotation to resume
          if (newAutoState) {
            isUserInteracting.current = false;
          } else {
            // When switching to manual mode, stop rotation immediately
            isUserInteracting.current = true;
          }

          // Clear any pending resume timeout
          if (resumeTimeout.current) {
            clearTimeout(resumeTimeout.current);
            resumeTimeout.current = null;
          }
        }}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 10,
          backgroundColor: autoRotateEnabled ? '#D4B896' : '#374151',
          color: autoRotateEnabled ? '#1a237e' : '#ffffff',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 16px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title={autoRotateEnabled ? 'Click to switch to Manual mode - stops auto-rotation' : 'Click to switch to Auto mode - continuous rotation'}
      >
        <span style={{ fontSize: '18px' }}>
          {autoRotateEnabled ? '⟳' : '⏸'}
        </span>
        <span>
          {autoRotateEnabled ? 'Auto' : 'Manual'}
        </span>
      </button>
    </div>
  );
}

export default GloveViewer;