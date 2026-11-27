import { json, env } from '../lib/util.js';
import { gql } from '../lib/shopify.js';

const GRAPH = 'https://graph.facebook.com/v21.0';
const g = async (path, opts = {}) => {
  const r = await fetch(`${GRAPH}/${path}`, { ...opts, headers: { authorization: `Bearer ${env('WA_TOKEN')}`, ...(opts.headers || {}) } });
  return r.json().catch(() => ({}));
};

export default async function handler(req, res) {
  const u = new URL(req.url, 'http://x');
  if (!env('WA_TOKEN')) return json(res, 200, { ok: false, note: 'WA_TOKEN not set yet' });

  const waba = env('WA_WABA_ID');
  const out = { live: env('LIVE') === 'true', test_numbers: env('TEST_NUMBERS'), using_template: env('WA_TEMPLATE') };

  const numbers = await g(`${waba}/phone_numbers?fields=id,display_phone_number,verified_name,name_status,new_display_name,new_name_status,quality_rating`);
  out.phone_numbers = numbers.data || numbers.error;

  if (u.searchParams.get('subscribe') === '1') {
    out.subscribe = await g(`${waba}/subscribed_apps`, { method: 'POST' });
  }
  const subs = await g(`${waba}/subscribed_apps`);
  out.subscribed_apps = (subs.data || []).map(a => a.whatsapp_business_api_data?.name || a.name || 'app');

  const t = await g(`${waba}/message_templates?fields=name,status,language,category,rejected_reason&limit=50`);
  out.templates = (t.data || []).filter(x => x.name.startsWith('sask_')).map(x => ({ name: x.name, status: x.status, rejected_reason: x.rejected_reason, category: x.category }));
  if (t.error) out.templates_error = t.error;
  if (u.searchParams.get('diag') === '1') {
    out.phone = await g(`${env('WA_PHONE_NUMBER_ID')}?fields=display_phone_number,status,name_status,code_verification_status,health_status,messaging_limit_tier`);
  }

  try {
    const cb = `https://${req.headers.host}/api/shopify-order`;
    if (u.searchParams.get('shopify') === '1') {
      const m = await gql(`mutation($cb: String!) { webhookSubscriptionCreate(topic: ORDERS_CREATE, webhookSubscription: { uri: $cb }) { webhookSubscription { id } userErrors { message } } }`, { cb });
      out.shopify_webhook_create = m.webhookSubscriptionCreate.userErrors.length ? m.webhookSubscriptionCreate.userErrors : 'created';
    }
    const w = await gql(`{ shop { name } webhookSubscriptions(first: 10) { nodes { topic uri } } }`);
    out.shopify = { shop: w.shop.name, webhooks: w.webhookSubscriptions.nodes };
  } catch (e) { out.shopify = { error: e.message }; }

  const missing = ['WA_TOKEN', 'WA_PHONE_NUMBER_ID', 'META_APP_SECRET', 'WA_VERIFY_TOKEN', 'SHOPIFY_CLIENT_ID', 'SHOPIFY_CLIENT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'LOGO_URL'].filter(k => !env(k));
  out.env = missing.length ? { missing } : 'all set';
  return json(res, 200, out);
}
