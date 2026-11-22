-- Cost prices stay in the app: a cost change no longer queues a Shopify update.
create or replace function public.mark_variant_dirty() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and new.shopify_variant_id is not null and (
    new.sku is distinct from old.sku or new.price is distinct from old.price) then
    new.shopify_dirty := true;
  end if;
  return new;
end $$;
