# 📋 Documento de Planificación
## Sistema de Gestión para Kiosco Universitario (Web + Móvil)

| | |
|---|---|
| **Proyecto** | Sistema POS e inventario para kiosco universitario |
| **Cliente** | Kiosco universitario (1 sucursal, 2 trabajadores) |
| **País / Moneda** | Nicaragua 🇳🇮 · Córdoba (NIO, C$) |
| **Naturaleza** | Proyecto universitario aplicado a un negocio real |
| **Fecha** | Septiembre 2026 |
| **Versión** | 1.0 — Planificación del MVP |

---

## 1. Resumen ejecutivo

Se desarrollará un sistema de **punto de venta (POS), inventario y administración** para un
kiosco universitario que vende **productos empaquetados** (gaseosas, snacks) y **comida de
menú**. El sistema tiene dos aplicaciones:

- **📱 App móvil (POS):** herramienta de los trabajadores para vender, escanear códigos de
  barras con la cámara, cobrar y cerrar caja. **Funciona sin internet** y sincroniza al reconectar.
- **🖥️ Web Admin:** panel para el dueño: catálogo, inventario, reportes, caja y usuarios.

El diseño es **escalable** (multi-sucursal listo) y de **bajo costo** (planes gratuitos).

---

## 2. Análisis del negocio

| Aspecto | Definición |
|---|---|
| Tipo | Kiosco universitario, 1 sucursal, venta solo en mostrador |
| Catálogo | Productos empaquetados + comida de menú |
| POS | Operado por trabajadores; escaneo con **cámara del celular** |
| Pagos | **Efectivo** y **transferencia** (sin pasarela en línea) |
| Empleados | 2 personas, hacen de todo |
| Conectividad | Internet **inestable** → requiere modo **offline** |
| Moneda | Córdoba (C$) |

### Decisiones clave acordadas
1. **App móvil = POS de los trabajadores** (no hay app de clientes).
2. **Comida:** el plato siempre lleva todo; **solo cambia el precio por porción**.
3. **Inventario híbrido:** stock por unidad en empaquetados; **la comida solo se vende** (sin
   stock en el MVP). Recetas/ingredientes **diseñados pero inactivos** (Fase 2).
4. **Offline nivel básico:** la venta se guarda en el celular y se **sincroniza** al volver el
   internet (el negocio nunca se detiene).
5. **Pagos:** efectivo y transferencia (solo registro).

---

## 3. Requisitos

### 3.1 Funcionales
- **Autenticación:** login de los 2 trabajadores; cada venta registra quién la hizo.
- **Catálogo:** CRUD de categorías; productos empaquetados (código de barras, precio, costo,
  stock); comida con **porciones** (cada una con su precio y costo).
- **Inventario:** descuento automático de stock en empaquetados; entradas/ajustes manuales;
  alerta de stock bajo.
- **POS móvil:** escanear código con la cámara, agregar comida por porción, cobrar
  (efectivo/transferencia), **guardar offline y sincronizar**.
- **Caja:** apertura con monto inicial y cierre con **arqueo** (declarado vs. esperado).
- **Reportes:** ventas por día/producto, más vendidos, ganancias, caja diaria, inventario
  valorizado, horas pico.

### 3.2 No funcionales
- **Offline-first** con sincronización automática y **sin duplicar ventas**.
- **Seguridad:** login + aislamiento de datos por negocio (RLS).
- **Usabilidad:** POS aprendible en minutos.
- **Costo bajo:** apoyado en planes gratuitos.
- **Android primero** (celulares de los trabajadores).
- **Escalabilidad:** multi-sucursal desde el diseño.

---

## 4. Usuarios y roles

| Rol | Quién | Permisos |
|---|---|---|
| **Admin** | Dueño | Todo: catálogo, precios, inventario, reportes, usuarios, caja, ventas |
| **Operador** | Ayudante | Vender en el POS, cerrar caja, consultar ventas y reportes básicos. **No** edita precios ni usuarios |

> En el MVP se implementan **roles diferenciados desde el inicio** (decisión del cliente). La
> base de datos y la seguridad (RLS) ya lo soportan.

---

## 5. Módulos del sistema

1. **Autenticación** · 2. **Catálogo** · 3. **Inventario** · 4. **POS / Ventas** ·
5. **Caja** · 6. **Reportes** · 7. **Sincronización** (motor offline).

---

## 6. Flujos principales

**Venta (POS):** abrir POS → escanear/tocar productos → elegir porción (comida) → cobrar
(efectivo/transferencia) → guardar local → descontar stock → sincronizar al haber internet.

