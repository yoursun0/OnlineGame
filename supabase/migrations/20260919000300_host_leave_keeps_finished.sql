-- When the host leaves a room that already finished (e.g. downstairs host_left),
-- keep status = finished so remaining guests still see the result after refresh.
-- Open/playing host leave still expires the room (no host handoff in v1).

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
  if v_room.host_guest_id = p_guest_id then
    if v_room.status = 'finished' then
      update public.rooms set last_activity_at = now() where id = v_room.id;
    else
      update public.rooms set status = 'expired', last_activity_at = now() where id = v_room.id;
    end if;
  else
    update public.rooms set last_activity_at = now(), expires_at = now() + interval '6 hours' where id = v_room.id;
  end if;
end;
$$;
