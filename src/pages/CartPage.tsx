import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';
import { X, MinusCircle, PlusCircle, ShoppingBag, ArrowLeft } from 'lucide-react';

// ===== Liste complète ISO 3166-1 alpha-2 =====
import countries from 'world-countries'; 
// installe ce package: npm install world-countries

const COUNTRIES = countries.map(c => ({
  code: c.cca2,
  label: c.name.common,
}));

// regex postaux (si absent => on reste tolérant)
const POSTAL_PATTERNS = {
  FR: /^(?:0[1-9]|[1-8]\d|9[0-8])\d{3}$/,
  GB: /^([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/i,
  US: /^\d{5}(-\d{4})?$/,
  CA: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i,
  AE: /^\d{5}$/,
};

const STATE_LABELS = {
  FR: 'Département / Région (optionnel)',
  GB: 'County (optional)',
  US: 'State',
  CA: 'Province',
  AE: 'Emirate',
};

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRe = /^\+?[0-9 ()\-]{7,20}$/;

const POSTAL_OPTIONAL = new Set(['AE', 'HK', 'IE']);
const STATE_REQUIRED = new Set(['US', 'CA', 'AU', 'IN', 'BR']);

const tidy = (v) => v.replace(/\s+/g, ' ').trim();

const CartPage = () => {
  const { items, removeFromCart, updateQuantity, getTotalPrice } = useCartStore();

  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: '',
    country: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postalCode: '',
    notes: '',
  });

  const stateLabel = useMemo(() => {
    return STATE_LABELS[customerInfo.country] || 'State / Province / Region';
  }, [customerInfo.country]);

  const postalPlaceholder = useMemo(() => {
    switch (customerInfo.country) {
      case 'FR': return '75001';
      case 'GB': return 'SW1A 1AA';
      case 'US': return '94107';
      case 'CA': return 'K1A 0B1';
      case 'AE': return '00000';
      default:   return 'Postal / ZIP code';
    }
  }, [customerInfo.country]);

  const isPostalValid = () => {
    const code = customerInfo.postalCode.trim();
    if (!code && POSTAL_OPTIONAL.has(customerInfo.country)) return true;
    const rx = POSTAL_PATTERNS[customerInfo.country];
    return rx ? rx.test(code) : !!code;
  };

  const isFormValid = () => {
    const c = customerInfo;
    if (!tidy(c.name)) return false;
    if (!emailRe.test(c.email)) return false;
    if (!phoneRe.test(c.phone)) return false;
    if (!c.country) return false;
    if (!tidy(c.address1)) return false;
    if (!tidy(c.city)) return false;

    if (STATE_REQUIRED.has(c.country) && !tidy(c.state)) return false;
    if (!isPostalValid()) return false;

    return true;
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!isFormValid()) return;

    const payloadCustomer = {
      name: tidy(customerInfo.name),
      email: tidy(customerInfo.email),
      phone: tidy(customerInfo.phone),
      country: customerInfo.country,
      address1: tidy(customerInfo.address1),
      address2: tidy(customerInfo.address2),
      city: tidy(customerInfo.city),
      state: tidy(customerInfo.state),
      postalCode: customerInfo.postalCode.toUpperCase().trim(),
      notes: tidy(customerInfo.notes),
    };

    try {
      // 1) email pré-paiement
      await fetch(`${import.meta.env.VITE_API_URL}/send-order-mail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: payloadCustomer,
          order: items,
          total: getTotalPrice(),
        }),
      });

      // 2) création session Stripe
      const res = await fetch(`${import.meta.env.VITE_API_URL}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, customer: payloadCustomer }),
      });

      const data = await res.json();
      if (data?.url) {
        sessionStorage.setItem('orderData', JSON.stringify(items));
        window.location.href = data.url;
      } else {
        alert('Erreur lors de la création de la session de paiement.');
      }
    } catch (err) {
      console.error('Erreur checkout :', err);
      alert('Impossible de procéder au paiement.');
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
        {/* produits */}
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

        {/* résumé commande + infos client */}
        <div>
          <form onSubmit={handleCheckout} className="bg-neutral-800 rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-bold">Order Summary</h2>

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

            <h3 className="text-lg font-semibold text-white">Customer Information</h3>
            <input type="text" placeholder="Full Name" required
                   value={customerInfo.name}
                   onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                   className="w-full p-2 rounded bg-neutral-700 text-white placeholder:text-neutral-400" />

            <input type="email" placeholder="Email" required
                   value={customerInfo.email}
                   onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                   className="w-full p-2 rounded bg-neutral-700 text-white placeholder:text-neutral-400" />

            <input type="tel" placeholder="Phone (with country code)" required
                   value={customerInfo.phone}
                   onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                   className="w-full p-2 rounded bg-neutral-700 text-white placeholder:text-neutral-400" />

            <select required value={customerInfo.country}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, country: e.target.value })}
                    className="w-full p-2 rounded bg-neutral-700 text-white">
              <option value="">Select Country</option>
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>

            <input type="text" placeholder="Address line 1" required
                   value={customerInfo.address1}
                   onChange={(e) => setCustomerInfo({ ...customerInfo, address1: e.target.value })}
                   className="w-full p-2 rounded bg-neutral-700 text-white placeholder:text-neutral-400" />

            <input type="text" placeholder="Address line 2 (optional)"
                   value={customerInfo.address2}
                   onChange={(e) => setCustomerInfo({ ...customerInfo, address2: e.target.value })}
                   className="w-full p-2 rounded bg-neutral-700 text-white placeholder:text-neutral-400" />

            <input type="text" placeholder="City" required
                   value={customerInfo.city}
                   onChange={(e) => setCustomerInfo({ ...customerInfo, city: e.target.value })}
                   className="w-full p-2 rounded bg-neutral-700 text-white placeholder:text-neutral-400" />

            <input type="text" placeholder={stateLabel}
                   value={customerInfo.state}
                   onChange={(e) => setCustomerInfo({ ...customerInfo, state: e.target.value })}
                   className="w-full p-2 rounded bg-neutral-700 text-white placeholder:text-neutral-400" />

            <input type="text" placeholder={postalPlaceholder}
                   value={customerInfo.postalCode}
                   onChange={(e) => setCustomerInfo({ ...customerInfo, postalCode: e.target.value })}
                   className="w-full p-2 rounded bg-neutral-700 text-white placeholder:text-neutral-400" />

            <textarea placeholder="Delivery notes (optional)" rows="2"
                      value={customerInfo.notes}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, notes: e.target.value })}
                      className="w-full p-2 rounded bg-neutral-700 text-white placeholder:text-neutral-400" />

            <button type="submit"
                    className={`btn btn-primary w-full py-3 ${!isFormValid() ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!isFormValid()}>
              Proceed to Checkout
            </button>

            <div className="mt-6 text-sm text-neutral-400 text-center">
              <p>Free Shipping Worldwide</p>
              <p className="mt-2">30-day satisfaction guarantee</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
