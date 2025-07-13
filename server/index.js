// server/index.js
import express from 'express';
import prisma from './prismaClient.js';
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
        const { items, customer } = req.body;

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
        await sendOrderEmail(items, customer);
        // Sauvegarde dans la base
        await fetch(`${process.env.BACKEND_URL}/save-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer,
                items,
            }),
        });



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

const sendOrderEmail = async (items, customer) => {
    try {
        console.log("📦 Contenu de customer :", customer); // 👈 LOG ICI
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'einesbek@gmail.com',
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

