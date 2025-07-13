import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const SuccessPage: React.FC = () => {
    const navigate = useNavigate();

    const orderData = JSON.parse(sessionStorage.getItem('orderData') || 'null');

    if (!orderData) {
        return (
            <div className="pt-24 pb-16 container-custom text-center">
                <h1 className="text-2xl font-bold mb-4">Commande introuvable</h1>
                <p className="mb-8 text-neutral-400">Aucune information de commande n’a été transmise.</p>
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
        <div className="pt-24 pb-16 container-custom max-w-2xl mx-auto text-white">
            <div className="bg-neutral-900 p-8 rounded-xl shadow-md text-center">
                <h1 className="text-3xl font-bold mb-2">Commande confirmée</h1>
                <p className="text-neutral-400 mb-6">Merci pour votre achat. Vous recevrez un e-mail de confirmation sous peu.</p>

                <div className="text-left space-y-2 mb-6">
                    <div><strong>Nom :</strong> {orderData.name}</div>
                    <div><strong>Email :</strong> {orderData.email}</div>
                    <div><strong>Téléphone :</strong> {orderData.phone}</div>
                    <div><strong>Adresse :</strong> {orderData.address}</div>
                    <div><strong>Total :</strong> {Number(orderData.total).toFixed(2)} €</div>
                </div>

                <div className="text-left">
                    <h2 className="font-semibold text-lg mb-2">Détails de la commande</h2>
                    <ul className="list-disc ml-5 space-y-1 text-sm">
                        {orderData.items.map((item: any, idx: number) => (
                            <li key={idx}>
                                {item.quantity} × {item.gloveJson?.size || 'Gant personnalisé'} — {item.price.toFixed(2)} €
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="mt-8">
                    <button
                        onClick={() => navigate('/')}
                        className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold py-3 px-6 rounded-lg text-lg transition"
                    >
                        Retour à l’accueil
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SuccessPage;
