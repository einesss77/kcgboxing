// server/index.js
import express from 'express';
import prisma from './prismaClient.js';
import Stripe from 'stripe';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const app = express();

/** Stripe */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' });

/** Middlewares */
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());

/* =========================
   Helpers: validation + utils
   ========================= */
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRe = /^\+?[0-9 ()\-]{7,20}$/;  // tolérant, normaliser en E.164 côté serveur si tu ajoutes libphonenumber
const countryRe = /^[A-Z]{2}$/;           // ISO alpha-2 attendu (ex: FR, US, AE)

const tidy = (v = '') => String(v).replace(/\s+/g, ' ').trim();

function validateCustomer(raw) {
  const c = {
    name: tidy(raw?.name),
    email: tidy(raw?.email),
    phone: tidy(raw?.phone),
    country: tidy(raw?.country).toUpperCase(),
    address1: tidy(raw?.address1),
    address2: tidy(raw?.address2),
    city: tidy(raw?.city),
    state: tidy(raw?.state),
    postalCode: tidy(raw?.postalCode).toUpperCase(),
    notes: tidy(raw?.notes),
  };

  if (!c.name || !emailRe.test(c.email) || !phoneRe.test(c.phone)) {
    return { ok: false, error: 'Invalid name/email/phone' };
  }
  if (!countryRe.test(c.country)) {
    return { ok: false, error: 'Invalid country (use ISO alpha-2, e.g. FR, US, AE)' };
  }
  if (!c.address1 || !c.city) {
    return { ok: false, error: 'Address1 and City are required' };
  }
  // simple rule: state required for some countries (US, CA, AU, IN, BR)
  const STATE_REQUIRED = new Set(['US', 'CA', 'AU', 'IN', 'BR']);
  if (STATE_REQUIRED.has(c.country) && !c.state) {
    return { ok: false, error: 'State/Province is required for this country' };
  }
  // postal optional for AE/HK/IE; else must be non-empty
  const POSTAL_OPTIONAL = new Set(['AE', 'HK', 'IE']);
  if (!POSTAL_OPTIONAL.has(c.country) && !c.postalCode) {
    return { ok: false, error: 'Postal/ZIP code is required for this country' };
  }

  return { ok: true, customer: c };
}

function buildFullAddress(c) {
  // Ex: "12 Rue X, Bât B, Paris, Île-de-France, 75001, FR"
  const parts = [
    c.address1,
    c.address2 || null,
    c.city,
    c.state || null,
    c.postalCode || null,
    c.country,
  ].filter(Boolean);
  return parts.join(', ');
}

function validateItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { ok: false, error: 'Cart is empty or invalid' };
  }
  // Chaque item doit avoir au minimum un quantity entier >=1
  for (const it of rawItems) {
    if (!it || !Number.isFinite(it.quantity) || it.quantity < 1) {
      return { ok: false, error: 'Each item must include a valid quantity' };
    }
  }
  return { ok: true };
}

/** Prix sécurisé côté serveur.
 *  Tu peux:
 *   - soit mettre un prix fixe
 *   - soit dériver le prix selon la config (taille, matériau, etc.) depuis une table/logic serveur
 */
function deriveUnitPriceCents(item) {
  // TODO: remplace cette logique par un vrai calcul depuis DB/feature flags si nécessaire
  const BASE_EUR_CENTS = 12000; // 120,00 €
  return BASE_EUR_CENTS;
}

/* =========================
   Routes
   ========================= */

/** Checkout session + email + sauvegarde DB */
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { items, customer } = req.body || {};

    // 1) Valider le client
    const vCust = validateCustomer(customer);
    if (!vCust.ok) return res.status(400).json({ error: vCust.error });
    const cust = vCust.customer;
    const fullAddress = buildFullAddress(cust);

    // 2) Valider les items
    const vItems = validateItems(items);
    if (!vItems.ok) return res.status(400).json({ error: vItems.error });

    // 3) Construire line_items Stripe à partir d’un prix serveur
    const line_items = items.map((it) => {
      const unit_amount = deriveUnitPriceCents(it); // sécurisé côté serveur
      return {
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Custom Boxing Gloves',
            // Optionnel: tu peux ajouter une courte desc si tu veux
            // description: `Size: ${it?.glove?.size || 'N/A'}`,
            // images: it.image ? [it.image] : undefined, // évite d'envoyer des URLs non sûres
          },
          unit_amount,
        },
        quantity: Math.max(1, Number(it.quantity) || 1),
      };
    });

    // 4) Créer la session Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items,
      success_url: `${process.env.FRONTEND_URL}/success`,
      cancel_url: `${process.env.FRONTEND_URL}/cart`,
      // Optionnel: metadata utiles
      metadata: {
        customer_email: cust.email,
        customer_name: cust.name,
        country: cust.country,
      },
    });

    // 5) Envoyer l’e-mail de pré-commande (optionnel avant paiement)
    await sendOrderEmail(items, { ...cust, fullAddress });

    // 6) Sauvegarder la commande en base (montant recalculé côté serveur)
    const totalCents = items.reduce((acc, it) => acc + deriveUnitPriceCents(it) * Math.max(1, Number(it.quantity) || 1), 0);
    const totalEuros = Math.round(totalCents) / 100;

    await prisma.order.create({
      data: {
        name: cust.name,
        email: cust.email,
        phone: cust.phone,
        address: fullAddress, // champ string unique — si tu as un modèle avec champs séparés, enregistre-les aussi
        total: totalEuros,
        items: {
          create: items.map((it) => ({
            gloveJson: it.glove,                     // objet complet
            quantity: Math.max(1, Number(it.quantity) || 1),
            price: Math.round(deriveUnitPriceCents(it)) / 100, // prix unitaire € côté serveur
          })),
        },
      },
    });

    console.log('✅ Checkout init ok — session:', session.id);
    return res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Erreur Stripe/checkout:', err);
    return res.status(500).json({ error: 'Erreur lors de la création de session' });
  }
});

