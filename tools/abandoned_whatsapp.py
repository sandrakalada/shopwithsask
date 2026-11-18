"""List new abandoned checkouts with a phone number and build bilingual WhatsApp
click-to-send links for the owner. Read-only on Shopify; never sends anything.
Usage: python3 tools/abandoned_whatsapp.py [--dry]  (--dry: do not record as sent)"""
import os, sys, json, re, urllib.request, urllib.parse
from datetime import datetime, timedelta, timezone

STORE = 'wfud64-tq.myshopify.com'
SENT = os.path.join(os.path.dirname(__file__), '..', 'notes', 'abandoned-checkouts-sent.json')
MIN_AGE_H, MAX_AGE_H = 1, 48

def token():
    d = urllib.parse.urlencode(dict(grant_type='client_credentials', client_id=os.environ['SHOPIFY_CLIENT_ID'],
                                    client_secret=os.environ['SHOPIFY_CLIENT_SECRET'])).encode()
    return json.load(urllib.request.urlopen(f'https://{STORE}/admin/oauth/access_token', d))['access_token']

def gql(tk, q, v=None):
    r = urllib.request.Request(f'https://{STORE}/admin/api/2025-10/graphql.json', json.dumps({'query': q, 'variables': v or {}}).encode(),
                               {'X-Shopify-Access-Token': tk, 'Content-Type': 'application/json'})
    j = json.load(urllib.request.urlopen(r))
    if 'errors' in j: raise SystemExit(j['errors'])
    return j['data']

def wa_number(p):
    d = re.sub(r'\D', '', p or '')
    if d.startswith('00'): d = d[2:]
    if d.startswith('0'): d = '20' + d[1:]
    if len(d) == 10 and d.startswith('1'): d = '20' + d
    return d if d.startswith('20') and len(d) == 12 else None

def ar_title(tk, pid, fallback):
    try:
        t = gql(tk, 'query($id:ID!){translatableResource(resourceId:$id){translations(locale:"ar"){key value}}}', {'id': pid})
        for x in (t['translatableResource'] or {}).get('translations', []):
            if x['key'] == 'title' and x['value']: return x['value']
    except SystemExit: pass
    return fallback

def main():
    dry = '--dry' in sys.argv
    tk = token()
    sent = json.load(open(SENT)) if os.path.exists(SENT) else []
    now = datetime.now(timezone.utc)
    since = (now - timedelta(hours=MAX_AGE_H)).strftime('%Y-%m-%dT%H:%M:%SZ')
    data = gql(tk, '''query($q:String){abandonedCheckouts(first:50, reverse:true, query:$q){nodes{id createdAt completedAt abandonedCheckoutUrl
      totalPriceSet{shopMoney{amount}} customer{firstName defaultPhoneNumber{phoneNumber}} shippingAddress{firstName phone}
      billingAddress{phone} lineItems(first:5){nodes{title quantity variant{inventoryQuantity product{id}}}}}}}''', {'q': f'created_at:>={since}'})
    out = []
    for n in data['abandonedCheckouts']['nodes']:
        age = (now - datetime.fromisoformat(n['createdAt'].replace('Z', '+00:00'))).total_seconds() / 3600
        if n['completedAt'] or n['id'] in sent or not (MIN_AGE_H <= age <= MAX_AGE_H): continue
        sa, cu = n.get('shippingAddress') or {}, n.get('customer') or {}
        num = wa_number(sa.get('phone') or (n.get('billingAddress') or {}).get('phone') or (cu.get('defaultPhoneNumber') or {}).get('phoneNumber'))
        if not num: continue
        items = n['lineItems']['nodes']
        if not items: continue
        if any(i.get('variant') and (i['variant'].get('inventoryQuantity') or 0) <= 0 for i in items):
            out.append({'id': n['id'], 'name': (sa.get('firstName') or cu.get('firstName') or 'Customer'), 'items': ', '.join(i['title'] for i in items),
                        'total': n['totalPriceSet']['shopMoney']['amount'], 'hours_ago': round(age), 'link': None, 'note': 'sold out, not messaged'})
            continue
        first = items[0]
        en = first['title'] if len(items) == 1 else f"{first['title']} and your other pieces"
        a1 = ar_title(tk, first['variant']['product']['id'], first['title']) if first.get('variant') else first['title']
        ar = a1 if len(items) == 1 else f'{a1} وباقي القطع'
        name = (sa.get('firstName') or cu.get('firstName') or '').strip()
        url = n['abandonedCheckoutUrl']
        msg = (f"Hi{(' ' + name) if name else ''}, this is Shop With Sask. You left the {en} in your cart and it is still available. "
               f"You can complete your order here: {url}\nCash on delivery or Instapay. Reply here if you need help with the size.\n\n"
               f"أهلاً{(' ' + name) if name else ''}، معاكي Shop With Sask. سيبتي {ar} في السلة ولسه متاح. "
               f"تقدري تكملي طلبك من هنا: {url}\nالدفع كاش عند الاستلام أو إنستاباي. لو محتاجة مساعدة في المقاس ابعتيلنا هنا.")
        out.append({'id': n['id'], 'name': name or 'Customer', 'items': ', '.join(i['title'] for i in items),
                    'total': n['totalPriceSet']['shopMoney']['amount'], 'hours_ago': round(age),
                    'link': f'https://wa.me/{num}?text=' + urllib.parse.quote(msg)})
    if not dry and out:
        json.dump(sent + [o['id'] for o in out], open(SENT, 'w'), indent=1)
    print(json.dumps(out, ensure_ascii=False, indent=1))

if __name__ == '__main__':
    main()
