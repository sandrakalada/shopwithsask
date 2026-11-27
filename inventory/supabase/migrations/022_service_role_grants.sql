-- the WhatsApp service and edge function write these with the service role
grant select, insert, update, delete on public.wa_messages to service_role;
grant select, insert, update, delete on public.returns to service_role;
