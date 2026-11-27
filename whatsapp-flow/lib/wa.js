import { env } from './util.js';

const GRAPH = 'https://graph.facebook.com/v21.0';

async function send(payload) {
  const r = await fetch(`${GRAPH}/${env('WA_PHONE_NUMBER_ID')}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env('WA_TOKEN')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`WhatsApp ${r.status}: ${JSON.stringify(data.error || data)}`);
  return data;
}

export const sendText = (to, body) =>
  send({ to, type: 'text', text: { body, preview_url: false } });

export const sendButtons = (to, body, buttons, headerImage) =>
  send({
    to, type: 'interactive',
    interactive: {
      type: 'button',
      ...(headerImage ? { header: { type: 'image', image: { link: headerImage } } } : {}),
      body: { text: body },
      action: { buttons: buttons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title } })) }
    }
  });

export const sendList = (to, body, buttonText, rows) =>
  send({
    to, type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: { button: buttonText, sections: [{ title: 'Options', rows: rows.map(r => ({ id: r.id, title: r.title })) }] }
    }
  });

export const sendOrderTemplate = (to, { params, payloads, logoUrl, name, lang }) =>
  send({
    to, type: 'template',
    template: {
      name, language: { code: lang },
      components: [
        { type: 'header', parameters: [{ type: 'image', image: { link: logoUrl } }] },
        { type: 'body', parameters: params.map(t => ({ type: 'text', text: String(t) })) },
        ...payloads.map((p, i) => ({ type: 'button', sub_type: 'quick_reply', index: String(i), parameters: [{ type: 'payload', payload: p }] }))
      ]
    }
  });

export const markRead = id =>
  send({ status: 'read', message_id: id }).catch(() => {});
