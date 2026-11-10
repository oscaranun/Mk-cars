-- Los horarios se cargan manualmente: el tiempo de traslado entre turnos deja de aplicarse.
alter table public.settings alter column travel_minutes set default 0;
update public.settings set travel_minutes = 0 where travel_minutes <> 0;
