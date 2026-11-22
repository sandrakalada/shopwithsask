-- Write-offs: damaged, defective and used pieces leave stock but their cost still counts.
alter table public.stock_movements drop constraint if exists stock_movements_reason_check;
alter table public.stock_movements add constraint stock_movements_reason_check check (reason = any (array['receive','sale','return','adjust','count','damage','defect','used','shopify']));
