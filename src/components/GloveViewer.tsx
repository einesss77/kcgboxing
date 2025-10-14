import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { useCustomizationStore } from '../store/customizationStore';
import { generateTextTexture } from '../utils/GenerateTextTexture';
// import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';


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

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const directional = new THREE.DirectionalLight(0xffffff, 1);
    directional.position.set(5, 10, 7);
    scene.add(ambient, directional);

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
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  const updateMaterials = async () => {
    if (!modelRef.current) return;

    modelRef.current.traverse(async (child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        const material = child.material;
        const name = child.name;

        // 🧠 Récupère la vraie couleur du gant
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

        // ⛔️ Ne pas teinter la texture
        material.color.set('#ffffff');

        const zone = name as keyof typeof textZones;
        const hasText = textZones[zone]?.text;
        const images = customImages[zone] ?? [];

        images.forEach(image => {
          if (!image.transform) {
            image.transform = { x: 0, y: 0, scale: 1, rotation: 0 };
          }
        });

        if (hasText || images.length > 0) {
          const texture = await generateTextTexture({
            text: textZones[zone]?.text || '',
            font: textZones[zone]?.font,
            size: textZones[zone]?.size,
            textColor: textZones[zone]?.color,
            bgColor: gloveColorHex,
            x: textZones[zone]?.x,
            y: textZones[zone]?.y,
            rotation: textZones[zone]?.rotation,
            images: images
          });

          material.map = texture;
          (texture as any).colorSpace = THREE.SRGBColorSpace;
          texture.needsUpdate = true;

        } else {
          // 🧤 Crée une texture plate de la couleur du gant
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
        // === FINISH: Metallic vs Matte ===
        // // 1) Get the selected color object for this mesh zone
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

        // 2) choose finish type from name or price
        const cname = (selectedColor?.name || '').toLowerCase();
        const isMetallic = cname.startsWith('metallic') || selectedColor?.price === 7;
        const isMatte = cname.startsWith('matte');

        // // 3) if GLTF had PBR maps, they override our values — null them
        if ('metalnessMap' in material) (material as any).metalnessMap = null;
        if ('roughnessMap' in material) (material as any).roughnessMap = null;

        // // 4) Apply PBR values (requires env map in 1)
        if ('metalness' in material && 'roughness' in material) {
          if (isMetallic) {
            material.metalness = 0.9;
            material.roughness = 0.15;
            (material as any).envMapIntensity = 0.65;

          } else if (isMatte) {
            material.metalness = 0.0;
            material.roughness = 1;
            (material as any).envMapIntensity = 1;
          } else {
            // default look 
            material.metalness = 0.0;
            material.roughness = 0.6;
            (material as any).envMapIntensity = 1;
          }
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
