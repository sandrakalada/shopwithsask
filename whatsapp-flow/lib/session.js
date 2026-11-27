import { env } from './util.js';

const base = () => `${env('SUPABASE_URL')}/rest/v1/wa_sessions`;
const headers = () => ({ apikey: env('SUPABASE_SERVICE_KEY'), authorization: `Bearer ${env('SUPABASE_SERVICE_KEY')}`, 'content-type': 'application/json' });

export async function setSession(phone, orderId, state) {
  const r = await fetch(base(), {
    method: 'POST',
    headers: { ...headers(), prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ phone, order_id: String(orderId), state, updated_at: new Date().toISOString() })
  });
  if (!r.ok) throw new Error('session save ' + r.status + ' ' + await r.text());
}

export async function getSession(phone) {
  const since = new Date(Date.now() - 48 * 3600e3).toISOString();
  const r = await fetch(`${base()}?phone=eq.${encodeURIComponent(phone)}&updated_at=gte.${encodeURIComponent(since)}&select=*`, { headers: headers() });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] || null;
}

export async function clearSession(phone) {
  await fetch(`${base()}?phone=eq.${encodeURIComponent(phone)}`, { method: 'DELETE', headers: headers() });
}
