-- photo of the size/colour, from Shopify (the colour's own picture), shown on stickers and lists
alter table public.variants add column if not exists image_url text;
