import * as THREE from 'three';
import type { CustomImage } from '../store/customizationStore';

//
// Font-loading helpers: ensure the chosen web font is available before drawing
//
const loadedFontFamilies = new Set<string>();

function getPrimaryFamily(fontSetting: string): string {
  const first = (fontSetting || '').split(',')[0].trim();
  return first.replace(/^['"]|['"]$/g, ''); // strip surrounding quotes
}

async function ensureFontLoaded(fontFamily: string, px: number) {
  // Best-effort for older browsers that lack the Font Loading API
  if (!('fonts' in document)) return;
  if (loadedFontFamilies.has(fontFamily)) return;

  try {
    // Load the exact family at the size you need
    // @ts-ignore
    await document.fonts.load(`${px}px "${fontFamily}"`);
    loadedFontFamilies.add(fontFamily);
  } catch (e) {
    console.warn('Font load failed (fallback may render):', fontFamily, e);
  }
}

interface TextOptions {
  text: string;
  font?: string;
  textColor?: string;
  bgColor?: string;
  x?: number;
  y?: number;
  rotation?: number;
  size?: number;
  images?: CustomImage[];
}

export async function generateTextTexture({
  text,
  font = 'Arial',
  textColor = '#FFFFFF',
  bgColor = '#000000',
  x = 256,
  y = 256,
  rotation = 0,
  size = 64,
  images = [],
}: TextOptions): Promise<THREE.Texture> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = bgColor ?? '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  // Images
  for (const image of images) {
    const img = await loadImage(image.url);
    const { x: ix, y: iy, scale, rotation: r } = image.transform;
    ctx.save();
    ctx.translate(ix + 256, iy + 256);
    ctx.rotate((r * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  }

  // Text
  if (text) {
    // 1) Wait for the selected web font
    const family = getPrimaryFamily(font); // "Pacifico" | "Parisienne" | "League Script" | "UnifrakturMaguntia"
    await ensureFontLoaded(family, size);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rotation * Math.PI) / 180);

    // 2) Do NOT force bold — some script/blackletter faces have no bold variant
    // Quote family names to support spaces
    ctx.font = `${size}px "${family}"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Optional: stroke width scaled to size for nicer outlines
    ctx.lineWidth = Math.max(1, Math.round(size * 0.06));
    ctx.strokeStyle = '#FFFFFF';
    ctx.strokeText(text, 0, 0);

    ctx.fillStyle = textColor;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
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
