import React from 'react';
import { useCustomizationStore } from '../../store/customizationStore';
import { GloveColor } from '../../types/glove';

const colors: GloveColor[] = [
  { name: 'Classic Black', hex: '#000000', price: 0 },
  { name: 'Classic White', hex: '#FFFFFF', price: 0 },
  { name: 'Navy Blue', hex: '#1a237e', price: 0 },
  { name: 'Royal Blue', hex: '#2563EB', price: 0 },
  { name: 'Forest Green', hex: '#047857', price: 0 },
  { name: 'Neon Green', hex: '#22C55E', price: 0 },
  { name: 'Rich Red', hex: '#dc2626', price: 0 },
  { name: 'Deep Brown', hex: '#78350f', price: 0 },
  { name: 'Carbon Black', hex: '#111827', price: 0 },
  { name: 'Pearl White', hex: '#f8fafc', price: 0 },
  { name: 'Rose Gold', hex: '#f472b6', price: 0 },
  { name: 'Ultra Black', hex: '#0A0A0A', price: 0 },

  // Couleurs Mattes
  { name: 'Matte Black', hex: '#1C1C1C', price: 0 },
  { name: 'Matte White', hex: '#F5F5F5', price: 0 },
  { name: 'Matte Orange', hex: '#FF6F00', price: 0 },
  { name: 'Matte Blue', hex: '#1E3A8A', price: 0 },

  // Couleurs Mettalic
  { name: 'Metallic Purple', hex: '#6A0DAD', price: 7 },
  { name: 'Metallic Blue', hex: '#1F51FF', price: 7 },
  { name: 'Metallic Black', hex: '#2B2B2B', price: 7 },
  { name: 'Metallic White', hex: '#FFFFFF', price: 7 },
  { name: 'Metallic Gold', hex: '#D4AF37', price: 7 },
  { name: 'Metallic Silver', hex: '#C0C0C0', price: 7 },
  { name: 'Metallic Green', hex: '#0A8754', price: 7 },
  { name: 'Metallic Silver', hex: '#94A3B8', price: 7 },
  { name: 'Metallic Purple', hex: '#9333EA', price: 7 },
  { name: 'Metallic Gold', hex: '#c5a572', price: 7 }

];

const ColorSelector: React.FC = () => {
  const { glove, updateColor } = useCustomizationStore();

  const sections = [
    { id: 'outerPalm', label: 'Outer Palm', color: glove.outerPalmColor },
    { id: 'innerPalm', label: 'Inner Palm', color: glove.innerPalmColor },
    { id: 'innerThumb', label: 'Inner Thumb', color: glove.innerThumbColor },
    { id: 'outerThumb', label: 'Outer Thumb', color: glove.outerThumbColor },
    { id: 'fingers', label: 'Fingers', color: glove.fingersColor },
    { id: 'strap', label: 'Wrist Outline', color: glove.strapColor },
    { id: 'wrist', label: 'Wrist', color: glove.wristColor },
    { id: 'wristOutline', label: 'Starp', color: glove.wristOutlineColor },
    { id: 'outline', label: 'Outline', color: glove.outlineColor },
  ];

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <div key={section.id} className="mb-6">
          <h3 className="text-lg font-semibold mb-3">{section.label}</h3>
          <div className="grid grid-cols-5 gap-3">
            {colors.map((color) => (
              <button
                key={`${section.id}-${color.name}`}
                onClick={() => updateColor(section.id, color)}
                style={{ backgroundColor: color.hex }}
                className={`
                  w-full aspect-square rounded-lg relative z-10 border border-white
                  ${section.color?.name === color.name ? 'ring-2 ring-gold ring-offset-2 ring-offset-navy' : ''}
                  hover:scale-105 transition-transform duration-200
                `}
                title={`${color.name}${color.price > 0 ? ` (+$${color.price.toFixed(2)})` : ''}`}
              >
                {color.price > 0 && (
                  <div className="absolute bottom-0 right-0 bg-black/70 px-1.5 py-0.5 text-xs text-white">
                    +${color.price.toFixed(2)}
                  </div>
                )}
                {color.name.toLowerCase().includes('metallic') && (
                  <div className="absolute top-0 left-0 bg-yellow-300/30 px-1.5 py-0.5 text-xs text-black">
                    ✨ Metallic
                  </div>
                )}
                {color.name.toLowerCase().includes('matte') && (
                  <div className="absolute top-0 left-0 bg-neutral-800/60 px-1.5 py-0.5 text-xs text-white">
                    ⚫ Matte
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="p-4 bg-navy/30 rounded-lg border border-gold/20">
        <h4 className="font-semibold mb-2">Color Selection Tips</h4>
        <ul className="text-sm text-neutral-400 space-y-1">
          <li>• Metallic finishes add a premium look and enhanced durability</li>
          <li>• Classic colors are included at no additional cost</li>
          <li>• Premium colors feature special pigments for vibrant, long-lasting color</li>
        </ul>
      </div>
    </div>
  );
};

export default ColorSelector;
