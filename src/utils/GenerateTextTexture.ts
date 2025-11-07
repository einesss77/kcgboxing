import * as THREE from 'three';
import type { CustomImage } from '../store/customizationStore';

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

// Load a font and ensure it's ready before rendering
async function loadFont(fontFamily: string): Promise<void> {
  // Skip loading for system fonts
  const systemFonts = ['Arial', 'Courier New', 'Georgia', 'Impact', 'Verdana'];
  if (systemFonts.includes(fontFamily)) {
    return;
  }

  try {
    // Use CSS Font Loading API to ensure font is loaded
    await document.fonts.load(`bold 64px "${fontFamily}"`);

    // Additional check: wait for fonts to be ready
    await document.fonts.ready;
  } catch (error) {
    console.warn(`Failed to load font: ${fontFamily}`, error);
    // Continue anyway - browser will fall back to default font
  }
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
  // IMPORTANT: Load the font first before rendering
  await loadFont(font);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background color
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = bgColor ?? '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  // Images
  for (const image of images) {
    const img = await loadImage(image.url);
    const { x, y, scale, rotation } = image.transform;
    ctx.save();
    ctx.translate(x + 256, y + 256);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  }

  // Text
  if (text) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.font = `bold ${size}px "${font}"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
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