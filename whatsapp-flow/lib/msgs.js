import { env } from './util.js';

// WhatsApp message id -> Shopify order, so delivery and read receipts can update the order.
const base = () => `${env('SUPABASE_URL')}/rest/v1/wa_messages`;
const headers = () => ({ apikey: env('SUPABASE_SERVICE_KEY'), authorization: `Bearer ${env('SUPABASE_SERVICE_KEY')}`, 'content-type': 'application/json' });

export async function saveMsg(id, orderGid) {
  if (!id) return;
  const r = await fetch(base(), { method: 'POST', headers: { ...headers(), prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id, order_gid: orderGid, status: 'sent' }) });
  if (!r.ok) throw new Error('msg save ' + r.status + ' ' + await r.text());
}

export async function getMsg(id) {
  const r = await fetch(`${base()}?id=eq.${encodeURIComponent(id)}&select=*`, { headers: headers() });
  if (!r.ok) return null;
  return (await r.json())[0] || null;
}

export async function setMsgStatus(id, status) {
  await fetch(`${base()}?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { ...headers(), prefer: 'return=minimal' }, body: JSON.stringify({ status, updated_at: new Date().toISOString() }) });
}
