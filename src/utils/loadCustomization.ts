import {
  CustomGlove,
  TextSettings,
  CustomImage,
  Zone,
  GloveColor,
  ColorField,
  useCustomizationStore,
} from '../store/customizationStore';

// Infer finish for older JSONs that may not include it
function normalizeColor(c: any): GloveColor {
  if (!c) {
    return { name: 'Classic Black', hex: '#000000', price: 0, finish: 'solid' };
  }
  const name = String(c.name ?? '').toLowerCase();

  const inferredFinish: GloveColor['finish'] =
    c.finish ??
    (name.includes('metallic') || name.includes('chrome') ? 'metallic'
      : name.includes('neon') || name.includes('fluorescent') || name.includes('clear')
      ? 'fluorescent'
      : 'solid');

  return {
    name: c.name ?? 'Color',
    hex: c.hex ?? '#000000',
    price: Number(c.price ?? 0),
    finish: inferredFinish,
    // keep any provided values, otherwise set sensible defaults
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

  // Colors — set the EXACT color fields (no stripping "Color")
  Object.entries(gloveData || {}).forEach(([key, value]) => {
    if (key.endsWith('Color') && value && typeof value === 'object') {
      const field = key as ColorField;                 // e.g. "fingersColor"
      const color = normalizeColor(value);             // ensure finish/gloss/glow exist
      updateColor(field, color);                       // store updates cost internally
    }
  });

  // Size
  if (gloveData?.size) {
    updateSize(gloveData.size);
  }

  // Text zones
  Object.entries(textZones || {}).forEach(([zone, settings]) => {
    if (settings) {
      updateTextZone(zone as Zone, settings);
    }
  });

  // Images — keep id + transform from JSON when adding
  Object.entries(customImages || {}).forEach(([zone, images]) => {
    (images || []).forEach((image) => {
      addCustomImage(zone as Zone, image.url, {
        id: image.id,
        transform: image.transform,
      });
    });
  });
}
