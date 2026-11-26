-- Allows expenses to be classified as capital spending ("Inversión en equipamiento – Reposición extraordinaria").
-- They remain real cash outflows but are excluded from operating expenses and results.

alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses add constraint expenses_category_check
  check (category in ('productos', 'combustible', 'mantenimiento', 'publicidad', 'inversion_equipamiento', 'otro'));

-- admin_update_expense validates the same list; patch only that literal so the rest of the function is untouched.
do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.admin_update_expense(uuid,date,text,numeric,text,text,text,text,uuid,text)'::regprocedure)
    into v_def;
  if position('''publicidad'', ''otro''' in v_def) > 0 then
    execute replace(v_def, '''publicidad'', ''otro''', '''publicidad'', ''inversion_equipamiento'', ''otro''');
  end if;
end $$;
