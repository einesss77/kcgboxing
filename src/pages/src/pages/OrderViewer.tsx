import { useState } from 'react';
import GloveViewer from "../../../components/GloveViewer.tsx";
import { loadCustomizationFromJson } from "../../../utils/loadCustomization.ts";

export default function OrderJsonLoader() {
    const [jsonInput, setJsonInput] = useState('');
    const [error, setError] = useState('');

    const handleLoad = () => {
        try {
            const parsed = JSON.parse(jsonInput);
            const gloveData = Array.isArray(parsed) ? parsed[0] : parsed;
            if (!gloveData) throw new Error("Objet vide");
            loadCustomizationFromJson(
                gloveData.glove,
                gloveData.textZones,
                gloveData.customImages
            );
            setError('');
        } catch (err) {
            console.error(err);
            setError('❌ JSON invalide ou incomplet');
        }
    };

    return (
        <div className="p-4 bg-gray-900 min-h-screen text-white">
            <h1 className="text-2xl font-bold mb-4">🧤 Charger un gant depuis un JSON</h1>

            <textarea
                className="w-full h-64 p-3 border border-gray-700 rounded mb-4 bg-gray-800 text-white"
                placeholder="Colle ici le JSON complet de la commande"
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
            />

            <button
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                onClick={handleLoad}
            >
                Charger
            </button>

            {error && <p className="text-red-500 mt-4">{error}</p>}

            <div className="mt-8 w-full h-[600px] border border-gray-600 rounded overflow-hidden">
                <GloveViewer />
            </div>
        </div>
    );
}
