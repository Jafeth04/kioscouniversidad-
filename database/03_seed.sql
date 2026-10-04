-- =============================================================================
--  KIOSCO UNIVERSITARIO - DATOS DE ARRANQUE (SEED)
--  Datos mínimos para probar el sistema: 1 negocio, 1 sucursal, categorías,
--  productos empaquetados (con stock) y comida (con porciones).
-- -----------------------------------------------------------------------------
--  Ejecutar en el SQL Editor de Supabase (corre como owner, omite RLS).
--  IDs fijos para poder referenciarlos fácilmente durante el desarrollo.
-- =============================================================================

-- ---------- NEGOCIO Y SUCURSAL ----------------------------------------------
insert into negocio (id, nombre, moneda) values
  ('00000000-0000-0000-0000-000000000001', 'Kiosco Universitario', 'NIO')
on conflict (id) do nothing;

insert into sucursal (id, negocio_id, nombre, direccion) values
  ('00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-000000000001',
   'Sucursal Principal', 'Campus Universitario')
on conflict (id) do nothing;

-- ---------- NOTA SOBRE USUARIOS ---------------------------------------------
-- Los 2 trabajadores se crean vía Supabase Auth (registro/login). Luego se
-- inserta su fila en 'perfil' enlazada a auth.users(id). Ejemplo (reemplazar
-- el UUID por el id real de auth.users tras el registro):
--
-- insert into perfil (id, negocio_id, nombre, rol) values
--   ('<uuid-de-auth.users>', '00000000-0000-0000-0000-000000000001', 'Dueño', 'admin');

-- ---------- CATEGORÍAS -------------------------------------------------------
insert into categoria (id, negocio_id, nombre, orden) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001', 'Bebidas',  1),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000001', 'Snacks',   2),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000001', 'Comida',   3)
on conflict (id) do nothing;

-- ---------- PRODUCTOS EMPAQUETADOS (con código de barras + precio) ----------
insert into producto (id, negocio_id, categoria_id, nombre, tipo, codigo_barras, precio, costo) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000c1', 'Gaseosa 350ml', 'empaquetado', '7501000110011', 25.00, 18.00),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000c1', 'Agua 600ml',    'empaquetado', '7501000110028', 15.00, 10.00),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000c2', 'Ranchitas',     'empaquetado', '7501000110035', 20.00, 14.00)
on conflict (id) do nothing;

-- ---------- INVENTARIO INICIAL (por sucursal) -------------------------------
insert into inventario (sucursal_id, producto_id, stock_actual, stock_minimo) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', 40, 10),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e2', 30, 10),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e3', 25,  5)
on conflict (sucursal_id, producto_id) do nothing;

-- ---------- COMIDA (sin stock en el MVP; el precio va por PORCIÓN) -----------
insert into producto (id, negocio_id, categoria_id, nombre, tipo) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000c3', 'Hamburguesa', 'comida'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000c3', 'Nacatamal',   'comida')
on conflict (id) do nothing;

insert into producto_variante (producto_id, nombre_porcion, precio, costo, orden) values
  -- Hamburguesa: mismo plato, cambia el precio por porción
  ('00000000-0000-0000-0000-0000000000f1', 'Pequeña', 60.00, 35.00, 1),
  ('00000000-0000-0000-0000-0000000000f1', 'Mediana', 80.00, 45.00, 2),
  ('00000000-0000-0000-0000-0000000000f1', 'Grande', 100.00, 55.00, 3),
  -- Nacatamal: porción única
  ('00000000-0000-0000-0000-0000000000f2', 'Único',   50.00, 30.00, 1);

-- =============================================================================
--  FIN DEL SEED
-- =============================================================================
