import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';
import { useCustomizationStore } from '../store/customizationStore';
import type { CustomImage, TextSettings } from '../store/customizationStore';
import { generateTextTexture } from '../utils/GenerateTextTexture';

// Apply finish ONLY from color (metallic/fluorescent/matte/solid)
function applyFinish(
  mat: THREE.MeshStandardMaterial,
  c: { hex: string; finish?: 'solid' | 'metallic' | 'fluorescent' | 'matte'; glow?: number }
) {
  const base = new THREE.Color(c.hex);

  // Albedo comes from map; keep base white
  mat.color.set('#ffffff');
  // Defaults
  mat.metalness = 0.1;
  mat.roughness = 0.5;
  mat.emissive.set(0x000000);
  mat.emissiveIntensity = 0;

  switch (c.finish) {
    case 'metallic':
      mat.metalness = 0.9;
      mat.roughness = 0.22;
      break;
    case 'fluorescent':
      mat.metalness = 0.0;
      mat.roughness = 0.35;
      mat.emissive.copy(base);
      mat.emissiveIntensity = Math.min(1.2, Math.max(0.2, c.glow ?? 0.9));
      break;
    case 'matte':
      mat.metalness = 0.0;
      mat.roughness = 0.9; // very diffuse, non-glossy
      break;
    default:
      // solid
      break;
  }
}

/* =========================
   MASK HELPERS (keep finishes OFF text & images)
   white = background (finish ON)
   black = text/images (finish OFF)
========================= */
const loadedFontFamilies = new Set<string>();
function getPrimaryFamily(fontSetting?: string) {
  const first = (fontSetting || 'Arial').split(',')[0].trim();
  return first.replace(/^['"]|['"]$/g, '');
}
async function ensureFontLoaded(fontFamily: string, px: number) {
  // @ts-ignore
  if (!('fonts' in document)) return;
  if (loadedFontFamilies.has(fontFamily)) return;
  try {
    // @ts-ignore
    await document.fonts.load(`${px}px "${fontFamily}"`);
    loadedFontFamilies.add(fontFamily);
  } catch {
    // ignore
  }
}
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
async function buildMaskTexture(z?: TextSettings, imgs?: CustomImage[]) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  // Start white (finish ON everywhere)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 512);

  // Knock out TEXT to black (finish OFF)
  if (z?.text) {
    const family = getPrimaryFamily(z.font);
    await ensureFontLoaded(family, z.size ?? 64);

    ctx.save();
    ctx.translate(z.x ?? 256, z.y ?? 256);
    ctx.rotate(((z.rotation ?? 0) * Math.PI) / 180);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${z.size ?? 64}px "${family}"`;
    ctx.fillStyle = '#000000';
    ctx.fillText(z.text, 0, 0);
    ctx.restore();
  }

  // Knock out IMAGES to black (approx by their transformed rect)
  if (imgs && imgs.length) {
    for (const image of imgs) {
      try {
        const img = await loadImage(image.url);
        const { x, y, scale, rotation } = image.transform || {
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
        };

        ctx.save();
        ctx.translate((x ?? 0) + 256, (y ?? 0) + 256);
        ctx.rotate(((rotation ?? 0) * Math.PI) / 180);
        ctx.scale(scale ?? 1, scale ?? 1);
        ctx.fillStyle = '#000000';
        ctx.fillRect(-img.width / 2, -img.height / 2, img.width, img.height);
        ctx.restore();
      } catch {
        // skip if image fails to load
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}
/* ======================= */

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
    (renderer as any).outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mountRef.current.appendChild(renderer.domElement);

    // Lights
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
      void updateMaterials();
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

  const getColorForMesh = (name: string) => {
    switch (name) {
      case 'Fingers':       return glove.fingersColor;
      case 'InnerPalm':     return glove.innerPalmColor;
      case 'OutterPalm':    return glove.outerPalmColor;
      case 'InnerThumb':    return glove.innerThumbColor;
      case 'OutterThumb':   return glove.outerThumbColor;
      case 'WristOutline':         return glove.strapColor;
      case 'Wrist':         return glove.wristColor;
      case 'Strap':  return glove.wristOutlineColor;
      case 'Outline':       return glove.outlineColor;
      default:              return glove.mainColor;
    }
  };

  const isZone = (name: string): name is keyof typeof textZones =>
    Object.prototype.hasOwnProperty.call(textZones, name);

  const processMesh = async (mesh: THREE.Mesh) => {
    if (!(mesh.material instanceof THREE.MeshStandardMaterial)) return;

    const material = mesh.material;
    const name = mesh.name;
    const c = getColorForMesh(name);
    const bgHex = c.hex;

    // Collect overlays for this zone (if any)
    const zone = isZone(name) ? name : undefined;
    const z = zone ? (textZones[zone] as TextSettings) : undefined;
    const txt = z?.text ?? '';
    const imgs: CustomImage[] = zone ? (customImages[zone] ?? []) : [];

    imgs.forEach((image) => {
      if (!image.transform) {
        image.transform = { x: 0, y: 0, scale: 1, rotation: 0 };
      }
    });

    // Base albedo map (with text/images baked in)
    if (txt || imgs.length > 0) {
      const texture = await generateTextTexture({
        text: txt,
        font: z?.font,
        size: z?.size,
        textColor: z?.color,
        bgColor: bgHex,
        x: z?.x,
        y: z?.y,
        rotation: z?.rotation,
        images: imgs,
      });
      material.map = texture;
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 2;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = bgHex;
      ctx.fillRect(0, 0, 2, 2);
      material.map = new THREE.CanvasTexture(canvas);
    }

    // Apply PBR finish based on the selected color ONLY
    applyFinish(material, c);

    // ---- Mask out text & images from the finish so they stay plain ----
    material.emissiveMap = null as any;
    material.metalnessMap = null as any;

    if (txt || imgs.length > 0) {
      const mask = await buildMaskTexture(z, imgs);

      if (c.finish === 'fluorescent') {
        // Glow only on background (white in mask)
        material.emissiveMap = mask;
      }
      if (c.finish === 'metallic') {
        // Metalness only on background (white in mask)
        material.metalnessMap = mask;
      }
      // 'matte' and 'solid' need no maps
    }
    // -------------------------------------------------------------------

    material.needsUpdate = true;
  };

  const updateMaterials = async () => {
    const model = modelRef.current;
    if (!model) return;

    const tasks: Promise<void>[] = [];
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) tasks.push(processMesh(child));
    });
    await Promise.all(tasks);
  };

  useEffect(() => {
    void updateMaterials();
  }, [glove, textZones, customImages]);

  return (
    <div ref={mountRef} style={{ width: '100%', height: '100%', backgroundColor: '#111' }} />
  );
}

export default GloveViewer;
