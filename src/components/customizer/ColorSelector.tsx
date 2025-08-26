import React from 'react';
import { useCustomizationStore } from '../../store/customizationStore';
import type { GloveColor } from '../../store/customizationStore'; // ← use store type to include finish/matte

/* Optional: set surcharges here */
const METALLIC_SURCHARGE = 9.99;
const MATTE_SURCHARGE = 0;

// === Color palette with finishes ===
const colors: GloveColor[] = [
  // Solids
  { name: 'Classic Black', hex: '#000000', price: 0, finish: 'solid' },
  { name: 'Classic White', hex: '#FFFFFF', price: 0, finish: 'solid' },
  { name: 'Navy Blue',     hex: '#1a237e', price: 0, finish: 'solid' },
  { name: 'Royal Blue',    hex: '#2563EB', price: 0, finish: 'solid' },
  { name: 'Forest Green',  hex: '#047857', price: 0, finish: 'solid' },
  { name: 'Rich Red',      hex: '#F03513', price: 0, finish: 'solid' },
  { name: 'Deep Brown',    hex: '#78350f', price: 0, finish: 'solid' },
  { name: 'Pearl White',   hex: '#f8fafc', price: 0, finish: 'solid' },
  { name: 'Carbon Black',  hex: '#111827', price: 0, finish: 'solid' },

  // Matte
  { name: 'Matte Black', hex: '#0b0b0b', price: MATTE_SURCHARGE, finish: 'matte' },
  { name: 'Matte Navy',  hex: '#0f1b3d', price: MATTE_SURCHARGE, finish: 'matte' },
  { name: 'Matte Red',   hex: '#b22323', price: MATTE_SURCHARGE, finish: 'matte' },
  { name: 'Matte Olive', hex: '#3a4a3d', price: MATTE_SURCHARGE, finish: 'matte' },

  // Metallics (with surcharge)
  { name: 'Metallic Gold',   hex: '#c5a572', price: METALLIC_SURCHARGE, finish: 'metallic', gloss: 0.75 },
  { name: 'Metallic Silver', hex: '#94A3B8', price: METALLIC_SURCHARGE, finish: 'metallic', gloss: 0.70 },
  { name: 'Metallic Purple', hex: '#9013F0', price: METALLIC_SURCHARGE, finish: 'metallic', gloss: 0.70 },
  { name: 'Rose Gold',       hex: '#f4a7a7', price: METALLIC_SURCHARGE, finish: 'metallic', gloss: 0.70 },

  // Fluorescents
  { name: 'Neon Green',  hex: '#22C55E', price: 0, finish: 'fluorescent', glow: 0.85 },
  { name: 'Clear Blue',  hex: '#13ECF0', price: 0, finish: 'fluorescent', glow: 0.85 },
  { name: 'Neon Yellow', hex: '#FFFF33', price: 0, finish: 'fluorescent', glow: 0.90 },
  { name: 'Neon Pink',   hex: '#FF10F0', price: 0, finish: 'fluorescent', glow: 0.90 },
];

/* === Swatch styling helpers === */
function metallicStyle(hex: string): React.CSSProperties {
  return {
    backgroundImage: `
      linear-gradient(
        180deg,
        rgba(0,0,0,0.25) 0%,
        ${hex} 20%,
        rgba(255,255,255,0.85) 45%,
        ${hex} 55%,
        rgba(0,0,0,0.2) 80%,
        ${hex} 100%
      )`,
    boxShadow:
      'inset 0 2px 6px rgba(255,255,255,0.35), inset 0 -2px 8px rgba(0,0,0,0.25)',
  };
}
function fluorescentStyle(hex: string): React.CSSProperties {
  return {
    backgroundColor: hex,
    boxShadow: `0 0 8px ${hex}, 0 0 16px ${hex}, 0 0 28px ${hex}88`,
    filter: 'saturate(1.35) brightness(1.1)',
  };
}
function matteStyle(hex: string): React.CSSProperties {
  return {
    backgroundColor: hex,
    boxShadow:
      'inset 0 0 0 1px rgba(255,255,255,0.10), inset 0 18px 40px rgba(255,255,255,0.03)',
    filter: 'saturate(0.95) brightness(0.98)',
  };
}
function solidStyle(hex: string): React.CSSProperties {
  return { backgroundColor: hex };
}
function getSwatchStyle(c: GloveColor): React.CSSProperties {
  if (c.finish === 'metallic') return metallicStyle(c.hex);
  if (c.finish === 'fluorescent') return fluorescentStyle(c.hex);
  if (c.finish === 'matte') return matteStyle(c.hex);
  return solidStyle(c.hex);
}

