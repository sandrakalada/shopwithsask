-- WhatsApp message id -> order, for delivery/read receipts (used by the WhatsApp service)
create table if not exists public.wa_messages (
  id text primary key,
  order_gid text not null,
  status text not null default 'sent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.wa_messages enable row level security;
revoke all on public.wa_messages from anon, authenticated;
