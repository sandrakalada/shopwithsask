import { json, env } from '../lib/util.js';

const GRAPH = 'https://graph.facebook.com/v21.0';

export default async function handler(req, res) {
  const u = new URL(req.url, 'http://x');
  if (u.searchParams.get('delete') !== 'sask_order_confirm_v2') return json(res, 400, { ok: false });
  const r = await fetch(`${GRAPH}/${env('WA_WABA_ID')}/message_templates?name=sask_order_confirm_v2&hsm_id=1516636963897969`, { method: 'DELETE', headers: { authorization: `Bearer ${env('WA_TOKEN')}` } }).then(r => r.json());
  return json(res, 200, { ok: !!r.success, result: r });
}
