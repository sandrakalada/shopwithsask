import { env } from './util.js';

export async function addAlert(a) {
  const r = await fetch(`${env('SUPABASE_URL')}/rest/v1/wa_alerts`, {
    method: 'POST',
    headers: { apikey: env('SUPABASE_SERVICE_KEY'), authorization: `Bearer ${env('SUPABASE_SERVICE_KEY')}`, 'content-type': 'application/json', prefer: 'return=minimal' },
    body: JSON.stringify(a)
  });
  if (!r.ok) throw new Error('alert save ' + r.status + ' ' + await r.text());
}