**Reabastecer:** admin registra entrada de stock → sube inventario (queda en el libro de
movimientos).

**Cierre de día:** cerrar caja → arqueo → ver reporte del día.

---

## 7. Modelo de base de datos

Base de datos **PostgreSQL** (Supabase). Principios escalables:
- **UUID** como llave primaria → generación offline sin colisiones.
- **`negocio_id` + `sucursal_id`** → multi-tenant / multi-sucursal desde el día 1.
- **Inventario por sucursal** + **libro de movimientos** (ledger auditable).
- **Auditoría** (created_at/updated_at) + **soft-delete** (activo).
- **RLS** (seguridad por fila) para aislar datos por negocio.

### Entidades principales
```
negocio ─< sucursal
negocio ─< perfil (usuario: rol admin/operador, enlazado a Supabase Auth)
negocio ─< categoria ─< producto ─< producto_variante (porciones de comida)
sucursal ─< inventario (stock por producto)
sucursal ─< movimiento_inventario (entradas/salidas/ventas)
sucursal ─< caja_sesion (apertura/cierre + arqueo)
negocio  ─< venta ─< venta_detalle
                  └─< pago (efectivo/transferencia)
[Fase 2, diseñado e inactivo]: ingrediente, receta, receta_ingrediente,
                               proveedor, compra, compra_detalle
```
Claves para offline: `venta.uuid_local` + `dispositivo_id` → evitan ventas duplicadas al
sincronizar.

> Implementado en: `database/01_schema.sql`, `database/02_rls.sql`, `database/03_seed.sql`.

---

## 8. Arquitectura y tecnologías

```
📱 App móvil (POS)              🖥️ Web Admin                ☁️ Backend
Expo / React Native      →     Next.js (React)      →     Supabase
- expo-camera (escáner)        - dashboards/reportes       - PostgreSQL
- SQLite local (offline)       - CRUD catálogo/inventario  - Auth + RLS
- cola de sincronización       - Vercel (hosting)          - API automática
```

| Componente | Tecnología | Justificación |
|---|---|---|
| POS móvil | **Expo / React Native** | Un solo código, escáner con cámara integrado, ideal Android |
| Offline | **SQLite local + cola (outbox)** | Vende sin internet y sincroniza al reconectar |
| Backend | **Supabase (PostgreSQL)** | Relacional (inventario/reportes), Auth + seguridad, plan gratuito |
| Web Admin | **Next.js + Tailwind + shadcn/ui** | Rápido, dashboards, accesible |
| Gráficos | **Recharts** | Ligero, ideal para reportes |
| Hosting web | **Vercel** | Gratis y hecho para Next.js |

---

## 9. Diseño del Web Admin

**Propósito:** administrar y analizar (no vende; eso lo hace el POS).

### Rutas
```
/login
/(dashboard)/                 → resumen del día + alertas de stock
/productos, /productos/nuevo, /productos/[id]
/categorias
/inventario, /inventario/movimientos
/ventas, /ventas/[id]
/caja
/reportes
/usuarios          (solo admin)
/configuracion
```

### Reportes (con selector de fechas y gráficos)
1. Ventas por día · 2. Ventas por producto · 3. Más vendidos ·
4. Ganancias (precio − costo) · 5. Caja diaria · 6. Horas pico.

---

## 10. Diseño del POS móvil (resumen)

- Login del trabajador.
- Pantalla de venta: escanear con cámara / tocar comida → elegir porción → carrito → total C$.
- Cobro: efectivo o transferencia (referencia).
- **Guardado offline** y **sincronización** automática al reconectar.
- Apertura y cierre de caja con arqueo.

> 📌 El diseño **detallado** del POS (pantallas, escáner, base de datos local y motor de
> sincronización) está en la **Sección 16**.

---

## 11. Alcance del MVP vs. Fase 2

**✅ MVP (v1):** login con roles · catálogo (empaquetados + comida con porciones) · POS con
escáner y offline/sync · descuento de stock · pagos efectivo/transferencia · caja con arqueo ·
los 6 reportes.

**🔜 Fase 2:** recetas/ingredientes activos, proveedores y compras, facturación electrónica
(DGI Nicaragua), fidelización de clientes, multi-sucursal.

---

## 12. Roadmap de construcción

1. **Base de datos** en Supabase (esquema + seguridad + datos de prueba). ✅ *diseñada*
2. **Web Admin:** Base + login → Catálogo → Inventario → Ventas/Caja → Reportes → Usuarios.
3. **POS móvil:** Base + login → venta/escáner → cobro → offline/sync → caja.
4. **Pruebas** integradas (venta offline → sincronización → reporte).
5. **Despliegue:** Web en Vercel, backend en Supabase, APK del POS para Android.

