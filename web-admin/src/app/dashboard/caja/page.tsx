"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cordoba } from "@/lib/formato";
import { esAdmin } from "@/lib/roles";
import { encolar, nuevoId, guardarCache, leerCache } from "@/lib/offline";
import { Banknote, Plus, Minus, Trash2 } from "lucide-react";

type Plato = {
  id: string;
  nombre: string;
  precio_venta: number | null;
  cantidad_disponible: number | null;
};

type ItemCarrito = {
  producto_id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  disponible: number;
};

export default function CajaPage() {
  const supabase = createClient();
  const [negocioId, setNegocioId] = useState<string | null>(null);
  const [sucursalId, setSucursalId] = useState<string | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [rol, setRol] = useState<string | null>(null);
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [metodo, setMetodo] = useState<"efectivo" | "transferencia">("efectivo");
  const [referencia, setReferencia] = useState("");
  const [ventasHoy, setVentasHoy] = useState<{ total: number; n: number }>({
    total: 0,
    n: 0,
  });
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    // SIN internet: usamos los platos guardados en el celular.
    if (!navigator.onLine) {
      setPlatos(leerCache<Plato[]>("caja_platos", []));
      return;
    }
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    const [{ data: pl }, { data: ventas }] = await Promise.all([
      supabase
        .from("producto")
        .select("id, nombre, precio, cantidad_disponible")
        .in("tipo", ["comida", "empaquetado"])
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("venta")
        .select("total, vendida_en")
        .gte("vendida_en", inicioHoy.toISOString()),
    ]);
    const platosMapeados = ((pl as { id: string; nombre: string; precio: number | null; cantidad_disponible: number | null }[]) ?? []).map(
      (p) => ({
        id: p.id,
        nombre: p.nombre,
        precio_venta: p.precio,
        cantidad_disponible: p.cantidad_disponible,
      }),
    );
    setPlatos(platosMapeados);
    guardarCache("caja_platos", platosMapeados); // para usarlos sin internet
    const vs = (ventas as { total: number }[]) ?? [];
    setVentasHoy({
      total: vs.reduce((s, v) => s + Number(v.total), 0),
      n: vs.length,
    });
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data: sesion } = await supabase.auth.getSession();
      const user = sesion.session?.user;
      if (user) {
        setUsuarioId(user.id);
        if (navigator.onLine) {
          const { data: perfil } = await supabase
            .from("perfil")
            .select("negocio_id, rol")
            .eq("id", user.id)
            .single();
          const neg = perfil?.negocio_id ?? null;
          setNegocioId(neg);
          setRol(perfil?.rol ?? null);
          let suc: string | null = null;
          if (neg) {
            const { data: s } = await supabase
              .from("sucursal")
              .select("id")
              .eq("negocio_id", neg)
              .limit(1)
              .single();
            suc = s?.id ?? null;
            setSucursalId(suc);
          }
          guardarCache("caja_ids", { negocioId: neg, sucursalId: suc, rol: perfil?.rol });
        } else {
          const ids = leerCache<{ negocioId: string | null; sucursalId: string | null; rol: string | null }>(
            "caja_ids",
            { negocioId: null, sucursalId: null, rol: null },
          );
          setNegocioId(ids.negocioId);
          setSucursalId(ids.sucursalId);
          setRol(ids.rol);
        }
      }
      await cargar();
    })();
  }, [supabase, cargar]);

  function agregar(p: Plato) {
    if (p.precio_venta == null) {
      alert("Este plato no tiene precio. Ponle precio en la pantalla de Platos.");
      return;
    }
    setCarrito((prev) => {
      const ex = prev.find((i) => i.producto_id === p.id);
      if (ex) {
        return prev.map((i) =>
          i.producto_id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          producto_id: p.id,
          nombre: p.nombre,
          precio: Number(p.precio_venta),
          cantidad: 1,
          disponible: Number(p.cantidad_disponible ?? 0),
        },
      ];
    });
  }

  function cambiarCantidad(id: string, delta: number) {
    setCarrito((prev) =>
      prev
        .map((i) =>
          i.producto_id === id
            ? { ...i, cantidad: Math.max(0, i.cantidad + delta) }
            : i,
        )
        .filter((i) => i.cantidad > 0),
    );
  }

  const total = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);

  async function cobrar() {
    if (carrito.length === 0 || !negocioId || !sucursalId || !usuarioId) {
      alert("Agrega platos a la venta.");
      return;
    }

    // Bloquear si se vende más de lo que hay listo
    const faltantes = carrito.filter((i) => i.cantidad > i.disponible);
    if (faltantes.length > 0) {
      const msg = faltantes
        .map((f) => `• ${f.nombre}: hay ${f.disponible} listos, intentas vender ${f.cantidad}`)
        .join("\n");
      alert(
        `No puedes vender más de lo que hay listo:\n\n${msg}\n\nCocina más en la pantalla de Cocina.`,
      );
      return;
    }

    setGuardando(true);

    // Armamos la venta con IDs ya generados (así no dependemos del servidor).
    const ventaId = nuevoId();
    const ventaRow = {
      id: ventaId,
      negocio_id: negocioId,
      sucursal_id: sucursalId,
      usuario_id: usuarioId,
      total,
      uuid_local: nuevoId(),
      dispositivo_id: "web",
      sync_estado: "sincronizada",
      vendida_en: new Date().toISOString(),
    };
    const detalles = carrito.map((i) => ({
      venta_id: ventaId,
      producto_id: i.producto_id,
      descripcion: i.nombre,
      cantidad: i.cantidad,
      precio_unitario: i.precio,
      subtotal: i.precio * i.cantidad,
    }));
    const pagoRow = {
      venta_id: ventaId,
      metodo,
      monto: total,
      referencia: metodo === "transferencia" ? referencia.trim() || null : null,
    };
    const inserts = [
      { tabla: "venta", filas: [ventaRow] },
      { tabla: "venta_detalle", filas: detalles },
      { tabla: "pago", filas: [pagoRow] },
    ];

    // SIN internet: guardamos la venta en el dispositivo y bajamos el stock local.
    if (!navigator.onLine) {
      encolar("venta", `Venta ${cordoba(total)}`, inserts);
      setPlatos((prev) =>
        prev.map((p) => {
          const it = carrito.find((c) => c.producto_id === p.id);
          return it
            ? { ...p, cantidad_disponible: Number(p.cantidad_disponible ?? 0) - it.cantidad }
            : p;
        }),
      );
      setCarrito([]);
      setReferencia("");
      setGuardando(false);
      alert("Venta guardada SIN internet. Se subirá sola cuando vuelva la señal.");
      return;
    }

    // CON internet: la subimos de una vez.
    const { error: e1 } = await supabase.from("venta").insert([ventaRow]);
    if (e1) {
      alert("No se pudo registrar la venta: " + e1.message);
      setGuardando(false);
      return;
    }
    const { error: e2 } = await supabase.from("venta_detalle").insert(detalles);
    if (e2) {
      await supabase.from("venta").delete().eq("id", ventaId);
      alert("No se pudo registrar la venta:\n" + e2.message);
      setGuardando(false);
      await cargar();
      return;
    }
    await supabase.from("pago").insert([pagoRow]);

    setCarrito([]);
    setReferencia("");
    setGuardando(false);
    await cargar();
    alert("¡Venta registrada!");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900 dark:text-white">
        <Banknote className="h-6 w-6 text-emerald-600" />
        Caja
      </h1>
      <p className="mt-1 text-neutral-500">
        Toca los platos para venderlos. El inventario de platos listos baja solo.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        {/* Platos para vender */}
        <div className="md:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {platos.map((p) => {
              const disp = Number(p.cantidad_disponible ?? 0);
              return (
                <button
                  key={p.id}
                  onClick={() => agregar(p)}
                  className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-400 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-white">
                      {p.nombre}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Quedan: {disp}
                    </p>
                  </div>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    {cordoba(p.precio_venta)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Carrito */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="font-semibold text-neutral-900 dark:text-white">
            Venta actual
          </h2>

          {carrito.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-400">
              Toca un plato para agregarlo.
            </p>
          ) : (
            <>
              <ul className="mt-4 space-y-3">
                {carrito.map((i) => (
                  <li key={i.producto_id} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">
                        {i.nombre}
                      </span>
                      <button
                        onClick={() => cambiarCantidad(i.producto_id, -i.cantidad)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => cambiarCantidad(i.producto_id, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded border border-neutral-300 dark:border-neutral-700"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center">{i.cantidad}</span>
                        <button
                          onClick={() => cambiarCantidad(i.producto_id, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded border border-neutral-300 dark:border-neutral-700"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="font-medium">
                        {cordoba(i.precio * i.cantidad)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                <div className="mb-3 flex gap-2">
                  <button
                    onClick={() => setMetodo("efectivo")}
                    className={
                      "flex-1 rounded-lg border px-3 py-2 text-sm font-medium " +
                      (metodo === "efectivo"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400")
                    }
                  >
                    Efectivo
                  </button>
                  <button
                    onClick={() => setMetodo("transferencia")}
                    className={
                      "flex-1 rounded-lg border px-3 py-2 text-sm font-medium " +
                      (metodo === "transferencia"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400")
                    }
                  >
                    Transferencia
                  </button>
                </div>
                {metodo === "transferencia" && (
                  <input
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder="N° de referencia (opcional)"
                    className="mb-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                  />
                )}

                <div className="mb-3 flex items-center justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{cordoba(total)}</span>
                </div>
                <button
                  onClick={cobrar}
                  disabled={guardando}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {guardando ? "Registrando…" : "Cobrar"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Resumen del día (solo el dueño) */}
      {esAdmin(rol) && (
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <p className="text-xs text-neutral-500">Ventas de hoy</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {cordoba(ventasHoy.total)}
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs text-neutral-500"># de ventas hoy</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-white">
            {ventasHoy.n}
          </p>
        </div>
      </div>
      )}
    </div>
  );
}
