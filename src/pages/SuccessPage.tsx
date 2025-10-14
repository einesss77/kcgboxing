import React from 'react';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const SuccessPage: React.FC = () => {
    const navigate = useNavigate();
    const called = useRef(false);

    useEffect(() => {
        if (called.current) return;
        called.current = true;

        let items: any[] = [];
        let customer: any = null;

        // read what the cart saved before redirecting to Stripe
        try { items = JSON.parse(sessionStorage.getItem('orderItems') || '[]'); } catch { }
        try { customer = JSON.parse(sessionStorage.getItem('orderCustomer') || 'null'); } catch { }

        if (items?.length && customer?.email) {
            const api = (import.meta.env.VITE_API_URL || window.location.origin).toString();

            fetch(`${api}/email/paid`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items, customer }),
            })
                .catch(console.error)
                .finally(() => {
                    // prevent re-sending on refresh
                    sessionStorage.removeItem('orderItems');
                    sessionStorage.removeItem('orderCustomer');
                });
        }
    }, []);

    return (
        <div className="pt-24 pb-16 container-custom max-w-xl mx-auto text-white text-center">
            <div className="bg-neutral-900 p-8 rounded-xl shadow-lg">
                <h1 className="text-3xl font-bold mb-4">Merci pour votre commande !</h1>
                <p className="text-neutral-400 mb-6">
                    Votre commande a été confirmée. Un e-mail de confirmation vous sera envoyé sous peu.
                </p>
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
