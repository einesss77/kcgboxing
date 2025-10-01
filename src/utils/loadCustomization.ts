import {
  CustomGlove,
  TextSettings,
  CustomImage,
  Zone,
  GloveColor,
  useCustomizationStore,
} from '../store/customizationStore';

// Infer finish for older JSONs (includes 'matte')
function normalizeColor(c: any): GloveColor {
  if (!c) {
    return { name: 'Classic Black', hex: '#000000', price: 0, finish: 'solid' };
  }
  const nameLower = String(c.name ?? '').toLowerCase();

  const inferredFinish: GloveColor['finish'] =
    c.finish ??
    (nameLower.includes('metallic') || nameLower.includes('chrome')
      ? 'metallic'
      : nameLower.includes('neon') ||
        nameLower.includes('fluorescent') ||
        nameLower.includes('clear')
      ? 'fluorescent'
      : nameLower.includes('matte') ||
        nameLower.includes('matt') ||
        nameLower.includes('flat')
      ? 'matte'
      : 'solid');

  return {
    name: c.name ?? 'Color',
    hex: c.hex ?? '#000000',
    price: Number(c.price ?? 0),
    finish: inferredFinish,
    gloss: c.gloss ?? (inferredFinish === 'metallic' ? 0.7 : undefined),
    glow:  c.glow  ?? (inferredFinish === 'fluorescent' ? 0.85 : undefined),
  };
}

export function loadCustomizationFromJson(
  gloveData: CustomGlove,
  textZones: Record<Zone, TextSettings>,
  customImages: Record<Zone, CustomImage[]>
) {
  const { updateColor, updateSize, updateTextZone, addCustomImage } =
    useCustomizationStore.getState();

  // 1) CLEAR existing images so the previous load doesn't leak into this one
  {
    const state = useCustomizationStore.getState();
    const empty = Object.fromEntries(
      (Object.keys(state.customImages) as Zone[]).map((z) => [z, [] as CustomImage[]])
    ) as Record<Zone, CustomImage[]>;
    useCustomizationStore.setState({ customImages: empty });
  }

  // 2) Colors — strip the "Color" suffix so the store writes the right field
  Object.entries(gloveData || {}).forEach(([key, value]) => {
    if (key.endsWith('Color') && value && typeof value === 'object') {
      const part = key.replace(/Color$/, ''); // e.g. "fingersColor" -> "fingers"
      updateColor(part, normalizeColor(value));
    }
  });

  // 3) Size
  if (gloveData?.size) {
    updateSize(gloveData.size);
  }

  // 4) Text zones
  Object.entries(textZones || {}).forEach(([zone, settings]) => {
    if (settings) updateTextZone(zone as Zone, settings);
  });

  // 5) Images — keep id + transform from JSON when adding
  //    Skip WristOutline; Strap will mirror there automatically.
  Object.entries(customImages || {}).forEach(([zone, images]) => {
    if (zone === 'WristOutline') return;
    (images || []).forEach((image) => {
      addCustomImage(zone as Zone, image.url, {
        id: image.id,
        transform: image.transform,
      });
    });
  });
}
