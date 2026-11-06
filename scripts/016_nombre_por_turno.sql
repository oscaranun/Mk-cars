-- Nombre propio por turno: permite que dos turnos del mismo WhatsApp muestren nombres distintos
-- sin modificar el cliente. Si es null se usa el nombre del cliente.
alter table public.appointments add column if not exists contact_name text
  check (contact_name is null or length(contact_name) between 2 and 120);
