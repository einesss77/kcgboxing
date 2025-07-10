import React, { useState } from 'react';
import { useCustomizationStore } from '../../store/customizationStore';
import { Image as ImageIcon, X, Move, RotateCw, Maximize, Plus } from 'lucide-react';
import type { Zone, ImageTransform } from '../../store/customizationStore';

const AVAILABLE_ZONES = ['OutterPalm', 'OutterThumb', 'Strap'] as const;
type AvailableZone = typeof AVAILABLE_ZONES[number];

const ZONE_LABELS: Record<AvailableZone, string> = {
  OutterPalm: 'Outer Palm',
  OutterThumb: 'Outer Thumb',
  Strap: 'Strap'
};

export default function ImageUploader() {
  const { customImages, addCustomImage, removeCustomImage, updateImageTransform } = useCustomizationStore();
  const [selectedZone, setSelectedZone] = useState<AvailableZone>('OutterPalm');
  const [isDragging, setIsDragging] = useState(false);
 
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    
    processFile(file);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        addCustomImage(selectedZone, reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTransformChange = (imageId: string, property: keyof ImageTransform, value: number) => {
    const image = customImages[selectedZone].find(img => img.id === imageId);
    if (!image) return;

    updateImageTransform(selectedZone, imageId, {
      ...image.transform,
      [property]: value
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-3">Upload Custom Images</h3>
        <p className="text-neutral-400 text-sm mb-4">
          Add multiple images to customize specific areas of the gloves. Each image costs $7.99.
        </p>
      </div>

      <div className="bg-neutral-800 rounded-xl p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Select Zone</label>
          <select
            className="w-full bg-neutral-700 rounded-lg border border-neutral-600 p-3 focus:outline-none focus:ring-2 focus:ring-gold focus:border-gold"
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value as AvailableZone)}
          >
            {AVAILABLE_ZONES.map((zone) => (
              <option key={zone} value={zone}>{ZONE_LABELS[zone]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Add Image (+$7.99)</label>
          <div
            className={`
              border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
              ${isDragging ? 'border-gold bg-gold/10' : 'border-neutral-600 hover:border-gold/50'}
            `}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            <input
              type="file"
              id="fileInput"
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
            <ImageIcon className="h-12 w-12 mx-auto mb-4 text-neutral-400" />
            <p className="text-sm text-neutral-300 mb-2">
              Drag and drop your image here, or click to browse
            </p>
            <p className="text-xs text-neutral-500">
              Supports: PNG, JPG, JPEG (max 5MB)
            </p>
          </div>
        </div>

        {customImages[selectedZone].length > 0 && (
          <div className="space-y-6">
            <h4 className="font-medium flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Images for {ZONE_LABELS[selectedZone]}
            </h4>
            
            {customImages[selectedZone].map((image) => (
              <div key={image.id} className="bg-neutral-900 rounded-lg p-4 space-y-4">
                <div className="relative">
                  <img
                    src={image.url}
                    alt="Preview"
                    className="w-full rounded-lg border border-neutral-600"
                  />
                  <button
                    onClick={() => removeCustomImage(selectedZone, image.id)}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 p-2 rounded-full transition-colors"
                    title="Remove image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Move className="h-4 w-4 text-gold" />
                    <label className="text-sm font-medium">Position</label>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>X Position</span>
                        <span>{image.transform.x.toFixed(0)}px</span>
                      </div>
                      <input
                        type="range"
                        min="-512"
                        max="512"
                        value={image.transform.x}
                        onChange={(e) => handleTransformChange(image.id, 'x', parseInt(e.target.value))}
                        className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Y Position</span>
                        <span>{image.transform.y.toFixed(0)}px</span>
                      </div>
                      <input
                        type="range"
                        min="-512"
                        max="512"
                        value={image.transform.y}
                        onChange={(e) => handleTransformChange(image.id, 'y', parseInt(e.target.value))}
                        className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <RotateCw className="h-4 w-4 text-gold" />
                    <label className="text-sm font-medium">Rotation</label>
                  </div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Angle</span>
                    <span>{image.transform.rotation.toFixed(0)}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={image.transform.rotation}
                    onChange={(e) => handleTransformChange(image.id, 'rotation', parseInt(e.target.value))}
                    className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Maximize className="h-4 w-4 text-gold" />
                    <label className="text-sm font-medium">Scale</label>
                  </div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Size</span>
                    <span>{image.transform.scale.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.01"
                    max="2"
                    step="0.01"
                    value={image.transform.scale}
                    onChange={(e) => handleTransformChange(image.id, 'scale', parseFloat(e.target.value))}
                    className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-navy/30 rounded-lg border border-gold/20 p-4">
          <h4 className="font-semibold mb-2">Image Guidelines</h4>
          <ul className="text-sm text-neutral-400 space-y-1">
            <li>• Images should have a transparent background for best results</li>
            <li>• Recommended size: 512x512 pixels</li>
            <li>• Keep file size under 5MB for optimal performance</li>
            <li>• Each image costs $7.99</li>
            <li>• You can add multiple images to each zone</li>
          </ul>
        </div>
      </div>
    </div>
  );
}