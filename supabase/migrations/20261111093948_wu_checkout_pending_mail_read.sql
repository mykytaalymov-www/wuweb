create function public.wu_staging_mail_pending(p_order text) returns boolean
language sql security invoker set search_path='' as $$
 select exists(select 1 from wu_staging.outbox where order_id=p_order and sent is null);
$$;
revoke all on function public.wu_staging_mail_pending(text) from public,anon,authenticated;
grant execute on function public.wu_staging_mail_pending(text) to service_role;
notify pgrst,'reload schema';
