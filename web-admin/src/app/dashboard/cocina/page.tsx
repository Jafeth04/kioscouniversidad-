"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { encolar, nuevoId, guardarCache, leerCache } from "@/lib/offline";
import { ChefHat, Plus, Trash2, Scale, AlertTriangle } from "lucide-react";

type Plato = {
  id: string;
  nombre: string;
  cantidad_disponible: number | null;
};

type Linea = { producto_id: string; nombre: string; cantidad: number };

// Ingrediente "por porción" que consume una receta (para el bloqueo si falta).
type Consumo = {
  ingrediente_id: string;
  nombre: string;
  cantidad_receta: number;
  rendimiento: number;
  stock: number;
  unidad: string;
};

// Ingrediente "por medida" disponible (aceite, salsa…) para registrar consumo real.
type MedidaIng = {
  id: string;
  nombre: string;
  unidad_base: string;
  contenido_base: number;
  stockBase: number; // existencia en unidad base (onzas)
};

type Insumo = {
  ingrediente_id: string;
  nombre: string;
  unidad_base: string;
  cantidad_base: number;
  stockBase: number;
};

export default function CocinaPage() {
  const supabase = createClient();
  const [negocioId, setNegocioId] = useState<string | null>(null);
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [consumoPorPlato, setConsumoPorPlato] = useState<Record<string, Consumo[]>>({});
  const [medidaIngs, setMedidaIngs] = useState<MedidaIng[]>([]);
  const [cargando, setCargando] = useState(true);

  const [selPlato, setSelPlato] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);

  // consumo real de ingredientes por medida
  const [selInsumo, setSelInsumo] = useState("");
  const [cantInsumo, setCantInsumo] = useState("");
  const [insumos, setInsumos] = useState<Insumo[]>([]);

  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    // SIN internet: usamos lo guardado en el celular.
    if (!navigator.onLine) {
      const c = leerCache<{
        platos: Plato[];
        mapa: Record<string, Consumo[]>;
        medidaIngs: MedidaIng[];
      }>("cocina_datos", { platos: [], mapa: {}, medidaIngs: [] });
      setPlatos(c.platos);
      setConsumoPorPlato(c.mapa);
      setMedidaIngs(c.medidaIngs);
      setCargando(false);
      return;
    }
    const [{ data: pl }, { data: rec }, { data: med }] = await Promise.all([
      supabase
        .from("vw_plato_costeo")
        .select("id, nombre, cantidad_disponible")
        .order("nombre"),
      supabase
        .from("receta")
        .select(
          "producto_id, receta_ingrediente(cantidad, ingrediente(id, nombre, tipo_costeo, rendimiento, stock_actual, unidad_compra))",
        ),
      supabase
        .from("ingrediente")
        .select("id, nombre, unidad_base, contenido_base, stock_actual")
        .eq("tipo_costeo", "medida")
        .eq("activo", true)
        .order("nombre"),
    ]);
    setPlatos((pl as Plato[]) ?? []);

    // Mapa: plato -> ingredientes POR PORCIÓN que consume (para bloquear si faltan).
    const mapa: Record<string, Consumo[]> = {};
    type RecRow = {
      producto_id: string;
      receta_ingrediente: {
        cantidad: number;
        ingrediente: {
          id: string;
          nombre: string;
          tipo_costeo: "porcion" | "medida";
          rendimiento: number | null;
          stock_actual: number | null;
          unidad_compra: string | null;
        } | null;
      }[];
    };
    for (const r of (rec as unknown as RecRow[]) ?? []) {
      mapa[r.producto_id] = (r.receta_ingrediente ?? [])
        .filter((ri) => ri.ingrediente && ri.ingrediente.tipo_costeo === "porcion")
        .map((ri) => ({
          ingrediente_id: ri.ingrediente!.id,
          nombre: ri.ingrediente!.nombre,
          cantidad_receta: Number(ri.cantidad),
          rendimiento: Number(ri.ingrediente!.rendimiento ?? 0),
          stock: Number(ri.ingrediente!.stock_actual ?? 0),
          unidad: ri.ingrediente!.unidad_compra ?? "",
        }));
    }
    setConsumoPorPlato(mapa);

    const medsArr = ((med as {
      id: string;
      nombre: string;
      unidad_base: string | null;
      contenido_base: number | null;
      stock_actual: number | null;
    }[]) ?? []).map((m) => ({
      id: m.id,
      nombre: m.nombre,
      unidad_base: m.unidad_base ?? "onza",
      contenido_base: Number(m.contenido_base ?? 0),
      stockBase: Number(m.stock_actual ?? 0) * Number(m.contenido_base ?? 0),
    }));
    setMedidaIngs(medsArr);
    guardarCache("cocina_datos", {
      platos: (pl as Plato[]) ?? [],
      mapa,
      medidaIngs: medsArr,
    });
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

  function agregarLinea() {
    const p = platos.find((x) => x.id === selPlato);
    const c = parseFloat(cantidad);
    if (!p || isNaN(c) || c <= 0) {
      alert("Elige un plato y una cantidad válida.");
      return;
    }
    setLineas((prev) => [
      ...prev,
      { producto_id: p.id, nombre: p.nombre, cantidad: c },
    ]);
    setSelPlato("");
    setCantidad("");
  }

  function quitarLinea(i: number) {
    setLineas((prev) => prev.filter((_, idx) => idx !== i));
  }

  function agregarInsumo() {
    const ing = medidaIngs.find((m) => m.id === selInsumo);
    const c = parseFloat(cantInsumo);
    if (!ing || isNaN(c) || c <= 0) {
      alert("Elige un ingrediente y escribe cuántas onzas usaste.");
      return;
    }
    setInsumos((prev) => {
      // si ya está, suma la cantidad
      const ex = prev.find((x) => x.ingrediente_id === ing.id);
      if (ex) {
        return prev.map((x) =>
          x.ingrediente_id === ing.id
            ? { ...x, cantidad_base: x.cantidad_base + c }
            : x,
        );
      }
      return [
        ...prev,
        {
          ingrediente_id: ing.id,
          nombre: ing.nombre,
          unidad_base: ing.unidad_base,
          cantidad_base: c,
          stockBase: ing.stockBase,
        },
      ];
    });
    setSelInsumo("");
    setCantInsumo("");
  }

  function quitarInsumo(id: string) {
    setInsumos((prev) => prev.filter((x) => x.ingrediente_id !== id));
  }

  async function guardar() {
    if (lineas.length === 0 || !negocioId) {
      alert("Agrega al menos un plato que hayas cocinado.");
      return;
    }

    // Revisar SOLO los ingredientes por porción (esos sí bloquean si faltan).
    const necesidad: Record<
      string,
      { nombre: string; unidad: string; requerido: number; stock: number }
    > = {};
    for (const l of lineas) {
      for (const c of consumoPorPlato[l.producto_id] ?? []) {
        const consumo =
          c.rendimiento > 0 ? (c.cantidad_receta / c.rendimiento) * l.cantidad : 0;
        if (!necesidad[c.ingrediente_id]) {
          necesidad[c.ingrediente_id] = {
            nombre: c.nombre,
            unidad: c.unidad,
            requerido: 0,
            stock: c.stock,
          };
        }
        necesidad[c.ingrediente_id].requerido += consumo;
      }
    }
    const faltan = Object.values(necesidad).filter((n) => n.requerido > n.stock);
    if (faltan.length > 0) {
      const msg = faltan
        .map(
          (f) =>
            `• ${f.nombre}: necesitas ${f.requerido.toFixed(2)} ${f.unidad}, tienes ${f.stock.toFixed(2)}`,
        )
        .join("\n");
      alert(
        `No puedes cocinar esto todavía. Te faltan ingredientes:\n\n${msg}\n\nRegístralos primero en el Mercado.`,
      );
      return;
    }

    setGuardando(true);

    const prodId = nuevoId();
    const cabRow = { id: prodId, negocio_id: negocioId };
    const detalles = lineas.map((l) => ({
      produccion_id: prodId,
      producto_id: l.producto_id,
      cantidad: l.cantidad,
    }));
    const insumoRows = insumos.map((x) => ({
      produccion_id: prodId,
      ingrediente_id: x.ingrediente_id,
      cantidad_base: x.cantidad_base,
    }));
    const inserts = [
      { tabla: "produccion", filas: [cabRow] },
      { tabla: "produccion_detalle", filas: detalles },
      ...(insumoRows.length > 0
        ? [{ tabla: "produccion_insumo", filas: insumoRows }]
        : []),
    ];

    // SIN internet: se guarda y sube después.
    if (!navigator.onLine) {
      const totalPlatos = lineas.reduce((s, l) => s + l.cantidad, 0);
      encolar("produccion", `Cocina: ${totalPlatos} platos`, inserts);
      setLineas([]);
      setInsumos([]);
      setGuardando(false);
      alert("Producción guardada SIN internet. Se subirá sola cuando vuelva la señal.");
      return;
    }

    const { error: e1 } = await supabase.from("produccion").insert([cabRow]);
    if (e1) {
      alert("No se pudo guardar: " + e1.message);
      setGuardando(false);
      return;
    }
    const { error: e2 } = await supabase
      .from("produccion_detalle")
      .insert(detalles);
    if (e2) {
      await supabase.from("produccion").delete().eq("id", prodId);
      alert("No se pudo guardar la producción:\n" + e2.message);
      setGuardando(false);
      await cargar();
      return;
    }
    if (insumoRows.length > 0) {
      await supabase.from("produccion_insumo").insert(insumoRows);
    }

    setLineas([]);
    setInsumos([]);
    setGuardando(false);
    await cargar();
    alert("¡Producción registrada! Se gastaron los ingredientes y hay más platos listos.");
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900 dark:text-white">
        <ChefHat className="h-6 w-6 text-emerald-600" />
        Cocina
      </h1>
      <p className="mt-1 text-neutral-500">
        Registra lo que cocinaste. Se <b>descuentan los ingredientes</b> y se
        suman los <b>platos listos</b> para vender.
      </p>

      {/* Registrar producción */}
      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <p className="mb-3 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          ① ¿Qué cocinaste?
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <select
            value={selPlato}
            onChange={(e) => setSelPlato(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 sm:col-span-2"
          >
            <option value="">Elegir plato…</option>
            {platos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <input
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            type="number"
            step="1"
            min="0"
            placeholder="¿Cuántos hiciste?"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </div>
        <button
          onClick={agregarLinea}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
        >
          <Plus className="h-4 w-4" />
          Agregar
        </button>

        {lineas.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            {lineas.map((l, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-neutral-700 dark:text-neutral-300">
                  <b>{l.cantidad}</b> × {l.nombre}
                </span>
                <button
                  onClick={() => quitarLinea(i)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* ② Consumo real de ingredientes por medida */}
        <div className="mt-5 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            <Scale className="h-4 w-4 text-sky-600" />
            ② ¿Cuánto aceite, salsa… usaste? (opcional)
          </p>
          {medidaIngs.length === 0 ? (
            <p className="text-xs text-neutral-400">
              No tienes ingredientes “por medida” todavía. Marca el aceite o la salsa
              como “por medida” en la pantalla de Ingredientes y aquí podrás registrar
              cuánto usaste.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <select
                  value={selInsumo}
                  onChange={(e) => setSelInsumo(e.target.value)}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 sm:col-span-2"
                >
                  <option value="">Elegir ingrediente…</option>
                  {medidaIngs.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} (tienes ~{Math.round(m.stockBase)} {m.unidad_base}s)
                    </option>
                  ))}
                </select>
                <input
                  value={cantInsumo}
                  onChange={(e) => setCantInsumo(e.target.value)}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="¿Cuántas onzas?"
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                />
              </div>
              <button
                onClick={agregarInsumo}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-sky-500 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/40"
              >
                <Plus className="h-4 w-4" />
                Agregar lo que usé
              </button>

              {insumos.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {insumos.map((x) => {
                    const excede = x.cantidad_base > x.stockBase + 0.001;
                    return (
                      <li
                        key={x.ingrediente_id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-neutral-700 dark:text-neutral-300">
                          <b>{x.cantidad_base}</b> {x.unidad_base}s de {x.nombre}
                          {excede && (
                            <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3" />
                              más de lo que tienes (~{Math.round(x.stockBase)})
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => quitarInsumo(x.ingrediente_id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>

        {(lineas.length > 0 || insumos.length > 0) && (
          <button
            onClick={guardar}
            disabled={guardando}
            className="mt-5 w-full rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
          >
            {guardando ? "Guardando…" : "Registrar producción"}
          </button>
        )}
      </div>

      {/* Platos listos ahora */}
      <h2 className="mt-8 font-semibold text-neutral-900 dark:text-white">
        Platos listos ahora
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cargando ? (
          <p className="text-neutral-400">Cargando…</p>
        ) : (
          platos.map((p) => {
            const n = Number(p.cantidad_disponible ?? 0);
            return (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
              >
                <span className="font-medium text-neutral-900 dark:text-white">
                  {p.nombre}
                </span>
                <span
                  className={
                    "rounded-full px-2.5 py-0.5 text-sm font-bold " +
                    (n > 0
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : "bg-neutral-200 text-neutral-500 dark:bg-neutral-800")
                  }
                >
                  {n}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
