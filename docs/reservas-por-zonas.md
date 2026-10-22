# Reservas por zonas — Issue #33

Implementación de desarrollo en `feat/33-reservas-por-zonas`, siguiendo el documento completo y la autorización de continuar solo en desarrollo. No desplegada ni activada. No se ejecutaron migraciones ni escrituras en Supabase. No se cambiaron credenciales. La activación requiere aprobación posterior a las pruebas.

## Qué cambia

- `/admin/zonas`: zonas, barrios, editor visual de límites sobre Google Maps, prioridades, plantilla semanal, cupos, excepciones, bloqueos y copia de siete días. Además permite editar jornada, pausa diaria compartida por todas las unidades, traslado estimado, margen, duración por servicio y cantidad de unidades activas. Los cambios no cancelan reservas existentes.
- `/admin/agenda-servicios`: resumen de siete días, servicios confirmados del día y solicitudes pendientes paginadas. Incluye solicitudes previas del formulario anterior, filtros, propuesta de horario, unidad, duración e importe, enlaces a WhatsApp/Maps, aceptación manual, alternativa, cancelación e historial. La unidad de un turno confirmado puede reasignarse con nueva comprobación de disponibilidad y registro.
- `/reservar` y el formulario de la portada: cuando la modalidad está habilitada, Google Maps valida la dirección, el servidor mantiene el polígono de cobertura existente y resuelve la zona por coordenadas. Se ofrecen fechas sin hora. Si no hay zona, se recibe una solicitud de revisión; si el cupo no alcanza, se exige optar por lista de espera.
- La modalidad queda desactivada al instalar la migración. En ausencia de la migración se conserva el flujo actual. Activación y desactivación posterior desde el CRM.
- No se cambian branding, hero, logo, colores, fotografías ni tipografías. Se reutilizan los componentes del panel y del formulario existentes.

Las solicitudes nuevas se guardan separadas, con `requested_day`, sin inventar un `requested_start`. No crean clientes/vehículos/consultas duplicados anticipadamente. Cuando el administrador registra aceptación explícita, una sola transacción usa `submit_booking`, vincula su consulta con el turno, confirma el horario real y conserva el origen en la solicitud. La ficha habitual gestiona después reprogramación, servicio, cobro y cancelación. Los pedidos pendientes aparecen en la agenda nueva; las listas anteriores reciben el turno al confirmarse.

Los cupos son **vehículos por jornada**, compartidos entre las zonas. Además se controla un presupuesto de minutos: jornada menos pausa, por cantidad de unidades activas; se descuentan servicios, pendientes que ocupan cupo, traslado y margen. La lista de espera no ocupa cupo. La disponibilidad comprueba también que exista un intervalo continuo para ese servicio en alguna unidad. No se inventan horarios para contabilizar solicitudes.

Las propuestas no reservan el intervalo horario: se vuelve a comprobar al aceptar. Las confirmaciones se serializan por fecha; la misma unidad no admite superposiciones. Unidades diferentes sí pueden trabajar simultáneamente. Un mismo operario indicado en el CRM tampoco puede trabajar en dos unidades a la vez. Los cambios de configuración se coordinan con las operaciones en curso mediante bloqueos transaccionales.

La Partner inicial es la unidad principal. Los turnos anteriores con `mobile_unit_id` nulo se interpretan como suyos; no se actualizan masivamente. Cada solicitud nueva conserva la duración de su servicio al enviarse, aunque el catálogo se edite después. El traslado se inicializa con el valor existente de `settings.travel_minutes`, se edita desde el panel nuevo y no utiliza cálculo de tráfico.

## Arquitectura y compatibilidad comprobadas

