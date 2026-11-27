export const STORE = 'Shop With Säsk';

const ZONES = [
  { eta: '2 to 5 working days', match: ['cairo', 'giza', 'al qahirah', 'al jizah', 'c', 'gz'] },
  { eta: '4 to 7 working days', match: ['alexandria', 'alx', 'north coast', 'matrouh', 'mt', 'port said', 'ismailia', 'suez', 'damietta', 'dakahlia', 'sharqia', 'sharkia', 'qalyubia', 'kafr el sheikh', 'gharbia', 'monufia', 'beheira', 'ptsd', 'is', 'suz', 'dt', 'dk', 'shr', 'kb', 'kfs', 'gh', 'mnf', 'bh'] },
  { eta: '5 to 9 working days', match: ['red sea', 'luxor', 'aswan', 'asyut', 'assiut', 'sohag', 'qena', 'minya', 'beni suef', 'faiyum', 'fayoum', 'new valley', 'south sinai', 'north sinai', 'ba', 'lx', 'asn', 'ast', 'shg', 'kn', 'mn', 'bns', 'fym', 'wad', 'js', 'sin'] }
];

export function etaFor(province = '', city = '') {
  const p = String(province).trim().toLowerCase();
  const c = String(city).trim().toLowerCase();
  for (const z of ZONES) {
    if (z.match.includes(p) || z.match.some(m => m.length > 3 && (p.includes(m) || c.includes(m)))) return z.eta;
  }
  return '2 to 9 working days';
}

export const money = n => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const BTN = {
  CONFIRM: 'CONFIRM', CANCEL: 'CANCEL', CHANGE: 'CHANGE',
  CASH: 'CASH', INSTA: 'INSTA',
  CANCEL_YES: 'CANCEL_YES', CANCEL_NO: 'CANCEL_NO',
  CHG: 'CHG', SIZE: 'SIZE'
};

export const CHANGE_OPTIONS = [
  { key: 'size', title: 'Size' },
  { key: 'colour', title: 'Colour' },
  { key: 'item', title: 'Item' },
  { key: 'address', title: 'Delivery address' },
  { key: 'other', title: 'Something else' }
];
export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export const LABEL = {
  CONFIRM: 'Confirm Order',
  CANCEL: 'Cancel Order',
  CHANGE: 'Request Change',
  CASH: 'Cash on delivery',
  INSTA: 'Instapay',
  CANCEL_YES: 'Yes, cancel it',
  CANCEL_NO: 'Keep my order'
};

export const templateParams = o => [o.firstName, o.name, `EGP ${money(o.total)}`, o.itemsLine, o.eta];

export const firstMessage = o =>
`Hi ${o.firstName}!
Thank you for shopping with *${STORE}*.
Your order *${o.name}* for the total amount of *EGP ${money(o.total)}* is ready to go!

${o.itemsLine}
Estimated delivery: ${o.eta}.

Please tap "Confirm Order" so we can ship it.`;

const NOTE = '_Please note: if the order is refused at the door, the delivery fee is still due, payable to the courier in cash or by Instapay._';

export const msg = {
  cash: o =>
`Thank you, ${o.firstName}! Your order *${o.name}* is confirmed.

Please have *EGP ${money(o.total)}* ready in cash for the courier. You can try your items at the door before you pay.
Estimated delivery: ${o.eta}. We'll message you when it's out for delivery.

${NOTE}`,

  pay: o =>
`Thank you, ${o.firstName}! How would you like to pay for order *${o.name}*?`,

  insta: o =>
`Thank you, ${o.firstName}! Your order *${o.name}* is confirmed with Instapay.

Someone will be in touch with you.

${NOTE}`,

  change: o => `Sure, ${o.firstName}! What would you like to change in order *${o.name}*?`,

  changeSize: o => `Which size would you like instead?`,

  changeAsk: key => ({
    colour: 'Which colour would you like? Please type it below.',
    item: 'Which item would you like instead? Please type the name or send a screenshot.',
    address: 'Please type the new delivery address, including building, floor and apartment.',
    other: 'Please tell us what you would like to change.'
  })[key],

  changeSizeGot: (o, size) =>
`Got it! We'll change your order *${o.name}* to size *${size}*.
Our team will confirm the update with you shortly.`,

  changeGot: () =>
`Thank you! We've passed your request to our team. We'll confirm your updated order with you shortly.`,

  cancelAsk: o => `Are you sure you want to cancel order *${o.name}*?`,

  cancelled: o =>
`Your order *${o.name}* has been cancelled. We hope to see you again soon at shopwithsask.com.`,

  kept: o => `Great, your order *${o.name}* is still active. How would you like to pay?`,

  freeText: () => `Thanks for your message! Our team will reply shortly.`,

  alert: (o, what, extra = '') =>
`Säsk flow: ${what}
Order ${o.name}, ${o.fullName}, ${o.phone}
Total EGP ${money(o.total)}${extra ? `\n${extra}` : ''}`
};
