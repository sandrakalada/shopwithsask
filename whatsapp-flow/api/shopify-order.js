import { rawBody, verifyShopify, json, env } from '../lib/util.js';
import { getOrder } from '../lib/shopify.js';
import { onNewOrder } from '../lib/flow.js';
import { deps } from '../lib/deps.js';

const eligible = o => /pending/i.test(o.financial) && o.gateways.some(g => /cash on delivery|cod|instapay/i.test(g));

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false });
  const body = await rawBody(req);
  if (!verifyShopify(body, req.headers['x-shopify-hmac-sha256'], env('SHOPIFY_WEBHOOK_SECRET') || env('SHOPIFY_CLIENT_SECRET'))) return json(res, 401, { ok: false });

  let id;
  try { id = JSON.parse(body).id; } catch { return json(res, 400, { ok: false }); }

  try {
    const order = await getOrder(id);
    if (!order) return json(res, 200, { ok: true, result: 'no-order' });
    if (!eligible(order)) return json(res, 200, { ok: true, result: 'not-eligible' });
    const result = await onNewOrder(order, deps());
    console.log('order', order.name, result);
    return json(res, 200, { ok: true, result });
  } catch (e) {
    console.error('order webhook', e);
    return json(res, 200, { ok: false, error: e.message });
  }
}
