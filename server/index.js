// server/index.js
import express from 'express';
import prisma from './prismaClient.js';
import Stripe from 'stripe';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import { sendPaidOrderEmail } from './sendPaidOrderEmail.js';

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2022-11-15',
});

app.use(cors({ origin: process.env.FRONTEND_URL }));

 
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// ✅ WEBHOOK STRIPE
app.post('/webhook/stripe',
  bodyParser.raw({ type: 'application/json' }), // 👈 important: avant express.json()
  async (req, res) => {
    let event;
    try {
      const sig = req.headers['stripe-signature'];
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('❌ Signature FAILED:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      console.log('🔔 Webhook hit:', event.type, 'id=', event.id);

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        // Session enrichie (client + produits pour fallback images)
        const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['customer_details', 'line_items.data.price.product'],
        });

        const orderId = fullSession.client_reference_id;
        console.log('🆔 client_reference_id =', orderId);

        let order = null;
        if (orderId) {
          order = await prisma.order.findUnique({
            where: { id: Number(orderId) },
            include: { items: true },
          });
        }

        if (!order) {
          console.warn('⚠️ Order introuvable pour id =', orderId, '(client_reference_id). Mail 2 non envoyé.');
          return res.json({ received: true });
        }

        try {
          await sendPaidOrderEmail({
            session: fullSession,
            order, // → on passe la commande DB pour reconstruire items/images comme le mail 1
            to: process.env.PAID_EMAIL_TO,
          });
          console.log('📧 Mail 2 envoyé à', process.env.PAID_EMAIL_TO);
        } catch (mailErr) {
          console.error('❌ Erreur envoi mail 2:', mailErr);
        }

        return res.json({ received: true });
      }

      // Ack les autres events quand même
      return res.json({ received: true });

    } catch (err) {
      console.error('❌ Handler error:', err);
      return res.status(500).send('Webhook handler error');
    }
  }
);



app.use(express.json());

app.get('/health', (req, res) => res.send('ok'));



// CREATE CHECKOUT SESSION
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { items, customer, items_json } = req.body;

    // 1) Take the EXACT string from the FE (fallback: pretty stringify)
    const rawJson = (typeof items_json === 'string')
      ? items_json
      : JSON.stringify(items, null, 2);

    // 2) Save order in DB (both object + exact string)
    const order = await prisma.order.create({
      data: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        total: items.reduce((acc, it) => acc + (Number(it.price || 0) * Number(it.quantity || 1)), 0),

        // Mirror as JSON (query-friendly)
        originalJson: JSON.parse(rawJson),
        // EXACT Mail-1 string (this is what Mail-2 will attach)
        originalJsonText: rawJson,

        items: {
          create: items.map((it) => ({
            gloveJson: {
              ...(it.glove || {}),
              image: it.image || null,
              customImages: it.customImages || null,
            },
            quantity: it.quantity,
            price: it.price,
          })),
        },
      },
      include: { items: true },
    });

    // (optional sanity check)
    const saved = await prisma.order.findUnique({ where: { id: order.id } });

    // 3) Create Stripe session, link to DB via client_reference_id
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: customer.email,
      shipping_address_collection: {
        allowed_countries: ['FR','BE','DE','ES','IT','NL','GB','US','AE','DZ'],
      },
      phone_number_collection: { enabled: true },
      line_items: items.map((item) => ({
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Custom Glove',
            description: `Size: ${item?.glove?.size ?? '—'}`,
            images: [item.image].filter(Boolean), // must be HTTPS public URLs
          },
          unit_amount: Math.round(Number(item.price || 0) * 100),
        },
        quantity: Number(item.quantity || 1),
      })),
      client_reference_id: String(order.id),
      success_url: `${process.env.FRONTEND_URL}/success`,
      cancel_url: `${process.env.FRONTEND_URL}/cart`,
    });

  
    await sendOrderEmail(items, customer);

    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ create-checkout-session:', err);
    res.status(500).json({ error: 'Erreur lors de la création de session' });

  }
});






