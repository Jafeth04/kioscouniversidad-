-- =============================================================================
--  KIOSCO UNIVERSITARIO - SEGURIDAD A NIVEL DE FILA (RLS)
--  Complementa 01_schema.sql. Cada usuario autenticado solo puede ver y
--  modificar datos de SU negocio (multi-tenant seguro).
-- -----------------------------------------------------------------------------
--  Requiere la función mi_negocio_id() ya creada en 01_schema.sql:
--      select negocio_id from perfil where id = auth.uid();
-- =============================================================================

-- ---------------------------------------------------------------------------
--  1) Tablas que YA tenían RLS habilitado en 01_schema.sql pero les faltaba
--     su política. (Sin política, RLS bloquea TODO por defecto.)
-- ---------------------------------------------------------------------------

-- negocio: el usuario solo ve su propio negocio
create policy negocio_propio on negocio
    for all to authenticated
    using (id = mi_negocio_id())
    with check (id = mi_negocio_id());

create policy ingrediente_propio on ingrediente
    for all to authenticated
    using (negocio_id = mi_negocio_id())
    with check (negocio_id = mi_negocio_id());

create policy proveedor_propio on proveedor
    for all to authenticated
    using (negocio_id = mi_negocio_id())
    with check (negocio_id = mi_negocio_id());

-- ---------------------------------------------------------------------------
--  2) Habilitar RLS en el resto de las tablas
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
      'sucursal','perfil','producto_variante','inventario',
      'movimiento_inventario','caja_sesion','venta','venta_detalle','pago',
      'receta','receta_ingrediente','compra','compra_detalle'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
--  3) Políticas para tablas con negocio_id DIRECTO
-- ---------------------------------------------------------------------------
create policy sucursal_propia on sucursal
    for all to authenticated
    using (negocio_id = mi_negocio_id())
    with check (negocio_id = mi_negocio_id());

-- perfil: el usuario ve los perfiles de su mismo negocio (para asignar ventas)
create policy perfil_propio on perfil
    for all to authenticated
    using (negocio_id = mi_negocio_id())
    with check (negocio_id = mi_negocio_id());

create policy venta_propia on venta
    for all to authenticated
    using (negocio_id = mi_negocio_id())
    with check (negocio_id = mi_negocio_id());

-- ---------------------------------------------------------------------------
--  4) Políticas para tablas que heredan el negocio vía RELACIÓN (JOIN)
-- ---------------------------------------------------------------------------

-- producto_variante -> producto.negocio_id
create policy variante_propia on producto_variante
    for all to authenticated
    using (exists (
        select 1 from producto p
        where p.id = producto_variante.producto_id
          and p.negocio_id = mi_negocio_id()))
    with check (exists (
        select 1 from producto p
        where p.id = producto_variante.producto_id
          and p.negocio_id = mi_negocio_id()));

-- inventario -> sucursal.negocio_id
create policy inventario_propio on inventario
    for all to authenticated
    using (exists (
        select 1 from sucursal s
        where s.id = inventario.sucursal_id
          and s.negocio_id = mi_negocio_id()))
    with check (exists (
        select 1 from sucursal s
        where s.id = inventario.sucursal_id
          and s.negocio_id = mi_negocio_id()));

-- movimiento_inventario -> sucursal.negocio_id
create policy movinv_propio on movimiento_inventario
    for all to authenticated
    using (exists (
        select 1 from sucursal s
        where s.id = movimiento_inventario.sucursal_id
          and s.negocio_id = mi_negocio_id()))
    with check (exists (
        select 1 from sucursal s
        where s.id = movimiento_inventario.sucursal_id
          and s.negocio_id = mi_negocio_id()));

-- caja_sesion -> sucursal.negocio_id
create policy caja_propia on caja_sesion
    for all to authenticated
    using (exists (
        select 1 from sucursal s
        where s.id = caja_sesion.sucursal_id
          and s.negocio_id = mi_negocio_id()))
    with check (exists (
        select 1 from sucursal s
        where s.id = caja_sesion.sucursal_id
          and s.negocio_id = mi_negocio_id()));

-- venta_detalle -> venta.negocio_id
create policy detalle_propio on venta_detalle
    for all to authenticated
    using (exists (
        select 1 from venta v
        where v.id = venta_detalle.venta_id
          and v.negocio_id = mi_negocio_id()))
    with check (exists (
        select 1 from venta v
        where v.id = venta_detalle.venta_id
          and v.negocio_id = mi_negocio_id()));

-- pago -> venta.negocio_id
create policy pago_propio on pago
    for all to authenticated
    using (exists (
        select 1 from venta v
        where v.id = pago.venta_id
          and v.negocio_id = mi_negocio_id()))
    with check (exists (
        select 1 from venta v
        where v.id = pago.venta_id
          and v.negocio_id = mi_negocio_id()));

-- receta -> producto.negocio_id   (Fase 2)
create policy receta_propia on receta
    for all to authenticated
    using (exists (
        select 1 from producto p
        where p.id = receta.producto_id
          and p.negocio_id = mi_negocio_id()))
    with check (exists (
        select 1 from producto p
        where p.id = receta.producto_id
          and p.negocio_id = mi_negocio_id()));

-- receta_ingrediente -> receta -> producto.negocio_id   (Fase 2)
create policy receta_ing_propia on receta_ingrediente
    for all to authenticated
    using (exists (
        select 1 from receta r
        join producto p on p.id = r.producto_id
        where r.id = receta_ingrediente.receta_id
          and p.negocio_id = mi_negocio_id()))
    with check (exists (
        select 1 from receta r
        join producto p on p.id = r.producto_id
        where r.id = receta_ingrediente.receta_id
          and p.negocio_id = mi_negocio_id()));

-- compra -> sucursal.negocio_id   (Fase 2)
create policy compra_propia on compra
    for all to authenticated
    using (exists (
        select 1 from sucursal s
        where s.id = compra.sucursal_id
          and s.negocio_id = mi_negocio_id()))
    with check (exists (
        select 1 from sucursal s
        where s.id = compra.sucursal_id
          and s.negocio_id = mi_negocio_id()));

-- compra_detalle -> compra -> sucursal.negocio_id   (Fase 2)
create policy compra_det_propia on compra_detalle
    for all to authenticated
    using (exists (
        select 1 from compra c
        join sucursal s on s.id = c.sucursal_id
        where c.id = compra_detalle.compra_id
          and s.negocio_id = mi_negocio_id()))
    with check (exists (
        select 1 from compra c
        join sucursal s on s.id = c.sucursal_id
        where c.id = compra_detalle.compra_id
          and s.negocio_id = mi_negocio_id()));

-- =============================================================================
--  NOTA: El proceso de sincronización desde el POS puede correr con la
--  service_role de Supabase (omite RLS) o como el usuario autenticado dueño
--  de la venta. Ambas rutas quedan cubiertas por estas políticas.
-- =============================================================================
