import { env } from './util.js';
import { etaFor } from './copy.js';

let cached = { token: '', exp: 0 };
export async function token() {
  if (env('SHOPIFY_TOKEN')) return env('SHOPIFY_TOKEN');
  if (cached.token && Date.now() < cached.exp) return cached.token;
  const r = await fetch(`https://${env('SHOPIFY_STORE')}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: env('SHOPIFY_CLIENT_ID'), client_secret: env('SHOPIFY_CLIENT_SECRET'), grant_type: 'client_credentials' })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error('Shopify token ' + r.status + ' ' + (d.error_description || d.error || ''));
  cached = { token: d.access_token, exp: Date.now() + Math.max(60, (d.expires_in || 3600) - 300) * 1000 };
  return cached.token;
}

export async function gql(query, variables = {}) {
  const r = await fetch(`https://${env('SHOPIFY_STORE')}/admin/api/2026-10/graphql.json`, {
    method: 'POST',
    headers: { 'x-shopify-access-token': await token(), 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  const data = await r.json();
  if (!r.ok || data.errors) throw new Error('Shopify: ' + JSON.stringify(data.errors || data));
  return data.data;
}

const ORDER = `query($id: ID!) { order(id: $id) {
  id name tags displayFinancialStatus cancelledAt paymentGatewayNames
  currentTotalPriceSet { shopMoney { amount } }
  currentSubtotalPriceSet { shopMoney { amount } }
  totalShippingPriceSet { shopMoney { amount } }
  shippingAddress { firstName lastName name phone province provinceCode city }
  lineItems(first: 20) { nodes { title variantTitle quantity } }
} }`;

export async function getOrder(id) {
  const gid = String(id).startsWith('gid://') ? id : `gid://shopify/Order/${id}`;
  const { order } = await gql(ORDER, { id: gid });
  return order ? shape(order) : null;
}

export function shape(o) {
  const a = o.shippingAddress || {};
  const items = o.lineItems.nodes.map(l => `${l.title}${l.variantTitle ? ` (${l.variantTitle})` : ''} x${l.quantity}`);
  let itemsLine = items.join(', ');
  if (itemsLine.length > 300) itemsLine = items.slice(0, 3).join(', ') + ` and ${items.length - 3} more`;
  return {
    id: o.id.split('/').pop(),
    gid: o.id,
    name: o.name,
    tags: o.tags || [],
    cancelled: !!o.cancelledAt,
    financial: o.displayFinancialStatus,
    gateways: o.paymentGatewayNames || [],
    firstName: (a.firstName || a.name || 'there').split(' ')[0],
    fullName: a.name || '',
    phone: a.phone || '',
    total: o.currentTotalPriceSet.shopMoney.amount,
    subtotal: o.currentSubtotalPriceSet.shopMoney.amount,
    shipping: o.totalShippingPriceSet.shopMoney.amount,
    itemsLine,
    eta: etaFor(a.provinceCode || a.province, a.city)
  };
}

export async function addTags(gid, tags) {
  await gql(`mutation($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { message } } }`, { id: gid, tags });
}

export async function removeTags(gid, tags) {
  await gql(`mutation($id: ID!, $tags: [String!]!) { tagsRemove(id: $id, tags: $tags) { userErrors { message } } }`, { id: gid, tags });
}

export async function addNote(gid, text) {
  const d = await gql(`query($id: ID!) { order(id: $id) { note } }`, { id: gid });
  const note = [d.order?.note, `[WhatsApp ${new Date().toISOString().slice(0, 16).replace('T', ' ')}] ${text}`].filter(Boolean).join('\n');
  await gql(`mutation($input: OrderInput!) { orderUpdate(input: $input) { userErrors { message } } }`, { input: { id: gid, note } });
}

export async function latestOrderFor(waFrom, toWa) {
  const d = await gql(`{ orders(first: 25, sortKey: CREATED_AT, reverse: true) { nodes { id shippingAddress { phone } } } }`);
  const hit = d.orders.nodes.find(o => toWa(o.shippingAddress?.phone) === waFrom);
  return hit ? getOrder(hit.id) : null;
}
