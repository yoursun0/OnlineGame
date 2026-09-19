-- Shared well 3–4 kids: clear post-start join rejection; start allows 1–4 ready humans.

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
  if not found or v_room.expires_at <= now() then
    raise exception 'Room not found or no longer open.' using errcode = 'P0001';
  end if;
  if v_room.status = 'playing' then
    raise exception 'This game has already started.' using errcode = 'P0001';
  end if;
  if v_room.status <> 'open' then
    raise exception 'Room not found or no longer open.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.room_members where room_id = v_room.id and guest_id = p_guest_id) then return v_room.id; end if;
  if (select count(*) from public.room_members where room_id = v_room.id) >= v_room.max_players then
    raise exception 'Room is full.' using errcode = 'P0001';
  end if;
  select candidate into v_seat from generate_series(0, v_room.max_players - 1) candidate
  where not exists (select 1 from public.room_members where room_id = v_room.id and seat = candidate)
  order by candidate limit 1;
  insert into public.room_members (room_id, guest_id, display_name, seat) values (v_room.id, p_guest_id, trim(p_display_name), v_seat);
  update public.rooms set last_activity_at = now(), expires_at = now() + interval '6 hours' where id = v_room.id;
  return v_room.id;
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
  v_member_count integer;
  v_human_count integer;
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
  select count(*) into v_human_count from public.room_members where room_id = v_room.id and coalesce(is_cpu, false) = false;

  if v_room.game_slug = 'downstairs' then
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

  if v_room.game_slug <> 'downstairs' then
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
