-- Give the owner's account (the first non-test account) the "owner" role so it can manage the team.
update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"owner"}'::jsonb
where id = (select id from auth.users where email not like 'claude-test-%' order by created_at limit 1);
