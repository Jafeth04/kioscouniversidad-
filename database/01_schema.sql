-- =============================================================================
--  KIOSCO UNIVERSITARIO - ESQUEMA DE BASE DE DATOS (PostgreSQL / Supabase)
--  Versión: MVP v1  ·  Moneda: Córdoba (NIO, C$)  ·  Diseño escalable
-- -----------------------------------------------------------------------------
--  Principios de diseño:
--   * UUID como PK  -> generación offline sin colisiones (sincronización)
--   * negocio_id + sucursal_id -> multi-tenant / multi-sucursal desde el inicio
--   * Inventario por sucursal + libro de movimientos (ledger auditable)
--   * Auditoría (created_at/updated_at/created_by) + soft-delete (activo)
--   * RLS (Row Level Security) para aislar datos por negocio
--   * Tablas de Fase 2 (recetas, proveedores, compras) diseñadas pero sin uso aún
-- =============================================================================

-- ---------- EXTENSIONES ------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()

-- ---------- TIPOS ENUMERADOS -------------------------------------------------
create type rol_usuario        as enum ('admin', 'operador');
create type tipo_producto       as enum ('empaquetado', 'comida');
create type tipo_movimiento_inv as enum ('entrada', 'salida', 'ajuste', 'venta', 'merma');
create type metodo_pago         as enum ('efectivo', 'transferencia');
create type estado_venta        as enum ('completada', 'anulada');
create type estado_sync         as enum ('pendiente', 'sincronizada');
create type estado_caja         as enum ('abierta', 'cerrada');

