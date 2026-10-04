"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cordoba } from "@/lib/formato";
import { UtensilsCrossed } from "lucide-react";

type Plato = {
  id: string;
  nombre: string;
  disponible: boolean;
  precio_venta: number | null;
  costo: number | null;
  ganancia: number | null;
  margen_pct: number | null;
};

type IngredienteSimple = {
  id: string;
  nombre: string;
  tipo_costeo: "porcion" | "medida";
  unidad_base: string | null;
  costo_unitario_receta: number | null;
};

type LineaReceta = {
  ingrediente_id: string;
  cantidad: number;
  ingrediente: {
    nombre: string;
    tipo_costeo: "porcion" | "medida";
    unidad_base: string | null;
    costo_unitario_receta: number | null;
  } | null;
};

const ING_SELECT = "id, nombre, tipo_costeo, unidad_base, costo_unitario_receta";
const LINEA_SELECT =
  "ingrediente_id, cantidad, ingrediente(nombre, tipo_costeo, unidad_base, costo_unitario_receta)";

export default function PlatosPage() {
  const supabase = createClient();
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [recetas, setRecetas] = useState<Record<string, string>>({}); // producto_id -> receta_id
  const [ingredientes, setIngredientes] = useState<IngredienteSimple[]>([]);
  const [negocioId, setNegocioId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const [editId, setEditId] = useState<string | null>(null);
  const [editPrecio, setEditPrecio] = useState("");
  const [editNombre, setEditNombre] = useState("");

  const [expandido, setExpandido] = useState<string | null>(null);
  const [lineas, setLineas] = useState<LineaReceta[]>([]);
  const [aAgregar, setAAgregar] = useState("");

  const [nNombre, setNNombre] = useState("");
  const [nPrecio, setNPrecio] = useState("");

  const [imagenes, setImagenes] = useState<Record<string, string | null>>({});
  const [subiendo, setSubiendo] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const [{ data: pl }, { data: rec }, { data: ing }, { data: imgs }] =
      await Promise.all([
        supabase.from("vw_plato_costeo").select("*").order("nombre"),
        supabase.from("receta").select("id, producto_id"),
        supabase.from("ingrediente").select(ING_SELECT).eq("activo", true).order("nombre"),
        supabase.from("producto").select("id, imagen_url"),
      ]);
    setPlatos((pl as Plato[]) ?? []);
    const map: Record<string, string> = {};
    (rec ?? []).forEach((r: { id: string; producto_id: string }) => {
      map[r.producto_id] = r.id;
    });
    setRecetas(map);
    setIngredientes((ing as IngredienteSimple[]) ?? []);
    const im: Record<string, string | null> = {};
    (imgs as { id: string; imagen_url: string | null }[] ?? []).forEach((p) => {
      im[p.id] = p.imagen_url;
    });
    setImagenes(im);
    setCargando(false);
  }, [supabase]);

  async function subirFoto(platoId: string, file: File | null) {
    if (!file || !negocioId) return;
    setSubiendo(platoId);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const ruta = `${negocioId}/${platoId}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("platos")
      .upload(ruta, file, { upsert: true, contentType: file.type });
    if (upErr) {
      alert("No se pudo subir la foto: " + upErr.message);
      setSubiendo(null);
      return;
    }
    const { data } = supabase.storage.from("platos").getPublicUrl(ruta);
    const { error: updErr } = await supabase
      .from("producto")
      .update({ imagen_url: data.publicUrl })
      .eq("id", platoId);
    if (updErr) {
      alert("No se pudo guardar la foto: " + updErr.message);
      setSubiendo(null);
      return;
    }
    setSubiendo(null);
    await cargar();
  }

  async function quitarFoto(platoId: string) {
    if (!window.confirm("¿Quitar la foto de este plato?")) return;
    await supabase.from("producto").update({ imagen_url: null }).eq("id", platoId);
    await cargar();
  }

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: perfil } = await supabase
          .from("perfil")
          .select("negocio_id")
          .eq("id", userData.user.id)
          .single();
        setNegocioId(perfil?.negocio_id ?? null);
      }
      await cargar();
    })();
  }, [supabase, cargar]);

  function empezarEdicion(p: Plato) {
    setEditId(p.id);
    setEditNombre(p.nombre);
    setEditPrecio(String(p.precio_venta ?? ""));
  }

  async function guardarPlato(p: Plato) {
    const precio = parseFloat(editPrecio);
    if (!editNombre.trim() || isNaN(precio) || precio < 0) {
      alert("Revisa el nombre y el precio.");
      return;
    }
    const { error } = await supabase
      .from("producto")
      .update({ nombre: editNombre.trim(), precio })
      .eq("id", p.id);
    if (error) {
      alert("No se pudo guardar: " + error.message);
      return;
    }
    setEditId(null);
    await cargar();
  }

  async function eliminarPlato(p: Plato) {
    const ok = window.confirm(
      `¿Eliminar el plato "${p.nombre}"?\n\nYa no aparecerá en el menú ni en la caja. Las ventas anteriores se conservan.`,
    );
    if (!ok) return;
    const { error } = await supabase
      .from("producto")
      .update({ activo: false, disponible: false })
      .eq("id", p.id);
    if (error) {
      alert("No se pudo eliminar: " + error.message);
      return;
    }
    if (expandido === p.id) setExpandido(null);
    await cargar();
  }

  async function alternarDisponible(p: Plato) {
    const { error } = await supabase
      .from("producto")
      .update({ disponible: !p.disponible })
      .eq("id", p.id);
    if (error) {
      alert("No se pudo cambiar la disponibilidad: " + error.message);
      return;
    }
    await cargar();
  }

  async function cargarLineas(recetaId: string) {
    const { data } = await supabase
      .from("receta_ingrediente")
      .select(LINEA_SELECT)
      .eq("receta_id", recetaId);
    setLineas((data as unknown as LineaReceta[]) ?? []);
  }

  async function abrirReceta(platoId: string) {
    if (expandido === platoId) {
      setExpandido(null);
      return;
    }
    setExpandido(platoId);
    setAAgregar("");
    const recetaId = recetas[platoId];
    if (!recetaId) {
      setLineas([]);
      return;
    }
    await cargarLineas(recetaId);
  }

  async function agregarIngrediente(platoId: string) {
    const recetaId = recetas[platoId];
    if (!recetaId || !aAgregar) return;
    // porción -> 1 porción; medida -> arranca en 1 (el dueño pone las onzas reales)
    const { error } = await supabase
      .from("receta_ingrediente")
      .insert({ receta_id: recetaId, ingrediente_id: aAgregar, cantidad: 1 });
    if (error) {
      alert("No se pudo agregar (¿ya está en la receta?): " + error.message);
      return;
    }
    setAAgregar("");
    await cargarLineas(recetaId);
    setExpandido(platoId);
    await cargar(); // recalcular costo
  }

  async function cambiarCantidad(
    platoId: string,
    ingredienteId: string,
    valor: string,
  ) {
    const cantidad = parseFloat(valor);
    if (isNaN(cantidad) || cantidad <= 0) return;
    const recetaId = recetas[platoId];
    if (!recetaId) return;
    const { error } = await supabase
      .from("receta_ingrediente")
      .update({ cantidad })
      .eq("receta_id", recetaId)
      .eq("ingrediente_id", ingredienteId);
    if (error) {
      alert("No se pudo guardar la cantidad: " + error.message);
      return;
    }
    await cargarLineas(recetaId);
    await cargar();
  }

  async function quitarIngrediente(platoId: string, ingredienteId: string) {
    const recetaId = recetas[platoId];
    if (!recetaId) return;
    await supabase
      .from("receta_ingrediente")
      .delete()
      .eq("receta_id", recetaId)
      .eq("ingrediente_id", ingredienteId);
    await cargarLineas(recetaId);
    await cargar();
  }

  async function crearPlato(e: React.FormEvent) {
    e.preventDefault();
    const precio = parseFloat(nPrecio);
    if (!nNombre.trim() || isNaN(precio) || precio < 0) {
      alert("Completa el nombre y un precio válido.");
      return;
    }
    if (!negocioId) return;
    const { data: prod, error } = await supabase
      .from("producto")
      .insert({
        negocio_id: negocioId,
        nombre: nNombre.trim(),
        tipo: "comida",
        precio,
      })
      .select("id")
      .single();
    if (error) {
      alert("No se pudo crear el plato: " + error.message);
      return;
    }
    await supabase.from("receta").insert({ producto_id: prod!.id });
    setNNombre("");
    setNPrecio("");
    await cargar();
    // Abrir el plato recién creado para agregar ingredientes de una vez
    setExpandido(prod!.id);
    setLineas([]);
    setAAgregar("");
  }

  // Etiqueta de la unidad de cantidad según el tipo de ingrediente.
  function unidadCantidad(ing: IngredienteSimple | LineaReceta["ingrediente"]) {
    if (!ing) return "porción";
    return ing.tipo_costeo === "medida" ? (ing.unidad_base ?? "medida") : "porción";
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900 dark:text-white">
        <UtensilsCrossed className="h-6 w-6 text-emerald-600" />
        Platos y costeo
      </h1>
      <p className="mt-1 text-neutral-500">
        Así de fácil: <b>①</b> crea el plato con su precio · <b>②</b> agrégale sus
        ingredientes y la cantidad que lleva (los <b>por medida</b> se ponen en onzas) ·{" "}
        <b>③</b> el costo, la ganancia y el margen se calculan solos.
      </p>

      {/* Nuevo plato */}
      <form
        onSubmit={crearPlato}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Nuevo plato
          </label>
          <input
            value={nNombre}
            onChange={(e) => setNNombre(e.target.value)}
            placeholder="Nombre del plato"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-800"
          />
        </div>
        <input
          value={nPrecio}
          onChange={(e) => setNPrecio(e.target.value)}
          type="number"
          step="0.01"
          min="0"
          placeholder="Precio C$"
          className="w-32 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-800"
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Crear
        </button>
      </form>

      {/* Lista de platos */}
      <div className="mt-6 space-y-3">
        {cargando ? (
          <p className="text-neutral-400">Cargando…</p>
        ) : platos.length === 0 ? (
          <p className="text-neutral-400">Aún no hay platos. Crea el primero arriba.</p>
        ) : (
          platos.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="flex flex-wrap items-center gap-4 p-4">
                {/* Foto del plato */}
                <div className="flex flex-col items-center gap-1">
                  {imagenes[p.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imagenes[p.id]!}
                      alt={p.nombre}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-neutral-100 text-neutral-300 dark:bg-neutral-800">
                      <UtensilsCrossed className="h-6 w-6" />
                    </span>
                  )}
                  <label className="cursor-pointer text-[11px] font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                    {subiendo === p.id
                      ? "Subiendo…"
                      : imagenes[p.id]
                        ? "Cambiar"
                        : "Subir foto"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => subirFoto(p.id, e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {imagenes[p.id] && (
                    <button
                      onClick={() => quitarFoto(p.id)}
                      className="text-[11px] text-red-500 hover:underline"
                    >
                      Quitar
                    </button>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {editId === p.id ? (
                      <input
                        value={editNombre}
                        onChange={(e) => setEditNombre(e.target.value)}
                        className="rounded-md border border-neutral-300 px-2 py-1 text-sm font-semibold dark:border-neutral-700 dark:bg-neutral-800"
                      />
                    ) : (
                      <p className="font-semibold text-neutral-900 dark:text-white">
                        {p.nombre}
                      </p>
                    )}
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-xs font-medium " +
                        (p.disponible
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400")
                      }
                    >
                      {p.disponible ? "Disponible" : "Agotado"}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3">
                    <button
                      onClick={() => abrirReceta(p.id)}
                      className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      {expandido === p.id ? "Ocultar ingredientes" : "Ver ingredientes"}
                    </button>
                    <button
                      onClick={() => alternarDisponible(p)}
                      className="text-xs font-medium text-neutral-500 hover:underline"
                    >
                      {p.disponible ? "Marcar agotado" : "Marcar disponible"}
                    </button>
                    {editId === p.id ? (
                      <>
                        <button
                          onClick={() => guardarPlato(p)}
                          className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="text-xs font-medium text-neutral-500 hover:underline"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => empezarEdicion(p)}
                          className="text-xs font-medium text-neutral-500 hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => eliminarPlato(p)}
                          className="text-xs font-medium text-red-500 hover:underline"
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xs text-neutral-500">Costo</p>
                  <p className="font-medium text-neutral-700 dark:text-neutral-300">
                    {cordoba(p.costo)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-neutral-500">Precio venta</p>
                  {editId === p.id ? (
                    <input
                      value={editPrecio}
                      onChange={(e) => setEditPrecio(e.target.value)}
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-24 rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                    />
                  ) : (
                    <p className="font-medium text-neutral-900 dark:text-white">
                      {cordoba(p.precio_venta)}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <p className="text-xs text-neutral-500">Ganancia</p>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {cordoba(p.ganancia)}
                  </p>
                </div>

                <div className="w-16 text-right">
                  <p className="text-xs text-neutral-500">Margen</p>
                  <p className="font-semibold text-neutral-900 dark:text-white">
                    {p.margen_pct != null ? `${p.margen_pct}%` : "—"}
                  </p>
                </div>
              </div>

              {/* Ingredientes de la receta */}
              {expandido === p.id && (
                <div className="border-t border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
                  {lineas.length === 0 ? (
                    <p className="text-sm text-neutral-400">
                      Este plato no tiene ingredientes todavía.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {lineas.map((l) => {
                        const unit = Number(l.ingrediente?.costo_unitario_receta ?? 0);
                        const costoLinea = unit * Number(l.cantidad);
                        return (
                          <li
                            key={l.ingrediente_id}
                            className="flex flex-wrap items-center justify-between gap-2 text-sm"
                          >
                            <span className="font-medium text-neutral-700 dark:text-neutral-300">
                              {l.ingrediente?.nombre}
                            </span>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={Number(l.cantidad)}
                                onBlur={(e) =>
                                  cambiarCantidad(p.id, l.ingrediente_id, e.target.value)
                                }
                                className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                              />
                              <span className="w-16 text-neutral-500">
                                {unidadCantidad(l.ingrediente)}
                                {l.ingrediente?.tipo_costeo === "medida" ? "s" : ""}
                              </span>
                              <span className="w-20 text-right font-medium text-neutral-600 dark:text-neutral-400">
                                {cordoba(costoLinea)}
                              </span>
                              <button
                                onClick={() => quitarIngrediente(p.id, l.ingrediente_id)}
                                className="text-xs font-medium text-red-500 hover:underline"
                              >
                                Quitar
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="mt-3 flex gap-2">
                    <select
                      value={aAgregar}
                      onChange={(e) => setAAgregar(e.target.value)}
                      className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                    >
                      <option value="">Agregar ingrediente…</option>
                      {ingredientes.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nombre} ({cordoba(i.costo_unitario_receta)}/
                          {unidadCantidad(i)})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => agregarIngrediente(p.id)}
                      disabled={!aAgregar}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Agregar
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-neutral-400">
                    Tip: en ingredientes <b>por medida</b> (aceite, salsa) la cantidad son{" "}
                    <b>onzas por plato</b>. Puede ser distinta en cada plato.
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
