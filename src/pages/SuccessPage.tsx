import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const SuccessPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const orderData = JSON.parse(sessionStorage.getItem('orderData') || 'null');

    if (!orderData) {
        return (
            <div className="pt-24 pb-16 container-custom text-center">
                <h1 className="text-2xl font-bold mb-4">Commande introuvable</h1>
                <p className="mb-8">Aucune information de commande n’a été transmise.</p>
                <button
                    onClick={() => navigate('/')}
                    className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold py-3 px-6 rounded-lg text-lg transition"
                >
                    Retour à l’accueil
                </button>
            </div>
        );
    }

    return (
        <div className="pt-24 pb-16 container-custom">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2"> Merci pour votre commande !</h1>
                <p className="text-neutral-400">Votre paiement a bien été confirmé.</p>
            </div>

            <div className="bg-neutral-800 text-white p-6 rounded-xl">
                <h2 className="text-xl font-semibold mb-4">Résumé de la commande :</h2>
                <pre className="bg-neutral-900 p-4 rounded overflow-auto text-sm">
          {JSON.stringify(orderData, null, 2)}
        </pre>
            </div>

            <div className="mt-8 text-center">
                <button
                    onClick={() => navigate('/')}
                    className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold py-3 px-6 rounded-lg text-lg transition"
                >
                    Retour à l’accueil
                </button>
            </div>
        </div>
    );
};

export default SuccessPage;
