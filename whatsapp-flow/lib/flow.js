import { BTN, LABEL, msg, templateParams, CHANGE_OPTIONS, SIZES } from './copy.js';

const id = (btn, orderId) => `${btn}:${orderId}`;
const payButtons = orderId => [
  { id: id(BTN.CASH, orderId), title: LABEL.CASH },
  { id: id(BTN.INSTA, orderId), title: LABEL.INSTA }
];

export async function onNewOrder(order, d) {
  if (order.cancelled || order.tags.includes('wa-sent')) return 'skip';
  const to = d.waNumber(order.phone);
  if (!to) return 'no-phone';
  if (!d.allowed(to)) return 'not-allowed';
  const sent = await d.wa.sendOrderTemplate(to, {
    name: d.cfg.template, lang: d.cfg.lang, logoUrl: d.cfg.logoUrl,
    params: templateParams(order),
    payloads: [BTN.CONFIRM, BTN.CANCEL, BTN.CHANGE].map(b => id(b, order.id))
  });
  await d.shop.addTags(order.gid, ['wa-sent']);
  if (d.msgs) await d.msgs.save(sent?.messages?.[0]?.id, order.gid).catch(e => console.error('msg save', e.message));
  return 'sent';
}

// Delivery and read receipts for the order confirmation: tag the order wa-delivered, wa-read or wa-failed.
const RANK = { sent: 0, delivered: 1, read: 2, failed: 3 };
export async function onStatus(st, d) {
  if (!d.msgs || !RANK[st.status]) return 'ignored';
  const m = await d.msgs.get(st.id);
  if (!m) return 'unknown-message';
  if (st.status !== 'failed' && (RANK[m.status] ?? 0) >= RANK[st.status]) return 'old';
  await d.msgs.setStatus(st.id, st.status);
  const tag = `wa-${st.status}`;
  await d.shop.addTags(m.order_gid, [tag]);
  const drop = ['wa-delivered', 'wa-read', 'wa-failed'].filter(t => t !== tag);
  await d.shop.removeTags(m.order_gid, drop);
  return tag;
}

const alert = async (d, order, what, extra) => {
  if (d.alerts) await d.alerts.add({ order_name: order.name, order_id: order.id, customer: order.fullName, phone: order.phone, total: Number(order.total) || null, kind: what, detail: extra || null })
    .catch(e => console.error('alert', e.message));
  if (d.cfg.ownerNumber) await d.wa.sendText(d.cfg.ownerNumber, msg.alert(order, what, extra)).catch(() => {});
};

export async function onButton(from, payload, d) {
  const [btnFull, orderId] = String(payload).split(':');
  const m = /^(CHG|SIZE)_(.+)$/.exec(btnFull);
  const [btn, opt] = m ? [m[1], m[2]] : [btnFull, ''];
  if (!orderId) return 'bad-payload';
  const order = await d.shop.getOrder(orderId);
  if (!order) return 'no-order';
  if (d.waNumber(order.phone) !== from) return 'wrong-customer';

  switch (btn) {
    case BTN.CONFIRM:
      await d.wa.sendButtons(from, msg.pay(order), payButtons(order.id));
      return 'pay-ask';

    case BTN.CASH:
      await d.wa.sendText(from, msg.cash(order));
      await d.shop.addTags(order.gid, ['cod-confirmed']);
      await d.shop.removeTags(order.gid, ['instapay-pending', 'cancel-requested']);
      await d.session.clear(from);
      await alert(d, order, 'Confirmed: Cash on delivery');
      return 'cash';

    case BTN.INSTA:
      await d.wa.sendText(from, msg.insta(order));
      await d.shop.addTags(order.gid, ['instapay-pending']);
      await d.shop.removeTags(order.gid, ['cod-confirmed', 'cancel-requested']);
      await d.session.clear(from);
      await alert(d, order, 'Confirmed: Instapay', 'Send them your Instapay details.');
      return 'insta';

    case BTN.CHANGE:
      await d.wa.sendList(from, msg.change(order), 'Choose', CHANGE_OPTIONS.map(c => ({ id: id(`${BTN.CHG}_${c.key}`, order.id), title: c.title })));
      await d.shop.addTags(order.gid, ['change-requested']);
      return 'change';

    case BTN.CHG:
      if (opt === 'size') {
        await d.wa.sendList(from, msg.changeSize(order), 'Choose size', SIZES.map(sz => ({ id: id(`${BTN.SIZE}_${sz}`, order.id), title: sz })));
        return 'change-size';
      }
      if (!msg.changeAsk(opt)) return 'unknown-button';
      await d.wa.sendText(from, msg.changeAsk(opt));
      await d.session.set(from, order.id, `await_change_${opt}`);
      return 'change-ask';

    case BTN.SIZE:
      if (!SIZES.includes(opt)) return 'unknown-button';
      await d.wa.sendText(from, msg.changeSizeGot(order, opt));
      await d.shop.addNote(order.gid, `Change requested: size ${opt}`);
      await d.session.clear(from);
      await alert(d, order, 'Change: size', `New size: ${opt}`);
      return 'change-size-got';

    case BTN.CANCEL:
      await d.wa.sendButtons(from, msg.cancelAsk(order), [
        { id: id(BTN.CANCEL_YES, order.id), title: LABEL.CANCEL_YES },
        { id: id(BTN.CANCEL_NO, order.id), title: LABEL.CANCEL_NO }
      ]);
      return 'cancel-ask';

    case BTN.CANCEL_YES:
      await d.wa.sendText(from, msg.cancelled(order));
      await d.shop.addTags(order.gid, ['cancel-requested']);
      await d.session.clear(from);
      await alert(d, order, 'Cancelled', 'Cancel it in Shopify. The app does not cancel orders.');
      return 'cancelled';

    case BTN.CANCEL_NO:
      await d.wa.sendButtons(from, msg.kept(order), payButtons(order.id));
      return 'kept';

    default:
      return 'unknown-button';
  }
}

export async function onMessage(from, { type, text }, d) {
  const s = await d.session.get(from);
  const order = s ? await d.shop.getOrder(s.order_id) : null;

  if (s && order && s.state.startsWith('await_change') && (type === 'text' ? text : type === 'image')) {
    const what = s.state.replace('await_change_', '') || 'change';
    const detail = type === 'image' ? '(sent a screenshot)' : text;
    await d.wa.sendText(from, msg.changeGot());
    await d.shop.addNote(order.gid, `Change requested (${what}): ${detail}`);
    await d.session.clear(from);
    await alert(d, order, `Change: ${what}`, detail);
    return 'change-got';
  }

  return 'ignored';
}