-- =============================================================================
--  1) ORGANIZACIÓN (multi-tenant / multi-sucursal)
-- =============================================================================
create table negocio (
    id           uuid primary key default gen_random_uuid(),
    nombre       text not null,
    moneda       char(3) not null default 'NIO',
    activo       boolean not null default true,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

create table sucursal (
    id           uuid primary key default gen_random_uuid(),
    negocio_id   uuid not null references negocio(id) on delete cascade,
    nombre       text not null,
    direccion    text,
    activo       boolean not null default true,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index idx_sucursal_negocio on sucursal(negocio_id);

-- =============================================================================
--  2) USUARIOS  (enlazados a Supabase Auth: auth.users)
-- =============================================================================
create table perfil (
    id           uuid primary key references auth.users(id) on delete cascade,
    negocio_id   uuid not null references negocio(id) on delete cascade,
    nombre       text not null,
    rol          rol_usuario not null default 'operador',
    activo       boolean not null default true,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index idx_perfil_negocio on perfil(negocio_id);

-- =============================================================================
--  3) CATÁLOGO
-- =============================================================================
create table categoria (
    id           uuid primary key default gen_random_uuid(),
    negocio_id   uuid not null references negocio(id) on delete cascade,
    nombre       text not null,
    orden        int  not null default 0,
    activo       boolean not null default true,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index idx_categoria_negocio on categoria(negocio_id);

create table producto (
    id            uuid primary key default gen_random_uuid(),
    negocio_id    uuid not null references negocio(id) on delete cascade,
    categoria_id  uuid references categoria(id) on delete set null,
    nombre        text not null,
    tipo          tipo_producto not null,
    codigo_barras text,                        -- solo empaquetados (nullable)
    -- Precio/costo del empaquetado (la comida usa producto_variante):
    precio        numeric(12,2) check (precio  is null or precio  >= 0),
    costo         numeric(12,2) check (costo   is null or costo   >= 0),
    imagen_url    text,
    activo        boolean not null default true,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    created_by    uuid references perfil(id)
);
create index idx_producto_negocio    on producto(negocio_id);
create index idx_producto_categoria  on producto(categoria_id);
-- Un código de barras es único DENTRO de un negocio (permite escaneo confiable):
create unique index uq_producto_codigo
    on producto(negocio_id, codigo_barras)
    where codigo_barras is not null;

-- Porciones de la comida (Pequeña/Mediana/Grande), cada una con su precio:
create table producto_variante (
    id            uuid primary key default gen_random_uuid(),
    producto_id   uuid not null references producto(id) on delete cascade,
    nombre_porcion text not null,             -- 'Pequeña', 'Mediana', 'Grande'
    precio        numeric(12,2) not null check (precio >= 0),
    costo         numeric(12,2) check (costo is null or costo >= 0),
    orden         int not null default 0,
    activo        boolean not null default true,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create index idx_variante_producto on producto_variante(producto_id);

-- =============================================================================
--  4) INVENTARIO  (por sucursal + libro de movimientos)
--     Solo aplica a productos 'empaquetado' en el MVP.
-- =============================================================================
create table inventario (
    id            uuid primary key default gen_random_uuid(),
    sucursal_id   uuid not null references sucursal(id) on delete cascade,
    producto_id   uuid not null references producto(id) on delete cascade,
    stock_actual  numeric(12,3) not null default 0,
    stock_minimo  numeric(12,3) not null default 0,
    updated_at    timestamptz not null default now(),
    unique (sucursal_id, producto_id)
);
create index idx_inventario_sucursal on inventario(sucursal_id);

-- Ledger: cada cambio de stock queda registrado y auditado.
create table movimiento_inventario (
    id            uuid primary key default gen_random_uuid(),
    sucursal_id   uuid not null references sucursal(id) on delete cascade,
    producto_id   uuid not null references producto(id) on delete cascade,
    tipo          tipo_movimiento_inv not null,
    cantidad      numeric(12,3) not null,     -- + entra / - sale
    motivo        text,
    referencia_id uuid,                        -- ej. venta.id que originó la salida
    usuario_id    uuid references perfil(id),
    created_at    timestamptz not null default now()
);
create index idx_movinv_sucursal_producto on movimiento_inventario(sucursal_id, producto_id);
create index idx_movinv_fecha on movimiento_inventario(created_at);

-- =============================================================================
--  5) CAJA  (apertura / cierre con arqueo)
-- =============================================================================
create table caja_sesion (
    id                uuid primary key default gen_random_uuid(),
    sucursal_id       uuid not null references sucursal(id) on delete cascade,
    usuario_id        uuid not null references perfil(id),
    estado            estado_caja not null default 'abierta',
    monto_inicial     numeric(12,2) not null default 0,
    apertura          timestamptz not null default now(),
    cierre            timestamptz,
    monto_declarado   numeric(12,2),           -- lo que el trabajador contó
    monto_esperado    numeric(12,2),           -- calculado por el sistema (efectivo)
    diferencia        numeric(12,2),           -- declarado - esperado
    notas             text,
    created_at        timestamptz not null default now()
);
create index idx_caja_sucursal on caja_sesion(sucursal_id);
create index idx_caja_estado   on caja_sesion(estado);

-- =============================================================================
--  6) VENTAS  (offline-first)
-- =============================================================================
create table venta (
    id            uuid primary key default gen_random_uuid(),
    negocio_id    uuid not null references negocio(id) on delete cascade,
    sucursal_id   uuid not null references sucursal(id) on delete cascade,
    caja_sesion_id uuid references caja_sesion(id) on delete set null,
    usuario_id    uuid not null references perfil(id),
    numero        bigint,                       -- correlativo legible (se asigna al sincronizar)
    total         numeric(12,2) not null check (total >= 0),
    estado        estado_venta not null default 'completada',
    -- Campos de sincronización offline:
    uuid_local    uuid not null,                -- generado en el dispositivo
    dispositivo_id text not null,
    sync_estado   estado_sync not null default 'pendiente',
    vendida_en    timestamptz not null,         -- fecha real de la venta (en el celular)
    created_at    timestamptz not null default now(),
    -- Evita duplicar la misma venta al reintentar la sincronización:
    unique (dispositivo_id, uuid_local)
);
create index idx_venta_sucursal_fecha on venta(sucursal_id, vendida_en);
create index idx_venta_sync on venta(sync_estado);
create index idx_venta_caja on venta(caja_sesion_id);

create table venta_detalle (
    id             uuid primary key default gen_random_uuid(),
    venta_id       uuid not null references venta(id) on delete cascade,
    producto_id    uuid not null references producto(id),
    variante_id    uuid references producto_variante(id),  -- porción (comida)
    descripcion    text not null,               -- nombre "congelado" al momento de la venta
    cantidad       numeric(12,3) not null check (cantidad > 0),
    precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
    subtotal       numeric(12,2) not null check (subtotal >= 0)
);
create index idx_detalle_venta on venta_detalle(venta_id);
create index idx_detalle_producto on venta_detalle(producto_id);

create table pago (
    id           uuid primary key default gen_random_uuid(),
    venta_id     uuid not null references venta(id) on delete cascade,
    metodo       metodo_pago not null,
    monto        numeric(12,2) not null check (monto >= 0),
    referencia   text,                          -- # de transferencia si aplica
    created_at   timestamptz not null default now()
);
create index idx_pago_venta on pago(venta_id);

