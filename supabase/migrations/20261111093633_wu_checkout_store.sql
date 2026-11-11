-- WU staging only. Existing public tables and other applications are untouched.
create schema if not exists wu_staging;
revoke all on schema wu_staging from public, anon, authenticated;
grant usage on schema wu_staging to service_role;

create table wu_staging.orders (
 id text primary key, token_hash text not null check(length(token_hash)=64), fingerprint text not null,
 quote jsonb not null, created bigint not null, session_id text unique, checkout_url text,
 status text not null default 'pending' check(status in ('pending','paid','failed','expired')),
 customer jsonb, payment_intent text
);
create table wu_staging.events (id text primary key, processed timestamptz not null default now());
create table wu_staging.outbox (
 id text primary key, order_id text not null references wu_staging.orders(id), sent bigint,
 attempts integer not null default 0, next_attempt bigint not null default 0,
 claim_token uuid, locked_until timestamptz
);
create index wu_staging_outbox_pending on wu_staging.outbox(next_attempt) where sent is null;
create table wu_staging.rate_limits (bucket bigint not null, key text not null, count integer not null, primary key(bucket,key));
create table wu_staging.worker_auth (id boolean primary key default true check(id), token_hash text not null);

alter table wu_staging.orders enable row level security;
alter table wu_staging.events enable row level security;
alter table wu_staging.outbox enable row level security;
alter table wu_staging.rate_limits enable row level security;
alter table wu_staging.worker_auth enable row level security;
revoke all on all tables in schema wu_staging from public, anon, authenticated;
grant select,insert,update,delete on all tables in schema wu_staging to service_role;

create function public.wu_staging_health() returns boolean language sql security invoker set search_path='' as $$
 select to_regclass('wu_staging.orders') is not null;
$$;
create function public.wu_staging_order_get(p_id text) returns jsonb language sql security invoker set search_path='' as $$
 select to_jsonb(o) from wu_staging.orders o where id=p_id;
$$;
create function public.wu_staging_order_create(p_id text,p_token_hash text,p_fingerprint text,p_quote jsonb,p_created bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 insert into wu_staging.orders(id,token_hash,fingerprint,quote,created) values(p_id,p_token_hash,p_fingerprint,p_quote,p_created) on conflict(id) do nothing;
 return (select to_jsonb(o) from wu_staging.orders o where id=p_id);
end;
$$;
create function public.wu_staging_order_attach(p_id text,p_session_id text,p_url text) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 update wu_staging.orders set session_id=p_session_id,checkout_url=p_url where id=p_id and (session_id is null or session_id=p_session_id);
 if not found then raise exception 'session_conflict'; end if;
 return true;
end;
$$;
create function public.wu_staging_event_apply(p_event text,p_order text,p_session jsonb,p_status text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare o wu_staging.orders; inserted text; millis bigint := (extract(epoch from clock_timestamp())*1000)::bigint;
begin
 select * into strict o from wu_staging.orders where id=p_order for update;
 if o.session_id is not null and o.session_id<>p_session->>'id' then raise exception 'session_conflict'; end if;
 insert into wu_staging.events(id) values(p_event) on conflict(id) do nothing returning id into inserted;
 if inserted is null then return false; end if;
 if o.status<>'paid' and not(o.status='failed' and p_status='pending') then
  update wu_staging.orders set status=p_status,session_id=coalesce(session_id,p_session->>'id'),
   customer=coalesce(p_session->'customer_details','{}'::jsonb)||jsonb_build_object('shipping',coalesce(p_session#>'{collected_information,shipping_details}',p_session->'shipping_details')),
   payment_intent=case when jsonb_typeof(p_session->'payment_intent')='object' then p_session#>>'{payment_intent,id}' else p_session->>'payment_intent' end
  where id=p_order;
  if p_status='paid' then insert into wu_staging.outbox(id,order_id) values('paid:'||p_order,p_order) on conflict(id) do nothing; end if;
 end if;
 return true;
end;
$$;
create function public.wu_staging_mail_claim() returns jsonb language sql security invoker set search_path='' as $$
 with jobs as (
  select id from wu_staging.outbox where sent is null and next_attempt <= (extract(epoch from clock_timestamp())*1000)::bigint
   and (locked_until is null or locked_until<now()) order by next_attempt limit 10 for update skip locked
 ), claimed as (
  update wu_staging.outbox o set claim_token=gen_random_uuid(),locked_until=now()+interval '5 minutes'
  from jobs where jobs.id=o.id returning o.*
 ) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) from claimed;
$$;
create function public.wu_staging_mail_finish(p_id text,p_claim uuid,p_next bigint) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 update wu_staging.outbox set sent=case when p_next is null then (extract(epoch from clock_timestamp())*1000)::bigint else null end,
  attempts=attempts+case when p_next is null then 0 else 1 end,next_attempt=coalesce(p_next,0),claim_token=null,locked_until=null
 where id=p_id and claim_token=p_claim and sent is null;
 return found;
end;
$$;
create function public.wu_staging_rate_limit(p_key text) returns boolean language plpgsql security invoker set search_path='' as $$
declare b bigint := floor(extract(epoch from now())/60); n integer;
begin
 delete from wu_staging.rate_limits where bucket<b-2;
 insert into wu_staging.rate_limits(bucket,key,count) values(b,left(p_key,100),1)
 on conflict(bucket,key) do update set count=wu_staging.rate_limits.count+1 returning count into n;
 return n<=120;
end;
$$;
create function public.wu_staging_worker_authorize(p_token text) returns boolean language sql security invoker set search_path='' as $$
 select coalesce((select token_hash=encode(extensions.digest(p_token,'sha256'),'hex') from wu_staging.worker_auth where id),false);
$$;

-- Deny all browser roles and PUBLIC access to every new RPC. No SECURITY DEFINER.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like 'wu_staging_%' loop
  execute format('revoke all on function %s from public, anon, authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
notify pgrst, 'reload schema';
