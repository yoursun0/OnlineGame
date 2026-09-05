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
declare
  v_new_version integer;
begin
  if not public.is_room_member(p_room_id, p_guest_id) then raise exception 'You are not a member of this room.' using errcode = '42501'; end if;
  update public.rooms
  set state = p_state,
      version = version + 1,
      status = p_status,
      last_activity_at = now(),
      expires_at = now() + interval '6 hours'
  where id = p_room_id and status = 'playing' and version = p_expected_version
  returning version into v_new_version;
  if not found then
    if exists (select 1 from public.rooms where id = p_room_id and status = 'playing') then
      raise exception 'The room changed; refresh and try again.' using errcode = '40001';
    end if;
    raise exception 'The room is not currently playing.' using errcode = 'P0001';
  end if;
  insert into public.game_events (room_id, version, guest_id, event_type, payload)
  values (p_room_id, v_new_version, p_guest_id, p_event_type, p_payload);
end;
$$;

revoke execute on function public.append_game_event(uuid, uuid, integer, jsonb, public.room_status, text, jsonb) from public, anon, authenticated;
grant execute on function public.append_game_event(uuid, uuid, integer, jsonb, public.room_status, text, jsonb) to service_role;