---

## 13. Estado actual

| Etapa | Estado |
|---|---|
| Descubrimiento del negocio | ✅ Completado |
| Requisitos, usuarios, módulos, flujos | ✅ Completado |
| Diseño de base de datos (SQL) | ✅ Completado |
| Planificación Web Admin | ✅ Completado |
| Costos, límites y arquitectura de datos | ✅ Completado |
| Planificación POS móvil | ✅ Completado |
| Construcción | ⏳ Pendiente |

---

## 14. Costos, límites y capacidad

### 14.1 Configuración 100% gratuita (y legal)
| Componente | Servicio | Costo | Nota |
|---|---|---|---|
| Backend + base de datos central | **Supabase Free** | Gratis | Base de datos, Auth, API y seguridad incluidos |
| Hosting del Web Admin | **Cloudflare Pages** | Gratis | ⚠️ Permite uso **comercial** (Vercel Hobby es solo personal) |
| App móvil (POS) | **Expo + compilación local** | Gratis | APK instalado directo en los celulares (sideload) |

**Costo mensual del proyecto: C$0.**
Único gasto **opcional** (no necesario): $25 pago único de Google Play, solo si se quiere
publicar la app en la tienda. Un dominio propio es opcional (~$10–15/año).

### 14.2 Límites del plan gratuito de Supabase
- Base de datos: **500 MB** · Almacenamiento archivos: 1 GB · Transferencia: ~5 GB/mes
- Auth: 50,000 usuarios/mes (solo se usan 2)
- ⚠️ El proyecto se pausa tras ~7 días **sin actividad** (no afecta a un kiosco que vende a diario).

### 14.3 Cálculo de capacidad de la base de datos
- Una venta completa (cabecera + líneas + pago + movimiento de inventario) ocupa **≈ 2 KB**
  (incluye índices).
- 500 MB ÷ 2 KB ≈ **250,000 ventas**; con 20% de margen de seguridad → **~200,000 ventas**.

| Ritmo de ventas | Ventas/mes (~26 días) | Tiempo para llenar 500 MB |
|---|---|---|
| Tranquilo (50/día) | ~1,300 | ~12–13 años |
| Normal (100/día) | ~2,600 | ~6–7 años |
| Muy movido (200/día) | ~5,200 | ~3 años |

**Conclusión:** el plan gratuito dura **años**. Si algún día se acerca al límite:
1. Archivar ventas viejas a CSV y liberarlas de la BD activa, o
2. Subir a **Supabase Pro ($25/mes)** → 8 GB (≈ 4 millones de ventas).

> Recomendación: usar pocas imágenes de productos (o ninguna en el MVP), porque las fotos
> consumen el almacenamiento aparte y más rápido.

---

## 15. Arquitectura de datos: local + central

El sistema usa **dos bases de datos** que trabajan juntas (por el diseño offline):

| | 📱 Base de datos LOCAL | ☁️ Base de datos CENTRAL |
|---|---|---|
| Dónde vive | En cada celular (SQLite) | En la nube (**Supabase**) |
| Para qué | Vender sin internet; guarda las ventas al instante | Consolidar ventas de todos los celulares; alimentar el Web Admin |
| Quién la usa | La app POS | Web Admin + sincronización del POS |

**Flujo:** el POS escribe en la base local → cuando hay internet, envía las ventas pendientes a
Supabase (sin duplicar, gracias a `uuid_local` + `dispositivo_id`) → el Web Admin lee de Supabase.

### ¿Por qué NO alojamos la base central por cuenta propia?
Como el POS es **móvil**, se conecta **por internet desde afuera**, lo que exige dirección
pública fija, una capa de API segura en medio y disponibilidad 24/7.

- **PC en el kiosco:** ❌ descartado — internet inestable, sin IP pública fija, se apaga con la
  luz, sin respaldos. Los celulares no lo alcanzarían de forma confiable.
- **VPS propio / Supabase self-hosted:** posible, pero **cuesta mensual** y **alguien debe
  mantenerlo** (respaldos, seguridad, caídas). Riesgo para un negocio pequeño sin equipo técnico.
- **Supabase administrado (nube):** ✅ **decisión tomada** — siempre encendido, con respaldos,
  seguridad y API listos, sin administración de servidores y **gratis** para este tamaño.

**Decisión confirmada:** la base central se aloja en **Supabase (nube administrada)**. El diseño
offline ya protege contra el internet inestable.

