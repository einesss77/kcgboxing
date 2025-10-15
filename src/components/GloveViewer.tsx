import { useEffect, useRef } from 'react';
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
    controls.update();

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

    const animate = () => {
      requestAnimationFrame(animate);
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
      envRT.dispose();
      pmrem.dispose();

      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

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
          material.metalness = 0.9;
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
    updateMaterials();
  }, [glove, textZones, customImages]);

  return (
    <div
      ref={mountRef}
      style={{ width: '100%', height: '100%', backgroundColor: '#111' }}
    />
  );
}

export default GloveViewer;