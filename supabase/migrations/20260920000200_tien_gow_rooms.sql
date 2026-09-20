-- TGW / 打天九 catalogue rooms: lobby-only until CPU fill + engine wiring.
-- Prefix TGW-, 1–4 humans (max_players 4), turn-based, no initial hand.

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
