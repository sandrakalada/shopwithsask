-- Where each product was bought (Shein): the supplier SKU from the order, or a full product link.
alter table public.products add column if not exists supplier_sku text, add column if not exists supplier_url text;
