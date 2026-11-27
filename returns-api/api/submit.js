import { cors, findOrder, eligibility, publicOrder, gql, send } from './_lib.js';
export const config = { api: { bodyParser: { sizeLimit: '4.5mb' } } };
const REASONS = ['size_small', 'size_big', 'not_as_expected', 'quality', 'wrong_item', 'damaged', 'changed_mind', 'other'];
async function uploadPhoto(dataUrl, name) {
  const m = /^data:(image\/(jpeg|png|webp));base64,(.+)$/.exec(dataUrl || ''); if (!m) throw new Error('photo');
  const buf = Buffer.from(m[3], 'base64'); if (buf.length > 5e6) throw new Error('photo_size');
  const st = await gql(`mutation($i:[StagedUploadInput!]!){stagedUploadsCreate(input:$i){stagedTargets{url resourceUrl parameters{name value}} userErrors{message}}}`,
    { i: [{ filename: name, mimeType: m[1], resource: 'FILE', httpMethod: 'POST', fileSize: String(buf.length) }] });
  const t = st.stagedUploadsCreate.stagedTargets[0];
  const fd = new FormData(); for (const p of t.parameters) fd.append(p.name, p.value);
  fd.append('file', new Blob([buf], { type: m[1] }), name);
  const up = await fetch(t.url, { method: 'POST', body: fd }); if (!up.ok) throw new Error('upload');
  const fc = await gql(`mutation($f:[FileCreateInput!]!){fileCreate(files:$f){files{id} userErrors{message}}}`,
    { f: [{ originalSource: t.resourceUrl, contentType: 'IMAGE', alt: name }] });
  if (fc.fileCreate.userErrors.length) throw new Error('file');
  return fc.fileCreate.files[0].id;
}
const REASON_EN = { size_small: 'Too small', size_big: 'Too big', not_as_expected: 'Not as expected', quality: 'Quality issue', wrong_item: 'Wrong item received', damaged: 'Damaged item', changed_mind: 'Changed my mind', other: 'Other' };
// Emails each new request to the store inbox via Resend when RESEND_API_KEY is set (no-op otherwise).
export async function notify(d) {
  const key = process.env.RESEND_API_KEY; if (!key) return;
  const to = process.env.RETURNS_EMAIL || 'orders@shopwithsask.com';
  const from = process.env.RESEND_FROM || 'Sask Returns <onboarding@resend.dev>';
  const lines = [`New ${d.type.toUpperCase()} request ${d.num}`, '', `Order: ${d.order}`, `Customer: ${d.name}`, `Contact: ${d.contact}`, `Governorate: ${d.gov}`,
    `Fee: ${d.fee != null ? d.fee + ' EGP' : '-'}`, '', 'Items:', ...d.items.map(i => `- ${i.title}${i.variant ? ' (' + i.variant + ')' : ''} x${i.qty}`), '',
    `Reason: ${REASON_EN[d.reason] || d.reason}`, d.type === 'exchange' ? `Wants instead: ${d.wanted}` : `Instapay: ${d.instapay}`, `Details: ${d.details || '-'}`, '',
    'Photos are attached. Open all requests in Shopify:', 'https://admin.shopify.com/store/wfud64-tq/content/metaobjects/entries/return_request'];
  const attachments = d.photos.map((p, k) => ({ filename: `${d.num}-photo-${k + 1}.jpg`, content: String(p).split(',')[1] || '' }));
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', signal: ctl.signal, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], reply_to: d.contact.includes('@') ? d.contact : undefined, subject: `${d.type === 'exchange' ? 'Exchange' : 'Return'} request ${d.num} - order ${d.order}`, text: lines.join('\n'), attachments }) });
    if (!r.ok) console.error('notify', r.status, await r.text());
  } catch (e) { console.error('notify', e.message); } finally { clearTimeout(tm); }
}
export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    const b = req.body || {};
    const f = await findOrder(b.order, b.contact);
    if (f.error) return send(res, 404, { error: f.error });
    const el = eligibility(f.order); if (!el.ok) return send(res, 400, { error: el.code });
    const po = publicOrder(f.order);
    const type = b.type === 'exchange' ? 'exchange' : b.type === 'return' ? 'return' : null;
    if (!type) return send(res, 400, { error: 'type' });
    if (!REASONS.includes(b.reason)) return send(res, 400, { error: 'reason' });
    if (!b.condition) return send(res, 400, { error: 'condition' });
    const photos = Array.isArray(b.photos) ? b.photos.slice(0, 3) : [];
    if (!photos.length) return send(res, 400, { error: 'photo' });
    const sel = (Array.isArray(b.items) ? b.items : []).map(i => ({ id: i.id, qty: Math.max(1, parseInt(i.qty) || 1) }))
      .map(i => ({ ...i, line: po.items.find(l => l.id === i.id) })).filter(i => i.line && !i.line.finalSale);
    if (!sel.length) return send(res, 400, { error: 'items' });
    if (type === 'exchange' && !(b.exchangeWanted || '').trim()) return send(res, 400, { error: 'exchange_wanted' });
    if (type === 'return' && !(b.instapay || '').trim()) return send(res, 400, { error: 'instapay' });
    const num = `R${po.name.replace('#', '')}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const ids = [];
    for (let k = 0; k < photos.length; k++) ids.push(await uploadPhoto(photos[k], `${num}-photo-${k + 1}.jpg`));
    const fee = po.area ? (type === 'return' ? po.area.returnFee : po.area.exchangeFee) : null;
    const fields = [
      ['request_number', num], ['request_type', type], ['status', 'New'], ['order_name', po.name], ['order_id', f.order.id],
      ['customer_name', [f.order.shippingAddress?.firstName, f.order.shippingAddress?.lastName].filter(Boolean).join(' ')],
      ['contact', String(b.contact).slice(0, 120)], ['governorate', po.governorate || ''],
      ['items', JSON.stringify(sel.map(i => ({ title: i.line.title, variant: i.line.variant, qty: Math.min(i.qty, i.line.qty) })))],
      ['reason', b.reason], ['details', String(b.details || '').slice(0, 2000)],
      ['exchange_request', String(b.exchangeWanted || '').slice(0, 1000)], ['refund_instapay', String(b.instapay || '').slice(0, 120)],
      ['photos', JSON.stringify(ids)], ['submitted_at', new Date().toISOString()],
    ];
    if (fee != null) fields.push(['fee', String(fee)]);
    if (el.deliveredAt) fields.push(['delivered_at', el.deliveredAt]);
    const mo = await gql(`mutation($m:MetaobjectCreateInput!){metaobjectCreate(metaobject:$m){metaobject{id} userErrors{field message}}}`,
      { m: { type: 'return_request', handle: num.toLowerCase(), fields: fields.map(([key, value]) => ({ key, value })) } });
    if (mo.metaobjectCreate.userErrors.length) { console.error(mo.metaobjectCreate.userErrors); return send(res, 500, { error: 'save' }); }
    await notify({ type, num, order: po.name, name: [f.order.shippingAddress?.firstName, f.order.shippingAddress?.lastName].filter(Boolean).join(' '), contact: String(b.contact), gov: po.governorate || '',
      fee, items: sel.map(i => ({ title: i.line.title, variant: i.line.variant, qty: Math.min(i.qty, i.line.qty) })), reason: b.reason, wanted: b.exchangeWanted || '', instapay: b.instapay || '', details: b.details || '', photos });
    send(res, 200, { ok: true, requestNumber: num, fee, type });
  } catch (e) { console.error(e); send(res, 500, { error: String(e.message || 'server').startsWith('photo') ? e.message : 'server' }); }
}
