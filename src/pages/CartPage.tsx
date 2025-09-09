import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';
import { X, MinusCircle, PlusCircle, ShoppingBag, ArrowLeft } from 'lucide-react';

const CartPage = () => {
  const { items, removeFromCart, updateQuantity, getTotalPrice } = useCartStore();
  const navigate = useNavigate();

  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    zip: '',
    country: '',
  });

  const isFormValid = () => {
    return (
      customerInfo.name.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email) &&
      /^\d{8,15}$/.test(customerInfo.phone) &&
      customerInfo.street.trim() &&
      customerInfo.city.trim() &&
      customerInfo.zip.trim() &&
      customerInfo.country.trim()
    );
  };

  const handleCheckout = async () => {
    if (!isFormValid()) return;

    try {
      const customerData = {
        customer: customerInfo,
        order: items.map((item) => ({
          name: "Custom Boxing Gloves",
          quantity: item.quantity,
          price: item.price,
        })),
        total: getTotalPrice(),
      };

      // Envoi au backend pour mail ou traitement
      await fetch(`${import.meta.env.VITE_API_URL}/send-order-mail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerData),
      });

      // Création de la session Stripe
      const res = await fetch(`${import.meta.env.VITE_API_URL}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, customer: customerInfo }),
      });

      const data = await res.json();
      if (data?.url) {
        sessionStorage.setItem('orderData', JSON.stringify(items));
        window.location.href = data.url;
      } else {
        alert("Erreur lors de la création de la session de paiement.");
      }
    } catch (err) {
      console.error("Erreur checkout :", err);
      alert("Impossible de procéder au paiement.");
    }
  };

  if (items.length === 0) {
    return (
      <div className="pt-24 pb-16 container-custom">
        <div className="flex flex-col items-center justify-center text-center py-16">
          <ShoppingBag className="h-16 w-16 text-neutral-700 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
          <p className="text-neutral-400 mb-8 max-w-md">
            Looks like you haven't added any custom gloves to your cart yet.
          </p>
          <button 
            onClick={() => window.location.href = "/customize"}
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold py-3 px-6 rounded-lg text-lg transition"
          >
            Acheter maintenant
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-16 container-custom">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">Shopping Cart</h1>
        <Link to="/customize" className="text-neutral-400 hover:text-white flex items-center gap-2 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Continue Shopping
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-neutral-800 rounded-xl overflow-hidden">
            <div className="p-6">
              <div className="grid grid-cols-12 text-sm text-neutral-400 pb-4 border-b border-neutral-700">
                <div className="col-span-6">Product</div>
                <div className="col-span-2 text-center">Price</div>
                <div className="col-span-2 text-center">Quantity</div>
                <div className="col-span-2 text-right">Total</div>
              </div>

              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 items-start py-6 border-b border-neutral-700">
                  <div className="col-span-6 flex gap-4">
                    <div className="bg-neutral-700 rounded-lg h-24 w-24 flex items-center justify-center overflow-hidden">
                      <div
                        className="h-16 w-16 rounded shadow-inner border border-white"
                        style={{
                          background: `linear-gradient(135deg, ${item.glove?.fingersColor?.hex || '#111'}, ${item.glove?.outerPalmColor?.hex || '#333'})`
                        }}
                        title="Glove preview"
                      />
                    </div>

                    <div>
                      <h3 className="font-semibold mb-1">Custom Boxing Gloves</h3>
                      <ul className="text-sm text-neutral-400 space-y-1">
                        <li>Size: {item.glove?.size || '—'}</li>
                        <li>Fingers: {item.glove?.fingersColor?.name || '—'}</li>
                        <li>Outer Palm: {item.glove?.outerPalmColor?.name || '—'}</li>
                        <li>Inner Palm: {item.glove?.innerPalmColor?.name || '—'}</li>
                        <li>Strap: {item.glove?.strapColor?.name || '—'}</li>
                        <li>Wrist: {item.glove?.wristColor?.name || '—'}</li>
                      </ul>
                    </div>
                  </div>

                  <div className="col-span-2 text-center">${Number(item.price || 0).toFixed(2)}</div>

                  <div className="col-span-2 flex items-center justify-center gap-2">
                    <button onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                            className="text-neutral-400 hover:text-white transition-colors">
                      <MinusCircle className="h-4 w-4" />
                    </button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="text-neutral-400 hover:text-white transition-colors">
                      <PlusCircle className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="col-span-2 text-right flex items-center justify-end gap-4">
                    <span>${(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}</span>
                    <button onClick={() => removeFromCart(item.id)}
                            className="text-neutral-500 hover:text-red-500 transition-colors"
                            aria-label="Remove item">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}

            </div>
          </div>
        </div>

        <div>
          <div className="bg-neutral-800 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4">Order Summary</h2>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-neutral-400">Subtotal</span>
                <span>${Number(getTotalPrice() || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Shipping</span>
                <span>Calculated at checkout</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Taxes</span>
                <span>Calculated at checkout</span>
              </div>
            </div>

            <div className="border-t border-neutral-700 pt-4 mb-6">
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>${Number(getTotalPrice() || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <h3 className="text-lg font-semibold text-white">Informations client</h3>
              <input type="text" placeholder="Full Name" value={customerInfo.name}
                     onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                     className="w-full p-2 rounded bg-neutral-700 text-white placeholder:text-neutral-400" />
              <input type="email" placeholder="Email" value={customerInfo.email}
                     onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                     className="w-full p-2 rounded bg-neutral-700 text-white placeholder:text-neutral-400" />
              <input type="tel" placeholder="Phone number" value={customerInfo.phone}
                     onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                     className="w-full p-2 rounded bg-neutral-700 text-white placeholder:text-neutral-400" />
              <input type="text" placeholder="Street address" value={customerInfo.street}
                     onChange={(e) => setCustomerInfo({...customerInfo, street: e.target.value})}
                     className="w-full p-2 rounded bg-neutral-700 text-white placeholder:text-neutral-400" />
              <input type="text" placeholder="City" value={customerInfo.city}
                     onChange={(e) => setCustomerInfo({...customerInfo, city: e.target.value})}
                     className="w-full p-2 rounded bg-neutral-700 text-white placeholder:text-neutral-400" />
              <input type="text" placeholder="ZIP / Postal code" value={customerInfo.zip}
                     onChange={(e) => setCustomerInfo({...customerInfo, zip: e.target.value})}
                     className="w-full p-2 rounded bg-neutral-700 text-white placeholder:text-neutral-400" />
              <input type="text" placeholder="Country" value={customerInfo.country}
                     onChange={(e) => setCustomerInfo({...customerInfo, country: e.target.value})}
                     className="w-full p-2 rounded bg-neutral-700 text-white placeholder:text-neutral-400" />
            </div>

            <button className={`btn btn-primary w-full py-3 ${!isFormValid() ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={handleCheckout} disabled={!isFormValid()}>
              Proceed to Checkout
            </button>

            <div className="mt-6 text-sm text-neutral-400 text-center">
              <p>Free Shipping Worldwide</p>
              <p className="mt-2">30-day satisfaction guarantee</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;