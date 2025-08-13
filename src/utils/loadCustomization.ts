import { CustomGlove, TextSettings, CustomImage, Zone } from '../store/customizationStore';
import { useCustomizationStore } from '../store/customizationStore';

export function loadCustomizationFromJson(
    gloveData: CustomGlove,
    textZones: Record<Zone, TextSettings>,
    customImages: Record<Zone, CustomImage[]>
) {
    const { updateColor, updateSize, updateTextZone, addCustomImage } =
        useCustomizationStore.getState();

    // Couleurs
    Object.entries(gloveData || {}).forEach(([key, value]) => {
        if (key.endsWith('Color') && value && typeof value === 'object') {
            // part = 'fingers', 'outerPalm', etc.
            const part = key.replace('Color', '');
            updateColor(part, value as any);
        }
    });

    // Taille
    if (gloveData?.size) {
        updateSize(gloveData.size);
    }

    // Textes
    Object.entries(textZones || {}).forEach(([zone, settings]) => {
        if (settings) {
            updateTextZone(zone as Zone, settings);
        }
    });

    // Images : on conserve id + transform du JSON dès l'ajout (pas besoin de 2e update)
    Object.entries(customImages || {}).forEach(([zone, images]) => {
        (images || []).forEach((image) => {
            addCustomImage(zone as Zone, image.url, {
                id: image.id,
                transform: image.transform,
            });
        });
    });
}
