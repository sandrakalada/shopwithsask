-- Live sync app -> Shopify: every stock change made in the app (and every SKU/price edit) is sent to Shopify straight away.
-- Shopify -> app is already live through the inventory webhook.
create or replace function public.push_to_shopify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://tsyxbnotjjhgxvzlresr.supabase.co/functions/v1/shopify',
    headers := jsonb_build_object('content-type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='sask_cron_secret')),
    body := '{"action":"push"}'::jsonb,
    timeout_milliseconds := 60000);
  return null;
end $$;
drop trigger if exists stock_push_live on public.stock_movements;
create trigger stock_push_live after insert on public.stock_movements
  for each row when (new.source = 'app' and new.shopify_pushed_at is null) execute function public.push_to_shopify();
drop trigger if exists variant_push_live on public.variants;
create trigger variant_push_live after update of shopify_dirty, sku, price on public.variants
  for each row when (new.shopify_dirty is true) execute function public.push_to_shopify();
