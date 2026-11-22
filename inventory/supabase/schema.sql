-- Sask Inventory – run once in Supabase → SQL Editor.
-- Quantities change only through stock_movements (a trigger keeps variants.quantity
-- in sync), so offline phones can replay their movements safely without overwriting
-- each other.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  handle text unique,
  title text not null,
  product_type text,
  image_url text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null default 'Default Title',
  sku text,
  barcode text not null unique,
  price numeric(10,2),
  quantity integer not null default 0,
  low_stock_at integer not null default 0,
  shopify_variant_id text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists variants_product_idx on public.variants(product_id);
create index if not exists variants_updated_idx on public.variants(updated_at);
create index if not exists products_updated_idx on public.products(updated_at);

create table if not exists public.stock_movements (
  id uuid primary key,                       -- generated on the phone, makes retries safe
  variant_id uuid not null references public.variants(id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('receive','sale','return','adjust','count','damage','shopify')),
  note text,
  created_at timestamptz not null default now(), -- time on the phone
  synced_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  user_email text default (auth.jwt() ->> 'email')
);
create index if not exists movements_variant_idx on public.stock_movements(variant_id);
create index if not exists movements_created_idx on public.stock_movements(created_at desc);

-- updated_at bookkeeping (the app pulls rows changed since its last sync)
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

drop trigger if exists variants_touch on public.variants;
create trigger variants_touch before update on public.variants
  for each row execute function public.touch_updated_at();

-- apply every movement to the variant's quantity
create or replace function public.apply_stock_movement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.variants set quantity = quantity + new.delta where id = new.variant_id;
  return new;
end $$;

drop trigger if exists stock_movement_apply on public.stock_movements;
create trigger stock_movement_apply after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- Row level security: any signed-in staff account can read and write.
-- Turn OFF public sign-ups (Authentication → Providers → Email) and create staff
-- users yourself under Authentication → Users.
alter table public.products enable row level security;
alter table public.variants enable row level security;
alter table public.stock_movements enable row level security;

drop policy if exists "staff all" on public.products;
create policy "staff all" on public.products for all to authenticated using (true) with check (true);
drop policy if exists "staff all" on public.variants;
create policy "staff all" on public.variants for all to authenticated using (true) with check (true);
drop policy if exists "staff read" on public.stock_movements;
create policy "staff read" on public.stock_movements for select to authenticated using (true);
drop policy if exists "staff insert" on public.stock_movements;
create policy "staff insert" on public.stock_movements for insert to authenticated with check (true);

-- ---------------------------------------------------------------------------
-- Shopify stock sync (used by the "shopify" Edge Function)
-- ---------------------------------------------------------------------------
alter table public.products add column if not exists shopify_product_id text;
alter table public.variants add column if not exists shopify_inventory_item_id text;
alter table public.variants add column if not exists shopify_synced_at timestamptz;
alter table public.stock_movements add column if not exists source text not null default 'app';
alter table public.stock_movements add column if not exists shopify_pushed_at timestamptz;
alter table public.stock_movements add column if not exists shopify_error text;

-- databases created before the 'shopify' reason existed
alter table public.stock_movements drop constraint if exists stock_movements_reason_check;
alter table public.stock_movements add constraint stock_movements_reason_check
  check (reason in ('receive','sale','return','adjust','count','damage','shopify'));

create unique index if not exists variants_shopify_variant_idx on public.variants(shopify_variant_id) where shopify_variant_id is not null;
create index if not exists variants_shopify_item_idx on public.variants(shopify_inventory_item_id);
create index if not exists movements_unpushed_idx on public.stock_movements(created_at)
  where source = 'app' and shopify_pushed_at is null;
