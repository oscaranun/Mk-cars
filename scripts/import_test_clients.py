"""Copy exported clients/vehicles into the fixed MK Cars test project only.

Reads local CSVs and MK_CARS_TEST_* environment variables. No production API
connection, updates, deletes, user imports or notifications. Re-runs skip IDs
already present, retaining edits made to the test copies.
"""
import argparse
import csv
import hashlib
import json
import os
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request
from uuid import UUID

TEST_HOST = 'lzkbhqknnsurxrjzzxvk.supabase.co'


def test_url(value):
    parsed = urllib.parse.urlparse(value.strip().strip('"'))
    if (parsed.scheme != 'https' or parsed.hostname != TEST_HOST or parsed.username
            or parsed.password or parsed.port or parsed.query or parsed.fragment
            or parsed.path not in ('', '/')):
        raise ValueError('Se rechazó el destino: solo se admite el proyecto fijo de pruebas.')
    return f'https://{TEST_HOST}'


def read_csv(path, table):
    with Path(path).open(newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    required = {'id', 'client_id', 'category'} if table == 'vehicles' else {'id', 'full_name', 'whatsapp'}
    if not reader.fieldnames or not required.issubset(reader.fieldnames):
        raise ValueError(f'Columnas inválidas en {table}.')
    result = []
    ids = set()
    for source in rows:
        if None in source or any(v is None for v in source.values()):
            raise ValueError(f'Fila incompleta en {table}.')
        row = {k: None if v in ('', 'NULL', 'null') else v for k, v in source.items()}
        UUID(row['id'])
        if row['id'] in ids:
            raise ValueError(f'ID duplicado en {table}.')
        ids.add(row['id'])
        for key in ('marketing_consent', 'is_demo'):
            if key in row:
                raw = str(row[key]).lower()
                if raw not in ('true', 'false'):
                    raise ValueError(f'Valor booleano inválido en {table}.')
                row[key] = raw == 'true'
        if 'review_request_count' in row:
            row['review_request_count'] = int(row['review_request_count'])
        if table == 'vehicles':
            UUID(row['client_id'])
            if row['category'] not in ('auto', 'suv', 'pickup', 'otro'):
                raise ValueError('Categoría inválida.')
            if row.get('catalog_id'):
                UUID(row['catalog_id'])
            if row['category'] == 'otro' and not 2 <= len(row.get('category_label') or '') <= 40:
                raise ValueError('Falta la descripción de un vehículo Otro.')
        elif not row['full_name'] or not row['whatsapp']:
            raise ValueError('Falta nombre o WhatsApp.')
        result.append(row)
    return result


def plan(clients, vehicles, existing_clients, existing_vehicles):
    client_ids = {r['id'] for r in clients}
    if any(v['client_id'] not in client_ids for v in vehicles):
        raise ValueError('Hay un vehículo cuyo cliente no está en el archivo.')
    phones = {}
    for row in [*existing_clients, *clients]:
        old = phones.setdefault(row['whatsapp'], row['id'])
        if old != row['id']:
            raise ValueError('Un WhatsApp tiene distintos IDs; se requiere revisar antes de importar.')
    old_clients = {r['id'] for r in existing_clients}
    old_vehicles = {r['id']: r for r in existing_vehicles}
    if any(v['id'] in old_vehicles and old_vehicles[v['id']]['client_id'] != v['client_id'] for v in vehicles):
        raise ValueError('Un vehículo existente pertenece a otro cliente.')
    return ([r for r in clients if r['id'] not in old_clients],
            [r for r in vehicles if r['id'] not in old_vehicles])


def map_catalog(vehicles, catalog):
    ids = {r['id'] for r in catalog}
    normalize = lambda value: ' '.join((value or '').casefold().split())
    result = {'foreign_catalog_links_remapped': 0, 'foreign_catalog_links_omitted': 0}
    for vehicle in vehicles:
        if vehicle.get('catalog_id') and vehicle['catalog_id'] not in ids:
            matches = [r for r in catalog if
                r['category'] == vehicle['category'] and
                normalize(r.get('brand')) == normalize(vehicle.get('brand')) and
                normalize(r.get('model')) == normalize(vehicle.get('model')) and
                normalize(vehicle.get('brand')) and normalize(vehicle.get('model'))]
            vehicle['catalog_id'] = matches[0]['id'] if len(matches) == 1 else None
            result['foreign_catalog_links_remapped' if len(matches) == 1 else 'foreign_catalog_links_omitted'] += 1
    return result


class TestAPI:
    def __init__(self):
        self.base = test_url(os.environ.get('MK_CARS_TEST_SUPABASE_URL', ''))
        self.key = os.environ.get('MK_CARS_TEST_SUPABASE_SERVICE_ROLE_KEY', '').strip().strip('"')
        if not self.key:
            raise ValueError('Falta la conexión privada de pruebas.')

    def request(self, path, payload=None, extra_headers=None):
        headers = {'apikey': self.key, 'Authorization': 'Bearer '+self.key, **(extra_headers or {})}
        if payload is not None:
            headers.update({'Content-Type': 'application/json', 'Prefer': 'return=minimal'})
        req = urllib.request.Request(self.base+'/rest/v1/'+path,
            data=json.dumps(payload).encode() if payload is not None else None, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                body = response.read()
                return json.loads(body) if body else None
        except urllib.error.HTTPError as error:
            try:
                code = json.loads(error.read()).get('code', 'sin código')
            except (ValueError, AttributeError):
                code = 'sin código'
            raise RuntimeError(f'Operación rechazada: HTTP {error.code}, código {code}. No se sobrescribieron registros.') from None

    def rows(self, table, columns='*'):
        result = []
        while True:
            batch = self.request(f'{table}?select={columns}&order=id&offset={len(result)}&limit=500')
            result.extend(batch)
            if len(batch) < 500:
                return result


def run(args):
    clients, vehicles = read_csv(args.clients, 'clients'), read_csv(args.vehicles, 'vehicles')
    api = TestAPI()
    schema = api.request('', extra_headers={'Accept': 'application/openapi+json'})['definitions']
    for name, rows in [('clients', clients), ('vehicles', vehicles)]:
        if any(set(row) - set(schema[name]['properties']) for row in rows):
            raise ValueError('Las columnas del archivo no coinciden con el destino.')
    before_clients = api.rows('clients', 'id,whatsapp')
    before_vehicles = api.rows('vehicles', 'id,client_id')
    new_clients, new_vehicles = plan(clients, vehicles, before_clients, before_vehicles)
    # UUIDs in the catalogue are project-specific. Match unique exact text/category
    # without changing the destination catalogue or guessing an ambiguous match.
    catalog_changes = map_catalog(new_vehicles, api.rows('vehicle_catalog', 'id,brand,model,category'))
    report = {'destination': TEST_HOST, 'mode': 'applied' if args.apply else 'dry_run',
        'source_clients': len(clients), 'source_vehicles': len(vehicles),
        'new_clients': len(new_clients), 'new_vehicles': len(new_vehicles),
        'skipped_clients': len(clients)-len(new_clients), 'skipped_vehicles': len(vehicles)-len(new_vehicles),
        **catalog_changes,
        'sha256': {name: hashlib.sha256(Path(path).read_bytes()).hexdigest()
                   for name,path in [('clients',args.clients),('vehicles',args.vehicles)]}}
    if args.apply:
        # Each table batch is atomic. If the second batch fails, re-running only
        # inserts missing IDs; it never overwrites copies or contacts production.
        if new_clients:
            api.request('clients', new_clients)
        if new_vehicles:
            api.request('vehicles', new_vehicles)
        after_clients = api.rows('clients', 'id,whatsapp')
        after_vehicles = api.rows('vehicles', 'id,client_id')
        remaining = plan(clients, vehicles, after_clients, after_vehicles)
        if any(remaining):
            raise RuntimeError('La verificación final encontró filas pendientes.')
        report['verified_clients'] = len(clients)
        report['verified_vehicles'] = len(vehicles)
    if args.report:
        Path(args.report).write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--clients', required=True, type=Path)
    parser.add_argument('--vehicles', required=True, type=Path)
    parser.add_argument('--report', type=Path)
    parser.add_argument('--apply', action='store_true')
    run(parser.parse_args())
