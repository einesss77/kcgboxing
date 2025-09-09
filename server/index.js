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

/* -----------------------------
   Address formatting helper
   ----------------------------- */
function formatFullAddressFromCustomer(customer) {
  // If structured fields exist, build a multi-line address
  if (customer?.street || customer?.city || customer?.postalCode || customer?.country) {
    const lines = [
      customer.street || '',
      customer.address2 || '',
      [customer.postalCode, customer.city].filter(Boolean).join(' '),
      customer.state || '',
      customer.country || '',
    ].filter(Boolean);
    return lines.join('\n');
  }
  // Fallback to the single address string
  return customer?.address || '';
}

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

    // Save to DB (store a clean multi-line address)
    await fetch(`${process.env.BACKEND_URL}/save-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { ...customer, address: formatFullAddressFromCustomer(customer) },
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

    const fullAddress = formatFullAddressFromCustomer(customer);

    const html = `
      <h2>New order received</h2>

      <h3>👤 Customer Information</h3>
      <ul>
        <li><strong>Name:</strong> ${customer.name || '-'}</li>
        <li><strong>Email:</strong> ${customer.email || '-'}</li>
        <li><strong>Phone:</strong> ${customer.phone || '-'}</li>
        ${
          (customer.street || customer.city || customer.postalCode || customer.country)
            ? `
              <li><strong>Street:</strong> ${customer.street || '-'}</li>
              ${customer.address2 ? `<li><strong>Address 2:</strong> ${customer.address2}</li>` : ''}
              <li><strong>City:</strong> ${customer.city || '-'}</li>
              <li><strong>State/Province:</strong> ${customer.state || '-'}</li>
              <li><strong>Postal Code:</strong> ${customer.postalCode || '-'}</li>
              <li><strong>Country:</strong> ${customer.country || '-'}</li>
            `
            : `<li><strong>Address:</strong> ${customer.address || '-'}</li>`
        }
      </ul>

      <pre style="background:#111;padding:12px;border-radius:8px;white-space:pre-wrap;line-height:1.4;margin-top:8px">
${fullAddress}
      </pre>

      <h3>🧤 Glove Details</h3>
      <ul>
        <li><strong>Size:</strong> ${glove.size}</li>
        <li><strong>Material:</strong> ${glove.material.name} - ${glove.material.description}</li>
        <li><strong>Quantity:</strong> ${item.quantity}</li>
        <li><strong>Price:</strong> ${item.price} €</li>
      </ul>

      <h4>🎨 Colors</h4>
      <ul>
        <li>Fingers: ${glove.fingersColor.name}</li>
        <li>Outer Palm: ${glove.outerPalmColor.name}</li>
        <li>Inner Palm: ${glove.innerPalmColor.name}</li>
        <li>Inner Thumb: ${glove.innerThumbColor.name}</li>
        <li>Outer Thumb: ${glove.outerThumbColor.name}</li>
        <li>Strap: ${glove.strapColor.name}</li>
        <li>Wrist: ${glove.wristColor.name}</li>
        <li>Wrist Outline: ${glove.wristOutlineColor.name}</li>
        <li>Outline: ${glove.outlineColor.name}</li>
      </ul>
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
        // store a clean, multi-line address even if frontend sent a single field
        address: customer.address || formatFullAddressFromCustomer(customer),
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
