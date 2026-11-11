# Administración flexible para turnos a demanda

Implementación en `feat/admin-flexible-demanda`. No incluye publicación ni ejecución de SQL en bases alojadas.

## Cambios de uso

- Cinco entradas principales: Hoy, Agenda, Clientes, Finanzas y Ajustes. Las pantallas auxiliares siguen disponibles mediante enlaces dentro de cada área; se conservan sus rutas y permisos existentes.
- La ficha del cliente concentra datos, vehículos, turnos, cobros, seguimiento e historial. Permite crear un turno, cargar un lavado ya realizado, editar sus detalles, modificar precio/fecha/estado y registrar o corregir ingresos desde la misma ficha.
- El formulario público funciona a demanda por defecto: se solicitan los datos del cliente y vehículo; la fecha, hora y precio se acuerdan después. Zonas, recorridos y agenda de servicios quedan ocultos, con sus datos conservados. No se envían mensajes automáticamente.
- El calendario muestra siete días. El tablero incluye los trabajos realizados con deuda aunque tengan más de treinta días.

## Fechas e importes

Se distinguen la fecha real del servicio, la fecha real del cobro o gasto y la fecha de carga. Por ejemplo: un lavado del lunes puede registrarse el miércoles y llevar una transferencia recibida el martes. La carga histórica no exige que el horario del trabajo esté dentro de la jornada comercial. No permite registrar como realizados trabajos futuros ni ingresos futuros.

Al cargar un lavado, el cobro inicial es cero hasta que el operador indique un importe y su fecha real. Los ingresos pueden quedar a cuenta del cliente; para cancelar el saldo de un servicio deben vincularse explícitamente al turno correspondiente. También se admiten ingresos con concepto sin cliente o turno.

Los importes preservan los centavos y aceptan el formato argentino. Las correcciones exigen motivo. El ajuste conjunto de precio y pago se ejecuta en una transacción: ambos cambios se guardan o ninguno. Los pagos de días cerrados conservan la rectificación y el registro original anulado. Los gastos anulados se excluyen de los totales.

El cierre pide saldo inicial y contado real por medio, sin inventar el contado a partir del esperado. Sus actualizaciones requieren motivo y conservan versiones. Una diferencia global de cero no oculta diferencias compensadas entre efectivo y transferencias. Los errores al consultar movimientos se muestran como errores, en lugar de presentar una caja vacía.

## Base de datos y activación en pruebas

1. Revisar el cambio de código y disponer de respaldo o clon de la base de pruebas. Confirmar que contiene el esquema actual y las migraciones anteriores hasta `025`; no ejecutar nuevamente `001` sobre una base existente.
2. Aplicar **únicamente en pruebas**, tras revisar, `scripts/026_admin_flexible_demanda.sql`. Se ejecuta en una transacción. Agrega columnas, funciones e historial, y amplía la restricción de destino de pagos para admitir ingresos con concepto. No elimina datos históricos.
3. Configurar el despliegue de pruebas con las credenciales de esa misma base. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` deben corresponder al mismo proyecto y guardarse sin comillas envolventes. Nunca exponer la clave de servicio con prefijo público.
4. Mantener `MK_CARS_RESERVATION_MODE` ausente o con valor `demand`. La modalidad por zonas requiere el valor explícito `zones` además de su configuración existente en base de datos; no se activa con esta entrega.
5. Publicar la rama en el proyecto de pruebas. No usar las credenciales o dominios del sitio operativo para validar estas cargas.
6. Con un administrador de prueba, recorrer el formulario público, ficha de cliente, carga histórica, cobro parcial, corrección de fecha bancaria, egreso y cierre. Verificar móvil y roles utilizados por el equipo antes de decidir el paso a producción.

La aplicación nueva requiere `026`: algunas consultas y acciones mostrarán un error si se publica antes de actualizar el esquema. Para volver a la versión anterior, conservar los datos y el historial agregados; no borrar ingresos ni eliminar columnas como método de reversión. Los ingresos sin turno introducidos por esta versión requieren una pantalla que los reconozca.

## Validación local reproducible

- `node --test tests/*.test.mjs`: importes y geometría, cuatro casos.
- `python tests/admin-demand.test.py`: trece casos con PostgreSQL 17 descartable en Docker; carga histórica, separación de fechas, reintentos, validación de cliente/vehículo, cobros a cuenta, correcciones atómicas, permisos y versiones del cierre.
- `python tests/zone-booking.test.py`: veintitrés pruebas de regresión de las funciones existentes de zonas.
- `node tests/admin-demand-web.cjs`: Next real y Chromium, Supabase sintético; navegación reducida, ficha del cliente, corrección de cobro, carga histórica, accesibilidad de pestañas, ancho móvil, cierre y error financiero visible.
- `node tests/zone-web-smoke.cjs`: flujo de zonas optativo con servicios y mapas simulados.
- `pnpm exec tsc --noEmit --incremental false` y `pnpm build` con configuración sintética.

Las pruebas de navegador requieren Playwright y Chromium, y las de SQL requieren Docker. No usan credenciales de bases alojadas. El esquema local incluye fixtures explícitos de catálogo y roles porque faltan algunas migraciones históricas en el repositorio; una prueba local exitosa no sustituye revisar la migración contra el esquema real de pruebas.

## Alcance y límites

Esta entrega adapta el panel al trabajo a demanda acordado. No constituye la implementación completa de todas las recomendaciones de la auditoría anterior: no rediseña los permisos de escritura por rol, no unifica todos los catálogos de precios ni agrega conciliación bancaria automática o envíos de WhatsApp. Conserva los permisos y flujos existentes salvo los cambios descritos. Next se actualiza de 16.4.0 a 16.4.6 en la misma línea de versión.
