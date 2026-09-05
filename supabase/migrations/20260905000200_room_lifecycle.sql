create or replace function public.is_room_member(p_room_id uuid, p_guest_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room_id and guest_id = p_guest_id
  );
$$;

drop policy if exists "members can read their room" on public.rooms;
drop policy if exists "guests can read their membership" on public.room_members;
drop policy if exists "members can read room events" on public.game_events;

create policy "members can read their room"
on public.rooms for select to authenticated
using (host_guest_id = (select auth.uid()) or public.is_room_member(id, (select auth.uid())));

create policy "members can read room members"
on public.room_members for select to authenticated
using (public.is_room_member(room_id, (select auth.uid())));

create policy "members can read room events"
on public.game_events for select to authenticated
using (public.is_room_member(room_id, (select auth.uid())));

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
      values (
        v_code, p_game_slug, p_mode, p_guest_id,
        jsonb_build_object('board', jsonb_build_array(null, null, null, null, null, null, null, null, null), 'nextMark', 'X', 'moveCount', 0),
        2
      ) returning id into v_room_id;
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
  if char_length(trim(p_display_name)) < 1 or char_length(trim(p_display_name)) > 32 then
    raise exception 'Display name must be between 1 and 32 characters.' using errcode = '22023';
  end if;
  select * into v_room from public.rooms where code = upper(trim(p_code)) for update;
  if not found or v_room.expires_at <= now() or v_room.status <> 'open' then raise exception 'Room not found or no longer open.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.room_members where room_id = v_room.id and guest_id = p_guest_id) then return v_room.id; end if;
  if (select count(*) from public.room_members where room_id = v_room.id) >= v_room.max_players then raise exception 'Room is full.' using errcode = 'P0001'; end if;
  select candidate into v_seat
  from generate_series(0, v_room.max_players - 1) candidate
  where not exists (select 1 from public.room_members where room_id = v_room.id and seat = candidate)
  order by candidate limit 1;
  insert into public.room_members (room_id, guest_id, display_name, seat) values (v_room.id, p_guest_id, trim(p_display_name), v_seat);
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
  select id into v_room_id from public.rooms where code = upper(trim(p_code)) and status = 'open' and expires_at > now();
  if not found then raise exception 'Room not found or no longer open.' using errcode = 'P0001'; end if;
  update public.room_members set is_ready = p_ready, last_seen_at = now() where room_id = v_room_id and guest_id = p_guest_id;
  if not found then raise exception 'Join this room before changing ready state.' using errcode = 'P0001'; end if;
end;
$$;

create or replace function public.start_room_for_guest(p_code text, p_guest_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_ready boolean;
begin
  select * into v_room from public.rooms where code = upper(trim(p_code)) for update;
  if not found or v_room.status <> 'open' then raise exception 'Room is not open.' using errcode = 'P0001'; end if;
  if v_room.host_guest_id <> p_guest_id then raise exception 'Only the host can start the room.' using errcode = '42501'; end if;
  select count(*) = v_room.max_players and coalesce(bool_and(is_ready), false) into v_ready from public.room_members where room_id = v_room.id;
  if not v_ready then raise exception 'Both players must be ready before starting.' using errcode = 'P0001'; end if;
  update public.rooms set status = 'playing' where id = v_room.id;
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
  if v_room.host_guest_id = p_guest_id then update public.rooms set status = 'expired' where id = v_room.id; end if;
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
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or v_room.status <> 'playing' then raise exception 'The room is not currently playing.' using errcode = 'P0001'; end if;
  if not public.is_room_member(p_room_id, p_guest_id) then raise exception 'You are not a member of this room.' using errcode = '42501'; end if;
  if v_room.version <> p_expected_version then raise exception 'The room changed; refresh and try again.' using errcode = '40001'; end if;
  insert into public.game_events (room_id, version, guest_id, event_type, payload)
  values (p_room_id, v_room.version + 1, p_guest_id, p_event_type, p_payload);
  update public.rooms set state = p_state, version = v_room.version + 1, status = p_status where id = p_room_id;
end;
$$;

revoke execute on function public.create_room_for_guest(uuid, text, public.room_mode, text) from public, anon, authenticated;
revoke execute on function public.join_room_for_guest(text, uuid, text) from public, anon, authenticated;
revoke execute on function public.set_room_ready_for_guest(text, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.start_room_for_guest(text, uuid) from public, anon, authenticated;
revoke execute on function public.leave_room_for_guest(text, uuid) from public, anon, authenticated;
revoke execute on function public.append_game_event(uuid, uuid, integer, jsonb, public.room_status, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_room_for_guest(uuid, text, public.room_mode, text) to service_role;
grant execute on function public.join_room_for_guest(text, uuid, text) to service_role;
grant execute on function public.set_room_ready_for_guest(text, uuid, boolean) to service_role;
grant execute on function public.start_room_for_guest(text, uuid) to service_role;
grant execute on function public.leave_room_for_guest(text, uuid) to service_role;
grant execute on function public.append_game_event(uuid, uuid, integer, jsonb, public.room_status, text, jsonb) to service_role;

alter publication supabase_realtime add table public.rooms, public.room_members, public.game_events;
