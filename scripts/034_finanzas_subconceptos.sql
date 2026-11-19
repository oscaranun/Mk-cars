-- Finanzas: concepto + subconcepto + detalle, y normalización de lo cargado.
begin;

alter table public.expenses add column if not exists subconcept text
  check (subconcept is null or length(trim(subconcept)) between 2 and 60);
alter table public.other_incomes add column if not exists subconcept text
  check (subconcept is null or length(trim(subconcept)) between 2 and 60);

alter table public.finance_concepts drop constraint if exists finance_concepts_kind_check;
alter table public.finance_concepts add constraint finance_concepts_kind_check
  check (kind = any (array['ingreso', 'gasto', 'subconcepto']));

update public.finance_concepts set name = 'Cristian Antúnez' where kind = 'gasto' and name = 'Honorarios Cristian';
update public.finance_concepts set name = 'Rodrigo Aguilera' where kind = 'gasto' and name = 'Honorarios Rodrigo';

insert into public.finance_concepts (kind, name)
values ('subconcepto', 'Honorarios'), ('subconcepto', 'Adelanto'), ('subconcepto', 'Préstamo'),
       ('subconcepto', 'Combustible'), ('subconcepto', 'Compra'), ('subconcepto', 'Otro')
on conflict do nothing;

-- Guarda el texto original en el detalle antes de normalizar.
create temporary table _fix (id uuid, concept text, sub text, category text) on commit drop;

insert into _fix
select id, 'Cristian Antúnez', case when description ilike '%caby%' then null else 'Honorarios' end, 'otro'
from public.expenses where description ilike '%cristian%';

insert into _fix
select id, 'Rodrigo Aguilera', 'Honorarios', 'otro'
from public.expenses where description ilike '%rodrigo%';

insert into _fix
select id, 'Combustible', 'Compra', 'combustible'
from public.expenses where category = 'combustible' and description not ilike '%rodrigo%' and description not ilike '%cristian%';

insert into _fix
select id, 'Productos', 'Compra', 'productos'
from public.expenses where category = 'productos' and description not ilike '%rodrigo%' and description not ilike '%cristian%';

update public.expenses e
set notes = case
      when e.description is null or e.description = f.concept then e.notes
      else left(concat_ws(' · ', nullif(e.notes, ''), 'Antes: ' || e.description), 1000)
    end,
    description = f.concept,
    subconcept = f.sub,
    category = f.category
from _fix f
where e.id = f.id;

-- El flujo de fondos clasifica por concepto: los operarios siguen contando como mano de obra.
update public.cashflow_config
set config = jsonb_set(
  config, '{rules}',
  (config->'rules') || '[{"value":"Rodrigo Aguilera","bucket":"worker","direction":"expense"},
                         {"value":"Cristian Antúnez","bucket":"worker","direction":"expense"}]'::jsonb
)
where not exists (
  select 1 from jsonb_array_elements(config->'rules') r where r->>'value' = 'Rodrigo Aguilera'
);

commit;
