import crypto from 'node:crypto';

export async function rawBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
  return Buffer.concat(chunks).toString('utf8');
}

const safeEqual = (a, b) => {
  const x = Buffer.from(a || ''), y = Buffer.from(b || '');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export function verifyShopify(body, header, secret) {
  if (!secret || !header) return false;
  const digest = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64');
  return safeEqual(digest, header);
}

export function verifyMeta(body, header, secret) {
  if (!secret || !header) return false;
  const digest = 'sha256=' + crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  return safeEqual(digest, header);
}

export function waNumber(raw) {
  let d = String(raw || '').replace(/[^\d]/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0') && d.length === 11) d = '20' + d.slice(1);
  if (d.length === 10 && d.startsWith('1')) d = '20' + d;
  return d;
}

export const json = (res, code, obj) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); };

export const env = k => process.env[k] || '';

export function allowed(number) {
  if (env('LIVE') === 'true') return true;
  const list = env('TEST_NUMBERS').split(',').map(waNumber).filter(Boolean);
  return list.includes(waNumber(number));
}
