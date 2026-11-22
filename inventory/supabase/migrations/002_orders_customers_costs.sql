-- Orders, customers, invoices, cost prices, SKU sync to Shopify, settings.
alter table public.variants add column if not exists cost numeric(12,2);
alter table public.variants add column if not exists cost_currency text not null default 'EGP';
alter table public.variants drop constraint if exists variants_cost_currency_check;
alter table public.variants add constraint variants_cost_currency_check check (cost_currency in ('EGP','SAR'));
alter table public.variants add column if not exists shopify_dirty boolean not null default false;
alter table public.products add column if not exists title_ar text;

create or replace function public.mark_variant_dirty() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and new.shopify_variant_id is not null and (
    new.sku is distinct from old.sku or new.price is distinct from old.price or
    new.cost is distinct from old.cost or new.cost_currency is distinct from old.cost_currency) then
    new.shopify_dirty := true;
  end if;
  return new;
end $$;
drop trigger if exists variants_dirty on public.variants;
create trigger variants_dirty before update on public.variants
  for each row execute function public.mark_variant_dirty();

create or replace function public.touch_synced_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.synced_at := now();
  return new;
end $$;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb,
  synced_at timestamptz not null default now()
);
drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch before insert or update on public.app_settings
  for each row execute function public.touch_synced_at();
insert into public.app_settings(key, value) values ('sar_to_egp', '13'::jsonb) on conflict do nothing;

create table if not exists public.customers (
  id text primary key,
  name text, first_name text, last_name text, email text, phone text,
  address jsonb, city text,
  orders_count integer not null default 0,
  amount_spent numeric(12,2) not null default 0,
  note text, tags text[] not null default '{}',
  created_at timestamptz, updated_at timestamptz,
  synced_at timestamptz not null default now()
);
create index if not exists customers_synced_idx on public.customers(synced_at);
drop trigger if exists customers_touch on public.customers;
create trigger customers_touch before insert or update on public.customers
  for each row execute function public.touch_synced_at();

create table if not exists public.orders (
  id text primary key,
  name text not null,
  created_at timestamptz, updated_at timestamptz, processed_at timestamptz,
  cancelled_at timestamptz, closed_at timestamptz,
  financial_status text, fulfillment_status text,
  payment_gateways text[] not null default '{}',
  note text, tags text[] not null default '{}',
  email text, phone text, currency text, locale text,
  total numeric(12,2), subtotal numeric(12,2), shipping numeric(12,2), discounts numeric(12,2),
  customer_id text,
  shipping_address jsonb, shipping_title text,
  line_items jsonb not null default '[]',
  synced_at timestamptz not null default now()
);
alter table public.orders add column if not exists locale text;
create index if not exists orders_synced_idx on public.orders(synced_at);
create index if not exists orders_customer_idx on public.orders(customer_id);
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before insert or update on public.orders
  for each row execute function public.touch_synced_at();

create table if not exists public.invoices (
  id uuid primary key,
  number text not null,
  order_id text, customer_id text,
  customer_name text, customer_phone text, customer_address text,
  items jsonb not null default '[]',
  subtotal numeric(12,2) not null default 0,
  shipping numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  payment_method text, note text,
  language text not null default 'en',
  created_at timestamptz not null default now(),
  user_email text default (auth.jwt() ->> 'email'),
  synced_at timestamptz not null default now()
);
alter table public.invoices add column if not exists language text not null default 'en';
create index if not exists invoices_synced_idx on public.invoices(synced_at);
drop trigger if exists invoices_touch on public.invoices;
create trigger invoices_touch before insert or update on public.invoices
  for each row execute function public.touch_synced_at();

alter table public.app_settings enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.invoices enable row level security;

drop policy if exists "staff all" on public.app_settings;
create policy "staff all" on public.app_settings for all to authenticated using (true) with check (true);
drop policy if exists "staff read" on public.customers;
create policy "staff read" on public.customers for select to authenticated using (true);
drop policy if exists "staff read" on public.orders;
create policy "staff read" on public.orders for select to authenticated using (true);
drop policy if exists "staff all" on public.invoices;
create policy "staff all" on public.invoices for all to authenticated using (true) with check (true);

grant select, insert, update on public.app_settings, public.invoices to authenticated;
grant select on public.customers, public.orders to authenticated;
grant all on public.app_settings, public.invoices, public.customers, public.orders to service_role;
