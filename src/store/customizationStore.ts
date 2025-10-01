import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

// ===== New: finishes =====
export type Finish = 'solid' | 'metallic' | 'fluorescent';

export interface GloveColor {
  name: string;
  hex: string;
  price: number;

  // Optional visual finish (kept optional for backward compatibility)
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

export interface ImageTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface CustomImage {
  id: string;
  url: string;
  transform: ImageTransform;
}

export type Zone =
  | 'Wrist'
  | 'InnerThumb'
  | 'OutterThumb'
  | 'InnerPalm'
  | 'OutterPalm'
  | 'Strap'
  | 'WristOutline';

export interface TextSettings {
  text: string;
  font: string;
  color: string;
  size: number;
  rotation: number;
  x: number;
  y: number;

  // Optional finish for text rendering on the canvas
  finish?: Finish; // 'solid' | 'metallic' | 'fluorescent'
  gloss?: number;  // 0..1 (metallic intensity)
  glow?: number;   // 0..1 (fluorescent intensity)
}

export interface CustomGlove {
  id: string;
  basePrice: number;
  customizationCost: number;

  palmColor: GloveColor;
  thumbColor: GloveColor;
  mainColor: GloveColor;
  wristColor: GloveColor;
  laceColor: GloveColor;
  trimColor: GloveColor;

  fingersColor: GloveColor;
  innerPalmColor: GloveColor;
  outerPalmColor: GloveColor;
  innerThumbColor: GloveColor;
  outerThumbColor: GloveColor;
  strapColor: GloveColor;
  wristOutlineColor: GloveColor;
  outlineColor: GloveColor;

  material: GloveMaterial;
  pattern: GlovePattern;
  trim: GloveTrim;
  size: string;

  customTexts: TextSettings[];
  customImages: CustomImage[];
}

interface CustomizationState {
  glove: CustomGlove;
  textZones: Record<Zone, TextSettings>;
  customImages: Record<Zone, CustomImage[]>;

  updateColor: (part: string, color: GloveColor) => void;
  updateSize: (size: string) => void;
  updateTextZone: (zone: Zone, updates: Partial<TextSettings>) => void;

  /** Ajoute une image en conservant éventuellement id + transform (depuis un JSON). Renvoie l'id. */
  addCustomImage: (
    zone: Zone,
    url: string,
    options?: { id?: string; transform?: ImageTransform }
  ) => string;

  removeCustomImage: (zone: Zone, imageId: string) => void;
  updateImageTransform: (zone: Zone, imageId: string, transform: ImageTransform) => void;

  resetCustomization: () => void;
  calculatePrice: () => number;
}

// ===== Defaults with finishes =====
const defaultColor: GloveColor = {
  name: 'Classic Black',
  hex: '#000000',
  price: 0,
  finish: 'solid', // default finish for colors
};

const defaultTextSettings: TextSettings = {
  text: '',
  font: 'Arial',
  color: '#FFFFFF',
  size: 64,
  rotation: 0,
  x: 256,
  y: 256,
  finish: 'solid', // default finish for text
  gloss: 0.7,      // used if metallic
  glow: 0.8,       // used if fluorescent
};

const defaultImageTransform: ImageTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
};

const zones: Zone[] = [
  'Wrist',
  'InnerThumb',
  'OutterThumb',
  'InnerPalm',
  'OutterPalm',
  'Strap',
  'WristOutline',
];

const initialGlove: CustomGlove = {
  id: uuidv4(),
  basePrice: 135,
  customizationCost: 0,

  palmColor: { ...defaultColor },
  thumbColor: { ...defaultColor },
  mainColor: { ...defaultColor },
  wristColor: { ...defaultColor },
  laceColor: { ...defaultColor },
  trimColor: { ...defaultColor },

  fingersColor: { ...defaultColor },
  innerPalmColor: { ...defaultColor },
  outerPalmColor: { ...defaultColor },
  innerThumbColor: { ...defaultColor },
  outerThumbColor: { ...defaultColor },
  strapColor: { ...defaultColor },
  wristOutlineColor: { ...defaultColor },
  outlineColor: { ...defaultColor },

  material: {
    name: 'Premium Leather',
    description: 'Genuine leather for durability and comfort',
    price: 0,
  },
  pattern: {
    name: 'None',
    imageUrl: '',
    price: 0,
  },
  trim: {
    name: 'Standard',
    description: 'Classic boxing glove trim',
    price: 0,
  },
  size: '12oz',

  customTexts: [],
  customImages: [],
};

