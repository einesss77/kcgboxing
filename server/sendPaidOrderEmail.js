// server/sendPaidOrderEmail.js
import nodemailer from 'nodemailer';

/**
 * Mail 2 (post-paiement)
 * - Utilise EXACTEMENT le JSON Mail 1 depuis order.originalJsonText (fallback: originalJson)
 * - Attache le JSON exact + affiche les images custom (cid)
 */
export async function sendPaidOrderEmail({ session, order, to }) {
  if (!to) {
    console.error('❌ [MAIL2] PAID_EMAIL_TO manquant (.env)');
    return;
  }

  const useEthereal = String(process.env.USE_ETHEREAL || '').toLowerCase() === 'true';
  const debug = true;

  // ---------- Transport ----------
  let transporter;
  if (useEthereal) {
    const test = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport(
      { host: 'smtp.ethereal.email', port: 587, secure: false, auth: { user: test.user, pass: test.pass } },
      { logger: debug, debug }
    );
  } else {
    transporter = nodemailer.createTransport(
      { service: 'gmail', auth: { user: process.env.MAIL_FROM, pass: process.env.EMAIL_PASSWORD } },
      { logger: debug, debug }
    );
  }

  await transporter.verify();

  // ---------- Stripe basics ----------
  const c = session.customer_details || {};
  const s = session.shipping_details || {};
  const a = s.address || {};
  const linesAddr = [
    [a.line1, a.line2].filter(Boolean).join(' '),
    [a.postal_code, a.city].filter(Boolean).join(' '),
    [a.state, a.country].filter(Boolean).join(' '),
  ].filter(Boolean);
  const currency = (session.currency || 'eur').toUpperCase();

  // ---------- SOURCE OF TRUTH: EXACT Mail-1 JSON ----------
  const prettyJson = order?.originalJsonText
    ?? JSON.stringify(order?.originalJson ?? [], null, 2);

  let itemsForEmail = [];
  try {
    itemsForEmail = JSON.parse(prettyJson); // identical structure as Mail 1
  } catch (e) {
    console.warn('⚠️ [MAIL2] parse prettyJson failed, fallback empty []');
    itemsForEmail = [];
  }

  // ---------- Attachments ----------
  const attachments = [
    {
      filename: `checkout-${session.id}.json`,
      content: prettyJson,                 // exact string preserved
      contentType: 'application/json',
    },
  ];

  // Inline images from items.customImages (like Mail 1)
  const imgHtmlBlocks = [];
  const MAX_INLINE_IMAGES = 12;
  let imgCount = 0;

  for (let index = 0; index < itemsForEmail.length; index++) {
    const customImages = itemsForEmail[index]?.customImages || null;
    if (!customImages) continue;

    for (const zone of Object.keys(customImages)) {
      const arr = customImages[zone] || [];
      for (let i = 0; i < arr.length; i++) {
        const img = arr[i];
        if (!img?.url) continue;
        if (imgCount >= MAX_INLINE_IMAGES) break;

        const cid = `image-${index}-${zone}-${i}`;
        attachments.push({
          filename: `image-${index}-${zone}-${i}.png`,
          path: img.url,
          cid,
        });
        imgHtmlBlocks.push(
          `<div style="border:1px solid #eee;border-radius:8px;overflow:hidden">
             <div style="background:#fafafa;padding:6px 10px;font-size:12px;color:#555">${zone}</div>
             <img src="cid:${cid}" alt="${zone}" style="display:block;width:100%;max-width:320px;height:auto"/>
           </div>`
        );
        imgCount++;
      }
      if (imgCount >= MAX_INLINE_IMAGES) break;
    }
    if (imgCount >= MAX_INLINE_IMAGES) break;
  }

  // Table rows from EXACT itemsForEmail
  const rows = itemsForEmail.map((it, i) => {
    const qty = Number(it.quantity || 1);
    const price = Number(it.price || 0);
    const total = price * qty;
    return `
      <tr>
        <td style="padding:10px;border:1px solid #eee">${it.glove?.size ? `Custom Glove (${it.glove.size})` : (it.name || `Item ${i+1}`)}</td>
        <td style="padding:10px;border:1px solid #eee;text-align:center">${qty}</td>
        <td style="padding:10px;border:1px solid #eee;text-align:right">${price.toFixed(2)} ${currency}</td>
        <td style="padding:10px;border:1px solid #eee;text-align:right"><b>${total.toFixed(2)} ${currency}</b></td>
      </tr>
    `;
  }).join('');

  const html = `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;line-height:1.45;padding:24px">
    <div style="max-width:720px;margin:0 auto;border:1px solid #eee;border-radius:12px;overflow:hidden">
      <div style="background:#111;color:#fff;padding:18px 20px">
        <div style="font-size:18px;font-weight:700">Paiement confirmé — Nouvelle commande</div>
        <div style="opacity:.8;font-size:12px">Session: ${session.id}</div>
      </div>

      <div style="padding:20px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px">
          <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:12px">
            <div style="font-weight:600;margin-bottom:6px">👤 Client (Stripe)</div>
            <div style="font-size:14px;color:#333">
              <div><b>Nom:</b> ${c.name || ''}</div>
              <div><b>Email:</b> ${c.email || ''}</div>
              <div><b>Téléphone:</b> ${c.phone || ''}</div>
            </div>
          </div>
          <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:12px">
            <div style="font-weight:600;margin-bottom:6px">📦 Livraison</div>
            <div style="font-size:14px;color:#333">
              <div>${s.name || c.name || ''}</div>
              ${linesAddr.map(l => `<div>${l}</div>`).join('')}
            </div>
          </div>
        </div>

        <div style="margin-top:8px">
          <div style="font-weight:600;margin-bottom:8px">🧾 Détails de commande</div>
          <table style="border-collapse:collapse;border:1px solid #eee;width:100%">
            <thead>
              <tr style="background:#fafafa">
                <th style="text-align:left;padding:10px;border:1px solid #eee">Produit</th>
                <th style="text-align:center;padding:10px;border:1px solid #eee">Qté</th>
                <th style="text-align:right;padding:10px;border:1px solid #eee">Prix unitaire</th>
                <th style="text-align:right;padding:10px;border:1px solid #eee">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="4" style="text-align:center;padding:14px;color:#888">Aucun item</td></tr>`}
            </tbody>
          </table>
        </div>

        ${imgHtmlBlocks.length ? `
          <div style="margin-top:18px">
            <div style="font-weight:600;margin-bottom:8px">🖼️ Aperçus</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
              ${imgHtmlBlocks.join('')}
            </div>
          </div>` : ''}

        <div style="margin-top:18px;color:#555;font-size:13px">
          Le détail complet (session + items) est joint au format JSON :
          <code>checkout-${session.id}.json</code>
        </div>
      </div>
    </div>
  </div>`;

  const text = [
    'Paiement confirmé — Nouvelle commande',
    '',
    `Client: ${c.name || ''}`,
    `Email: ${c.email || ''}`,
    `Téléphone: ${c.phone || ''}`,
    '',
    'Adresse de livraison:',
    s.name || c.name || '',
    ...linesAddr,
    '',
    'Items:',
    ...itemsForEmail.map((it, i) => `- ${it.glove?.size ? `Custom Glove (${it.glove.size})` : (it.name || `Item ${i+1}`)} x${it.quantity} (${Number(it.price||0).toFixed(2)} ${currency})`),
    '',
    `Session: ${session.id}`,
  ].join('\n');

  const info = await transporter.sendMail({
    from: `"Boutique Gants" <${process.env.MAIL_FROM || 'no-reply@kcgboxing.com'}>`,
    to,
    subject: `Paiement confirmé — Checkout ${session.id}`,
    html,
    text,
    attachments,
  });

  console.log('✅ [MAIL2] OK');
  if (useEthereal) {
  }
}
