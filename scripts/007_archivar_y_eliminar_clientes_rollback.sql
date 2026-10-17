-- Revierte 006_archivar_y_eliminar_clientes.sql.
-- ATENCIÓN: borra client_audit_log (incluidas las copias de clientes eliminados). Exportala antes.
-- Los clientes archivados vuelven a quedar visibles como clientes normales.

drop trigger if exists inquiries_restore_client on public.inquiries;
drop trigger if exists clients_guard_delete on public.clients;

drop function if exists public.restore_archived_client_on_inquiry();
drop function if exists public.guard_client_delete();
drop function if exists public.delete_client_permanently(uuid, text, boolean);
drop function if exists public.restore_client(uuid);
drop function if exists public.archive_client(uuid, text);
drop function if exists public.client_delete_blockers(uuid);

drop table if exists public.client_audit_log;

drop index if exists public.clients_archived_at_idx;
alter table public.clients
  drop column if exists archive_reason,
  drop column if exists archived_by,
  drop column if exists archived_at;
