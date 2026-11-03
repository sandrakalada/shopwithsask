# Ads media-buyer setup: how to repeat it on another store

How Shop With Sask was set up so Claude can run Meta and Google ads and check them daily. Follow the same steps for a new account. Never paste passwords or secret keys into the chat. They go only into the environment settings (step 4).

## 1. Claude app (claude.ai/code)
- Start a cloud session on the new store's project folder.
- Connect the connectors in claude.ai Settings > Connectors: **Shopify** (log in with the new store). Optional: Apify (Instagram data), Semrush (SEO).
- Put a `CLAUDE.md` file in the project with the store's rules (template in section 7). Claude reads it every session.
- Make a `notes/` folder with `meta-ads.md` and `google-ads.md`. Claude writes IDs, findings and every change there, so nothing is lost between sessions.

## 2. Google Ads API access (Google Cloud, about 20 min)
1. console.cloud.google.com: create a project (example name "Store Claude").
2. APIs & Services > Library: enable **Google Ads API**.
3. OAuth consent screen: External, fill in the app name and email, add yourself as a test user, then **Publish app**.
4. Credentials > Create credentials > OAuth client ID > type **Desktop app**. Copy the Client ID and Client secret.
5. Google Ads API > Manage: request **Explorer** (or Basic) access. With only Test access, real accounts can't be read.
6. Note the Google Ads account number (10 digits, no dashes) and, if you have one, the manager (MCC) account number.

## 3. Meta (Facebook) access
1. developers.facebook.com: create an app (type Business) and add the **Marketing API**.
2. Create a long-lived access token (System User in Business Settings is best) with: ads_management, ads_read, business_management, pages_show_list, pages_read_engagement, instagram_basic.
3. Note the ad account id (act_...), Page id and Instagram business id.

## 4. Environment settings (Claude app > environment > Default > Environment variables)
Add these. Values stay private and are never shown in chat:
```
GOOGLE_ADS_CLIENT_ID=...
GOOGLE_ADS_CLIENT_SECRET=...
GOOGLE_ADS_CUSTOMER_ID=1234567890
GOOGLE_ADS_LOGIN_CUSTOMER_ID=manager id (optional)
META_ACCESS_TOKEN=...
META_AD_ACCOUNT_ID=act_...
```
Network access for the environment must allow: googleads.googleapis.com, oauth2.googleapis.com, graph.facebook.com.

## 5. First prompt to Claude (connect and audit)
```
Connect to my Google Ads account through the API and then fix it. Read CLAUDE.md and notes/ first.
1. Check that GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_CUSTOMER_ID are in the environment (never print secret values).
2. Build the OAuth consent URL (scope https://www.googleapis.com/auth/adwords, redirect_uri http://127.0.0.1, access_type=offline, prompt=consent) and give me short steps.
3. Exchange the code for a refresh token and tell me to save it as GOOGLE_ADS_REFRESH_TOKEN in the Default environment.
4. Test a read: campaigns with cost, clicks, conversions for the last 7 days.
5. Show me a plan before changing anything. Compare with Shopify orders (customerJourneySummary utm) to judge real results. Update notes/google-ads.md.
Then do the same for Meta: check the token, list live ad sets, spend, DMs, visits, and compare with Shopify orders.
```
Sign-in step for you: open the link, click Advanced > Go to (app name), Allow. The page that opens shows an error. That is expected. Copy the whole address bar and send it to Claude. Then save the refresh token Claude gives you as GOOGLE_ADS_REFRESH_TOKEN in the Default environment.

## 6. What was fixed on Shop With Sask (check the same on the new account)
Google (Performance Max):
- Goals: only real purchases count. Add to cart, checkout, contact and page view goals set to secondary. A campaign-level custom goal holds only the Shopify app purchase tag ("Google Shopping App Purchase"). The duplicate GA4 and codeless tags were double- or triple-counting sales.
- Budget lowered to match spend and the Meta cap (65 to 25 SAR/day). Target ROAS kept.
- Location: only the cities served, with "Presence" (people in the area), not "presence or interest".
- Negative keywords: competitor brand names plus junk (men, kids, cheap, wholesale, used, jobs, how to), English and Arabic.
- Checked: the feed is linked to Merchant Center and auto-tagging is on.
- Not possible through the API: turning off Display on Performance Max, and changing "codeless" conversion tags (do those by hand in Goals > Conversions).
- Leave the campaign about 2 weeks to learn, then judge it by real Shopify orders.

Meta:
- Women in the target age only, Instagram only, chosen high-end areas, total cap per day.
- Each post as a DM ad and a website ad; audience test (broad, brand interests, Instagram engagers).
- Website ads link to product pages with utm tags (utm_source=ig, utm_medium=paid, utm_campaign={{campaign.id}}, utm_content={{ad.id}}) so orders can be traced in Shopify.
- Pause losers: 85+ spent with 0 results while others work, or cost per result over 2x the average.
- Never advertise sold-out items, last-piece items, or out-of-season pieces.

## 7. CLAUDE.md template (edit for the new store)
```
# {Store name} - standing rules
## Store facts
- Currency, shipping area, delivery prices, payment methods.
## Always
- Keep replies to the owner brief. Confirm before anything that cannot be undone.
## Reporting
- Real revenue = orders that are fulfilled AND paid.
## Meta ads
- Setup, IDs and history: notes/meta-ads.md. Read it before any ads work.
- Hard cap: all live ad sets together max {X}/day. Audience: {gender, ages, platform, areas}.
- Never advertise sold-out items, items with 1 piece left, or out-of-season pieces.
- Judge ads by Shopify orders (customerJourneySummary utm) and DMs, never by cheap visits.
- Pause losers: any ad set that spent {85} with 0 results while another in the campaign gets results, or cost per result over 2x the campaign average. Do not move budget without asking.
## Google ads
- Setup, IDs and history: notes/google-ads.md. Read it before any ads work.
- Never raise budgets, change target ROAS or start campaigns without asking.
```

## 8. Daily scheduled task
In the session, ask Claude: "make a daily scheduled task at 12:47 Cairo time with this prompt":
```
Daily ads check (owner's standing request; the only ads report). Read CLAUDE.md, notes/meta-ads.md, notes/google-ads.md.
Meta: token check (warn if it expires within 10 days); live ad sets, spend, DMs, landing views yesterday and since each ad set started; apply the pause-losers rule; stock of advertised products (pause if sold out or 1 left); total under the daily cap.
Google: main campaign yesterday and last 7 days cost, clicks, conversions on the purchase goal, by network; new search terms (add competitor-brand and junk negatives, never our own product words).
Never raise budgets, change target ROAS or start new campaigns without asking.
Shopify: orders from the last 7 days with customerJourneySummary utm, not cancelled, matched to ads.
Brief report to the owner, no emojis; one line if nothing changed. Update the notes and save them.
```
Then say "do what is necessary as my media buyer" to give Claude permission to pause losers and block bad searches on its own. Budget increases and new campaigns still need your yes.
