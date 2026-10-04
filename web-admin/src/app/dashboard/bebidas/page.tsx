"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cordoba } from "@/lib/formato";
import { CupSoda } from "lucide-react";

type Bebida = {
  id: string;
  nombre: string;
  precio: number | null;
  costo: number | null;
  cantidad_disponible: number | null;
  disponible: boolean;
};

export default function BebidasPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Bebida[]>([]);
  const [negocioId, setNegocioId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  // alta
  const [nNombre, setNNombre] = useState("");
  const [nPrecio, setNPrecio] = useState("");
  const [nCosto, setNCosto] = useState("");
  const [nStock, setNStock] = useState("");
  const [guardando, setGuardando] = useState(false);

  // edición
  const [editId, setEditId] = useState<string | null>(null);
  const [ePrecio, setEPrecio] = useState("");
  const [eCosto, setECosto] = useState("");

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from("producto")
      .select("id, nombre, precio, costo, cantidad_disponible, disponible")
      .eq("tipo", "empaquetado")
      .eq("activo", true)
      .order("nombre");
    setItems((data as Bebida[]) ?? []);
    setCargando(false);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { data: perfil } = await supabase
          .from("perfil")
          .select("negocio_id")
          .eq("id", u.user.id)
          .single();
        setNegocioId(perfil?.negocio_id ?? null);
      }
      await cargar();
    })();
  }, [supabase, cargar]);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    const precio = parseFloat(nPrecio);
    const costo = parseFloat(nCosto);
    const stock = nStock ? parseFloat(nStock) : 0;
    if (!nNombre.trim() || isNaN(precio) || precio < 0 || isNaN(costo) || costo < 0) {
      alert("Completa el nombre, el precio y el costo.");
      return;
    }
    if (!negocioId) return;
    setGuardando(true);
    const { error } = await supabase.from("producto").insert({
      negocio_id: negocioId,
      nombre: nNombre.trim(),
      tipo: "empaquetado",
      precio,
      costo,
      cantidad_disponible: isNaN(stock) ? 0 : stock,
      disponible: true,
    });
    setGuardando(false);
    if (error) {
      alert("No se pudo agregar: " + error.message);
      return;
    }
    setNNombre("");
    setNPrecio("");
    setNCosto("");
    setNStock("");
    await cargar();
  }

  function empezarEdicion(b: Bebida) {
    setEditId(b.id);
    setEPrecio(String(b.precio ?? ""));
    setECosto(String(b.costo ?? ""));
  }

  async function guardarEdicion(b: Bebida) {
    const precio = parseFloat(ePrecio);
    const costo = parseFloat(eCosto);
    if (isNaN(precio) || precio < 0 || isNaN(costo) || costo < 0) {
      alert("Revisa el precio y el costo.");
      return;
    }
    await supabase.from("producto").update({ precio, costo }).eq("id", b.id);
    setEditId(null);
    await cargar();
  }

  async function agregarStock(b: Bebida) {
    const txt = window.prompt(`¿Cuántas "${b.nombre}" compraste? (se suman al inventario)`);
    if (txt == null) return;
    const n = parseFloat(txt);
    if (isNaN(n) || n <= 0) {
      alert("Escribe un número válido.");
      return;
    }
    const nuevo = Number(b.cantidad_disponible ?? 0) + n;
    await supabase.from("producto").update({ cantidad_disponible: nuevo }).eq("id", b.id);
    await cargar();
  }

  async function alternarDisponible(b: Bebida) {
    await supabase.from("producto").update({ disponible: !b.disponible }).eq("id", b.id);
    await cargar();
  }

  async function eliminar(b: Bebida) {
    if (!window.confirm(`¿Eliminar "${b.nombre}"? Ya no aparecerá para vender.`)) return;
    await supabase.from("producto").update({ activo: false, disponible: false }).eq("id", b.id);
    await cargar();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900 dark:text-white">
        <CupSoda className="h-6 w-6 text-emerald-600" />
        Bebidas y productos
      </h1>
      <p className="mt-1 text-neutral-500">
        Lo que comprás ya hecho y revendés (gaseosas, energizantes, agua…). Se venden en
        la Caja y bajan del inventario solos.
      </p>

      {/* Alta */}
      <form
        onSubmit={agregar}
        className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
      >
        <p className="mb-3 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          Agregar bebida
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            value={nNombre}
            onChange={(e) => setNNombre(e.target.value)}
            placeholder="Nombre (ej. Coca-Cola)"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-800"
          />
          <input
            value={nCosto}
            onChange={(e) => setNCosto(e.target.value)}
            type="number"
            step="0.01"
            min="0"
            placeholder="Costo C$ (lo que pagás)"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-800"
          />
          <input
            value={nPrecio}
            onChange={(e) => setNPrecio(e.target.value)}
            type="number"
            step="0.01"
            min="0"
            placeholder="Precio C$ (de venta)"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-800"
          />
          <input
            value={nStock}
            onChange={(e) => setNStock(e.target.value)}
            type="number"
            step="1"
            min="0"
            placeholder="¿Cuántas tenés? (opcional)"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-800"
          />
        </div>
        <button
          type="submit"
          disabled={guardando}
          className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {guardando ? "Agregando…" : "Agregar"}
        </button>
      </form>

      {/* Tarjetas (celular) */}
      <div className="mt-6 space-y-3 md:hidden">
        {cargando ? (
          <p className="text-center text-neutral-400">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="text-center text-neutral-400">
            Aún no hay bebidas. Agrega la primera arriba.
          </p>
        ) : (
          items.map((b) => {
            const editando = editId === b.id;
            const stock = Number(b.cantidad_disponible ?? 0);
            const ganancia = Number(b.precio ?? 0) - Number(b.costo ?? 0);
            return (
              <div
                key={b.id}
                className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-white">
                    {b.nombre}
                    {!b.disponible && (
                      <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800">
                        agotado
                      </span>
                    )}
                  </span>
                  <span
                    className={
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium " +
                      (stock <= 0
                        ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300")
                    }
                  >
                    Quedan {stock}
                  </span>
                </div>

                {editando ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="text-xs text-neutral-500">
                      Costo C$
                      <input
                        value={eCosto}
                        onChange={(e) => setECosto(e.target.value)}
                        type="number"
                        step="0.01"
                        className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                      />
                    </label>
                    <label className="text-xs text-neutral-500">
                      Precio C$
                      <input
                        value={ePrecio}
                        onChange={(e) => setEPrecio(e.target.value)}
                        type="number"
                        step="0.01"
                        className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                      />
                    </label>
                    <div className="col-span-2 flex gap-2">
                      <button
                        onClick={() => guardarEdicion(b)}
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
                        <p className="text-xs text-neutral-500">Costo</p>
                        <p className="font-medium text-neutral-800 dark:text-neutral-200">
                          {cordoba(b.costo)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">Precio</p>
                        <p className="font-medium text-neutral-800 dark:text-neutral-200">
                          {cordoba(b.precio)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">Ganancia</p>
                        <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {cordoba(ganancia)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => agregarStock(b)}
                        className="rounded-md border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/50 dark:text-emerald-300"
                      >
                        + Stock
                      </button>
                      <button
                        onClick={() => empezarEdicion(b)}
                        className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => alternarDisponible(b)}
                        className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
                      >
                        {b.disponible ? "Agotar" : "Activar"}
                      </button>
                      <button
                        onClick={() => eliminar(b)}
                        className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 dark:border-red-900/50 dark:text-red-400"
                      >
                        Eliminar
                      </button>
                    </div>
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
              <th className="px-4 py-3 font-medium">Bebida</th>
              <th className="px-4 py-3 font-medium">Costo</th>
              <th className="px-4 py-3 font-medium">Precio</th>
              <th className="px-4 py-3 font-medium">Ganancia</th>
              <th className="px-4 py-3 font-medium">Quedan</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                  Cargando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                  Aún no hay bebidas. Agrega la primera arriba.
                </td>
              </tr>
            ) : (
              items.map((b) => {
                const editando = editId === b.id;
                const stock = Number(b.cantidad_disponible ?? 0);
                const ganancia = Number(b.precio ?? 0) - Number(b.costo ?? 0);
                return (
                  <tr
                    key={b.id}
                    className="border-b border-neutral-100 last:border-0 dark:border-neutral-800"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-medium text-neutral-900 dark:text-white">
                        {b.nombre}
                        {!b.disponible && (
                          <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800">
                            agotado
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {editando ? (
                        <input
                          value={eCosto}
                          onChange={(e) => setECosto(e.target.value)}
                          type="number"
                          step="0.01"
                          className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                        />
                      ) : (
                        cordoba(b.costo)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editando ? (
                        <input
                          value={ePrecio}
                          onChange={(e) => setEPrecio(e.target.value)}
                          type="number"
                          step="0.01"
                          className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                        />
                      ) : (
                        cordoba(b.precio)
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-700 dark:text-emerald-400">
                      {cordoba(ganancia)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                          (stock <= 0
                            ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300")
                        }
                      >
                        {stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editando ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => guardarEdicion(b)}
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
                      ) : (
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            onClick={() => agregarStock(b)}
                            className="rounded-md border border-emerald-300 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                          >
                            + Stock
                          </button>
                          <button
                            onClick={() => empezarEdicion(b)}
                            className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => alternarDisponible(b)}
                            className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
                          >
                            {b.disponible ? "Agotar" : "Activar"}
                          </button>
                          <button
                            onClick={() => eliminar(b)}
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
