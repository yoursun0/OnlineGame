-- Solo LAD / downstairs rooms: realtime well, 1–4 humans, no CPU.

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
  if p_game_slug not in ('tic-tac-toe', 'connect-four', 'downstairs') then
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
    -- Solo well: host alone may start immediately. No CPU. Shared wells need every occupant ready.
    if v_human_count < 1 then
      raise exception 'At least one player is required to start.' using errcode = 'P0001';
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
