-- TGW lobby start: 1–4 humans, fill empty seats with CPU, shuffle seats 0–3
-- (南/東/北/西 counterclockwise, matching the lab). Deal is applied in the API via createHand.

create or replace function public.start_room_for_guest(p_code text, p_guest_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_member_count integer;
  v_human_count integer;
  v_all_ready boolean;
  v_host_seat smallint;
  v_seat smallint;
begin
  perform public.expire_idle_rooms(now());
  select * into v_room from public.rooms where code = upper(trim(p_code)) for update;
  if not found or v_room.status <> 'open' then raise exception 'Room is not open.' using errcode = 'P0001'; end if;
  if v_room.host_guest_id <> p_guest_id then raise exception 'Only the host can start the room.' using errcode = '42501'; end if;
  if not exists (select 1 from public.room_members where room_id = v_room.id and guest_id = p_guest_id) then
    raise exception 'Join this room before starting.' using errcode = 'P0001';
  end if;

  select count(*) into v_member_count from public.room_members where room_id = v_room.id;
  select count(*) into v_human_count from public.room_members where room_id = v_room.id and coalesce(is_cpu, false) = false;

  if v_room.game_slug = 'tien-gow' then
    -- 1–4 humans; remaining seats are CPU. Seats 0–3 = 南/東/北/西, shuffled at start.
    if v_human_count < 1 or v_human_count > 4 then
      raise exception 'A 打天九 table needs 1–4 humans.' using errcode = 'P0001';
    end if;
    if v_human_count > 1 then
      select coalesce(bool_and(is_ready), false) into v_all_ready
      from public.room_members where room_id = v_room.id and coalesce(is_cpu, false) = false;
      if not v_all_ready then
        raise exception 'All players must be ready before starting.' using errcode = 'P0001';
      end if;
    end if;
    for v_seat in 0..3 loop
      if not exists (
        select 1 from public.room_members where room_id = v_room.id and seat = v_seat
      ) then
        insert into public.room_members (room_id, guest_id, display_name, seat, is_ready, is_cpu)
        values (v_room.id, gen_random_uuid(), 'CPU', v_seat, true, true);
      end if;
    end loop;
    with ranked as (
      select guest_id, (row_number() over (order by random()) - 1)::smallint as new_seat
      from public.room_members
      where room_id = v_room.id
    )
    update public.room_members member
    set seat = ranked.new_seat
    from ranked
    where member.room_id = v_room.id and member.guest_id = ranked.guest_id;
  elsif v_room.game_slug = 'downstairs' then
    -- Solo (1) or Shared (2–4): every human must be ready when more than one.
    if v_human_count < 1 or v_human_count > 4 then
      raise exception 'A LAD well supports Solo (1) or Shared (2–4) kids.' using errcode = 'P0001';
    end if;
    if v_human_count > 1 then
      select coalesce(bool_and(is_ready), false) into v_all_ready
      from public.room_members where room_id = v_room.id and coalesce(is_cpu, false) = false;
      if not v_all_ready then
        raise exception 'All players must be ready before starting.' using errcode = 'P0001';
      end if;
    end if;
  elsif v_member_count = 1 then
    insert into public.room_members (room_id, guest_id, display_name, seat, is_ready, is_cpu)
    values (v_room.id, gen_random_uuid(), 'CPU', 1, true, true);
  elsif v_member_count = v_room.max_players then
    select coalesce(bool_and(is_ready), false) into v_all_ready from public.room_members where room_id = v_room.id;
    if not v_all_ready then raise exception 'Both players must be ready before starting.' using errcode = 'P0001'; end if;
  else
    raise exception 'Both players must be ready before starting.' using errcode = 'P0001';
  end if;

  if v_room.game_slug <> 'downstairs' and v_room.game_slug <> 'tien-gow' then
    v_host_seat := case when random() < 0.5 then 0 else 1 end;
    update public.room_members
    set seat = case when guest_id = p_guest_id then v_host_seat else 1 - v_host_seat end
    where room_id = v_room.id;
  end if;

  update public.rooms
  set status = 'playing', last_activity_at = now(), expires_at = now() + interval '6 hours'
  where id = v_room.id;
end;
$$;
