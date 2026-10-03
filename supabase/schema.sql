create table if not exists public.access_keys (
  id uuid primary key,
  value text not null unique,
  admin boolean not null default false,
  permanent boolean not null default false,
  expires_at bigint,
  duration_ms bigint,
  activated_at bigint,
  created_at bigint not null,
  revoked boolean not null default false
);

alter table public.access_keys add column if not exists duration_ms bigint;
alter table public.access_keys add column if not exists activated_at bigint;

create table if not exists public.key_archive (
  id uuid primary key,
  value text not null unique,
  admin boolean not null default false,
  permanent boolean not null default false,
  expires_at bigint,
  duration_ms bigint,
  activated_at bigint,
  created_at bigint not null,
  revoked boolean not null default false,
  archived_at bigint not null,
  archive_reason text not null default 'expired'
);

create or replace function public.archive_expired_access_keys(p_expired_before bigint, p_archived_at bigint)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  archived_count integer;
begin
  with expired_keys as (
    delete from public.access_keys
    where permanent = false and expires_at is not null and expires_at <= p_expired_before
    returning id, value, admin, permanent, expires_at, duration_ms, activated_at, created_at, revoked
  ), archived_keys as (
    insert into public.key_archive (id, value, admin, permanent, expires_at, duration_ms, activated_at, created_at, revoked, archived_at, archive_reason)
    select id, value, admin, permanent, expires_at, duration_ms, activated_at, created_at, revoked, p_archived_at, 'expired'
    from expired_keys
    on conflict (id) do nothing
    returning id
  )
  select count(*) into archived_count from archived_keys;
  return coalesce(archived_count, 0);
end;
$$;

alter table public.key_archive enable row level security;
revoke all on public.key_archive from anon, authenticated;
grant all on public.key_archive to service_role;
revoke all on function public.archive_expired_access_keys(bigint, bigint) from public, anon, authenticated;
grant execute on function public.archive_expired_access_keys(bigint, bigint) to service_role;

create table if not exists public.app_users (
  id uuid primary key,
  name text not null,
  email text not null,
  key_id uuid not null unique references public.access_keys(id) on delete cascade,
  password_hash text,
  salt text,
  created_at bigint not null
);

create table if not exists public.user_identities (
  id uuid primary key,
  provider text not null check (provider in ('google', 'discord')),
  provider_user_id text not null,
  key_id uuid references public.access_keys(id) on delete set null,
  original_key_id uuid not null,
  owner_id text not null,
  display_name text not null,
  email text,
  linked_at bigint not null,
  unique (provider, provider_user_id),
  unique (original_key_id, provider)
);

create index if not exists user_identities_key_id_idx on public.user_identities(key_id);
create index if not exists user_identities_original_key_id_idx on public.user_identities(original_key_id);

create table if not exists public.user_states (
  owner_id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key,
  rating integer not null check (rating between 1 and 5),
  text text not null check (char_length(text) between 1 and 240),
  created_at bigint not null
);

create table if not exists public.presence_clients (
  client_id text primary key,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

alter table public.access_keys enable row level security;
alter table public.app_users enable row level security;
alter table public.user_identities enable row level security;
alter table public.user_states enable row level security;
alter table public.reviews enable row level security;
alter table public.presence_clients enable row level security;

revoke all on public.access_keys, public.app_users, public.user_identities, public.user_states, public.reviews, public.presence_clients from anon, authenticated;
grant all on public.access_keys, public.app_users, public.user_identities, public.user_states, public.reviews, public.presence_clients, public.key_archive to service_role;