/** (Optionnel) Administration: liste des commandes */
app.get('/admin/orders', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    res.json(orders);
  } catch (err) {
    console.error('❌ Erreur récupération commandes :', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des commandes.' });
  }
});

/* =========================
   Email
   ========================= */
async function sendOrderEmail(items, customer) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'einesbek@gmail.com', // configure .env
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const item = items?.[0] || {};
    const glove = item?.glove || {};

    const html = `
      <h2>Nouvelle commande reçue</h2>

      <h3>👤 Informations client</h3>
      <ul>
        <li><strong>Nom :</strong> ${customer.name}</li>
        <li><strong>Email :</strong> ${customer.email}</li>
        <li><strong>Téléphone :</strong> ${customer.phone}</li>
        <li><strong>Pays :</strong> ${customer.country}</li>
        <li><strong>Adresse complète :</strong> ${customer.fullAddress}</li>
        ${customer.notes ? `<li><strong>Notes :</strong> ${customer.notes}</li>` : ''}
      </ul>

      <h3>📦 Détails panier</h3>
      <ul>
        ${items.map((it, idx) => `
          <li>
            <strong>Article ${idx + 1}</strong> — Qty: ${it.quantity}<br/>
            ${it?.glove?.size ? `Taille: ${it.glove.size}<br/>` : ''}
            ${it?.glove?.material?.name ? `Matériau: ${it.glove.material.name} - ${it.glove.material.description || ''}<br/>` : ''}
            ${it?.price ? `(prix front: ${it.price}€ — ignoré côté serveur pour Stripe)<br/>` : ''}
          </li>
        `).join('')}
      </ul>

      <h4>🎨 Couleurs (extrait premier article) :</h4>
      <ul>
        <li>Fingers : ${glove?.fingersColor?.name || '—'}</li>
        <li>Outer Palm : ${glove?.outerPalmColor?.name || '—'}</li>
        <li>Inner Palm : ${glove?.innerPalmColor?.name || '—'}</li>
        <li>Inner Thumb : ${glove?.innerThumbColor?.name || '—'}</li>
        <li>Outer Thumb : ${glove?.outerThumbColor?.name || '—'}</li>
        <li>Strap : ${glove?.strapColor?.name || '—'}</li>
        <li>Wrist : ${glove?.wristColor?.name || '—'}</li>
        <li>Wrist Outline : ${glove?.wristOutlineColor?.name || '—'}</li>
        <li>Outline : ${glove?.outlineColor?.name || '—'}</li>
      </ul>
    `;

    const jsonAttachment = {
      filename: `commande-${(customer.name || 'client').replace(/\s+/g, '-').toLowerCase()}.json`,
      content: JSON.stringify(items, null, 2),
      contentType: 'application/json',
    };

    const imageAttachments = await getImageAttachmentsFromItems(items);

    const info = await transporter.sendMail({
      from: `"Boutique Gants" <${process.env.EMAIL_USER || 'einesbek@gmail.com'}>`,
      to: ['einesbek@gmail.com', 'kcgboxing@gmail.com'],
      subject: 'Nouvelle commande sur ton site',
      html,
      attachments: [jsonAttachment, ...imageAttachments],
    });

    console.log('✅ Email envoyé :', info.messageId);
  } catch (error) {
    console.error('❌ Erreur envoi e-mail :', error);
  }
}

async function getImageAttachmentsFromItems(items) {
  const attachments = [];
  items.forEach((item, index) => {
    const customImages = item?.customImages;
    if (customImages) {
      for (const zone in customImages) {
        (customImages[zone] || []).forEach((image, i) => {
          if (!image?.url) return;
          attachments.push({
            filename: `image-${index}-${zone}-${i}.png`,
            path: image.url,
            cid: `image-${index}-${zone}-${i}`,
          });
        });
      }
    }
  });
  return attachments;
}

/* =========================
   Start server
   ========================= */
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
