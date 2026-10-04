"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Trash2, PackageX } from "lucide-react";

type Ingrediente = {
  id: string;
  nombre: string;
  tipo_costeo: "porcion" | "medida";
  unidad_compra: string | null;
  unidad_base: string | null;
};
type Plato = { id: string; nombre: string; cantidad_disponible: number | null };

type MermaRow = {
  id: string;
  tipo: string;
  cantidad: number;
  motivo: string | null;
  created_at: string;
  ingrediente: { nombre: string; unidad_base: string | null; unidad_compra: string | null; tipo_costeo: string } | null;
  producto: { nombre: string } | null;
};

const MOTIVOS = [
  "Se dañó",
  "Se venció",
  "Se cayó o derramó",
  "Regalado (cortesía)",
  "Error de cocina",
  "Otro",
];

export default function MermasPage() {
  const supabase = createClient();
  const [negocioId, setNegocioId] = useState<string | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [historial, setHistorial] = useState<MermaRow[]>([]);

  const [tipo, setTipo] = useState<"ingrediente" | "plato">("ingrediente");
  const [itemId, setItemId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const [{ data: ing }, { data: pl }, { data: h }] = await Promise.all([
      supabase
        .from("ingrediente")
        .select("id, nombre, tipo_costeo, unidad_compra, unidad_base")
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("producto")
        .select("id, nombre, cantidad_disponible")
        .eq("tipo", "comida")
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("merma")
        .select(
          "id, tipo, cantidad, motivo, created_at, ingrediente(nombre, unidad_base, unidad_compra, tipo_costeo), producto(nombre)",
        )
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setIngredientes((ing as Ingrediente[]) ?? []);
    setPlatos((pl as Plato[]) ?? []);
    setHistorial((h as unknown as MermaRow[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        setUsuarioId(u.user.id);
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

  const ingSel = ingredientes.find((i) => i.id === itemId);
  const unidad =
    tipo === "plato"
      ? "platos"
      : ingSel
        ? ingSel.tipo_costeo === "medida"
          ? (ingSel.unidad_base ?? "onza") + "s"
          : (ingSel.unidad_compra ?? "")
        : "";

  async function guardar() {
    const c = parseFloat(cantidad);
    if (!itemId || isNaN(c) || c <= 0 || !negocioId) {
      alert("Elige qué se perdió y cuánto.");
      return;
    }
    setGuardando(true);
    const motivoFinal = nota.trim() ? `${motivo} — ${nota.trim()}` : motivo;
    const { error } = await supabase.from("merma").insert({
      negocio_id: negocioId,
      tipo,
      ingrediente_id: tipo === "ingrediente" ? itemId : null,
      producto_id: tipo === "plato" ? itemId : null,
      cantidad: c,
      motivo: motivoFinal,
      usuario_id: usuarioId,
    });
    setGuardando(false);
    if (error) {
      alert("No se pudo registrar: " + error.message);
      return;
    }
    setItemId("");
    setCantidad("");
    setNota("");
    setMotivo(MOTIVOS[0]);
    await cargar();
    alert("Merma registrada. Se bajó del inventario.");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900 dark:text-white">
        <Trash2 className="h-6 w-6 text-emerald-600" />
        Mermas
      </h1>
      <p className="mt-1 text-neutral-500">
        Anotá lo que se perdió sin venderse. Baja del inventario para que las cuentas
        queden reales.
      </p>

      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        {/* Tipo */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setTipo("ingrediente");
              setItemId("");
            }}
            className={
              "flex-1 rounded-lg border px-3 py-2 text-sm font-medium " +
              (tipo === "ingrediente"
                ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400")
            }
          >
            Ingrediente
          </button>
          <button
            onClick={() => {
              setTipo("plato");
              setItemId("");
            }}
            className={
              "flex-1 rounded-lg border px-3 py-2 text-sm font-medium " +
              (tipo === "plato"
                ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400")
            }
          >
            Plato listo
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <select
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 sm:col-span-2"
          >
            <option value="">
              {tipo === "ingrediente" ? "Elegir ingrediente…" : "Elegir plato…"}
            </option>
            {(tipo === "ingrediente" ? ingredientes : platos).map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
                {tipo === "plato" &&
                  ` (listos: ${Number((x as Plato).cantidad_disponible ?? 0)})`}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <input
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              type="number"
              step="0.01"
              min="0"
              placeholder="¿Cuánto?"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            />
            {unidad && <span className="whitespace-nowrap text-sm text-neutral-500">{unidad}</span>}
          </div>

          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          >
            {MOTIVOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Detalle (opcional)"
          className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        />

        <button
          onClick={guardar}
          disabled={guardando}
          className="mt-4 rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Registrar merma"}
        </button>
      </div>

      {/* Historial */}
      <h2 className="mt-8 font-semibold text-neutral-900 dark:text-white">
        Últimas mermas
      </h2>
      <div className="mt-3 space-y-2">
        {historial.length === 0 ? (
          <p className="text-sm text-neutral-400">Aún no hay mermas registradas.</p>
        ) : (
          historial.map((m) => {
            const nombre = m.ingrediente?.nombre ?? m.producto?.nombre ?? "—";
            const u =
              m.tipo === "plato"
                ? "platos"
                : m.ingrediente?.tipo_costeo === "medida"
                  ? (m.ingrediente?.unidad_base ?? "onza") + "s"
                  : (m.ingrediente?.unidad_compra ?? "");
            return (
              <div
                key={m.id}
                className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40">
                  <PackageX className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <p className="font-medium text-neutral-800 dark:text-neutral-200">
                    {Number(m.cantidad)} {u} de {nombre}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {m.motivo} ·{" "}
                    {new Date(m.created_at).toLocaleDateString("es-NI", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
