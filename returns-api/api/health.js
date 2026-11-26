import { gql } from './_lib.js';
export default async function handler(req, res) {
  try { const d = await gql('{shop{name}}'); res.status(200).json({ ok: !!d.shop.name }); }
  catch (e) { res.status(500).json({ ok: false }); }
}
