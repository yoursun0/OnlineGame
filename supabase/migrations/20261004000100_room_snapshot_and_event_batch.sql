-- One read for a room snapshot, and one write for a computer-move batch.
-- GET must stay read-only; computer replies belong on the command that caused them.

create or replace function public.get_room_snapshot(
  p_code text,
  p_guest_id uuid,
  p_since_version integer default 0
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_members jsonb;
  v_events jsonb;
begin
  if p_since_version < 0 or p_since_version > 1000000 then
    raise exception 'Invalid event version.' using errcode = '22023';
  end if;
  select * into v_room from public.rooms where code = upper(trim(p_code));
  if not found then
    raise exception 'Room not found or expired.' using errcode = 'P0001';
  end if;
  if not public.is_room_member(v_room.id, p_guest_id) then
    raise exception 'Join this room before reading its state.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(members) order by members.seat, members.joined_at), '[]'::jsonb)
    into v_members
  from public.room_members members
  where members.room_id = v_room.id;
  select coalesce(jsonb_agg(to_jsonb(events) order by events.version), '[]'::jsonb)
    into v_events
  from (
    select *
    from public.game_events
    where room_id = v_room.id
      and (p_since_version = 0 or version > p_since_version)
    order by version
    limit 100
  ) events;
  return jsonb_build_object(
    'room', to_jsonb(v_room),
    'members', v_members,
    'events', v_events
  );
end;
$$;

revoke execute on function public.get_room_snapshot(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.get_room_snapshot(text, uuid, integer) to service_role;

create or replace function public.append_game_events(
  p_room_id uuid,
  p_actor_guest_id uuid,
  p_expected_version integer,
  p_steps jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_version integer;
  v_step jsonb;
  v_guest_id uuid;
  v_status public.room_status;
  v_event_type text;
begin
  if jsonb_typeof(p_steps) <> 'array'
     or jsonb_array_length(p_steps) < 1
     or jsonb_array_length(p_steps) > 25 then
    raise exception 'A move needs between 1 and 25 steps.' using errcode = '22023';
  end if;
  if not public.is_room_member(p_room_id, p_actor_guest_id) then
    raise exception 'You are not a member of this room.' using errcode = '42501';
  end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or v_room.status <> 'playing' then
    raise exception 'The room is not currently playing.' using errcode = 'P0001';
  end if;
  if v_room.version <> p_expected_version then
    raise exception 'The room changed; refresh and try again.' using errcode = '40001';
  end if;

  v_version := v_room.version;
  for v_step in select value from jsonb_array_elements(p_steps)
  loop
    if jsonb_typeof(v_step) <> 'object' then
      raise exception 'Each move step must be an object.' using errcode = '22023';
    end if;
    v_guest_id := (v_step->>'guest_id')::uuid;
    v_event_type := v_step->>'event_type';
    if v_guest_id is null or v_event_type is null or char_length(v_event_type) < 1 or char_length(v_event_type) > 64 then
      raise exception 'Each move step needs a member and an event type.' using errcode = '22023';
    end if;
    if not public.is_room_member(p_room_id, v_guest_id) then
      raise exception 'You are not a member of this room.' using errcode = '42501';
    end if;
    if jsonb_typeof(v_step->'state') <> 'object' or jsonb_typeof(v_step->'payload') <> 'object' then
      raise exception 'Each move step needs a state and a payload.' using errcode = '22023';
    end if;
    v_status := (v_step->>'status')::public.room_status;
    v_version := v_version + 1;
    update public.rooms
    set state = v_step->'state',
        version = v_version,
        status = v_status,
        last_activity_at = now(),
        expires_at = now() + interval '6 hours'
    where id = p_room_id;
    insert into public.game_events (room_id, version, guest_id, event_type, payload)
    values (p_room_id, v_version, v_guest_id, v_event_type, v_step->'payload');
  end loop;
  return v_version;
end;
$$;

revoke execute on function public.append_game_events(uuid, uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.append_game_events(uuid, uuid, integer, jsonb) to service_role;

notify pgrst, 'reload schema';
