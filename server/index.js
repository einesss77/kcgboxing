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

    // Save to DB
    await fetch(`${process.env.BACKEND_URL}/save-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer,
        items,
      }),
    });

    console.log('📧 sendOrderEmail called with:', items);
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: 'Error creating checkout session' });
  }
});

app.listen(4242, () => {
  console.log('✅ Server is running on http://localhost:4242');
});

/* -------------------------
   Send Order Email
   ------------------------- */
const sendOrderEmail = async (items, customer) => {
  try {
    console.log('📦 Customer payload:', customer);

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
      <h2>New order received</h2>

      <h3>👤 Customer Information</h3>
      <p><strong>Name:</strong> ${customer.name || '-'}</p>
      <p><strong>Email:</strong> ${customer.email || '-'}</p>
      <p><strong>Phone:</strong> ${customer.phone || '-'}</p>
      ${
        (customer.street || customer.city || customer.postalCode || customer.country)
          ? `
            <p><strong>Street and number:</strong> ${customer.street || '-'}</p>
            ${customer.address2 ? `<p><strong>Apartment/Building/Floor:</strong> ${customer.address2}</p>` : ''}
            <p><strong>City:</strong> ${customer.city || '-'}</p>
            <p><strong>State/Province/Region:</strong> ${customer.state || '-'}</p>
            <p><strong>ZIP/Postal code:</strong> ${customer.postalCode || '-'}</p>
            <p><strong>Country:</strong> ${customer.country || '-'}</p>
          `
          : `<p><strong>Address:</strong> ${customer.address || '-'}</p>`
      }

      <h3>🧤 Glove Details</h3>
      <p><strong>Size:</strong> ${glove.size}</p>
      <p><strong>Material:</strong> ${glove.material.name} - ${glove.material.description}</p>
      <p><strong>Quantity:</strong> ${item.quantity}</p>
      <p><strong>Price:</strong> ${item.price} €</p>

      <h4>🎨 Colors</h4>
      <p>Fingers: ${glove.fingersColor.name}</p>
      <p>Outer Palm: ${glove.outerPalmColor.name}</p>
      <p>Inner Palm: ${glove.innerPalmColor.name}</p>
      <p>Inner Thumb: ${glove.innerThumbColor.name}</p>
      <p>Outer Thumb: ${glove.outerThumbColor.name}</p>
      <p>Strap: ${glove.strapColor.name}</p>
      <p>Wrist: ${glove.wristColor.name}</p>
      <p>Wrist Outline: ${glove.wristOutlineColor.name}</p>
      <p>Outline: ${glove.outlineColor.name}</p>
    `;

    const jsonAttachment = {
      filename: `order-${(customer.name || 'client').replace(/\s+/g, '-').toLowerCase()}.json`,
      content: JSON.stringify(items, null, 2),
      contentType: 'application/json',
    };

    const imageAttachments = await getImageAttachmentsFromItems(items);

    const info = await transporter.sendMail({
      from: '"Gloves Store" <einesbek@gmail.com>',
      to: ['einesbek@gmail.com', 'kcgboxing@gmail.com'],
      subject: 'New order on your site',
      html,
      attachments: [jsonAttachment, ...imageAttachments],
    });

    console.log('✅ Email sent:', info.messageId);
  } catch (error) {
    console.error('❌ Email send error:', error);
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
            gloveJson: item.glove,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
    });

    console.log('💾 Order saved:', order.id);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ DB error:', err);
    res.status(500).json({ error: 'Database error' });
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
    console.error('❌ Fetch orders error:', err);
    res.status(500).json({ error: 'Error fetching orders' });
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
            cid: `image-${index}-${zone}-${i}`,
          });
        });
      }
    }
  });

  return attachments;
};
