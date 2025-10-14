// server/sendPaidOrderEmail.js
import nodemailer from 'nodemailer';

/**
 * Send a "Paid Order" email.
 * @param {Array} items - Cart items [{ glove, price, quantity, image?, customImages? }, ...]
 * @param {Object} customer - { name, email, phone, address }
 * @param {Object} [options] - Optional overrides { subject?, to?[] }
 */
export default async function sendPaidOrderEmail(items = [], customer = {}, options = {}) {
  try {
    // SMTP transporter (Gmail; must use an App Password in EMAIL_PASSWORD)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_FROM,
        pass: process.env.EMAIL_PASSWORD,
      },
      logger: true,
      debug: true,
    });

    // Optional sanity check (prints helpful error if SMTP blocked)
    await transporter.verify().catch(err => {
      console.error('SMTP verify failed:', err);
    });

    // Compute total
    const total = Array.isArray(items)
      ? items.reduce((sum, it) => sum + (Number(it?.price) || 0) * (Number(it?.quantity) || 1), 0)
      : 0;

    // Quick item summary
    const item0 = items?.[0] || {};
    const glove = item0.glove || {};

    const html = `
      <h2>✅ Paid Order Received</h2>

      <h3>👤 Customer</h3>
      <ul>
        <li><strong>Name:</strong> ${escapeHtml(customer?.name || '')}</li>
        <li><strong>Email:</strong> ${escapeHtml(customer?.email || '')}</li>
        <li><strong>Phone:</strong> ${escapeHtml(customer?.phone || '')}</li>
        <li><strong>Address:</strong> ${escapeHtml(customer?.address || '')}</li>
      </ul>

      <h3>🧤 Glove (first item)</h3>
      <ul>
        <li><strong>Size:</strong> ${escapeHtml(glove?.size || '')}</li>
        ${glove?.material ? `<li><strong>Material:</strong> ${escapeHtml(glove.material.name || '')} — ${escapeHtml(glove.material.description || '')}</li>` : ''}
        <li><strong>Quantity:</strong> ${Number(item0?.quantity ?? 1)}</li>
        <li><strong>Item Price:</strong> €${Number(item0?.price || 0).toFixed(2)}</li>
      </ul>

      <h3>🎨 Colors</h3>
      <ul>
        <li>Fingers: ${escapeHtml(glove?.fingersColor?.name || '')}</li>
        <li>Outer Palm: ${escapeHtml(glove?.outerPalmColor?.name || '')}</li>
        <li>Inner Palm: ${escapeHtml(glove?.innerPalmColor?.name || '')}</li>
        <li>Inner Thumb: ${escapeHtml(glove?.innerThumbColor?.name || '')}</li>
        <li>Outer Thumb: ${escapeHtml(glove?.outerThumbColor?.name || '')}</li>
        <li>Strap: ${escapeHtml(glove?.strapColor?.name || '')}</li>
        <li>Wrist: ${escapeHtml(glove?.wristColor?.name || '')}</li>
        <li>Wrist Outline: ${escapeHtml(glove?.wristOutlineColor?.name || '')}</li>
        <li>Outline: ${escapeHtml(glove?.outlineColor?.name || '')}</li>
      </ul>

      <h3>💶 Total</h3>
      <p><strong>€${Number(total).toFixed(2)}</strong></p>

      <h3>🧾 Order JSON</h3>
      <pre style="white-space:pre-wrap;background:#111;color:#fff;padding:12px;border-radius:6px;">
${escapeHtml(JSON.stringify(items, null, 2))}
      </pre>
    `;

    // Attach the order JSON
    const jsonAttachment = {
      filename: `paid-order-${(customer?.name || 'client').replace(/\s+/g, '-').toLowerCase()}.json`,
      content: JSON.stringify({ customer, items, total }, null, 2),
      contentType: 'application/json',
    };

    // Optional: attach any custom images referenced in items
    const imageAttachments = getImageAttachmentsFromItems(items);

    const mail = {
      from: '"Boutique Gants" <einesbek@gmail.com>',
      to: options.to || ['einesbek@gmail.com', 'kcgboxing@gmail.com'],
      subject: options.subject || '✅ Paid Order — New order on your site',
      html,
      attachments: [jsonAttachment, ...imageAttachments],
    };

    const info = await transporter.sendMail(mail);
    console.log('✅ Paid order email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ sendPaidOrderEmail error:', error);
    throw error;
  }
}

// ----- helpers (local to this file) -----
function getImageAttachmentsFromItems(items = []) {
  const attachments = [];
  items.forEach((item, index) => {
    const customImages = item?.customImages || {};
    Object.keys(customImages).forEach(zone => {
      (customImages[zone] || []).forEach((image, i) => {
        if (!image?.url) return;
        attachments.push({
          filename: `image-${index}-${zone}-${i}.png`,
          path: image.url,
          cid: `image-${index}-${zone}-${i}`,
        });
      });
    });
  });
  return attachments;
}

function escapeHtml(s = '') {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

