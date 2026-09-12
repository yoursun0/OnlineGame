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
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
begin
  if p_game_slug not in ('tic-tac-toe', 'connect-four') then
    raise exception 'Unsupported game.' using errcode = '22023';
  end if;
  if char_length(trim(p_display_name)) < 1 or char_length(trim(p_display_name)) > 32 then
    raise exception 'Display name must be between 1 and 32 characters.' using errcode = '22023';
  end if;

  if p_game_slug = 'connect-four' then
    v_prefix := 'CON-';
    v_empty_row := jsonb_build_array(null, null, null, null, null, null, null);
    v_state := jsonb_build_object(
      'board', jsonb_build_array(v_empty_row, v_empty_row, v_empty_row, v_empty_row, v_empty_row, v_empty_row),
      'nextColor', 'red',
      'moveCount', 0,
      'lastDrop', null
    );
  else
    v_prefix := 'TIK-';
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
      values (v_code, p_game_slug, p_mode, p_guest_id, v_state, 2)
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
