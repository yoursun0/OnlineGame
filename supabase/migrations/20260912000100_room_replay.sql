create or replace function public.replay_room_for_guest(
  p_code text,
  p_guest_id uuid,
  p_state jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_members integer;
  v_new_version integer;
begin
  perform public.expire_idle_rooms(now());
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'A replay needs a fresh game state.' using errcode = '22023';
  end if;
  select * into v_room from public.rooms where code = upper(trim(p_code)) for update;
  if not found or v_room.expires_at <= now() then
    raise exception 'Room not found or expired.' using errcode = 'P0001';
  end if;
  if v_room.status <> 'finished' then
    raise exception 'Replay is only available after the game ends.' using errcode = 'P0001';
  end if;
  if not public.is_room_member(v_room.id, p_guest_id) then
    raise exception 'You are not a member of this room.' using errcode = '42501';
  end if;
  select count(*) into v_members from public.room_members where room_id = v_room.id;
  if v_members < v_room.max_players then
    raise exception 'Both players must still be in the room to replay.' using errcode = 'P0001';
  end if;
  update public.rooms
  set state = p_state,
      status = 'playing',
      version = version + 1,
      last_activity_at = now(),
      expires_at = now() + interval '6 hours'
  where id = v_room.id
  returning version into v_new_version;
  insert into public.game_events (room_id, version, guest_id, event_type, payload)
  values (v_room.id, v_new_version, p_guest_id, 'replay', jsonb_build_object('reason', 'rematch'));
end;
$$;

revoke execute on function public.replay_room_for_guest(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replay_room_for_guest(text, uuid, jsonb) to service_role;