| Área actual | Archivos / comportamiento |
| --- | --- |
| Runtime | Next.js 16.4, React 19.3, TypeScript, Tailwind 4, pnpm con lockfile |
| Reserva pública | `components/booking.tsx`, `components/booking-vehicles.tsx`, `components/address-input.tsx`, `app/actions/booking.ts` |
| Cobertura | `lib/coverage.ts`: polígono en coordenadas; `isInCoverage` se conserva. No se encontró lectura de KML en runtime. |
| Maps | Places Autocomplete mediante `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, restricción a Argentina/cobertura y selección de coordenadas. Se conserva la integración. El barrio es descriptivo; no decide la zona. |
| Auth | `proxy.ts`, `lib/supabase/proxy.ts`, cookies SSR, `lib/admin/auth.ts`, `is_admin()` y layout. Las páginas nuevas comprueban también `isAdmin`, las acciones usan `getAdminClient`. |
| CRM y agenda previa | `/admin/agenda`, `/admin/turnos`, `/admin/turnos/[id]`, `crm-actions.ts` continúan disponibles. |
| WhatsApp | Enlaces `wa.me` y compositor; no hay webhook ni API de recepción. Abrir WhatsApp no acredita envío, lectura ni aceptación. |
| Estados actuales | `solicitado`, `esperando_cliente`, `confirmado`, `rechazado`, `reprogramado`, `cancelado`, `realizado`; se conservan sin sustituir históricos. |
| Base actual | Metadatos OpenAPI leídos sin filas para inventariar tablas y columnas. No permite certificar cuerpos de funciones, políticas activas, triggers o backups. |

Se identificaron: `admins`, `settings`, `clients`, `vehicles`, `inquiries`, `appointments`, `services`, `payments`, `status_history`, `appointment_vehicles`, `vehicle_catalog`, `blocked_dates`, `appointment_proposals`, `appointment_messages`, `client_audit_log`, `expenses`.

`appointments.requested_start` es obligatorio. `settings` tiene `vehicle_prices` y `travel_minutes`. La migración forward del catálogo y otras ampliaciones no están completas en el repositorio: `003_vehicle_catalog_rollback.sql` es un **rollback**, no se debe ejecutar para instalar. Tampoco se debe ejecutar el rollback 007. No es seguro reconstruir una base real aplicando todos los SQL por orden.

## Migración preparada, sin ejecutar en producción

`scripts/010_zone_booking.sql` usa transacción y requiere el esquema actual completo, incluyendo `blocked_dates`, `appointment_vehicles`, `submit_booking(jsonb)` y el CRM previo.

Agrega ocho tablas:

| Tabla | Propósito |
| --- | --- |
| `operating_zones` | Nombre, barrios descriptivos, polígono, prioridad y estado activo |
| `zone_weekly_schedule` | Zonas de cada día, flexibilidad, habilitación, cupo |
| `zone_day_overrides` | Sustitución de la plantilla para una fecha |
| `zone_booking_settings` | Feature flag, estimación por vehículo, horizonte de fechas |
| `zone_booking_requests` | Datos del pedido, día, propuesta, estado y referencia al turno confirmado |
| `zone_booking_events` | Registro de operaciones con actor, fecha y motivo |
| `mobile_units` | Unidades activas y Partner principal |
| `zone_service_types` | Servicios, duración por vehículo y estado activo |

Agrega `appointments.mobile_unit_id` como columna nullable con referencia a unidades, sin modificar los valores de las reservas históricas. Agrega RPC de disponibilidad, alta, configuración, gestión y reasignación. Un trigger comprueba cupos, tiempo, jornada, pausa, unidad y cruces antes de confirmar. Adapta las funciones existentes `assert_business_hours`, `appointment_slot_conflicts` y `check_appointment_capacity` para usar estas reglas con la modalidad activa; con ella apagada conservan los horarios y la capacidad del flujo anterior.

No elimina ni convierte filas históricas. Los ejemplos de zonas se crean **inactivos, sin polígonos inventados**: lunes a viernes con los barrios sugeridos, sábado flexible y domingo deshabilitado. Los límites se dibujan y editan en el mapa desde el CRM, cargándolo solo cuando se pulsa editar. Una zona necesita un contorno válido antes de activarse. Se conservan zonas, servicios y unidades desactivándolos, sin borrar sus referencias. La Partner principal y el servicio base permanecen disponibles; no se desactivan otras unidades con turnos confirmados futuros o propuestas pendientes.

RLS: tablas nuevas sin acceso anónimo. Lecturas autenticadas solo si `is_admin()`. Escrituras por RPC verificadas; sin DML directo para el rol autenticado. Las RPC de alta/disponibilidad solo se conceden a `service_role`: Next valida primero cobertura y datos. La respuesta pública solo contiene zona, fechas y cupos, nunca nombres, teléfonos ni direcciones de otros clientes.

## Validación realizada

Desde la raíz del checkout:

```sh
pnpm exec tsc --noEmit --incremental false
NODE_USE_ENV_PROXY=1 NEXT_TELEMETRY_DISABLED=1 pnpm build
python tests/zone-booking.test.py
node --test tests/zones-geometry.test.mjs
node tests/zone-web-smoke.cjs
```

Se aprobó compilación de 24 rutas. En la máquina cloud, `NODE_USE_ENV_PROXY=1` permite que Node 24 use el proxy del entorno; sin ese ajuste hubo error DNS al prerenderizar la ruta existente del catálogo. No se desactivó TLS. Persiste el aviso anterior de `metadataBase` de Next, fuera del alcance de reservas.

Resultado de esta revisión: 23 pruebas PostgreSQL y 2 de geometría aprobadas. Las comprobaciones Chromium con servicios simulados también terminaron correctamente. Para arrancar desarrollo cloud contra una base aislada, usar desde `/workspace/Mk-cars`: `NODE_USE_ENV_PROXY=1 NEXT_TELEMETRY_DISABLED=1 pnpm dev`. No probar altas o cambios administrativos con las variables de producción.

La suite PostgreSQL crea y elimina un contenedor **local** con datos sintéticos; no usa conexiones de Supabase. Comprueba permisos, feature flag, geometría, revisión manual, bloqueo, cupos, espera, aceptación atómica, límites de jornada y medianoche, cancelación con historial, copia, carrera por último cupo, pausa, jornada editable, traslado más margen, trabajo paralelo por unidades, RPC heredada de conflictos, presupuesto de minutos, conservación de duración por servicio y rechazo de cambios que invalidan confirmaciones.

Limitación explícita de esa suite: crea una estructura mínima para las tablas de catálogo que faltan en las migraciones y extrae solamente la función multivehículo conservada en el rollback 003, **sin ejecutar ningún rollback**. El fixture también reproduce los privilegios de tablas que el esquema previo espera de Supabase, antes de aplicar los permisos restringidos de las tablas nuevas. Sirve para verificar el nuevo SQL contra ese contrato, no demuestra equivalencia con todos los cuerpos de funciones y permisos desplegados en Supabase.

La prueba de navegador ejecuta Next y Chromium reales con Supabase y Maps simulados, credenciales sintéticas y sin escribir en servicios externos. Comprueba reserva sin hora con servicio, retorno del selector anterior al desactivar la modalidad, redirección sin sesión, login simulado, guardado de plantilla, edición de jornada/pausa/margen/traslado, dibujo de un contorno, agenda de siete días y ausencia de desbordamiento de página a 390 px en formulario y agenda. Requiere `playwright` disponible y Chromium (`CHROMIUM_PATH` permite elegir el ejecutable). El entorno cloud ya proporciona ambos; no se agregaron dependencias a la aplicación.

## Pruebas y requisitos antes de activar

1. Obtener un backup verificable del esquema y datos, incluyendo auth y cuerpos de funciones/políticas. Confirmar fecha y retención. Restaurarlo en una base de desarrollo aislada y verificar restauración. **No se comprobó ni creó un backup de producción en esta tarea.**
2. Completar/versionar el esquema forward faltante para reproducir el catálogo y `blocked_dates`; comparar `submit_booking` y sus valores de retorno con el contrato usado en 010.
3. Con autorización para esa base aislada, aplicar 010 una vez y verificar que comienza desactivada. Comparar clientes, reservas, importes e históricos antes y después. No ejecutar automáticamente contra producción.
4. Probar con administrador, usuario autenticado sin permisos y anónimo; verificar RLS efectiva con la configuración restaurada, no solamente con el fixture.
5. Configurar polígonos reales desde el mapa y revisar límites, barrios compartidos y prioridades. Configurar jornada, pausa, duraciones, traslado, margen, cupos y unidades. El polígono de cobertura existente siempre manda.
6. Configurar la clave **existente** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` para ese entorno y su origen permitido. No estaba presente en esta máquina; el panel impide la activación desde la aplicación si falta. No se modificaron claves, servicios contratados ni variables. Probar Places real y direcciones dentro, fuera y sin zona asignada.
7. Verificar en staging alta, múltiples vehículos, cupo concurrente, bloqueos, excepciones, copia semanal, propuesta/aceptación por WhatsApp, domingo habilitado, reprogramación y cancelación desde la ficha existente. Probar escritorio y móvil con datos sintéticos.
8. Validar los intervalos completos por unidad, incluyendo pausa, límites de jornada, traslado y margen, colisiones con históricos y cambios de unidad. No existe optimización automática de rutas, lectura de WhatsApp, estimación de tráfico ni calendario público publicado en esta entrega.
9. Revisar el cambio antes de cualquier push/deploy: el repositorio conectado a Vercel puede desplegar automáticamente incluso una rama de preview. No se hizo push, merge, PR remoto ni despliegue en esta tarea.
10. Solo con autorización posterior: aplicar migración aprobada en producción, desplegar versión revisada manteniendo la modalidad apagada, comprobar el flujo actual y luego habilitar desde el CRM.

