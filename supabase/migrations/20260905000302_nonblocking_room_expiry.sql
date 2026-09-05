create or replace function public.expire_idle_rooms(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with stale_rooms as (
    select id
    from public.rooms
    where status in ('open', 'playing')
      and (expires_at <= p_now or last_activity_at + interval '6 hours' <= p_now)
    order by id
    for update skip locked
  )
  update public.rooms as rooms
  set status = 'expired', updated_at = p_now, last_activity_at = p_now
  from stale_rooms
  where rooms.id = stale_rooms.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.expire_idle_rooms(timestamptz) from public, anon, authenticated;
grant execute on function public.expire_idle_rooms(timestamptz) to service_role;
