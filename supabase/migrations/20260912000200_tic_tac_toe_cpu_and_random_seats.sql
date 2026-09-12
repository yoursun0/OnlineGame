alter table public.room_members
  add column if not exists is_cpu boolean not null default false;

create or replace function public.start_room_for_guest(p_code text, p_guest_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_member_count integer;
  v_all_ready boolean;
  v_host_seat smallint;
begin
  perform public.expire_idle_rooms(now());
  select * into v_room from public.rooms where code = upper(trim(p_code)) for update;
  if not found or v_room.status <> 'open' then raise exception 'Room is not open.' using errcode = 'P0001'; end if;
  if v_room.host_guest_id <> p_guest_id then raise exception 'Only the host can start the room.' using errcode = '42501'; end if;
  if not exists (select 1 from public.room_members where room_id = v_room.id and guest_id = p_guest_id) then
    raise exception 'Join this room before starting.' using errcode = 'P0001';
  end if;

  select count(*) into v_member_count from public.room_members where room_id = v_room.id;
  if v_member_count = 1 then
    insert into public.room_members (room_id, guest_id, display_name, seat, is_ready, is_cpu)
    values (v_room.id, gen_random_uuid(), 'CPU', 1, true, true);
  elsif v_member_count = v_room.max_players then
    select coalesce(bool_and(is_ready), false) into v_all_ready from public.room_members where room_id = v_room.id;
    if not v_all_ready then raise exception 'Both players must be ready before starting.' using errcode = 'P0001'; end if;
  else
    raise exception 'Both players must be ready before starting.' using errcode = 'P0001';
  end if;

  v_host_seat := case when random() < 0.5 then 0 else 1 end;
  update public.room_members
  set seat = case when guest_id = p_guest_id then v_host_seat else 1 - v_host_seat end
  where room_id = v_room.id;

  update public.rooms
  set status = 'playing', last_activity_at = now(), expires_at = now() + interval '6 hours'
  where id = v_room.id;
end;
$$;
