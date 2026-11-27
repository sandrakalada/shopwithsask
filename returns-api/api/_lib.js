// Shop With Sask returns backend: order lookup + request intake. Credentials come only from env vars.
const SHOP = process.env.SHOPIFY_SHOP || 'wfud64-tq.myshopify.com';
const API = '2025-10';
let tok = null, tokExp = 0;
export async function token() {
  if (tok && Date.now() < tokExp) return tok;
  const r = await fetch(`https://${SHOP}/admin/oauth/access_token`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: process.env.SHOPIFY_CLIENT_ID, client_secret: process.env.SHOPIFY_CLIENT_SECRET, grant_type: 'client_credentials' }) });
  const j = await r.json(); if (!j.access_token) throw new Error('auth');
  tok = j.access_token; tokExp = Date.now() + 20 * 3600 * 1000; return tok;
}
export async function gql(query, variables) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`https://${SHOP}/admin/api/${API}/graphql.json`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': await token() }, body: JSON.stringify({ query, variables }) });
    const j = await r.json();
    if (j.errors && JSON.stringify(j.errors).includes('THROTTLED')) { await new Promise(s => setTimeout(s, 1500)); continue; }
    if (j.errors) throw new Error(JSON.stringify(j.errors));
    return j.data;
  }
  throw new Error('throttled');
}
const ORIGINS = ['https://shopwithsask.com', 'https://www.shopwithsask.com', 'https://wfud64-tq.myshopify.com'];
export function cors(req, res) {
  const o = req.headers.origin || '';
  if (ORIGINS.includes(o)) res.setHeader('Access-Control-Allow-Origin', o);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method' }); return true; }
  return false;
}
// Fee areas follow the store's shipping zones (province codes).
const AREAS = {
  cairo: { en: 'Cairo', ar: 'القاهرة', codes: ['C', 'HU'], ret: 85, exch: 160 },
  giza: { en: 'Giza', ar: 'الجيزة', codes: ['GZ', 'SU'], ret: 85, exch: 160 },
  alex: { en: 'Alexandria', ar: 'الإسكندرية', codes: ['ALX'], ret: 120, exch: 230 },
  delta: { en: 'Delta & Canal', ar: 'الدلتا والقناة', codes: ['SHR', 'BH', 'DK', 'DT', 'GH', 'IS', 'KFS', 'MNF', 'PTS', 'KB', 'SUZ'], ret: 100, exch: 190 },
  north: { en: 'North Coast', ar: 'الساحل الشمالي', codes: ['MT', 'JS', 'SIN'], ret: 165, exch: 320 },
  upper: { en: 'Upper Egypt & Red Sea', ar: 'الصعيد والبحر الأحمر', codes: ['ASN', 'AST', 'BNS', 'FYM', 'LX', 'MN', 'WAD', 'KN', 'BA', 'SHG'], ret: 199, exch: 388 },
};
export function areaFor(code, name) {
  const c = (code || '').toUpperCase();
  for (const [k, a] of Object.entries(AREAS)) if (a.codes.includes(c)) return { key: k, ...a };
  const n = (name || '').toLowerCase();
  if (n.includes('cairo')) return { key: 'cairo', ...AREAS.cairo };
  if (n.includes('giza')) return { key: 'giza', ...AREAS.giza };
  if (n.includes('alex')) return { key: 'alex', ...AREAS.alex };
  return null;
}
export const WINDOW_HOURS = 48;
const FINAL = /(earring|belt|swim|bikini|حلق|حزام|مايوه)/i;
export function isFinalSale(title, type) { return FINAL.test(title || '') || /swim/i.test(type || ''); }
const digits = s => (s || '').replace(/\D/g, '');
function samePhone(a, b) { a = digits(a); b = digits(b); if (a.length < 9 || b.length < 9) return false; return a.slice(-10) === b.slice(-10); }
const ORDER_Q = `query($q:String!){orders(first:1,query:$q){nodes{id name createdAt cancelledAt tags email phone displayFinancialStatus displayFulfillmentStatus
  customer{firstName lastName email phone} shippingAddress{firstName lastName phone province provinceCode}
  fulfillments{createdAt deliveredAt status} transactions{kind status processedAt}
  lineItems(first:30){nodes{id title variantTitle quantity sku image{url} product{productType handle}}}}}}`;
export async function findOrder(orderRaw, contactRaw) {
  const num = digits(orderRaw); const contact = (contactRaw || '').trim();
  if (!num || !contact) return { error: 'missing' };
  const d = await gql(ORDER_Q, { q: `name:#${num}` });
  const o = d.orders.nodes[0];
  if (!o || o.name.replace('#', '') !== num) return { error: 'not_found' };
  const emails = [o.email, o.customer?.email].filter(Boolean).map(e => e.toLowerCase());
  const phones = [o.phone, o.customer?.phone, o.shippingAddress?.phone].filter(Boolean);
  const ok = contact.includes('@') ? emails.includes(contact.toLowerCase()) : phones.some(p => samePhone(p, contact));
  if (!ok) return { error: 'not_found' };
  return { order: o };
}
export function eligibility(o) {
  if (o.cancelledAt || (o.tags || []).some(t => /^cancell?ed$/i.test(t))) return { ok: false, code: 'cancelled' };
  const fulfilled = (o.fulfillments || []).some(f => f.status === 'SUCCESS');
  if (!fulfilled) return { ok: false, code: 'not_shipped' };
  const delivered = (o.fulfillments || []).map(f => f.deliveredAt).filter(Boolean).sort().pop();
  const paid = (o.transactions || []).filter(t => t.kind === 'SALE' && t.status === 'SUCCESS').map(t => t.processedAt).sort().pop();
  const at = delivered || (o.displayFinancialStatus === 'PAID' ? paid : null);
  if (!at) return { ok: true, deliveredAt: null, confirmed: false };
  const hours = (Date.now() - new Date(at).getTime()) / 3.6e6;
  if (hours > WINDOW_HOURS) return { ok: false, code: 'window_closed', deliveredAt: at };
  return { ok: true, deliveredAt: at, confirmed: true, hoursLeft: Math.max(0, Math.round(WINDOW_HOURS - hours)) };
}
export function publicOrder(o) {
  const area = areaFor(o.shippingAddress?.provinceCode, o.shippingAddress?.province);
  return {
    name: o.name,
    firstName: o.shippingAddress?.firstName || o.customer?.firstName || '',
    governorate: o.shippingAddress?.province || '',
    area: area ? { key: area.key, en: area.en, ar: area.ar, returnFee: area.ret, exchangeFee: area.exch } : null,
    items: o.lineItems.nodes.filter(l => l.quantity > 0).map(l => ({ id: l.id, title: l.title, variant: l.variantTitle, qty: l.quantity, image: l.image?.url || '', finalSale: isFinalSale(l.title, l.product?.productType) })),
  };
}
export function send(res, code, obj) { res.status(code).json(obj); }
