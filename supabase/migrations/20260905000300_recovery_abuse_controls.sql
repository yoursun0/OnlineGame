alter table public.rooms
  add column if not exists last_activity_at timestamptz not null default now();

update public.rooms
set last_activity_at = coalesce(updated_at, created_at, now())
where last_activity_at is null;

create index if not exists rooms_expiry_idx on public.rooms (status, expires_at);

create table if not exists public.room_action_rate_limits (
  guest_id uuid not null,
  action text not null check (char_length(action) between 1 and 64),
  ip_hash text not null check (char_length(ip_hash) between 1 and 128),
  window_started timestamptz not null,
  attempts integer not null check (attempts >= 0),
  primary key (guest_id, action, ip_hash)
);

create table if not exists public.room_reports (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  reporter_guest_id uuid not null,
  reason text not null check (char_length(reason) between 1 and 280),
  created_at timestamptz not null default now(),
  unique (room_id, reporter_guest_id)
);

alter table public.room_action_rate_limits enable row level security;
alter table public.room_reports enable row level security;
revoke all on public.room_action_rate_limits, public.room_reports from public, anon, authenticated;

create or replace function public.expire_idle_rooms(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.rooms
  set status = 'expired', updated_at = p_now, last_activity_at = p_now
  where status in ('open', 'playing')
    and (expires_at <= p_now or last_activity_at + interval '6 hours' <= p_now);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.check_room_action_rate_limit(
  p_guest_id uuid,
  p_action text,
  p_ip_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_attempts integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate limit configuration.' using errcode = '22023';
  end if;
  loop
    select window_started, attempts
    into v_window, v_attempts
    from public.room_action_rate_limits
    where guest_id = p_guest_id and action = p_action and ip_hash = p_ip_hash
    for update;

    if not found then
      begin
        insert into public.room_action_rate_limits (guest_id, action, ip_hash, window_started, attempts)
        values (p_guest_id, p_action, p_ip_hash, now(), 1);
        return true;
      exception when unique_violation then
        -- Another request created the counter; retry while holding its row lock.
      end;
    elsif v_window + make_interval(secs => p_window_seconds) <= now() then
      update public.room_action_rate_limits
      set window_started = now(), attempts = 1
      where guest_id = p_guest_id and action = p_action and ip_hash = p_ip_hash;
      return true;
    elsif v_attempts >= p_limit then
      return false;
    else
      update public.room_action_rate_limits
      set attempts = attempts + 1
      where guest_id = p_guest_id and action = p_action and ip_hash = p_ip_hash;
      return true;
    end if;
  end loop;
end;
$$;

create or replace function public.report_room_for_guest(p_code text, p_guest_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
begin
  if char_length(trim(p_reason)) < 1 or char_length(trim(p_reason)) > 280 then
    raise exception 'Report reason must be between 1 and 280 characters.' using errcode = '22023';
  end if;
  select id into v_room_id
  from public.rooms
  where code = upper(trim(p_code)) and expires_at > now();
  if not found then raise exception 'Room not found or expired.' using errcode = 'P0001'; end if;
  insert into public.room_reports (room_id, reporter_guest_id, reason)
  values (v_room_id, p_guest_id, trim(p_reason))
  on conflict (room_id, reporter_guest_id) do nothing;
  return true;
end;
$$;

create or replace function public.create_room_for_guest(
  p_guest_id uuid,
  p_game_slug text,
  p_mode public.room_mode,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_code text;
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
begin
  if p_game_slug <> 'tic-tac-toe' then raise exception 'Unsupported game.' using errcode = '22023'; end if;
  if char_length(trim(p_display_name)) < 1 or char_length(trim(p_display_name)) > 32 then
    raise exception 'Display name must be between 1 and 32 characters.' using errcode = '22023';
  end if;
  loop
    v_code := 'TIK-' ||
      substr(v_alphabet, floor(random() * length(v_alphabet) + 1)::int, 1) ||
      substr(v_alphabet, floor(random() * length(v_alphabet) + 1)::int, 1) ||
      substr(v_alphabet, floor(random() * length(v_alphabet) + 1)::int, 1);
    begin
      insert into public.rooms (code, game_slug, mode, host_guest_id, state, max_players)
      values (v_code, p_game_slug, p_mode, p_guest_id,
        jsonb_build_object('board', jsonb_build_array(null, null, null, null, null, null, null, null, null), 'nextMark', 'X', 'moveCount', 0), 2)
      returning id into v_room_id;
      exit;
    exception when unique_violation then
    end;
  end loop;
  insert into public.room_members (room_id, guest_id, display_name, seat, is_ready)
  values (v_room_id, p_guest_id, trim(p_display_name), 0, false);
  return v_room_id;
end;
$$;

create or replace function public.join_room_for_guest(p_code text, p_guest_id uuid, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_seat smallint;
begin
  perform public.expire_idle_rooms(now());
  if char_length(trim(p_display_name)) < 1 or char_length(trim(p_display_name)) > 32 then
    raise exception 'Display name must be between 1 and 32 characters.' using errcode = '22023';
  end if;
  select * into v_room from public.rooms where code = upper(trim(p_code)) for update;
  if not found or v_room.expires_at <= now() or v_room.status <> 'open' then raise exception 'Room not found or no longer open.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.room_members where room_id = v_room.id and guest_id = p_guest_id) then return v_room.id; end if;
  if (select count(*) from public.room_members where room_id = v_room.id) >= v_room.max_players then raise exception 'Room is full.' using errcode = 'P0001'; end if;
  select candidate into v_seat from generate_series(0, v_room.max_players - 1) candidate
  where not exists (select 1 from public.room_members where room_id = v_room.id and seat = candidate)
  order by candidate limit 1;
  insert into public.room_members (room_id, guest_id, display_name, seat) values (v_room.id, p_guest_id, trim(p_display_name), v_seat);
  update public.rooms set last_activity_at = now(), expires_at = now() + interval '6 hours' where id = v_room.id;
  return v_room.id;
end;
$$;

create or replace function public.set_room_ready_for_guest(p_code text, p_guest_id uuid, p_ready boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_room_id uuid;
begin
  perform public.expire_idle_rooms(now());
  select id into v_room_id from public.rooms where code = upper(trim(p_code)) and status = 'open' and expires_at > now();
  if not found then raise exception 'Room not found or no longer open.' using errcode = 'P0001'; end if;
  update public.room_members set is_ready = p_ready, last_seen_at = now() where room_id = v_room_id and guest_id = p_guest_id;
  if not found then raise exception 'Join this room before changing ready state.' using errcode = 'P0001'; end if;
  update public.rooms set last_activity_at = now(), expires_at = now() + interval '6 hours' where id = v_room_id;
end;
$$;

create or replace function public.start_room_for_guest(p_code text, p_guest_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_room public.rooms; v_ready boolean;
begin
  perform public.expire_idle_rooms(now());
  select * into v_room from public.rooms where code = upper(trim(p_code)) for update;
  if not found or v_room.status <> 'open' then raise exception 'Room is not open.' using errcode = 'P0001'; end if;
  if v_room.host_guest_id <> p_guest_id then raise exception 'Only the host can start the room.' using errcode = '42501'; end if;
  select count(*) = v_room.max_players and coalesce(bool_and(is_ready), false) into v_ready from public.room_members where room_id = v_room.id;
  if not v_ready then raise exception 'Both players must be ready before starting.' using errcode = 'P0001'; end if;
  update public.rooms set status = 'playing', last_activity_at = now(), expires_at = now() + interval '6 hours' where id = v_room.id;
end;
$$;

create or replace function public.leave_room_for_guest(p_code text, p_guest_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_room public.rooms;
begin
  select * into v_room from public.rooms where code = upper(trim(p_code)) for update;
  if not found then return; end if;
  delete from public.room_members where room_id = v_room.id and guest_id = p_guest_id;
  if v_room.host_guest_id = p_guest_id then update public.rooms set status = 'expired', last_activity_at = now() where id = v_room.id;
  else update public.rooms set last_activity_at = now(), expires_at = now() + interval '6 hours' where id = v_room.id;
  end if;
end;
$$;

create or replace function public.append_game_event(
  p_room_id uuid,
  p_guest_id uuid,
  p_expected_version integer,
  p_state jsonb,
  p_status public.room_status,
  p_event_type text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_room public.rooms;
begin
  perform public.expire_idle_rooms(now());
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or v_room.status <> 'playing' then raise exception 'The room is not currently playing.' using errcode = 'P0001'; end if;
  if not public.is_room_member(p_room_id, p_guest_id) then raise exception 'You are not a member of this room.' using errcode = '42501'; end if;
  if v_room.version <> p_expected_version then raise exception 'The room changed; refresh and try again.' using errcode = '40001'; end if;
  insert into public.game_events (room_id, version, guest_id, event_type, payload)
  values (p_room_id, v_room.version + 1, p_guest_id, p_event_type, p_payload);
  update public.rooms set state = p_state, version = v_room.version + 1, status = p_status, last_activity_at = now(), expires_at = now() + interval '6 hours' where id = p_room_id;
end;
$$;

revoke execute on function public.expire_idle_rooms(timestamptz) from public, anon, authenticated;
revoke execute on function public.check_room_action_rate_limit(uuid, text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.report_room_for_guest(text, uuid, text) from public, anon, authenticated;
grant execute on function public.expire_idle_rooms(timestamptz) to service_role;
grant execute on function public.check_room_action_rate_limit(uuid, text, text, integer, integer) to service_role;
grant execute on function public.report_room_for_guest(text, uuid, text) to service_role;

