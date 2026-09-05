create extension if not exists pgcrypto;

create type public.room_mode as enum ('realtime', 'turn_based');
create type public.room_status as enum ('open', 'playing', 'finished', 'expired');

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code ~ '^[A-Z]{3}-[2-9A-HJ-NP-Z]{3}$'),
  game_slug text not null,
  mode public.room_mode not null,
  status public.room_status not null default 'open',
  host_guest_id uuid not null,
  state jsonb not null default '{}'::jsonb,
  version integer not null default 0 check (version >= 0),
  max_players smallint not null default 2 check (max_players between 2 and 16),
  expires_at timestamptz not null default now() + interval '6 hours',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  guest_id uuid not null,
  display_name text not null check (char_length(display_name) between 1 and 32),
  seat smallint check (seat is null or seat between 0 and 15),
  is_ready boolean not null default false,
  last_seen_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (room_id, guest_id)
);

create table public.game_events (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  version integer not null check (version > 0),
  guest_id uuid not null,
  event_type text not null check (char_length(event_type) between 1 and 64),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (room_id, version)
);

create index room_members_guest_id_idx on public.room_members (guest_id);
create index game_events_room_version_idx on public.game_events (room_id, version);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger rooms_set_updated_at
before update on public.rooms
for each row execute function public.set_updated_at();

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.game_events enable row level security;

revoke all on public.rooms, public.room_members, public.game_events from anon;
revoke insert, update, delete on public.rooms, public.room_members, public.game_events from authenticated;
grant select on public.rooms, public.room_members, public.game_events to authenticated;

create policy "members can read their room"
on public.rooms for select to authenticated
using (
  host_guest_id = (select auth.uid())
  or exists (
    select 1 from public.room_members member
    where member.room_id = rooms.id and member.guest_id = (select auth.uid())
  )
);

create policy "guests can read their membership"
on public.room_members for select to authenticated
using (guest_id = (select auth.uid()));

create policy "members can read room events"
on public.game_events for select to authenticated
using (
  exists (
    select 1 from public.room_members member
    where member.room_id = game_events.room_id and member.guest_id = (select auth.uid())
  )
);