-- =============================================================================
--  7) FASE 2  (diseñado, INACTIVO en el MVP)  -- recetas / proveedores / compras
-- =============================================================================
create table ingrediente (
    id           uuid primary key default gen_random_uuid(),
    negocio_id   uuid not null references negocio(id) on delete cascade,
    nombre       text not null,
    unidad       text not null default 'unidad', -- 'g', 'ml', 'unidad'
    activo       boolean not null default true,
    created_at   timestamptz not null default now()
);

create table receta (
    id           uuid primary key default gen_random_uuid(),
    producto_id  uuid not null references producto(id) on delete cascade,
    created_at   timestamptz not null default now()
);

create table receta_ingrediente (
    receta_id      uuid not null references receta(id) on delete cascade,
    ingrediente_id uuid not null references ingrediente(id) on delete cascade,
    cantidad       numeric(12,3) not null check (cantidad > 0),
    primary key (receta_id, ingrediente_id)
);

create table proveedor (
    id           uuid primary key default gen_random_uuid(),
    negocio_id   uuid not null references negocio(id) on delete cascade,
    nombre       text not null,
    contacto     text,
    activo       boolean not null default true,
    created_at   timestamptz not null default now()
);

create table compra (
    id           uuid primary key default gen_random_uuid(),
    sucursal_id  uuid not null references sucursal(id) on delete cascade,
    proveedor_id uuid references proveedor(id) on delete set null,
    total        numeric(12,2) not null default 0,
    fecha        timestamptz not null default now(),
    created_at   timestamptz not null default now()
);

create table compra_detalle (
    id            uuid primary key default gen_random_uuid(),
    compra_id     uuid not null references compra(id) on delete cascade,
    producto_id   uuid not null references producto(id),
    cantidad      numeric(12,3) not null check (cantidad > 0),
    costo_unitario numeric(12,2) not null check (costo_unitario >= 0)
);

-- =============================================================================
--  8) TRIGGERS
-- =============================================================================
-- 8.1  Mantener updated_at automáticamente
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['negocio','sucursal','perfil','categoria',
                           'producto','producto_variante']
  loop
    execute format(
      'create trigger trg_updated_at before update on %I
       for each row execute function set_updated_at();', t);
  end loop;
end $$;

-- 8.2  Descontar stock automáticamente al vender un EMPAQUETADO
--      (se dispara también cuando la venta llega por sincronización)
create or replace function aplicar_stock_por_venta()
returns trigger language plpgsql as $$
declare
    v_tipo tipo_producto;
    v_sucursal uuid;
begin
    select p.tipo into v_tipo from producto p where p.id = new.producto_id;
    if v_tipo = 'empaquetado' then
        select v.sucursal_id into v_sucursal from venta v where v.id = new.venta_id;

        insert into movimiento_inventario
            (sucursal_id, producto_id, tipo, cantidad, motivo, referencia_id)
        values
            (v_sucursal, new.producto_id, 'venta', -new.cantidad, 'Venta POS', new.venta_id);

        update inventario
           set stock_actual = stock_actual - new.cantidad,
               updated_at = now()
         where sucursal_id = v_sucursal
           and producto_id = new.producto_id;
    end if;
    return new;
end $$;

create trigger trg_stock_venta
    after insert on venta_detalle
    for each row execute function aplicar_stock_por_venta();

-- =============================================================================
--  9) SEGURIDAD (RLS) — cada usuario solo ve datos de SU negocio
-- =============================================================================
create or replace function mi_negocio_id()
returns uuid language sql stable as $$
    select negocio_id from perfil where id = auth.uid()
$$;

-- Habilitar RLS y política básica por negocio en las tablas con negocio_id.
do $$
declare t text;
begin
  foreach t in array array['negocio','categoria','producto','ingrediente','proveedor']
  loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- Ejemplo de política (se replica por tabla según su relación con el negocio):
create policy negocio_propio on categoria
    for all to authenticated
    using (negocio_id = mi_negocio_id())
    with check (negocio_id = mi_negocio_id());

create policy producto_propio on producto
    for all to authenticated
    using (negocio_id = mi_negocio_id())
    with check (negocio_id = mi_negocio_id());

-- NOTA: sucursal, venta, inventario, etc. heredan el negocio vía JOIN;
--       sus políticas se definen en 02_rls.sql para mantener este archivo legible.

-- =============================================================================
--  FIN DEL ESQUEMA MVP
-- =============================================================================
