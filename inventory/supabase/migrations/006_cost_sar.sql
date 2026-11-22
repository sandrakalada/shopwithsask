-- Exact cost paid in SAR (kept next to the EGP cost, so switching the display needs no conversion guesswork).
alter table public.variants add column if not exists cost_sar numeric;
