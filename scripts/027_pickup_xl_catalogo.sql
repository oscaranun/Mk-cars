update vehicle_catalog set category = 'pickup_xl'
where (brand = 'Ford' and model = 'F-150')
   or (brand = 'Chevrolet' and model = 'Silverado')
   or (brand = 'RAM' and model in ('1500', '2500'));

update vehicle_catalog set aliases = array['f150', 'f 150'] where brand = 'Ford' and model = 'F-150';

insert into vehicle_catalog (brand, model, category, aliases)
select v.brand, v.model, 'pickup_xl', v.aliases from (values
  ('Ford', 'F-150 Raptor', array['raptor', 'f150 raptor', 'f 150 raptor']),
  ('Ford', 'F-250', array['f250', 'f 250']),
  ('Toyota', 'Tundra', array[]::text[]),
  ('GMC', 'Sierra', array[]::text[]),
  ('Nissan', 'Titan', array[]::text[])
) as v(brand, model, aliases)
where not exists (select 1 from vehicle_catalog c where c.brand = v.brand and c.model = v.model);
