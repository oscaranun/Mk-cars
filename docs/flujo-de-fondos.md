# Flujo de fondos

Nueva sección `/admin/flujo-de-fondos`, dentro de Análisis. Combina movimientos históricos de la base del entorno con un modelo financiero editable de 24 meses. No crea ni modifica turnos, clientes, pagos o gastos.

## Datos existentes y criterios

| Pantalla / fuente | Uso en el flujo |
| --- | --- |
| Turnos y servicios: `appointments`, `services` | Trabajos realizados y valor final por fecha de realización. Los turnos realizados sin registro de servicio se incluyen cuando tienen fecha; los que no tienen fecha generan una advertencia. |
| Vehículos: `appointment_vehicles` | Cantidad de vehículos lavados. Un trabajo con dos vehículos cuenta como un trabajo y dos lavados. |
| Clientes: `clients` | Identifica registros de demostración para excluirlos; no se consultan nombres, teléfonos ni correos para este informe. |
| Cobros: `payments` | Entradas de caja por `paid_at`, incluyendo señas y propinas. Se excluyen anulaciones; no se vuelven a sumar importes pagados acumulados de turnos o servicios. |
| Finanzas: `other_incomes` | Otros ingresos por `received_on`. Aportes y préstamos se separan de los ingresos operativos. |
| Gastos: `expenses` | Salidas por `spent_on`. Se excluyen anulaciones y demostraciones. Incluye inversión y retiros efectivamente registrados. |
| Estadísticas existentes | Se conservan. Esta implementación calcula sus propias métricas, sin usar los totales de esa pantalla. |

Todas las fuentes se paginan hasta completar el historial, incluso si PostgREST limita cada respuesta a menos de 500 filas. La primera consulta pide el conteo exacto; inconsistencias, duplicados entre páginas o fallos de lectura generan un aviso en lugar de presentar un saldo incompleto como si fuera válido. La lectura de distintas tablas no es una instantánea transaccional: si se registran movimientos durante la consulta, actualizar para conciliar.

Se usan fechas de Argentina. El historial termina en el día actual, sin un límite retrospectivo ni un máximo de 24 meses. Los registros futuros no se convierten en movimientos históricos. La cantidad de lavados y el ticket usan la fecha del trabajo; el flujo de caja usa las fechas reales de cobro y gasto. Un trabajo pendiente de cobro no se incorpora como efectivo recibido.

La clasificación de gastos compara exactamente el concepto normalizado, primero con la descripción y luego con la categoría. Los conceptos nuevos sin correspondencia siguen incluidos como otros gastos operativos. Las reglas se editan en la misma pantalla. Las comisiones sin registro separado se muestran como **Sin registro separado**, sin imputarles un porcentaje estimado en meses reales. Los aportes de socios no inflan el resultado operativo ni la recuperación de inversión.

## Modelo de 24 meses

El extractor lee valores y resultados almacenados del archivo adjunto mediante `openpyxl`; no ejecuta macros. Conserva los escenarios conservador, moderado y objetivo, inversión, costos unitarios, gastos fijos, capacidad, inflación, crecimiento y participación de socios. El archivo original no se altera.

- El comienzo del plan se propone según el primer registro histórico; puede elegirse otro mes. El saldo inicial corresponde al momento anterior al primer movimiento mostrado.
- Meses transcurridos: movimientos reales, incluyendo meses sin movimientos, que no se rellenan con estimaciones.
- Mes actual: real parcial, identificado como **Mes en curso**. No se extrapola automáticamente.
- Meses futuros dentro del plan: escenario seleccionado. La referencia proyectada sigue disponible para comparar también en meses pasados.
- El horizonte original permanece en 24 meses. Si ya transcurrió, se conserva todo el historial y se advierte que hay que revisar la fecha del plan.
- El cálculo proyectado presupone que los servicios se cobran en el mismo mes, como en el Excel. No modela cuotas, mora ni capital de trabajo.
- La inflación se aplica mes a mes a ingresos y costos por separado; el volumen crece hasta la capacidad configurada. Los días del primer mes se aplican expresamente, aunque la fórmula del archivo original usa los días generales.
- La amortización es informativa y no se resta del efectivo. El inventario de referencia tampoco se suma nuevamente a la inversión.

