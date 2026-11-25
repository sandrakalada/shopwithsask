alter table public.shipments add column if not exists nok_status text, add column if not exists nok_location text, add column if not exists nok_checked_at timestamptz;
-- cron: sask-nok-status '7 * * * *' posts {"action":"nok-status"} with x-cron-secret
