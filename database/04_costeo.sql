-- =============================================================================
--  KIOSCO UNIVERSITARIO - COSTEO DE INGREDIENTES
--  Extiende la tabla `ingrediente` para el costeo real de platos:
--   * unidad_compra  -> cómo se compra (docena, libra, unidad, gramo, galón…)
--   * costo_compra   -> precio actual (editable; cada cambio va al historial)
--   * rendimiento    -> cuántos platos rinde UNA unidad de compra
--   * costo_por_plato-> calculado automáticamente = costo_compra / rendimiento
-- =============================================================================

alter table ingrediente
  add column if not exists unidad_compra  text,
  add column if not exists costo_compra   numeric(12,2),
  add column if not exists rendimiento    numeric(12,3),
  add column if not exists costo_por_plato numeric(12,4)
    generated always as (costo_compra / nullif(rendimiento, 0)) stored;

-- Historial de precios: cada cambio de precio queda registrado con su fecha.
create table if not exists historial_precio_ingrediente (
  id             uuid primary key default gen_random_uuid(),
  ingrediente_id uuid not null references ingrediente(id) on delete cascade,
  unidad_compra  text,
  costo_compra   numeric(12,2) not null,
  vigente_desde  timestamptz not null default now(),
  usuario_id     uuid references perfil(id)
);
create index if not exists idx_histprecio_ing
  on historial_precio_ingrediente(ingrediente_id);

alter table historial_precio_ingrediente enable row level security;
create policy histprecio_propio on historial_precio_ingrediente
  for all to authenticated
  using (exists (select 1 from ingrediente i
                 where i.id = historial_precio_ingrediente.ingrediente_id
                   and i.negocio_id = mi_negocio_id()))
  with check (exists (select 1 from ingrediente i
                 where i.id = historial_precio_ingrediente.ingrediente_id
                   and i.negocio_id = mi_negocio_id()));

-- -----------------------------------------------------------------------------
--  Datos reales del kiosco (proporcionados por el dueño, 28 sep 2026)
-- -----------------------------------------------------------------------------
--  Tomate: docena a C$40, 4 tomates rinden 8 platos -> 24 platos por docena
--  Arroz:  libra a C$25, rinde 5 platos por libra
--  Pepino: unidad a C$10, rinde 8 platos por unidad
--  Pechuga de pollo: libra a C$34, rinde 7 platos por libra
-- =============================================================================
