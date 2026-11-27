import * as wa from './wa.js';
import * as shop from './shopify.js';
import { setSession, getSession, clearSession } from './session.js';
import { addAlert } from './alerts.js';
import { saveMsg, getMsg, setMsgStatus } from './msgs.js';
import { env, waNumber, allowed } from './util.js';

export const deps = () => ({
  wa,
  shop,
  session: { set: setSession, get: getSession, clear: clearSession },
  alerts: { add: addAlert },
  msgs: { save: saveMsg, get: getMsg, setStatus: setMsgStatus },
  waNumber,
  allowed,
  cfg: {
    template: env('WA_TEMPLATE') || 'sask_order_confirm',
    lang: env('WA_TEMPLATE_LANG') || 'en',
    logoUrl: env('LOGO_URL'),
    ownerNumber: waNumber(env('OWNER_ALERT_NUMBER')),
    testShortcut: env('LIVE') !== 'true'
  }
});