export const useCustomizationStore = create<CustomizationState>((set, get) => ({
  glove: initialGlove,

  // Use spreads so any new defaults (finish/gloss/glow) propagate automatically
  textZones: {
 Wrist: { text: '', font: 'Arial', color: '#FFFFFF', size: 36, rotation: 90, x: 260, y: 360 },
    InnerThumb: { text: '', font: 'Arial', color: '#FFFFFF', size: 28, rotation: 300, x: 250, y: 220 },
    OutterThumb: { text: '', font: 'Arial', color: '#FFFFFF', size: 70, rotation: 30, x: 180, y: 230 },
    InnerPalm: { text: '', font: 'Arial', color: '#FFFFFF', size: 36, rotation: 0, x: 200, y: 110 },
    OutterPalm: { text: '', font: 'Arial', color: '#FFFFFF', size: 32, rotation: 0, x: 350, y: 400 },
    Strap: { text: '', font: 'Arial', color: '#FFFFFF', size: 32, rotation: 90, x: 110, y: 450 },
    WristOutline: { text: '', font: 'Arial', color: '#FFFFFF', size: 64, rotation: 0, x: 256, y: 256 },

  },

  customImages: zones.reduce((acc, zone) => {
    acc[zone] = [];
    return acc;
  }, {} as Record<Zone, CustomImage[]>),

  updateColor: (part, color) => {
    set((state) => {
      const updatedGlove = { ...state.glove };
      // store the entire object to preserve finish/gloss/glow
      (updatedGlove as any)[`${part}Color`] = color;
      updatedGlove.customizationCost = get().calculatePrice() - updatedGlove.basePrice;
      return { glove: updatedGlove };
    });
  },

  updateSize: (size) => {
    set((state) => ({
      glove: { ...state.glove, size },
    }));
  },

  updateTextZone: (zone, updates) => {
    set((state) => {
      const updated = {
        ...state.textZones[zone],
        ...updates,
      };

      const updatedZones: Record<Zone, TextSettings> = {
        ...state.textZones,
        [zone]: {
          ...state.textZones[zone],
          ...updates,
        },
       };

      // Mirror Strap settings to WristOutline (as before)
      if (zone === 'Strap') {
        updatedZones.WristOutline = {
          ...state.textZones.WristOutline,
          ...updates,
        };
      }

      return { textZones: updatedZones };
    });
  },

  addCustomImage: (zone, url, options) => {
    const id = options?.id ?? uuidv4();
    const transform: ImageTransform = options?.transform ?? { ...defaultImageTransform };
    const newImage: CustomImage = { id, url, transform };

    set((state) => {
      const updatedImages: Record<Zone, CustomImage[]> = {
        ...state.customImages,
        [zone]: [...state.customImages[zone], newImage],
      };

      if (zone === 'Strap') {
        // miroir vers WristOutline avec le même id + transform
        updatedImages.WristOutline = [...state.customImages.WristOutline, { ...newImage }];
      }

      return { customImages: updatedImages };
    });

    return id;
  },

  removeCustomImage: (zone, imageId) => {
    set((state) => {
      const updatedImages: Record<Zone, CustomImage[]> = {
        ...state.customImages,
        [zone]: state.customImages[zone].filter((img) => img.id !== imageId),
      };

      if (zone === 'Strap') {
        updatedImages.WristOutline = state.customImages.WristOutline.filter((img) => img.id !== imageId);
      }

      return { customImages: updatedImages };
    });
  },

  updateImageTransform: (zone, imageId, transform) => {
    console.log('[store] updateImageTransform ->', { zone, imageId, transform });
    set((state) => {
      const updatedImages: Record<Zone, CustomImage[]> = {
        ...state.customImages,
        [zone]: state.customImages[zone].map((img) => (img.id === imageId ? { ...img, transform } : img)),
      };

      if (zone === 'Strap') {
        updatedImages.WristOutline = state.customImages.WristOutline.map((img) =>
         img.id === imageId ? { ...img, transform } : img
        );
      }

      return { customImages: updatedImages };
    });
  },

  resetCustomization: () => {
    set({
      glove: { ...initialGlove, id: uuidv4() },
      textZones: zones.reduce((acc, zone) => {
        acc[zone] = { ...defaultTextSettings };
        return acc;
      }, {} as Record<Zone, TextSettings>),
      customImages: zones.reduce((acc, zone) => {
        acc[zone] = [];
        return acc;
      }, {} as Record<Zone, CustomImage[]>),
    });
  },

  calculatePrice: () => {
    const { glove } = get();
    let total = glove.basePrice;

    total += glove.palmColor.price;
    total += glove.thumbColor.price;
    total += glove.mainColor.price;
    total += glove.wristColor.price;
    total += glove.laceColor.price;
    total += glove.trimColor.price;
    total += glove.fingersColor.price;
    total += glove.innerPalmColor.price;
    total += glove.outerPalmColor.price;
    total += glove.innerThumbColor.price;
    total += glove.outerThumbColor.price;
    total += glove.strapColor.price;
    total += glove.wristOutlineColor.price;
    total += glove.outlineColor.price;

    total += glove.material.price;
    total += glove.pattern.price;
    total += glove.trim.price;

    total += glove.customTexts.length * 4.99;

    const totalImages = Object.entries(get().customImages)
      .filter(([zone]) => zone !== 'WristOutline')
      .reduce((sum, [, zoneImages]) => sum + zoneImages.length, 0);
    total += totalImages * 5;

    return total;
  },
}));
