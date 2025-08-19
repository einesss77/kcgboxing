import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';
import { useCustomizationStore } from '../store/customizationStore';
import { generateTextTexture } from '../utils/GenerateTextTexture';

// Apply finish ONLY from color (metallic/fluorescent/solid)
function applyFinish(
  mat: THREE.MeshStandardMaterial,
  c: { hex: string; finish?: 'solid'|'metallic'|'fluorescent'; glow?: number }
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
    default:
      // solid
      break;
  }
}

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

    // Simple environment for metallic reflections
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
      void updateMaterials();
      scene.add(model);
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
      case 'Strap':         return glove.strapColor;
      case 'Wrist':         return glove.wristColor;
      case 'WristOutline':  return glove.wristOutlineColor;
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
    const z = zone ? textZones[zone] : undefined;
    const txt = z?.text ?? '';
    const imgs = zone ? (customImages[zone] ?? []) : [];

    imgs.forEach((image: any) => {
      if (!image.transform) {
        image.transform = { x: 0, y: 0, scale: 1, rotation: 0 };
      }
    });

    // Build map: if there is text or images, composite them on top of a flat bg
    if (txt || imgs.length > 0) {
      const texture = await generateTextTexture({
        text: txt,
        font: z?.font,
        size: z?.size,
        textColor: z?.color,
        bgColor: bgHex,         // only background color is used from GloveColor
        x: z?.x,
        y: z?.y,
        rotation: z?.rotation,
        images: imgs
        // IMPORTANT: no finish/gloss/glow passed here (texts stay normal)
      });
      material.map = texture;
    } else {
      // No overlays: 2x2 flat texture in the selected color
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 2;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = bgHex;
      ctx.fillRect(0, 0, 2, 2);
      material.map = new THREE.CanvasTexture(canvas);
    }

    // Apply PBR finish based on the color selection ONLY
    applyFinish(material, c);
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
    <div
      ref={mountRef}
      style={{ width: '100%', height: '100%', backgroundColor: '#111' }}
    />
  );
}

export default GloveViewer;
