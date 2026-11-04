import json,os,urllib.request,urllib.parse,sys,time
T=os.environ["META_ACCESS_TOKEN"]; ACT="act_"+os.environ["META_AD_ACCOUNT_ID"]; IG="17841472046300883"; PAGE="519356447933571"
def req(path,params,method="POST"):
  q=urllib.parse.urlencode({**{k:(json.dumps(v,ensure_ascii=False) if isinstance(v,(dict,list)) else v) for k,v in params.items()},"access_token":T})
  try:
    if method=="GET": return json.load(urllib.request.urlopen("https://graph.facebook.com/v21.0/"+path+"?"+q))
    r=json.load(urllib.request.urlopen(urllib.request.Request("https://graph.facebook.com/v21.0/"+path,data=q.encode(),method="POST"))); print("ok",path,str(r)[:150]); time.sleep(4); return r
  except urllib.error.HTTPError as e: print("ERROR",path,e.read().decode()[:900]); sys.exit(1)
link="https://shopwithsask.com/products/floral-print-sleeveless-vest"
greet=("Hi! This is our Floral Print Sleeveless Vest, 940 EGP, sizes S, M and L. Order here: "+link+
 "\nأهلاً! ده الفيست المشجّر بـ 940 جنيه، مقاس S و M و L. اطلبيه من اللينك.")
print("greet chars",len(greet))
ib=[("What sizes are left? / المقاسات المتاحة؟","Small, Medium and Large are available right now. Order here: "+link+"\nمتاح دلوقتي S و M و L. اطلبيه من هنا: "+link),
    ("How much is delivery? / التوصيل بكام؟","Delivery is 75 EGP in Cairo and Giza, 100 EGP Express, 120 EGP Alexandria. Free in Cairo and Giza over 1,999 EGP.\nالتوصيل 75 جنيه القاهرة والجيزة، 100 جنيه سريع، 120 جنيه الإسكندرية. مجاني في القاهرة والجيزة فوق 1,999 جنيه."),
    ("How do I pay? / الدفع إزاي؟","Cash on delivery or Instapay, and you can try it at the door before you pay.\nكاش عند الاستلام أو إنستاباي، وتقدري تجربيه قدام المندوب قبل ما تدفعي.")]
wm={"type":"VISUAL_EDITOR","version":2,"landing_screen_type":"welcome_message","media_type":"text",
    "text_format":{"customer_action_type":"ice_breakers","message":{"text":greet,"quick_replies":[],"ice_breakers":[{"title":t,"response":r} for t,r in ib]}},
    "user_edit":True,"surface":"visual_editor_new"}
msg=("A floral vest that finishes any outfit, over a tee or a shirt. Message us to order.\nفيست مشجّر يكمّل أي لوك. ابعتيلنا رسالة واطلبيه.")
cr="2178355596396719" if "--go" in sys.argv else req(ACT+"/adcreatives",{"name":"Floral Print Sleeveless Vest - DM welcome","instagram_user_id":IG,
  "object_story_spec":{"page_id":PAGE,"instagram_user_id":IG,"link_data":{"link":"https://www.instagram.com/shopwithsask","image_hash":"62ef1e7ffe00d7d6f67a0ae872178433","message":msg,"name":"Floral Print Sleeveless Vest",
     "call_to_action":{"type":"INSTAGRAM_MESSAGE","value":{"app_destination":"INSTAGRAM_DIRECT","link":"https://www.instagram.com/shopwithsask","app_link":"instagram://direct?userid=72087065543"}},
     "page_welcome_message":json.dumps(wm,ensure_ascii=False)}}})
if "--go" not in sys.argv: print(cr); sys.exit()
for name,adset,old in [("A Broad","52559596425120","52559596619720"),("B Brands","52559642503520","52559642537120"),("D IG engagers","52559650248120","52559650263120")]:
  req(ACT+"/ads",{"name":f"Floral Print Sleeveless Vest - DM - {name}","adset_id":adset,"creative":{"creative_id":cr},"status":"ACTIVE"})
  time.sleep(30); req(old,{"status":"PAUSED"}); time.sleep(30)
