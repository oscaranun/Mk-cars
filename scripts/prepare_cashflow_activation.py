"""Create a private, one-time SQL installer. Never connects to any database.

Keep its output outside Git: it contains the user's financial assumptions.
Existing model settings are never overwritten on re-run.
"""
import argparse
import json
from pathlib import Path
import re


def prepare(model, migration):
    for key in ['config','source','observations']:
        if key not in model:raise ValueError('Falta contenido del modelo extraído.')
    literal=lambda value:"'"+json.dumps(value,ensure_ascii=False,allow_nan=False).replace("'","''")+"'::jsonb"
    ddl=re.sub(r'(?im)^\s*(?:begin|commit);[ \t]*$', '', migration)
    return """-- MK Cars: activar Flujo de fondos en el proyecto elegido.
-- Contiene supuestos financieros privados. No publicar este archivo ni subirlo a Git.
-- No modifica clientes, turnos, cobros ni gastos. No sobrescribe un modelo existente.
begin;
"""+ddl+f"""
with installed as (
  insert into public.cashflow_config(id,config,original_config,source,observations,version)
  values(1,{literal(model['config'])},{literal(model['config'])},{literal(model['source'])},{literal(model['observations'])},1)
  on conflict(id)do nothing returning config,version
)insert into public.cashflow_config_revisions(version,before_config,after_config)
  select version,null,config from installed;
commit;
select case when exists(select 1 from public.cashflow_config where id=1)
  then 'Flujo de fondos habilitado. La configuración existente se conservó si ya estaba cargada.'
  else 'No se pudo cargar el modelo.' end as resultado;
"""

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('model',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    if args.output.resolve().is_relative_to(Path(__file__).resolve().parents[1]):
        raise SystemExit('Guardá el instalador financiero privado fuera del repositorio.')
    source=json.loads(args.model.read_text())
    migration=(Path(__file__).parent/'033_flujo_de_fondos.sql').read_text()
    args.output.write_text(prepare(source,migration))
    print('Instalador privado preparado; no se ejecutó SQL.')