## Rollback operativo sin borrar datos

Desactivar la modalidad en `/admin/zonas` y verificar que `/reservar` recupera el selector actual. La acción invalida la portada y la página de reservas. Se pueden seguir gestionando pedidos nuevos ya recibidos desde la agenda de servicios; el apagado no cancela ni elimina nada.

Si hace falta revertir la aplicación, volver al commit de despliegue anterior conservando las ocho tablas y los eventos. Los turnos ya confirmados son registros ordinarios del CRM. No ejecutar DROP ni borrar solicitudes para deshacer la feature. Con el flag apagado vuelven los controles históricos de horario/capacidad; se conservan los registros de unidad y los datos nuevos. Antes de apagarlo, revisar las confirmaciones paralelas de unidades diferentes: el flujo anterior tiene una capacidad global y no conoce la flota. No se cancelan automáticamente.

Antes de revertir, revisar turnos nuevos confirmados para domingo: con modalidad apagada el CRM vuelve a rechazar nuevas propuestas dominicales; los turnos existentes se conservan. Coordinarlos manualmente sin cancelaciones automáticas.

El backup, la restauración completa y la prueba de integración en una copia real siguen siendo condiciones de activación, no pasos ya verificados.

## Límites operativos explícitos

- La pausa configurada es una franja diaria común a todas las unidades. No es una agenda de pausas individuales por operario.
- El cupo diario es un máximo de vehículos, no el número de camionetas. Las unidades activas definen la cantidad de equipos disponibles y el tiempo de jornada total.
- Los pedidos sin zona resuelta quedan para revisión manual. Los nombres de barrios no reemplazan el polígono de cobertura ni el límite operativo.
- Las solicitudes anteriores siguen utilizando su ficha original para propuestas y respuestas. La agenda nueva las muestra y las incluye en sus cuentas; no convierte sus datos.
- Antes de cambiar horarios, bloquear días, desactivar recursos o apagar la modalidad, revisar los pendientes. Las confirmaciones futuras no se reubican ni cancelan automáticamente.
- La matriz completa de permisos, Maps real, backup restaurable y migración en una copia completa siguen pendientes antes de autorizar activación.