app.listen(4242, () => {

  console.log("✅ Server is running on http://localhost:4242");

});

/* -------------------------
   Send Order Email
   ------------------------- */
const sendOrderEmail = async (items, customer) => {
  try {



    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {

        user: process.env.MAIL_FROM,

        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const item = items[0];
    const glove = item.glove;

    const html = `

            <h2>Nouvelle commande reçue</h2>

            <h3>👤 Informations client</h3>
            <ul>
              <li><strong>Nom :</strong> ${customer.name}</li>
              <li><strong>Email :</strong> ${customer.email}</li>
              <li><strong>Téléphone :</strong> ${customer.phone}</li>
              <li><strong>Adresse :</strong> ${customer.address}</li>
            </ul>

            <h3>🧤 Détails du gant</h3>
            <ul>
              <li><strong>Taille :</strong> ${glove.size}</li>
              <li><strong>Matériau :</strong> ${glove.material.name} - ${glove.material.description}</li>
              <li><strong>Quantité :</strong> ${item.quantity}</li>
              <li><strong>Prix :</strong> ${item.price} €</li>
            </ul>

            <h4>🎨 Couleurs :</h4>
            <ul>
              <li>Fingers : ${glove.fingersColor.name}</li>
              <li>Outer Palm : ${glove.outerPalmColor.name}</li>
              <li>Inner Palm : ${glove.innerPalmColor.name}</li>
              <li>Inner Thumb : ${glove.innerThumbColor.name}</li>
              <li>Outer Thumb : ${glove.outerThumbColor.name}</li>
              <li>Strap : ${glove.strapColor.name}</li>
              <li>Wrist : ${glove.wristColor.name}</li>
              <li>Wrist Outline : ${glove.wristOutlineColor.name}</li>
              <li>Outline : ${glove.outlineColor.name}</li>
            </ul>
        `;

    const jsonAttachment = {
      filename: `commande-${customer.name?.replace(/\s+/g, '-').toLowerCase() || 'client'}.json`,

      content: JSON.stringify(items, null, 2),
      contentType: 'application/json',
    };

    const imageAttachments = await getImageAttachmentsFromItems(items);

    const info = await transporter.sendMail({

      from: `"Boutique Gants" <${process.env.MAIL_FROM}>`,
      to: ['einesbek@gmail.com', 'kcgboxing@gmail.com'],
      subject: 'Nouvelle commande sur ton site',

      html,
      attachments: [jsonAttachment, ...imageAttachments],
    });


  } catch (error) {
    console.error("❌ Erreur envoi e-mail :", error);

  }
};

app.post('/save-order', async (req, res) => {
  try {
    const { customer, items } = req.body;


    const order = await prisma.order.create({
      data: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        total: items.reduce((acc, item) => acc + item.price * item.quantity, 0),
        originalJson: items,
        items: {
          create: items.map((item) => ({
            gloveJson: item.glove, // tout l'objet glove complet
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
    });

    console.log("💾 Commande enregistrée en base :", order.id);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Erreur DB :", err);
    res.status(500).json({ error: "Erreur base de données" });

  }
});

app.get('/admin/orders', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    res.json(orders);
  } catch (err) {

    console.error("❌ Erreur récupération commandes :", err);
    res.status(500).json({ error: 'Erreur lors de la récupération des commandes.' });

  }
});

const getImageAttachmentsFromItems = async (items) => {
  const attachments = [];

  items.forEach((item, index) => {
    const customImages = item.customImages;

    if (customImages) {
      for (const zone in customImages) {
        customImages[zone].forEach((image, i) => {
          attachments.push({
            filename: `image-${index}-${zone}-${i}.png`,
            path: image.url,

            cid: `image-${index}-${zone}-${i}`, // optionnel, si on veut les afficher dans le HTML un jour
 
          });
        });
      }
    }
  });

  return attachments;
};
