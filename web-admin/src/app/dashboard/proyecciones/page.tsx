"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  TrendingUp,
  TrendingDown,
  PartyPopper,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Pencil,
  RotateCcw,
  Plus,
  Trash2,
  CalendarDays,
  CalendarRange,
  Home,
  Users,
  Receipt,
  Banknote,
  UtensilsCrossed,
  Building2,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

type Gasto = { id: string; nombre: string; monto: number };
type Plato = { precio_venta: number | null; costo: number | null; ganancia: number | null };
type Otro = { nombre: string; monto: number };

const SEMANAS_MES = 4.33;
const TOTAL_PASOS = 5;
const FIJOS = ["Alquiler", "Salarios"]; // los que tienen su propia pregunta

function cordobaR(valor: number): string {
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: "NIO",
    maximumFractionDigits: 0,
  }).format(valor);
}

export default function ProyeccionesPage() {
  const supabase = createClient();
  const [gastosDB, setGastosDB] = useState<Gasto[]>([]);
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [negocioId, setNegocioId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const [paso, setPaso] = useState(0); // 0..4 preguntas, 5 resultado

  // respuestas
  const [vLV, setVLV] = useState("30");
  const [vSD, setVSD] = useState("100");
  const [gAlq, setGAlq] = useState("");
  const [gSal, setGSal] = useState("");
  const [otros, setOtros] = useState<Otro[]>([]);

  // inputs temporales para agregar un "otro" gasto
  const [oNombre, setONombre] = useState("");
  const [oMonto, setOMonto] = useState("");

  const cargar = useCallback(async () => {
    const [{ data: g }, { data: p }] = await Promise.all([
      supabase.from("gasto_fijo").select("id, nombre, monto").eq("activo", true).order("nombre"),
      supabase.from("vw_plato_costeo").select("precio_venta, costo, ganancia"),
    ]);
    const gs = (g as Gasto[]) ?? [];
    setGastosDB(gs);
    setPlatos((p as Plato[]) ?? []);

    const alq = gs.find((x) => x.nombre === "Alquiler")?.monto;
    const sal = gs.find((x) => x.nombre === "Salarios")?.monto;
    if (alq != null) setGAlq(String(alq));
    if (sal != null) setGSal(String(sal));
    setOtros(
      gs
        .filter((x) => !FIJOS.includes(x.nombre))
        .map((x) => ({ nombre: x.nombre, monto: Number(x.monto) })),
    );

    if (gs.length > 0) setPaso(TOTAL_PASOS);
    setCargando(false);
  }, [supabase]);

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

  // ---- cálculos ----
  const num = (s: string) => {
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  const conPrecio = platos.filter((p) => (p.precio_venta ?? 0) > 0);
  const prom = (f: (p: Plato) => number) =>
    conPrecio.length ? conPrecio.reduce((s, p) => s + f(p), 0) / conPrecio.length : 0;
  const precioProm = prom((p) => p.precio_venta ?? 0);
  const costoProm = prom((p) => p.costo ?? 0);
  const gananciaProm = prom((p) => p.ganancia ?? 0);

  const totalOtros = otros.reduce((s, o) => s + o.monto, 0);
  const platosMes = Math.round((num(vLV) * 5 + num(vSD) * 2) * SEMANAS_MES);
  const ingresos = platosMes * precioProm;
  const costoIngredientes = platosMes * costoProm;
  const totalGastos = num(gAlq) + num(gSal) + totalOtros;
  const utilidadNeta = ingresos - costoIngredientes - totalGastos;
  const equilibrioMes = gananciaProm > 0 ? Math.ceil(totalGastos / gananciaProm) : 0;
  const equilibrioDia = Math.ceil(equilibrioMes / (SEMANAS_MES * 7));
  const gana = utilidadNeta >= 0;
  const cubreGastos = platosMes >= equilibrioMes;

  // ---- guardar gastos ----
  async function sincronizarGastos() {
    if (!negocioId) return;
    for (const [nombre, monto] of [
      ["Alquiler", num(gAlq)],
      ["Salarios", num(gSal)],
    ] as [string, number][]) {
      const ex = gastosDB.find((x) => x.nombre === nombre);
      if (monto > 0) {
        if (ex) await supabase.from("gasto_fijo").update({ monto }).eq("id", ex.id);
        else await supabase.from("gasto_fijo").insert({ negocio_id: negocioId, nombre, monto });
      } else if (ex) {
        await supabase.from("gasto_fijo").delete().eq("id", ex.id);
      }
    }
    const otrosDB = gastosDB.filter((x) => !FIJOS.includes(x.nombre));
    for (const x of otrosDB) {
      await supabase.from("gasto_fijo").delete().eq("id", x.id);
    }
    const nuevos = otros.filter((o) => o.nombre.trim() && o.monto > 0);
    if (nuevos.length > 0) {
      await supabase.from("gasto_fijo").insert(
        nuevos.map((o) => ({ negocio_id: negocioId, nombre: o.nombre.trim(), monto: o.monto })),
      );
    }
    await cargar();
  }

  function agregarOtro() {
    const m = parseFloat(oMonto);
    if (!oNombre.trim() || isNaN(m) || m <= 0) {
      alert("Escribe el nombre del gasto y cuánto pagas (ej. Agua, 300).");
      return;
    }
    setOtros((prev) => [...prev, { nombre: oNombre.trim(), monto: m }]);
    setONombre("");
    setOMonto("");
  }
  function quitarOtro(i: number) {
    setOtros((prev) => prev.filter((_, idx) => idx !== i));
  }

  function siguiente() {
    if (paso < TOTAL_PASOS - 1) setPaso(paso + 1);
    else {
      sincronizarGastos();
      setPaso(TOTAL_PASOS);
    }
  }
  function atras() {
    if (paso > 0) setPaso(paso - 1);
  }

  if (cargando) return <p className="text-neutral-400">Cargando…</p>;

  // ---------- RESULTADO ----------
  if (paso >= TOTAL_PASOS) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900 dark:text-white">
          <TrendingUp className="h-6 w-6 text-emerald-600" />
          Tu resultado del mes
        </h1>
        <p className="mt-1 text-neutral-500">
          Esto es lo que te quedaría al mes con tus respuestas.
        </p>

        <div className="mt-5 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            <FilaCuenta
              icon={Banknote}
              colorIcono="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50"
              titulo="Entra por las ventas"
              subtitulo={`Venderías ~${platosMes.toLocaleString("es-NI")} platos`}
              valor={cordobaR(ingresos)}
              color="text-neutral-900 dark:text-white"
            />
            <FilaCuenta
              icon={UtensilsCrossed}
              colorIcono="text-amber-600 bg-amber-50 dark:bg-amber-950/40"
              titulo="Se va en ingredientes"
              subtitulo="Lo que cuesta hacer esos platos"
              valor={"− " + cordobaR(costoIngredientes)}
              color="text-neutral-500"
            />
            <FilaCuenta
              icon={Building2}
              colorIcono="text-sky-600 bg-sky-50 dark:bg-sky-950/40"
              titulo="Se va en gastos del local"
              subtitulo="Alquiler, salarios y otros"
              valor={"− " + cordobaR(totalGastos)}
              color="text-neutral-500"
            />
          </div>
          <div
            className={
              "flex items-center justify-between gap-3 px-5 py-4 text-white " +
              (gana ? "bg-emerald-600" : "bg-red-600")
            }
          >
            <div className="flex items-center gap-2">
              {gana ? (
                <PartyPopper className="h-6 w-6" />
              ) : (
                <AlertTriangle className="h-6 w-6" />
              )}
              <div>
                <p className="text-xs opacity-90">
                  {gana ? "Te queda a fin de mes" : "Estás perdiendo"}
                </p>
                <p className="text-sm font-medium opacity-90">
                  {gana ? "¡El negocio gana!" : "Sube precios o baja gastos"}
                </p>
              </div>
            </div>
            <p className="text-2xl font-extrabold">{cordobaR(utilidadNeta)}</p>
          </div>
        </div>

        {totalGastos > 0 && (
          <div
            className={
              "mt-5 flex items-start gap-3 rounded-2xl border p-5 text-sm " +
              (cubreGastos
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30"
                : "border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30")
            }
          >
            {cubreGastos ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <TrendingDown className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            )}
            <p className="text-neutral-700 dark:text-neutral-300">
              Para cubrir tus gastos necesitas vender{" "}
              <b>{equilibrioMes.toLocaleString("es-NI")} platos al mes</b> (≈{" "}
              <b>{equilibrioDia} por día</b>).{" "}
              {cubreGastos
                ? "Como vendés más que eso, ya te sobra."
                : "Todavía no llegás; vendé un poco más o bajá gastos."}
            </p>
          </div>
        )}

        <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <p className="mb-3 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            Tus respuestas
          </p>
          <ul className="space-y-1 text-sm">
            <Respuesta label="Platos por día (entre semana)" valor={`${num(vLV)} platos`} />
            <Respuesta label="Platos por día (fin de semana)" valor={`${num(vSD)} platos`} />
            <Respuesta label="Alquiler" valor={cordobaR(num(gAlq))} />
            <Respuesta label="Salarios" valor={cordobaR(num(gSal))} />
            {otros.map((o, i) => (
              <Respuesta key={i} label={o.nombre} valor={cordobaR(o.monto)} />
            ))}
          </ul>
          <button
            onClick={() => setPaso(0)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Pencil className="h-4 w-4" />
            Cambiar mis respuestas
          </button>
        </div>

        <p className="mt-4 text-xs text-neutral-400">
          Es un estimado con el promedio de tus platos (precio {cordobaR(precioProm)},
          ganancia {cordobaR(gananciaProm)} por plato).
        </p>
      </div>
    );
  }

  // ---------- PREGUNTAS SIMPLES (pasos 0-3) ----------
  const preguntas: {
    icon: LucideIcon;
    titulo: string;
    ayuda: string;
    valor: string;
    set: (v: string) => void;
    sufijo: string;
  }[] = [
    {
      icon: CalendarDays,
      titulo: "¿Cuántos platos vendés al día entre semana?",
      ayuda: "De lunes a viernes, más o menos. No tiene que ser exacto.",
      valor: vLV,
      set: setVLV,
      sufijo: "platos por día",
    },
    {
      icon: CalendarRange,
      titulo: "¿Y los fines de semana?",
      ayuda: "Sábado y domingo, platos por día.",
      valor: vSD,
      set: setVSD,
      sufijo: "platos por día",
    },
    {
      icon: Home,
      titulo: "¿Cuánto pagás de alquiler al mes?",
      ayuda: "El local. Si no pagás alquiler, dejá 0.",
      valor: gAlq,
      set: setGAlq,
      sufijo: "C$ al mes",
    },
    {
      icon: Users,
      titulo: "¿Cuánto pagás de salarios al mes?",
      ayuda: "Lo que les pagás a los trabajadores en total. Si trabajás solo, dejá 0.",
      valor: gSal,
      set: setGSal,
      sufijo: "C$ al mes",
    },
  ];

  const IconoPregunta = paso < 4 ? preguntas[paso].icon : Receipt;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900 dark:text-white">
        <TrendingUp className="h-6 w-6 text-emerald-600" />
        ¿Cuánto gano al mes?
      </h1>
      <p className="mt-1 text-neutral-500">
        Te hago unas preguntas rápidas y te digo cuánto ganarías.
      </p>

      {/* Progreso */}
      <div className="mt-6 flex items-center gap-1.5">
        {Array.from({ length: TOTAL_PASOS }).map((_, i) => (
          <div
            key={i}
            className={
              "h-1.5 flex-1 rounded-full " +
              (i <= paso ? "bg-emerald-500" : "bg-neutral-200 dark:bg-neutral-800")
            }
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-neutral-400">
        Pregunta {paso + 1} de {TOTAL_PASOS}
      </p>

      {/* Tarjeta de pregunta */}
      {paso < 4 ? (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <IconoPregunta className="h-6 w-6" />
          </span>
          <h2 className="mt-3 text-xl font-bold text-neutral-900 dark:text-white">
            {preguntas[paso].titulo}
          </h2>
          <p className="mt-1 text-sm text-neutral-500">{preguntas[paso].ayuda}</p>
          <div className="mt-5 flex items-center gap-3">
            <input
              autoFocus
              value={preguntas[paso].valor}
              onChange={(e) => preguntas[paso].set(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") siguiente();
              }}
              type="number"
              min="0"
              placeholder="0"
              className="w-40 rounded-xl border border-neutral-300 px-4 py-3 text-2xl font-bold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-700 dark:bg-neutral-800"
            />
            <span className="text-sm text-neutral-500">{preguntas[paso].sufijo}</span>
          </div>
        </div>
      ) : (
        // ---------- PASO 5: lista de otros gastos ----------
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <Receipt className="h-6 w-6" />
          </span>
          <h2 className="mt-3 text-xl font-bold text-neutral-900 dark:text-white">
            ¿Qué otros gastos fijos tenés al mes?
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Agregá cada uno: gas, agua, luz, internet, basura… Si no tenés más, tocá
            “Ver mi resultado”.
          </p>

          {otros.length > 0 && (
            <ul className="mt-4 space-y-2">
              {otros.map((o, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-950/40"
                >
                  <span className="text-neutral-700 dark:text-neutral-300">{o.nombre}</span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold text-neutral-900 dark:text-white">
                      {cordobaR(o.monto)}
                    </span>
                    <button
                      onClick={() => quitarOtro(i)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <input
              value={oNombre}
              onChange={(e) => setONombre(e.target.value)}
              placeholder="Nombre (ej. Agua)"
              className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            />
            <input
              value={oMonto}
              onChange={(e) => setOMonto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") agregarOtro();
              }}
              type="number"
              min="0"
              placeholder="C$"
              className="w-24 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            />
            <button
              onClick={agregarOtro}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-600 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          </div>

          {otros.length > 0 && (
            <div className="mt-4 flex justify-between border-t border-neutral-200 pt-3 text-sm font-semibold dark:border-neutral-800">
              <span className="text-neutral-700 dark:text-neutral-300">Suma de otros gastos</span>
              <span className="text-neutral-900 dark:text-white">{cordobaR(totalOtros)}</span>
            </div>
          )}
        </div>
      )}

      {/* Navegación */}
      <div className="mt-5 flex items-center justify-between">
        <button
          onClick={atras}
          disabled={paso === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Atrás
        </button>
        <button
          onClick={siguiente}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          {paso < TOTAL_PASOS - 1 ? "Siguiente" : "Ver mi resultado"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {paso === 0 && gastosDB.length > 0 && (
        <button
          onClick={() => setPaso(TOTAL_PASOS)}
          className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-neutral-400 hover:text-neutral-600"
        >
          <RotateCcw className="h-3 w-3" />
          Volver al resultado sin cambiar nada
        </button>
      )}
    </div>
  );
}

function FilaCuenta({
  icon: Icon,
  colorIcono,
  titulo,
  subtitulo,
  valor,
  color,
}: {
  icon: LucideIcon;
  colorIcono: string;
  titulo: string;
  subtitulo: string;
  valor: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <div className="flex items-center gap-3">
        <span className={"flex h-9 w-9 items-center justify-center rounded-lg " + colorIcono}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="font-medium text-neutral-800 dark:text-neutral-200">{titulo}</p>
          <p className="text-xs text-neutral-400">{subtitulo}</p>
        </div>
      </div>
      <p className={"text-lg font-bold " + color}>{valor}</p>
    </div>
  );
}

function Respuesta({ label, valor }: { label: string; valor: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium text-neutral-800 dark:text-neutral-200">{valor}</span>
    </li>
  );
}
