begin;

alter table public.presence_clients
  add column if not exists owner_id text;

alter table public.presence_clients
  add column if not exists last_authenticated_at timestamptz;

create index if not exists presence_clients_owner_last_seen_idx
  on public.presence_clients(owner_id, last_seen desc);

create index if not exists presence_clients_authenticated_at_idx
  on public.presence_clients(last_authenticated_at desc);

commit;