Las inversiones sin gasto asociado permanecen como supuestos: afectan el acumulado del modelo, pero no el flujo neto registrado. Si una inversión ya figura en Gastos, puede vincularse al movimiento: se utiliza el importe real y se cuenta una sola vez. La referencia proyectada considera la inversión total una sola vez al inicio; no constituye una conciliación bancaria. La recuperación de inversión usa resultados operativos y retiros, excluyendo aportes y saldo inicial.

Los importes faltantes se conservan como pendientes, con advertencia; no equivalen a un costo cero confirmado. La pantalla permite editar inversión, costos por lavado, gastos fijos, participaciones, inflación, volumen, ticket y reglas de clasificación, y exportar el detalle mensual a CSV para Excel.

## Activación y publicación

El código no contiene los importes privados del archivo. Configuración, referencia original, observaciones y procedencia se guardan en Supabase. Sin modelo cargado se muestra un mensaje de configuración pendiente, sin inventar cifras.

1. Preparar el modelo y el instalador **fuera del repositorio**:

   ```bash
   python scripts/extract_cashflow_workbook.py /ruta/modelo.xlsm /ruta/privada/modelo.json
   python scripts/prepare_cashflow_activation.py /ruta/privada/modelo.json /ruta/privada/activar.sql
   ```

2. En SQL Editor del proyecto Supabase correspondiente, ejecutar el archivo privado `activar.sql`. Incluye la migración `033_flujo_de_fondos.sql` y la configuración inicial en una transacción. No modifica movimientos existentes. Volver a ejecutarlo conserva los supuestos previamente guardados.
3. Publicar el código del cambio en el proyecto Vercel elegido y abrir `/admin/flujo-de-fondos` como propietario. No intercambiar variables de producción y pruebas. Cada despliegue consulta exclusivamente la base definida por su configuración existente.
4. Conciliar los totales históricos con Finanzas, completar importes faltantes, vincular las inversiones ya registradas y revisar las reglas de comisiones. La base conocida de pruebas muestra un aviso explícito de que no representa el historial de la web principal.

Los propietarios tienen acceso y pueden guardar supuestos. Otros administradores necesitan el permiso `flujo-de-fondos` y solo pueden consultar. Las tablas nuevas tienen RLS; no permiten lectura anónima ni escritura directa desde usuarios autenticados. La función de guardado exige propietario, conserva versiones anteriores y rechaza sobrescrituras desde una versión desactualizada. La aplicación valida todos los supuestos antes de guardar.

## Alcance de la revisión

Se revisaron las rutas, acciones y esquemas del código actual, y el archivo financiero suministrado. No se dispuso de una sesión autenticada en la web principal ni de una conexión de lectura a su Supabase; las pruebas no verifican sus importes históricos. Las conexiones disponibles corresponden al entorno de pruebas. La sección utiliza los registros de la base principal automáticamente cuando se activa allí, sin copiarlos a pruebas.

La pantalla de Estadísticas previa tiene consultas con límites y criterios distintos de anulaciones e ingresos manuales. No fue modificada: puede diferir del nuevo flujo. Para conciliar se deben usar los mismos períodos, fechas y conceptos, separando facturación de caja.

## Validación reproducible

```bash
node tests/cashflow.test.cjs
python tests/cashflow-db.test.py
node tests/cashflow-web.cjs
node tests/build-synthetic.cjs
```

Los datos de prueba versionados son ficticios. Para comprobar las fórmulas contra el archivo privado extraído:

```bash
MK_CARS_MODEL_FILE=/ruta/privada/modelo.json node tests/cashflow.test.cjs
```

La suite de PostgreSQL requiere Docker y utiliza una base desechable. La prueba web requiere Playwright y Chromium en `/usr/bin/chromium`; ejecuta Next con un backend local ficticio. Cubre paginación de más de mil registros con respuestas limitadas, cálculos, guardado, permisos, CSV, ausencia de configuración, errores de lectura y pantalla móvil. La compilación también utiliza un backend ficticio y no consulta bases alojadas.
