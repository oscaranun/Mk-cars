-- Scheduling (overlaps and travel time) is coordinated manually by the team.
-- The trigger keeps only the confirmed_at default and never blocks a turno.
create or replace function public.check_appointment_capacity()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.status = 'confirmado' and new.confirmed_at is null then
    new.confirmed_at := now();
  end if;
  return new;
end $function$;
