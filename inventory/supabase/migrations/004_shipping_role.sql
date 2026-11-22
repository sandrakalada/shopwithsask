-- "shipping" accounts can only read orders (and store details for the label).
create or replace function public.is_shipping() returns boolean
language sql stable set search_path = public as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'shipping'
$$;

drop policy if exists "staff all" on public.products;
create policy "staff all" on public.products for all to authenticated using (not public.is_shipping()) with check (not public.is_shipping());
drop policy if exists "staff all" on public.variants;
create policy "staff all" on public.variants for all to authenticated using (not public.is_shipping()) with check (not public.is_shipping());
drop policy if exists "staff read" on public.stock_movements;
create policy "staff read" on public.stock_movements for select to authenticated using (not public.is_shipping());
drop policy if exists "staff insert" on public.stock_movements;
create policy "staff insert" on public.stock_movements for insert to authenticated with check (not public.is_shipping());
drop policy if exists "staff read" on public.customers;
create policy "staff read" on public.customers for select to authenticated using (not public.is_shipping());
drop policy if exists "staff all" on public.invoices;
create policy "staff all" on public.invoices for all to authenticated using (not public.is_shipping()) with check (not public.is_shipping());
drop policy if exists "staff all" on public.app_settings;
drop policy if exists "read settings" on public.app_settings;
create policy "read settings" on public.app_settings for select to authenticated using (true);
drop policy if exists "write settings" on public.app_settings;
create policy "write settings" on public.app_settings for insert to authenticated with check (not public.is_shipping());
drop policy if exists "update settings" on public.app_settings;
create policy "update settings" on public.app_settings for update to authenticated using (not public.is_shipping()) with check (not public.is_shipping());
-- orders: readable by every signed-in account (existing "staff read" policy)
