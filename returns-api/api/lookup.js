import { cors, findOrder, eligibility, publicOrder, send } from './_lib.js';
export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    const { order, contact } = req.body || {};
    const f = await findOrder(order, contact);
    if (f.error) return send(res, 404, { error: f.error });
    const el = eligibility(f.order);
    send(res, 200, { order: publicOrder(f.order), eligibility: el });
  } catch (e) { console.error(e); send(res, 500, { error: 'server' }); }
}
