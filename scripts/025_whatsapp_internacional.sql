-- Accept international WhatsApp numbers (E.164 digits, 8-15) in submit_booking.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'submit_booking'
  loop
    execute replace(fn.def, '''^549[0-9]{10}$''', '''^[1-9][0-9]{7,14}$''');
  end loop;
end $$;
