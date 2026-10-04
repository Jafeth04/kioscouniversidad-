"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  cordoba,
  UNIDADES_COMPRA,
  UNIDADES_BASE,
  sugerirContenidoBase,
} from "@/lib/formato";
import { esAdmin } from "@/lib/roles";
import { Carrot, Scale } from "lucide-react";

type Ingrediente = {
  id: string;
  nombre: string;
  tipo_costeo: "porcion" | "medida";
  unidad_compra: string | null;
  unidad_base: string | null;
  contenido_base: number | null;
  costo_compra: number | null;
  rendimiento: number | null;
  costo_unitario_receta: number | null;
  stock_actual: number | null;
  stock_minimo: number | null;
};

const SELECT =
  "id, nombre, tipo_costeo, unidad_compra, unidad_base, contenido_base, costo_compra, rendimiento, costo_unitario_receta, stock_actual, stock_minimo";

export default function IngredientesPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Ingrediente[]>([]);
  const [negocioId, setNegocioId] = useState<string | null>(null);
  const [rol, setRol] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const puedeEditar = esAdmin(rol);

  // edición en línea
  const [editId, setEditId] = useState<string | null>(null);
  const [editTipo, setEditTipo] = useState<"porcion" | "medida">("porcion");
  const [editPrecio, setEditPrecio] = useState("");
  const [editRinde, setEditRinde] = useState("");
  const [editUnidadBase, setEditUnidadBase] = useState("onza");
  const [editContenido, setEditContenido] = useState("");

  // alta
  const [nNombre, setNNombre] = useState("");
  const [nTipo, setNTipo] = useState<"porcion" | "medida">("porcion");
  const [nUnidad, setNUnidad] = useState<string>("unidad");
  const [nPrecio, setNPrecio] = useState("");
  const [nRinde, setNRinde] = useState("");
  const [nUnidadBase, setNUnidadBase] = useState("onza");
  const [nContenido, setNContenido] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from("ingrediente")
      .select(SELECT)
      .eq("activo", true)
      .order("nombre");
    if (error) setError(error.message);
    else setItems(data as Ingrediente[]);
    setCargando(false);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: perfil } = await supabase
          .from("perfil")
          .select("negocio_id, rol")
          .eq("id", userData.user.id)
          .single();
        setNegocioId(perfil?.negocio_id ?? null);
        setRol(perfil?.rol ?? null);
      }
      await cargar();
    })();
  }, [supabase, cargar]);

  // Autollenar el contenido sugerido en el alta cuando cambian unidades.
  function alCambiarUnidadAlta(uc: string) {
    setNUnidad(uc);
    if (nTipo === "medida") {
      const sug = sugerirContenidoBase(uc, nUnidadBase);
      if (sug != null) setNContenido(String(sug));
    }
  }
  function alCambiarUnidadBaseAlta(ub: string) {
    setNUnidadBase(ub);
    const sug = sugerirContenidoBase(nUnidad, ub);
    if (sug != null) setNContenido(String(sug));
  }

  function empezarEdicion(it: Ingrediente) {
    setEditId(it.id);
    setEditTipo(it.tipo_costeo);
    setEditPrecio(String(it.costo_compra ?? ""));
    setEditRinde(String(it.rendimiento ?? ""));
    setEditUnidadBase(it.unidad_base ?? "onza");
    setEditContenido(
      String(it.contenido_base ?? sugerirContenidoBase(it.unidad_compra, it.unidad_base ?? "onza") ?? ""),
    );
  }

  async function guardarEdicion(it: Ingrediente) {
    const nuevoPrecio = parseFloat(editPrecio);
    if (isNaN(nuevoPrecio) || nuevoPrecio < 0) {
      alert("Revisa el precio.");
      return;
    }

    const cambios: Record<string, unknown> = {
      costo_compra: nuevoPrecio,
      tipo_costeo: editTipo,
    };

    if (editTipo === "porcion") {
      const rinde = parseFloat(editRinde);
      if (isNaN(rinde) || rinde <= 0) {
        alert("El rendimiento debe ser mayor a 0.");
        return;
      }
      cambios.rendimiento = rinde;
    } else {
      const contenido = parseFloat(editContenido);
      if (isNaN(contenido) || contenido <= 0) {
        alert(`Indica cuántas ${editUnidadBase}s trae un ${it.unidad_compra ?? "envase"} (mayor a 0).`);
        return;
      }
      cambios.unidad_base = editUnidadBase;
      cambios.contenido_base = contenido;
    }

    const { error } = await supabase
      .from("ingrediente")
      .update(cambios)
      .eq("id", it.id);
    if (error) {
      alert("No se pudo guardar: " + error.message);
      return;
    }

    if (nuevoPrecio !== it.costo_compra) {
      await supabase.from("historial_precio_ingrediente").insert({
        ingrediente_id: it.id,
        unidad_compra: it.unidad_compra,
        costo_compra: nuevoPrecio,
      });
    }
    setEditId(null);
    await cargar();
  }

  // Reconteo: el dueño mide lo que le queda y el sistema ajusta el inventario.
  async function reconteo(it: Ingrediente) {
    const contenido = Number(it.contenido_base ?? 0);
    if (contenido <= 0) return;
    const txt = window.prompt(
      `¿Cuántas ${it.unidad_base} de "${it.nombre}" tienes ahora mismo? (mídelo y escribe el número)`,
    );
    if (txt == null) return;
    const base = parseFloat(txt);
    if (isNaN(base) || base < 0) {
      alert("Escribe un número válido.");
      return;
    }
    const nuevoStock = base / contenido; // pasa de unidad base a unidad de compra
    const { error } = await supabase
      .from("ingrediente")
      .update({ stock_actual: nuevoStock })
      .eq("id", it.id);
    if (error) {
      alert("No se pudo ajustar: " + error.message);
      return;
    }
    await cargar();
  }

  async function eliminarIngrediente(it: Ingrediente) {
    const ok = window.confirm(
      `¿Eliminar el ingrediente "${it.nombre}"?\n\nSe quitará de las recetas donde esté. Las compras anteriores se conservan.`,
    );
    if (!ok) return;
    // Quitarlo de cualquier receta para que no afecte costos.
    await supabase
      .from("receta_ingrediente")
      .delete()
      .eq("ingrediente_id", it.id);
    // Baja lógica (se conserva el historial de compras/precios).
    const { error } = await supabase
      .from("ingrediente")
      .update({ activo: false })
      .eq("id", it.id);
    if (error) {
      alert("No se pudo eliminar: " + error.message);
      return;
    }
    await cargar();
  }

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    const precio = parseFloat(nPrecio);
    if (!nNombre.trim() || isNaN(precio) || precio < 0) {
      alert("Completa el nombre y el precio.");
      return;
    }
    if (!negocioId) {
      alert("No se encontró el negocio del usuario.");
      return;
    }

    const fila: Record<string, unknown> = {
      negocio_id: negocioId,
      nombre: nNombre.trim(),
      tipo_costeo: nTipo,
      unidad_compra: nUnidad,
      costo_compra: precio,
    };

    if (nTipo === "porcion") {
      const rinde = parseFloat(nRinde);
      if (isNaN(rinde) || rinde <= 0) {
        alert("El rendimiento (cuántos platos rinde) debe ser mayor a 0.");
        return;
      }
      fila.rendimiento = rinde;
    } else {
      const contenido = parseFloat(nContenido);
      if (isNaN(contenido) || contenido <= 0) {
        alert(`Indica cuántas ${nUnidadBase}s trae un ${nUnidad} (mayor a 0).`);
        return;
      }
      fila.unidad_base = nUnidadBase;
      fila.contenido_base = contenido;
    }

    setGuardando(true);
    const { data, error } = await supabase
      .from("ingrediente")
      .insert(fila)
      .select("id")
      .single();
    if (error) {
      alert("No se pudo agregar: " + error.message);
      setGuardando(false);
      return;
    }
    await supabase.from("historial_precio_ingrediente").insert({
      ingrediente_id: data!.id,
      unidad_compra: nUnidad,
      costo_compra: precio,
    });
    setNNombre("");
    setNPrecio("");
    setNRinde("");
    setNContenido("");
    setNTipo("porcion");
    setNUnidad("unidad");
    setNUnidadBase("onza");
    setGuardando(false);
    await cargar();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900 dark:text-white">
        <Carrot className="h-6 w-6 text-emerald-600" />
        Ingredientes
      </h1>
      <p className="mt-1 text-neutral-500">
        Hay dos tipos: <b>por porción</b> (rinde X platos, como el tomate o el pollo) y{" "}
        <b>por medida</b> (se mide en onzas, como el aceite o la salsa). El costo se
        calcula solo y el precio es el <b>promedio</b> de tus compras.
      </p>

      {!puedeEditar && (
        <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3 text-sm text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-300">
          Estás viendo el inventario en modo <b>solo lectura</b>. Para cambiar precios o
          agregar ingredientes, pídeselo al dueño.
        </div>
      )}

      {/* Alta (solo dueño) */}
      {puedeEditar && (
      <form
        onSubmit={agregar}
        className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
      >
        <p className="mb-3 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          Agregar ingrediente
        </p>

        {/* Selector de tipo */}
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setNTipo("porcion")}
            className={
              "flex-1 rounded-lg border px-3 py-2 text-sm font-medium " +
              (nTipo === "porcion"
                ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400")
            }
          >
            Por porción (rinde X platos)
          </button>
          <button
            type="button"
            onClick={() => {
              setNTipo("medida");
              const sug = sugerirContenidoBase(nUnidad, nUnidadBase);
              if (sug != null && !nContenido) setNContenido(String(sug));
            }}
            className={
              "flex-1 rounded-lg border px-3 py-2 text-sm font-medium " +
              (nTipo === "medida"
                ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400")
            }
          >
            Por medida (onzas, ml…)
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            value={nNombre}
            onChange={(e) => setNNombre(e.target.value)}
            placeholder={nTipo === "medida" ? "Nombre (ej. Aceite)" : "Nombre (ej. Tomate)"}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-700 dark:bg-neutral-800 lg:col-span-2"
          />
          <select
            value={nUnidad}
            onChange={(e) => alCambiarUnidadAlta(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-800"
          >
            {UNIDADES_COMPRA.map((u) => (
              <option key={u} value={u}>
                se compra por {u}
              </option>
            ))}
          </select>
          <input
            value={nPrecio}
            onChange={(e) => setNPrecio(e.target.value)}
            type="number"
            step="0.01"
            min="0"
            placeholder={`Precio C$ (por ${nUnidad})`}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-800"
          />
        </div>

        {/* Campos según el tipo */}
        {nTipo === "porcion" ? (
          <div className="mt-3">
            <input
              value={nRinde}
              onChange={(e) => setNRinde(e.target.value)}
              type="number"
              step="0.01"
              min="0"
              placeholder="¿Cuántos platos rinde? (ej. 8)"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-800 sm:w-72"
            />
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              Un {nUnidad} trae
            </span>
            <input
              value={nContenido}
              onChange={(e) => setNContenido(e.target.value)}
              type="number"
              step="0.01"
              min="0"
              placeholder="128"
              className="w-24 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-800"
            />
            <select
              value={nUnidadBase}
              onChange={(e) => alCambiarUnidadBaseAlta(e.target.value)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-800"
            >
              {UNIDADES_BASE.map((u) => (
                <option key={u} value={u}>
                  {u}s
                </option>
              ))}
            </select>
            <span className="text-xs text-neutral-400">
              (galón ≈ 128 onzas, litro ≈ 34 onzas)
            </span>
          </div>
        )}

        <button
          type="submit"
          disabled={guardando}
          className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {guardando ? "Agregando…" : "Agregar"}
        </button>
      </form>
      )}

      {/* Tarjetas (celular) */}
      <div className="mt-6 space-y-3 md:hidden">
        {cargando ? (
          <p className="text-center text-neutral-400">Cargando…</p>
        ) : error ? (
          <p className="text-center text-red-500">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-center text-neutral-400">
            Aún no hay ingredientes. Agrega el primero arriba.
          </p>
        ) : (
          items.map((it) => {
            const editando = editId === it.id;
            const medida = it.tipo_costeo === "medida";
            const stock = Number(it.stock_actual ?? 0);
            const minimo = Number(it.stock_minimo ?? 0);
            const bajo = stock <= 0 || (minimo > 0 && stock <= minimo);
            const base = medida ? stock * Number(it.contenido_base ?? 0) : stock;
            const unidad = medida ? (it.unidad_base ?? "") : (it.unidad_compra ?? "");
            return (
              <div
                key={it.id}
                className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-white">
                    {it.nombre}
                    {medida && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                        <Scale className="h-3 w-3" />
                        medida
                      </span>
                    )}
                  </span>
                  <span
                    className={
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium " +
                      (bajo
                        ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300")
                    }
                  >
                    {base.toLocaleString("es-NI", { maximumFractionDigits: medida ? 0 : 2 })} {unidad}
                  </span>
                </div>

                {editando ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditTipo("porcion")}
                        className={
                          "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium " +
                          (editTipo === "porcion"
                            ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "border-neutral-300 text-neutral-500 dark:border-neutral-700")
                        }
                      >
                        Por porción
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditTipo("medida")}
                        className={
                          "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium " +
                          (editTipo === "medida"
                            ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "border-neutral-300 text-neutral-500 dark:border-neutral-700")
                        }
                      >
                        Por medida
                      </button>
                    </div>
                    <label className="block text-xs text-neutral-500">
                      Precio C$ (por {it.unidad_compra})
                      <input
                        value={editPrecio}
                        onChange={(e) => setEditPrecio(e.target.value)}
                        type="number"
                        step="0.01"
                        className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                      />
                    </label>
                    {editTipo === "porcion" ? (
                      <label className="block text-xs text-neutral-500">
                        ¿Cuántos platos rinde?
                        <input
                          value={editRinde}
                          onChange={(e) => setEditRinde(e.target.value)}
                          type="number"
                          step="0.01"
                          className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                        />
                      </label>
                    ) : (
                      <div className="flex items-end gap-2">
                        <label className="flex-1 text-xs text-neutral-500">
                          Un {it.unidad_compra} trae
                          <input
                            value={editContenido}
                            onChange={(e) => setEditContenido(e.target.value)}
                            type="number"
                            step="0.01"
                            className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                          />
                        </label>
                        <select
                          value={editUnidadBase}
                          onChange={(e) => setEditUnidadBase(e.target.value)}
                          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                        >
                          {UNIDADES_BASE.map((u) => (
                            <option key={u} value={u}>
                              {u}s
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => guardarEdicion(it)}
                        className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-neutral-500">Precio</p>
                        <p className="font-medium text-neutral-800 dark:text-neutral-200">
                          {cordoba(it.costo_compra)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">
                          {medida ? "Contenido" : "Rinde"}
                        </p>
                        <p className="font-medium text-neutral-800 dark:text-neutral-200">
                          {medida
                            ? `${Number(it.contenido_base ?? 0)} ${it.unidad_base ?? ""}s`
                            : `${it.rendimiento} platos`}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">
                          Costo /{medida ? (it.unidad_base ?? "medida") : "plato"}
                        </p>
                        <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {cordoba(it.costo_unitario_receta)}
                        </p>
                      </div>
                    </div>
                    {puedeEditar && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {medida && (
                          <button
                            onClick={() => reconteo(it)}
                            className="rounded-md border border-sky-300 px-3 py-1.5 text-xs font-medium text-sky-700 dark:border-sky-900/50 dark:text-sky-300"
                          >
                            Ajustar
                          </button>
                        )}
                        <button
                          onClick={() => empezarEdicion(it)}
                          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => eliminarIngrediente(it)}
                          className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 dark:border-red-900/50 dark:text-red-400"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Tabla (tablet / PC) */}
      <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800">
            <tr>
              <th className="px-4 py-3 font-medium">Ingrediente</th>
              <th className="px-4 py-3 font-medium">Se compra por</th>
              <th className="px-4 py-3 font-medium">Precio</th>
              <th className="px-4 py-3 font-medium">Rinde / contenido</th>
              <th className="px-4 py-3 font-medium">Costo</th>
              <th className="px-4 py-3 font-medium">Tienes</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-neutral-400">
                  Cargando…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-red-500">
                  {error}
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-neutral-400">
                  Aún no hay ingredientes. Agrega el primero arriba.
                </td>
              </tr>
            ) : (
              items.map((it) => {
                const editando = editId === it.id;
                const medida = it.tipo_costeo === "medida";
                return (
                  <tr
                    key={it.id}
                    className="border-b border-neutral-100 last:border-0 dark:border-neutral-800"
                  >
                    <td className="px-4 py-3 font-medium text-neutral-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        {it.nombre}
                        {medida && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                            <Scale className="h-3 w-3" />
                            por medida
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{it.unidad_compra}</td>
                    <td className="px-4 py-3">
                      {editando ? (
                        <input
                          value={editPrecio}
                          onChange={(e) => setEditPrecio(e.target.value)}
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-24 rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                        />
                      ) : (
                        cordoba(it.costo_compra)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editando ? (
                        editTipo === "porcion" ? (
                          <input
                            value={editRinde}
                            onChange={(e) => setEditRinde(e.target.value)}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="platos"
                            className="w-24 rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                          />
                        ) : (
                          <div className="flex items-center gap-1">
                            <input
                              value={editContenido}
                              onChange={(e) => setEditContenido(e.target.value)}
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                            />
                            <select
                              value={editUnidadBase}
                              onChange={(e) => setEditUnidadBase(e.target.value)}
                              className="rounded-md border border-neutral-300 px-1 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                            >
                              {UNIDADES_BASE.map((u) => (
                                <option key={u} value={u}>
                                  {u}s
                                </option>
                              ))}
                            </select>
                          </div>
                        )
                      ) : medida ? (
                        `${Number(it.contenido_base ?? 0)} ${it.unidad_base ?? ""}s`
                      ) : (
                        `${it.rendimiento} platos`
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-700 dark:text-emerald-400">
                      {cordoba(it.costo_unitario_receta)}
                      <span className="ml-1 text-xs font-normal text-neutral-400">
                        /{medida ? (it.unidad_base ?? "medida") : "plato"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const stock = Number(it.stock_actual ?? 0);
                        const minimo = Number(it.stock_minimo ?? 0);
                        const bajo = stock <= 0 || (minimo > 0 && stock <= minimo);
                        const base = medida
                          ? stock * Number(it.contenido_base ?? 0)
                          : stock;
                        const unidad = medida
                          ? (it.unidad_base ?? "")
                          : (it.unidad_compra ?? "");
                        return (
                          <span
                            className={
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium " +
                              (bajo
                                ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300")
                            }
                          >
                            {base.toLocaleString("es-NI", {
                              maximumFractionDigits: medida ? 0 : 2,
                            })}{" "}
                            {unidad}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!puedeEditar ? (
                        <span className="text-xs text-neutral-300 dark:text-neutral-600">—</span>
                      ) : editando ? (
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setEditTipo("porcion")}
                              className={
                                "rounded-md border px-2 py-1 text-xs " +
                                (editTipo === "porcion"
                                  ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "border-neutral-300 text-neutral-500 dark:border-neutral-700")
                              }
                            >
                              porción
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditTipo("medida");
                                if (!editContenido) {
                                  const sug = sugerirContenidoBase(it.unidad_compra, editUnidadBase);
                                  if (sug != null) setEditContenido(String(sug));
                                }
                              }}
                              className={
                                "rounded-md border px-2 py-1 text-xs " +
                                (editTipo === "medida"
                                  ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "border-neutral-300 text-neutral-500 dark:border-neutral-700")
                              }
                            >
                              medida
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => guardarEdicion(it)}
                              className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={() => setEditId(null)}
                              className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          {medida && (
                            <button
                              onClick={() => reconteo(it)}
                              title="Medir lo que te queda y ajustar el inventario"
                              className="rounded-md border border-sky-300 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50 dark:border-sky-900/50 dark:text-sky-300 dark:hover:bg-sky-950/40"
                            >
                              Ajustar
                            </button>
                          )}
                          <button
                            onClick={() => empezarEdicion(it)}
                            className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => eliminarIngrediente(it)}
                            className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
