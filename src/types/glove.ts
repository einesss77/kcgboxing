export type Finish = 'solid' | 'metallic' | 'fluorescent';

export interface GloveColor {
  name: string;
  hex: string;
  price: number;
  /** Visual finish of the color (optional to keep backward compatibility) */
  finish?: Finish;
  /** Metallic highlight strength 0..1 (used when finish === 'metallic') */
  gloss?: number;
  /** Fluorescent glow intensity 0..1 (used when finish === 'fluorescent') */
  glow?: number;
}

export interface GloveMaterial {
  name: string;
  description: string;
  price: number;
}

export interface GlovePattern {
  name: string;
  imageUrl: string;
  price: number;
}

export interface GloveTrim {
  name: string;
  description: string;
  price: number;
}

export interface CustomText {
  content: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
}

export interface CustomImage {
  url: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
}

export interface CustomGlove {
  id: string;
  basePrice: number;
  customizationCost: number;

  // Colorable parts
  palmColor: GloveColor;
  thumbColor: GloveColor;
  mainColor: GloveColor;
  wristColor: GloveColor;
  laceColor: GloveColor;
  trimColor: GloveColor;

  material: GloveMaterial;
  pattern: GlovePattern;
  trim: GloveTrim;

  size: string;
  customText: string;
  customTexts: CustomText[];
  customImages: CustomImage[];
}
