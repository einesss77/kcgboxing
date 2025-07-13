// server/index.js
import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2022-11-15',
});

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

app.post('/create-checkout-session', async (req, res) => {
    try {
        const { items } = req.body;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: items.map((item) => ({
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: 'Custom Glove',
                        description: `Size: ${item.glove.size}`,
                        images: [item.image],
                    },
                    unit_amount: Math.round(item.price * 100),
                },
                quantity: item.quantity,
            })),

            success_url: `${process.env.FRONTEND_URL}/success`,
            cancel_url: `${process.env.FRONTEND_URL}/cart`,
        });
        await sendOrderEmail(items);

        console.log("📧 Fonction sendOrderEmail appelée avec :", items);
        res.json({ url: session.url });
    } catch (err) {
        console.error("Erreur Stripe :", err);
        res.status(500).json({ error: "Erreur lors de la création de session" });
    }
});

app.listen(4242, () => {
    console.log("✅ Server is running on http://localhost:4242");
});


const sendOrderEmail = async (items) => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'einesbek@gmail.com', // Ton email Gmail
                pass: process.env.EMAIL_PASSWORD, // Mot de passe d’application
            },
        });

        const item = items[0];
        const glove = item.glove;

        const html = `
      <h2>Nouvelle commande reçue</h2>
      <ul>
        <li><strong>Taille :</strong> ${glove.size}</li>
        <li><strong>Couleurs :</strong>
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
        </li>
        <li><strong>Matériau :</strong> ${glove.material.name} - ${glove.material.description}</li>
        <li><strong>Quantité :</strong> ${item.quantity}</li>
        <li><strong>Prix :</strong> ${item.price} €</li>
      </ul>
    `;
        console.log("📩 Envoi du mail en cours...");
        const info = await transporter.sendMail({
            from: '"Boutique Gants" <einesbek@gmail.com>',
            to: 'einesbek@gmail.com',
            subject: 'Nouvelle commande sur ton site',
            html,
        });

        console.log("✅ Email envoyé :", info.messageId);
    } catch (error) {
        console.error("❌ Erreur envoi e-mail :", error);
    }
};
