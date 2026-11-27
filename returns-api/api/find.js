import { cors, gql, send } from './_lib.js';
// "Can't find your order?" Returns order numbers (and dates) placed with this email in the last 90 days.
export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    if (!/^[^\s@"]+@[^\s@"]+\.[^\s@"]+$/.test(email) || email.length > 120) return send(res, 400, { error: 'email' });
    const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
    const d = await gql(`query($q:String!){orders(first:10,sortKey:CREATED_AT,reverse:true,query:$q){nodes{name createdAt cancelledAt email customer{email}}}}`,
      { q: `email:"${email}" AND created_at:>=${since}` });
    const orders = d.orders.nodes
      .filter(o => !o.cancelledAt && [o.email, o.customer?.email].filter(Boolean).map(e => e.toLowerCase()).includes(email))
      .slice(0, 5).map(o => ({ name: o.name, date: o.createdAt.slice(0, 10) }));
    send(res, 200, { orders });
  } catch (e) { console.error(e); send(res, 500, { error: 'server' }); }
}
