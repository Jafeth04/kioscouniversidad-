"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cordoba } from "@/lib/formato";
import { encolar, nuevoId, guardarCache, leerCache } from "@/lib/offline";
import { ShoppingCart, Trash2, Plus } from "lucide-react";

type Ingrediente = {
  id: string;
  nombre: string;
  unidad_compra: string | null;
  costo_compra: number | null;
};

type Linea = {
  ingrediente_id: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  costo_unitario: number;
};

type Compra = { id: string; fecha: string; total: number; nota: string | null };

export default function MercadoPage() {
  const supabase = createClient();
  const [negocioId, setNegocioId] = useState<string | null>(null);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [cargando, setCargando] = useState(true);

  // línea en edición
  const [selIng, setSelIng] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costo, setCosto] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    // SIN internet: usamos los ingredientes guardados en el celular.
    if (!navigator.onLine) {
      setIngredientes(leerCache<Ingrediente[]>("mercado_ingredientes", []));
      setCompras([]);
      setCargando(false);
      return;
    }
    const [{ data: ing }, { data: comp }] = await Promise.all([
      supabase
        .from("ingrediente")
        .select("id, nombre, unidad_compra, costo_compra")
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("compra_mercado")
        .select("id, fecha, total, nota")
        .order("fecha", { ascending: false })
        .limit(15),
    ]);
    const ings = (ing as Ingrediente[]) ?? [];
    setIngredientes(ings);
    guardarCache("mercado_ingredientes", ings);
    setCompras((comp as Compra[]) ?? []);
    setCargando(false);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data: sesion } = await supabase.auth.getSession();
      const user = sesion.session?.user;
      if (user) {
        if (navigator.onLine) {
          const { data: perfil } = await supabase
            .from("perfil")
            .select("negocio_id")
            .eq("id", user.id)
            .single();
          const neg = perfil?.negocio_id ?? null;
          setNegocioId(neg);
          guardarCache("negocio_id", neg);
        } else {
          setNegocioId(leerCache<string | null>("negocio_id", null));
        }
      }
      await cargar();
    })();
  }, [supabase, cargar]);

  // Al elegir ingrediente, prellenar el costo con el precio actual
  function elegirIngrediente(id: string) {
    setSelIng(id);
    const ing = ingredientes.find((i) => i.id === id);
    setCosto(ing?.costo_compra != null ? String(ing.costo_compra) : "");
  }

  function agregarLinea() {
    const ing = ingredientes.find((i) => i.id === selIng);
    const c = parseFloat(cantidad);
    const u = parseFloat(costo);
    if (!ing || isNaN(c) || c <= 0 || isNaN(u) || u < 0) {
      alert("Elige un ingrediente y pon una cantidad y un costo válidos.");
      return;
    }
    setLineas((prev) => [
      ...prev,
      {
        ingrediente_id: ing.id,
        nombre: ing.nombre,
        unidad: ing.unidad_compra ?? "",
        cantidad: c,
        costo_unitario: u,
      },
    ]);
    setSelIng("");
    setCantidad("");
    setCosto("");
  }

  function quitarLinea(i: number) {
    setLineas((prev) => prev.filter((_, idx) => idx !== i));
  }

  const total = lineas.reduce((s, l) => s + l.cantidad * l.costo_unitario, 0);

  async function guardarCompra() {
    if (lineas.length === 0 || !negocioId) {
      alert("Agrega al menos un producto a la compra.");
      return;
    }
    setGuardando(true);

    const compraId = nuevoId();
    const cabRow = {
      id: compraId,
      negocio_id: negocioId,
      total,
      nota: nota.trim() || null,
    };
    const detalles = lineas.map((l) => ({
      compra_id: compraId,
      ingrediente_id: l.ingrediente_id,
      cantidad: l.cantidad,
      costo_unitario: l.costo_unitario,
      subtotal: l.cantidad * l.costo_unitario,
    }));
    const inserts = [
      { tabla: "compra_mercado", filas: [cabRow] },
      { tabla: "compra_mercado_detalle", filas: detalles },
    ];

    // SIN internet: se guarda y sube después (el promedio se recalcula al sincronizar).
    if (!navigator.onLine) {
      encolar("compra", `Compra ${cordoba(total)}`, inserts);
      setLineas([]);
      setNota("");
      setGuardando(false);
      alert("Compra guardada SIN internet. Se subirá sola cuando vuelva la señal.");
      return;
    }

    const { error: e1 } = await supabase.from("compra_mercado").insert([cabRow]);
    if (e1) {
      alert("No se pudo guardar la compra: " + e1.message);
      setGuardando(false);
      return;
    }
    const { error: e2 } = await supabase
      .from("compra_mercado_detalle")
      .insert(detalles);
    if (e2) {
      await supabase.from("compra_mercado").delete().eq("id", compraId);
      alert("No se pudieron guardar los productos: " + e2.message);
      setGuardando(false);
      return;
    }

    // El trigger ya subió el stock y recalculó el COSTO PROMEDIO de cada ingrediente.
    // Leemos el nuevo costo promedio para mostrárselo al dueño.
    const ids = lineas.map((l) => l.ingrediente_id);
    const { data: actualizados } = await supabase
      .from("ingrediente")
      .select("id, nombre, costo_compra, unidad_compra")
      .in("id", ids);
    const resumen = (actualizados ?? [])
      .map(
        (i: { nombre: string; costo_compra: number | null; unidad_compra: string | null }) =>
          `• ${i.nombre}: ahora ${cordoba(i.costo_compra)} por ${i.unidad_compra ?? "unidad"} (promedio)`,
      )
      .join("\n");

    setLineas([]);
    setNota("");
    setGuardando(false);
    await cargar();
    alert(
      `¡Compra registrada! El inventario subió y el costo se promedió solo.\n\n${resumen}`,
    );
  }

  // Total gastado este mes
  const ahora = new Date();
  const totalMes = compras
    .filter((c) => {
      const d = new Date(c.fecha);
      return (
        d.getMonth() === ahora.getMonth() &&
        d.getFullYear() === ahora.getFullYear()
      );
    })
    .reduce((s, c) => s + Number(c.total), 0);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900 dark:text-white">
        <ShoppingCart className="h-6 w-6 text-emerald-600" />
        Mercado
      </h1>
      <p className="mt-1 text-neutral-500">
        Registra lo que compraste. El inventario <b>sube</b> solo y el precio del
        ingrediente se <b>promedia</b> con lo que ya tenías (costo promedio).
      </p>

      {/* Armar compra */}
      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <p className="mb-3 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          Nueva compra
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={selIng}
            onChange={(e) => elegirIngrediente(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 lg:col-span-2"
          >
            <option value="">Elegir ingrediente…</option>
            {ingredientes.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre} ({i.unidad_compra})
              </option>
            ))}
          </select>
          <input
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            type="number"
            step="0.01"
            min="0"
            placeholder="Cantidad"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
          <input
            value={costo}
            onChange={(e) => setCosto(e.target.value)}
            type="number"
            step="0.01"
            min="0"
            placeholder="Costo por unidad C$"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </div>
        <button
          onClick={agregarLinea}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
        >
          <Plus className="h-4 w-4" />
          Agregar a la compra
        </button>

        {/* Líneas */}
        {lineas.length > 0 && (
          <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <ul className="space-y-2">
              {lineas.map((l, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-neutral-700 dark:text-neutral-300">
                    {l.cantidad} {l.unidad} de <b>{l.nombre}</b> ×{" "}
                    {cordoba(l.costo_unitario)}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-medium">
                      {cordoba(l.cantidad * l.costo_unitario)}
                    </span>
                    <button
                      onClick={() => quitarLinea(i)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>

            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Nota (opcional, ej. 'Mercado Oriental')"
              className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            />

            <div className="mt-4 flex items-center justify-between">
              <span className="text-lg font-bold">
                Total: {cordoba(total)}
              </span>
              <button
                onClick={guardarCompra}
                disabled={guardando}
                className="rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {guardando ? "Guardando…" : "Guardar compra"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Historial */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <p className="text-xs text-neutral-500">Gastado este mes</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {cordoba(totalMes)}
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Nota</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-neutral-400">
                  Cargando…
                </td>
              </tr>
            ) : compras.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-neutral-400">
                  Aún no hay compras registradas.
                </td>
              </tr>
            ) : (
              compras.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-neutral-100 last:border-0 dark:border-neutral-800"
                >
                  <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                    {new Date(c.fecha).toLocaleDateString("es-NI")}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{c.nota ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {cordoba(c.total)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