const fmt = (n: number) => `$${n.toFixed(2)}`;

const ColorSelector: React.FC = () => {
  const { glove, updateColor } = useCustomizationStore();

  // Match your CustomGlove fields exactly
  const sections = [
    { id: 'fingers',      label: 'Fingers',       color: glove.fingersColor },
    { id: 'innerPalm',    label: 'Inner Palm',    color: glove.innerPalmColor },
    { id: 'outerPalm',    label: 'Outer Palm',    color: glove.outerPalmColor },
    { id: 'innerThumb',   label: 'Inner Thumb',   color: glove.innerThumbColor },
    { id: 'outerThumb',   label: 'Outer Thumb',   color: glove.outerThumbColor },
    { id: 'strap',        label: 'Strap',         color: glove.strapColor },           // ← fixed label
    { id: 'wrist',        label: 'Wrist',         color: glove.wristColor },
    { id: 'wristOutline', label: 'Wrist Outline', color: glove.wristOutlineColor },    // ← fixed label
    { id: 'outline',      label: 'Outline',       color: glove.outlineColor },
  ] as const;

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <div key={section.id} className="mb-6">
          <h3 className="text-lg font-semibold mb-3">{section.label}</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {colors.map((color) => {
              const selected = section.color?.name === color.name;
              return (
                <button
                  key={`${section.id}-${color.name}`}
                  onClick={() => updateColor(section.id, color)}
                  style={getSwatchStyle(color)}
                  className={`
                    w-full aspect-square rounded-lg relative z-10 border border-white/70
                    ${selected ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-neutral-900' : ''}
                    hover:scale-105 transition-transform duration-200
                  `}
                  title={`${color.name}${color.price > 0 ? ` (+${fmt(color.price)})` : ''}`}
                >
                  {/* Badge (top-left) */}
                  {color.finish === 'metallic' && (
                    <div className="absolute top-0 left-0 bg-yellow-300/90 px-1.5 py-0.5 text-xs text-black rounded-br">
                      ✨ Metallic{color.price > 0 ? ` · +${fmt(color.price)}` : ''}
                    </div>
                  )}
                  {color.finish === 'fluorescent' && (
                    <div className="absolute top-0 left-0 bg-green-300/90 px-1.5 py-0.5 text-xs text-black rounded-br">
                      ⚡ Fluorescent
                    </div>
                  )}
                  {color.finish === 'matte' && (
                    <div className="absolute top-0 left-0 bg-neutral-300/90 px-1.5 py-0.5 text-xs text-black rounded-br">
                      Matte
                    </div>
                  )}

                  {/* Bottom-right price pill for non-metallic paid colors */}
                  {color.price > 0 && color.finish !== 'metallic' && (
                    <div className="absolute bottom-0 right-0 bg-black/70 px-1.5 py-0.5 text-xs text-white rounded-tl">
                      +{fmt(color.price)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="p-4 bg-neutral-900/50 rounded-lg border border-yellow-500/20">
        <h4 className="font-semibold mb-2">Color Selection Tips</h4>
        <ul className="text-sm text-neutral-300 space-y-1">
          <li>• Metallic finishes show a premium sheen (extra charge if shown).</li>
          <li>• Fluorescent colors appear bright with a glowing edge.</li>
          <li>• Matte finishes are low-gloss and diffuse (non-reflective).</li>
          <li>• Classic colors are included at no additional cost.</li>
        </ul>
      </div>
    </div>
  );
};

export default ColorSelector;
