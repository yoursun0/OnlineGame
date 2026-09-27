-- Free-tier soft gates (issue #58): site-wide room cap, create and
-- start/rematch quotas, and a 15-minute idle TTL. IP hashes are computed in
-- the route from x-forwarded-for, then x-real-ip, then cf-connecting-ip.
-- Phase 2 (Cloudflare in front of Vercel) is not applied here.

create table if not exists public.room_soft_gates (
  scope_key text not null check (char_length(scope_key) between 1 and 180),
  action text not null check (char_length(action) between 1 and 64),
  window_started timestamptz not null,
  last_attempt_at timestamptz not null,
  attempts integer not null check (attempts >= 0),
  primary key (scope_key, action)
);

alter table public.room_soft_gates enable row level security;
revoke all on public.room_soft_gates from public, anon, authenticated;

create index if not exists rooms_active_idle_idx
  on public.rooms (last_activity_at)
  where status in ('open', 'playing', 'finished');

create or replace function public.expire_idle_rooms(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with stale_rooms as (
    select id
    from public.rooms
    where status in ('open', 'playing', 'finished')
      and last_activity_at + interval '15 minutes' <= p_now
    order by id
    for update skip locked
  )
  update public.rooms as rooms
  set status = 'expired', updated_at = p_now
  from stale_rooms
  where rooms.id = stale_rooms.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.expire_room_if_idle(p_code text, p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rooms
  set status = 'expired', updated_at = p_now
  where code = upper(trim(p_code))
    and status in ('open', 'playing', 'finished')
    and last_activity_at + interval '15 minutes' <= p_now;
end;
$$;

create or replace function public.playroom_room_cap_reached(p_cap integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_cap < 1 then
    raise exception 'Invalid room cap.' using errcode = '22023';
  end if;
  perform public.expire_idle_rooms(now());
  return (
    select count(*) >= p_cap
    from public.rooms
    where status in ('open', 'playing', 'finished')
  );
end;
$$;

create or replace function public.lock_soft_gate(p_scope_key text, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if char_length(p_scope_key) < 1 or char_length(p_scope_key) > 180
     or char_length(p_action) < 1 or char_length(p_action) > 64 then
    raise exception 'Invalid rate limit configuration.' using errcode = '22023';
  end if;
  loop
    perform 1
    from public.room_soft_gates
    where scope_key = p_scope_key and action = p_action
    for update;
    if found then
      return;
    end if;
    begin
      insert into public.room_soft_gates (scope_key, action, window_started, last_attempt_at, attempts)
      values (p_scope_key, p_action, now(), timestamptz 'epoch', 0);
    exception when unique_violation then
      -- Another transaction created the counter; lock it on the next pass.
    end;
  end loop;
end;
$$;

create or replace function public.soft_gate_allowed(
  p_scope_key text,
  p_action text,
  p_limit integer,
  p_window_seconds integer,
  p_cooldown_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_last timestamptz;
  v_attempts integer;
begin
  select window_started, last_attempt_at, attempts
  into v_window, v_last, v_attempts
  from public.room_soft_gates
  where scope_key = p_scope_key and action = p_action;
  if v_attempts = 0 or v_window + make_interval(secs => p_window_seconds) <= now() then
    return true;
  end if;
  if v_attempts >= p_limit then
    return false;
  end if;
  if p_cooldown_seconds > 0 and v_last + make_interval(secs => p_cooldown_seconds) > now() then
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.commit_soft_gate(
  p_scope_key text,
  p_action text,
  p_window_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_attempts integer;
begin
  select window_started, attempts
  into v_window, v_attempts
  from public.room_soft_gates
  where scope_key = p_scope_key and action = p_action
  for update;
  if v_attempts = 0 or v_window + make_interval(secs => p_window_seconds) <= now() then
    update public.room_soft_gates
    set window_started = now(), last_attempt_at = now(), attempts = 1
    where scope_key = p_scope_key and action = p_action;
  else
    update public.room_soft_gates
    set last_attempt_at = now(), attempts = attempts + 1
    where scope_key = p_scope_key and action = p_action;
  end if;
end;
$$;

create or replace function public.consume_create_room_gate(
  p_guest_id uuid,
  p_ip_hash text,
  p_limit integer,
  p_window_seconds integer,
  p_cooldown_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text;
  v_guest text;
  v_first text;
  v_second text;
begin
  if p_limit < 1 or p_window_seconds < 1 or p_cooldown_seconds < 0
     or p_ip_hash is null or char_length(p_ip_hash) < 1 or char_length(p_ip_hash) > 128 then
    raise exception 'Invalid rate limit configuration.' using errcode = '22023';
  end if;
  v_ip := 'ip:' || p_ip_hash;
  v_guest := 'guest:' || p_guest_id::text;
  if v_ip < v_guest then
    v_first := v_ip;
    v_second := v_guest;
  else
    v_first := v_guest;
    v_second := v_ip;
  end if;
  perform public.lock_soft_gate(v_first, 'create-room');
  perform public.lock_soft_gate(v_second, 'create-room');
  if public.soft_gate_allowed(v_ip, 'create-room', p_limit, p_window_seconds, p_cooldown_seconds)
     and public.soft_gate_allowed(v_guest, 'create-room', p_limit, p_window_seconds, p_cooldown_seconds) then
    perform public.commit_soft_gate(v_ip, 'create-room', p_window_seconds);
    perform public.commit_soft_gate(v_guest, 'create-room', p_window_seconds);
    return true;
  end if;
  return false;
end;
$$;

-- Keyed by the human member of the room. Seat numbers are not the key:
-- 打天九 shuffles them when the host starts.
create or replace function public.consume_start_rematch_gate(
  p_code text,
  p_guest_id uuid,
  p_limit integer,
  p_window_seconds integer,
  p_cooldown_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_scope text;
begin
  if p_limit < 1 or p_window_seconds < 1 or p_cooldown_seconds < 0 then
    raise exception 'Invalid rate limit configuration.' using errcode = '22023';
  end if;
  select id into v_room_id from public.rooms where code = upper(trim(p_code));
  if not found then
    raise exception 'Room not found or expired.' using errcode = 'P0001';
  end if;
  if not public.is_room_member(v_room_id, p_guest_id) then
    raise exception 'You are not a member of this room.' using errcode = '42501';
  end if;
  v_scope := 'room:' || v_room_id::text || ':guest:' || p_guest_id::text;
  perform public.lock_soft_gate(v_scope, 'start-rematch');
  if not public.soft_gate_allowed(v_scope, 'start-rematch', p_limit, p_window_seconds, p_cooldown_seconds) then
    return false;
  end if;
  perform public.commit_soft_gate(v_scope, 'start-rematch', p_window_seconds);
  return true;
end;
$$;

create or replace function public.touch_room_if_active(p_code text, p_guest_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms where code = upper(trim(p_code)) for update;
  if not found then
    raise exception 'Room not found or expired.' using errcode = 'P0001';
  end if;
  if not public.is_room_member(v_room.id, p_guest_id) then
    raise exception 'You are not a member of this room.' using errcode = '42501';
  end if;
  if v_room.status = 'expired' then
    return 'expired';
  end if;
  if v_room.status not in ('open', 'playing', 'finished') then
    return 'ignored';
  end if;
  if v_room.last_activity_at + interval '15 minutes' <= now() then
    update public.rooms set status = 'expired', updated_at = now() where id = v_room.id;
    return 'expired';
  end if;
  if v_room.last_activity_at + interval '45 seconds' > now() then
    return 'ignored';
  end if;
  update public.rooms
  set last_activity_at = now(),
      expires_at = now() + interval '15 minutes',
      updated_at = now()
  where id = v_room.id;
  update public.room_members
  set last_seen_at = now()
  where room_id = v_room.id and guest_id = p_guest_id;
  return 'ok';
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
  v_prefix text;
  v_state jsonb;
  v_empty_row jsonb;
  v_max_players smallint;
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
begin
  if p_game_slug not in ('tic-tac-toe', 'connect-four', 'downstairs', 'tien-gow') then
    raise exception 'Unsupported game.' using errcode = '22023';
  end if;
  if char_length(trim(p_display_name)) < 1 or char_length(trim(p_display_name)) > 32 then
    raise exception 'Display name must be between 1 and 32 characters.' using errcode = '22023';
  end if;

  if p_game_slug = 'downstairs' then
    if p_mode <> 'realtime' then
      raise exception '小朋友落樓梯 is realtime only.' using errcode = '22023';
    end if;
    v_prefix := 'LAD-';
    v_max_players := 4;
    v_state := jsonb_build_object('kind', 'well', 'phase', 'lobby', 'checkpoint', null);
  elsif p_game_slug = 'connect-four' then
    if p_mode <> 'turn_based' then
      raise exception 'Connect Four is turn-based only.' using errcode = '22023';
    end if;
    v_prefix := 'CON-';
    v_max_players := 2;
    v_empty_row := jsonb_build_array(null, null, null, null, null, null, null);
    v_state := jsonb_build_object(
      'board', jsonb_build_array(v_empty_row, v_empty_row, v_empty_row, v_empty_row, v_empty_row, v_empty_row),
      'nextColor', 'red',
      'moveCount', 0,
      'lastDrop', null
    );
  elsif p_game_slug = 'tien-gow' then
    if p_mode <> 'turn_based' then
      raise exception '打天九 is turn-based only.' using errcode = '22023';
    end if;
    v_prefix := 'TGW-';
    v_max_players := 4;
    v_state := jsonb_build_object('kind', 'tien-gow', 'phase', 'lobby');
  else
    if p_mode <> 'turn_based' then
      raise exception 'Tic-tac-toe is turn-based only.' using errcode = '22023';
    end if;
    v_prefix := 'TIK-';
    v_max_players := 2;
    v_state := jsonb_build_object(
      'board', jsonb_build_array(null, null, null, null, null, null, null, null, null),
      'nextMark', 'X',
      'moveCount', 0
    );
  end if;

  perform pg_advisory_xact_lock(hashtext('playroom:room-cap')::bigint);
  if public.playroom_room_cap_reached(40) then
    raise exception 'The server is busy. Please try again later.' using errcode = 'P0001';
  end if;

  loop
    v_code := v_prefix ||
      substr(v_alphabet, floor(random() * length(v_alphabet) + 1)::int, 1) ||
      substr(v_alphabet, floor(random() * length(v_alphabet) + 1)::int, 1) ||
      substr(v_alphabet, floor(random() * length(v_alphabet) + 1)::int, 1);
    begin
      insert into public.rooms (code, game_slug, mode, host_guest_id, state, max_players)
      values (v_code, p_game_slug, p_mode, p_guest_id, v_state, v_max_players)
      returning id into v_room_id;
      exit;
    exception when unique_violation then
      -- Retry with another short code.
    end;
  end loop;
  insert into public.room_members (room_id, guest_id, display_name, seat, is_ready)
  values (v_room_id, p_guest_id, trim(p_display_name), 0, false);
  return v_room_id;
end;
$$;

revoke execute on function public.expire_idle_rooms(timestamptz) from public, anon, authenticated;
revoke execute on function public.expire_room_if_idle(text, timestamptz) from public, anon, authenticated;
revoke execute on function public.playroom_room_cap_reached(integer) from public, anon, authenticated;
revoke execute on function public.lock_soft_gate(text, text) from public, anon, authenticated;
revoke execute on function public.soft_gate_allowed(text, text, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.commit_soft_gate(text, text, integer) from public, anon, authenticated;
revoke execute on function public.consume_create_room_gate(uuid, text, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.consume_start_rematch_gate(text, uuid, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.touch_room_if_active(text, uuid) from public, anon, authenticated;

grant execute on function public.expire_idle_rooms(timestamptz) to service_role;
grant execute on function public.expire_room_if_idle(text, timestamptz) to service_role;
grant execute on function public.playroom_room_cap_reached(integer) to service_role;
grant execute on function public.lock_soft_gate(text, text) to service_role;
grant execute on function public.soft_gate_allowed(text, text, integer, integer, integer) to service_role;
grant execute on function public.commit_soft_gate(text, text, integer) to service_role;
grant execute on function public.consume_create_room_gate(uuid, text, integer, integer, integer) to service_role;
grant execute on function public.consume_start_rematch_gate(text, uuid, integer, integer, integer) to service_role;
grant execute on function public.touch_room_if_active(text, uuid) to service_role;
