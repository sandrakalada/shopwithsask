-- Shipments: courier pick-ups for Shopify orders or manual (non-Shopify) parcels.
create table if not exists public.shipments (
  id uuid primary key,
  order_id text,
  order_name text,
  courier text not null default 'Own delivery',
  tracking text not null,
  status text not null default 'ready' check (status in ('ready','picked_up','delivered','returned','cancelled')),
  cod_amount numeric not null default 0,
  pieces int not null default 1,
  recipient jsonb not null default '{}'::jsonb,
  contents text,
  note text,
  shopify_fulfilled boolean not null default false,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);
create index if not exists shipments_synced_idx on public.shipments(synced_at);
create index if not exists shipments_order_idx on public.shipments(order_id);
drop trigger if exists shipments_touch on public.shipments;
create trigger shipments_touch before insert or update on public.shipments
  for each row execute function public.touch_synced_at();
alter table public.shipments enable row level security;
drop policy if exists "staff all" on public.shipments;
create policy "staff all" on public.shipments for all to authenticated using (not public.is_shipping()) with check (not public.is_shipping());
drop policy if exists "shipping read" on public.shipments;
create policy "shipping read" on public.shipments for select to authenticated using (public.is_shipping());
grant select, insert, update on public.shipments to authenticated;
grant all on public.shipments to service_role;
alter publication supabase_realtime add table public.shipments;
