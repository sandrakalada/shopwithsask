-- Return / exchange requests from the website form (Shopify metaobject return_request), copied here every 5 minutes
create table if not exists public.returns (
  id text primary key,               -- Shopify metaobject gid
  number text not null,              -- e.g. R1345-AB12
  type text not null,                -- return | exchange
  status text not null default 'New',
  order_name text, order_id text,
  customer_name text, contact text, governorate text,
  fee numeric, items jsonb not null default '[]',
  reason text, details text, exchange_request text, refund_instapay text,
  photos text[] not null default '{}',
  delivered_at timestamptz, submitted_at timestamptz,
  synced_at timestamptz not null default now()
);
alter table public.returns enable row level security;
create policy "staff read" on public.returns for select to authenticated using (not is_shipping());
grant select on public.returns to authenticated;
-- cron: sask-returns '*/5 * * * *' posts {"action":"returns-sync"} with x-cron-secret
