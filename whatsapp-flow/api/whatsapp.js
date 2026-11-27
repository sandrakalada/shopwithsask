import { rawBody, verifyMeta, json, env, allowed } from '../lib/util.js';
import { onButton, onMessage, onStatus } from '../lib/flow.js';
import { deps } from '../lib/deps.js';
import { markRead } from '../lib/wa.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const u = new URL(req.url, 'http://x');
    if (u.searchParams.get('hub.mode') === 'subscribe' && u.searchParams.get('hub.verify_token') === env('WA_VERIFY_TOKEN')) {
      res.statusCode = 200; return res.end(u.searchParams.get('hub.challenge'));
    }
    return json(res, 403, { ok: false });
  }
  if (req.method !== 'POST') return json(res, 405, { ok: false });

  const body = await rawBody(req);
  if (!verifyMeta(body, req.headers['x-hub-signature-256'], env('META_APP_SECRET'))) return json(res, 401, { ok: false });

  const d = deps();
  try {
    const data = JSON.parse(body);
    for (const entry of data.entry || []) for (const ch of entry.changes || []) {
      for (const st of ch.value?.statuses || []) {
        if (st.status === 'failed') console.error('wa delivery failed', st.recipient_id, JSON.stringify(st.errors || []));
        else console.log('wa status', st.recipient_id, st.status);
        await onStatus(st, d).catch(e => console.error('wa status update', e.message));
      }
      for (const m of ch.value?.messages || []) {
        const from = m.from;
        if (!allowed(from)) continue;
        markRead(m.id);
        const payload = m.button?.payload || m.interactive?.button_reply?.id || m.interactive?.list_reply?.id;
        const r = payload
          ? await onButton(from, payload, d)
          : await onMessage(from, { type: m.type, text: m.text?.body }, d);
        console.log('wa', from, payload || m.type, r);
      }
    }
  } catch (e) {
    console.error('wa webhook', e);
  }
  return json(res, 200, { ok: true });
}
