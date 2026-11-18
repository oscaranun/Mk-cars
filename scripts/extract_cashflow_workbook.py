"""Extract the supplied MK Cars workbook as editable defaults; never execute macros."""
import argparse
import hashlib
import json
import unicodedata
from pathlib import Path
import openpyxl


def extract(path):
    book = openpyxl.load_workbook(path, data_only=True)
    assumptions = book['Supuestos']
    value = lambda row: assumptions.cell(row, 2).value
    money = lambda amount: '$' + f'{amount:,.0f}'.replace(',', '.')
    investments = []
    for row in range(4, 19):
        sheet = book['Inversion inicial']
        if not sheet.cell(row, 1).value:
            continue
        investments.append(dict(id=f'investment-{row}', label=sheet.cell(row, 1).value,
            amount=sheet.cell(row, 2).value, kind=sheet.cell(row, 3).value,
            note=sheet.cell(row, 4).value or '', paidBy=sheet.cell(row, 5).value or '',
            expenseId=None, depreciate=row in (4, 12),
            lifeMonths=value(28 if row == 4 else 30) if row in (4, 12) else sheet.cell(row, 6).value or 0,
            residual=value(27 if row == 4 else 29) if row in (4, 12) else sheet.cell(row, 7).value or 0))
    config = dict(schemaVersion=1, startMonth=None, openingCash=0, scenario='objective',
        operatingDays=value(4), firstMonthOperatingDays=value(31), vehiclesPerDay=value(5),
        capacityPerDay=value(23), ticket=value(6), workerPercent=value(7)*100,
        paymentPercent=value(8)*100, incomeInflation=value(20)*100,
        costInflation=value(21)*100, volumeGrowth=value(22)*100,
        distributionPercent=value(26)*100, conservativePerDay=value(32), moderatePerDay=value(33),
        partners=[dict(name=book['Socios']['B3'].value, percent=value(24)*100),dict(name=book['Socios']['C3'].value,percent=value(25)*100)],
        fixedCosts=[dict(id=f'fixed-{r}',label=assumptions.cell(r,1).value,amount=value(r)) for r in range(9,20)],
        consumables=[dict(id=f'consumable-{r}',label=book['Costos por lavado'].cell(r,1).value,amount=book['Costos por lavado'].cell(r,2).value) for r in range(4,12)],
        investments=investments,
        inventory=[dict(id=f'inventory-{r}',label=book['Inventario'].cell(r,1).value,quantity=book['Inventario'].cell(r,2).value,unitPrice=book['Inventario'].cell(r,3).value) for r in range(4,18)],
        rules=[dict(direction='expense',value=name,bucket=bucket) for name,bucket in [
            ('productos','materials'),('Comisión operario','worker'),('Comisiones operarios','worker'),
            ('Honorarios Cristian','worker'),('Honorarios Rodrigo','worker'),
            ('Comisión medios de pago','fees'),('Comisiones Mercado Pago','fees'),
            ('combustible','fixed'),('mantenimiento','fixed'),('publicidad','fixed'),
            ('Seguro Partner','fixed'),('Software y telefonía','fixed'),
            ('Inversión inicial','investment'),('Compra de activos','investment'),('Retiro de socios','withdrawal')]]+
            [dict(direction='income',value=name,bucket='capital') for name in ['Aporte de socios','Aporte de capital','Préstamo']])
    config['rules'] += [dict(direction='expense',value=line['label'],bucket='fixed') for line in config['fixedCosts']]
    normalized=lambda text:' '.join(''.join(c for c in unicodedata.normalize('NFD',text.lower()) if not unicodedata.combining(c)).split())
    seen=set()
    config['rules']=[rule for rule in config['rules'] if not ((rule['direction'],normalized(rule['value'])) in seen or seen.add((rule['direction'],normalized(rule['value']))))]
    return dict(source=dict(fileName=Path(path).name,sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest(),
        sheets=book.sheetnames, currency='ARS', originalInvestment=book['Inversion inicial']['B20'].value,
        originalInventory=book['Inventario']['D22'].value, originalMonthlyCash=book['Panel']['B10'].value,
        originalMonth24=book['Panel']['B14'].value,originalDepreciation=book['Panel']['B11'].value,
        originalWashes=book['Panel']['B5'].value,originalRevenue=book['Panel']['B6'].value,
        originalVariable=book['Panel']['B8'].value,originalFixed=book['Panel']['B9'].value,
        scenarioCash={name:book['Escenarios'].cell(row,7).value for name,row in [('conservative',4),('moderate',5),('objective',6)]}), config=config,
        observations=[
            f"El inventario suma {money(book['Inventario']['D22'].value)} y el stock inicial figura por {money(book['Inversion inicial']['B17'].value)}; se conservan ambos sin sumarlos nuevamente.",
            'Herrería y trámites no tienen importe. Un valor sin cargar no equivale a costo cero confirmado.',
            f"El Excel tiene un residual de generador de {money(book['Inversion inicial']['G12'].value)} en inversión y {money(value(29))} en supuestos; la amortización del Panel usa el valor de supuestos y se conserva esa referencia.",
            'Días operativos mes 1 está definido en el Excel pero su flujo usa los días generales. Esta vista permite usar expresamente los días del primer mes.',
            'La participación de socios del Excel es ilustrativa; no representa un acuerdo societario.',
            'Los importes de inversión sin movimiento asociado son supuestos del modelo, no pagos bancarios verificados.'
        ])


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workbook',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    if args.output.resolve().is_relative_to(Path(__file__).resolve().parents[1]):
        raise SystemExit('Guardá los supuestos financieros extraídos fuera del repositorio.')
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(extract(args.workbook),ensure_ascii=False,indent=2)+'\n')
    print('Modelo extraído; no se ejecutaron macros ni se modificó el archivo original.')
