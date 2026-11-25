alter table public.shipments add column if not exists awb_path text;
-- storage bucket awb (private) with read for authenticated, write for non-shipping roles