---

## 16. Diseño detallado del POS móvil

### 16.1 Propósito
App **para los trabajadores**, orientada a vender rápido **incluso sin internet**:
escanear/tocar → cobrar → listo.

### 16.2 Tecnologías
| Función | Librería | Por qué |
|---|---|---|
| Framework | **Expo (React Native)** | Un solo código, ideal Android |
| Escáner | **expo-camera** | Usa la cámara del celular, sin hardware extra |
| Base local | **expo-sqlite** (+ Drizzle ORM) | Guarda ventas offline; consultas tipadas |
| Conexión | **NetInfo** | Detecta reconexión para sincronizar |
| Backend | **supabase-js** | Sube ventas y baja catálogo |
| Estado | **Zustand** | Manejo simple del carrito y sesión |

### 16.3 Navegación (pantallas)
```
Login
 └─ (sesión iniciada)
     ├─ Apertura de Caja      → monto inicial (si no hay caja abierta)
     ├─ Venta (principal)     → escáner + carrito + cobrar
     ├─ Catálogo rápido       → tocar comida/productos sin código
     ├─ Historial de ventas   → del día, con estado de sincronización
     ├─ Cierre de Caja        → arqueo (declarado vs. esperado)
     └─ Ajustes               → sincronizar manual, cerrar sesión
```

### 16.4 Pantallas y funciones
- **Login:** correo/contraseña (Supabase Auth). Al entrar, **descarga el catálogo** al celular.
- **Apertura de caja:** pide monto inicial en efectivo si no hay sesión abierta.
- **Venta (principal):** escáner de código → agrega empaquetado; pestaña de comida → elige
  **porción**; carrito con cantidades y **total en C$**; botón **Cobrar** (efectivo con vuelto o
  transferencia con referencia) → guarda venta local → descuenta stock local. Indicador
  **online/offline** visible.
- **Catálogo rápido:** cuadrícula para tocar productos/comida cuando el código no lee.
- **Historial:** ventas del día con marca ✅ sincronizada / ⏳ pendiente.
- **Cierre de caja:** total esperado vs. declarado → **diferencia** → cierra sesión.

### 16.5 Base de datos local (SQLite)
```
productos_cache      (id, nombre, tipo, codigo_barras, precio, stock_local)
variantes_cache      (id, producto_id, nombre_porcion, precio)
venta_local          (id=uuid_local, total, metodo_pago, fecha, sync_estado, usuario_id)
venta_detalle_local  (venta_local_id, producto_id, variante_id, cantidad, precio, subtotal)
caja_local           (id, monto_inicial, apertura, cierre, ...)
```
`productos_cache`/`variantes_cache` se llenan al descargar el catálogo; `venta_local` funciona
como **bandeja de salida (outbox)**.

### 16.6 Motor de sincronización (patrón outbox)
- **⬇️ PULL (descarga):** al iniciar sesión y periódicamente, baja catálogo, precios y stock →
  actualiza el caché local (permite vender offline).
- **⬆️ PUSH (subida):** cuando hay internet, envía las `venta_local` con `sync_estado='pendiente'`
  a Supabase; el `UNIQUE(dispositivo_id, uuid_local)` **evita duplicados**; al confirmar, marca
  la venta como `'sincronizada'`.
- **Disparadores:** al detectar reconexión (NetInfo), después de cada venta (si hay internet), y
  manual (botón "Sincronizar ahora").

### 16.7 Casos borde
| Situación | Solución |
|---|---|
| 2 celulares venden el mismo empaquetado sin internet | El servidor **reconcilia** el stock al sincronizar; aceptable para un kiosco pequeño |
| Número de factura correlativo | Se asigna en el **servidor** al sincronizar (evita choques); local usa UUID |
| Celular perdido/reinstalado con ventas sin subir | Mitigación: **sincronizar seguido** (auto tras cada venta con internet) |
| Precio cambió en el admin | Se actualiza en el próximo PULL; la venta ya hecha guarda el precio "congelado" |

### 16.8 Roles en el POS
- **admin** y **operador** pueden vender y cerrar caja.
- Solo **admin** (opcional) ajusta stock desde el móvil.

### 16.9 Roadmap del POS
1. Base: Expo + login + descarga de catálogo a SQLite.
2. Venta offline: escáner + carrito + comida con porciones + guardar venta local.
3. Cobro: efectivo/transferencia + descuento de stock local.
4. Motor de sincronización: push/pull + detección de reconexión.
5. Caja: apertura/cierre con arqueo.
6. Historial y pulido de UX.
