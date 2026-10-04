"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cordoba } from "@/lib/formato";
import { Calculator, CheckCircle2, AlertTriangle } from "lucide-react";

type Cierre = {
  fecha: string;
  efectivo_esperado: number;
  efectivo_contado: number;
  diferencia: number;
};

function hoyISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export default function CierrePage() {
  const supabase = createClient();
  const [negocioId, setNegocioId] = useState<string | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);

  const [fecha, setFecha] = useState(hoyISO());
  const [ventasEfectivo, setVentasEfectivo] = useState(0);
  const [ventasTransf, setVentasTransf] = useState(0);
  const [totalVentas, setTotalVentas] = useState(0);
  const [numVentas, setNumVentas] = useState(0);

  const [fondo, setFondo] = useState("0");
  const [contado, setContado] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const [historial, setHistorial] = useState<Cierre[]>([]);

  const cargarDia = useCallback(async () => {
    const ini = new Date(fecha + "T00:00:00");
    const fin = new Date(fecha + "T23:59:59.999");
    const { data } = await supabase
      .from("venta")
      .select("total, pago(metodo, monto)")
      .gte("vendida_en", ini.toISOString())
      .lte("vendida_en", fin.toISOString());
    const vs = (data as { total: number; pago: { metodo: string; monto: number }[] }[]) ?? [];
    let ef = 0,
      tr = 0,
      tot = 0;
    for (const v of vs) {
      tot += Number(v.total);
      for (const p of v.pago ?? []) {
        if (p.metodo === "efectivo") ef += Number(p.monto);
        else if (p.metodo === "transferencia") tr += Number(p.monto);
      }
    }
    setVentasEfectivo(ef);
    setVentasTransf(tr);
    setTotalVentas(tot);
    setNumVentas(vs.length);

    // ¿Ya hay un cierre guardado para ese día?
    const { data: c } = await supabase
      .from("cierre_caja")
      .select("fondo_inicial, efectivo_contado, nota")
      .eq("fecha", fecha)
      .maybeSingle();
    if (c) {
      setFondo(String(c.fondo_inicial ?? 0));
      setContado(c.efectivo_contado != null ? String(c.efectivo_contado) : "");
      setNota(c.nota ?? "");
    } else {
      setContado("");
      setNota("");
    }
    setGuardado(false);
  }, [supabase, fecha]);

  const cargarHistorial = useCallback(async () => {
    const { data } = await supabase
      .from("cierre_caja")
      .select("fecha, efectivo_esperado, efectivo_contado, diferencia")
      .order("fecha", { ascending: false })
      .limit(30);
    setHistorial((data as Cierre[]) ?? []);
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
      await cargarHistorial();
    })();
  }, [supabase, cargarHistorial]);

  useEffect(() => {
    cargarDia();
  }, [cargarDia]);

  const esperado = (parseFloat(fondo) || 0) + ventasEfectivo;
  const contadoNum = parseFloat(contado);
  const hayContado = !isNaN(contadoNum);
  const diferencia = hayContado ? contadoNum - esperado : 0;
  const cuadra = Math.abs(diferencia) < 0.5;

  async function guardar() {
    if (!negocioId || !hayContado) {
      alert("Escribe cuánto efectivo contaste.");
      return;
    }
    setGuardando(true);
    const { error } = await supabase.from("cierre_caja").upsert(
      {
        negocio_id: negocioId,
        fecha,
        fondo_inicial: parseFloat(fondo) || 0,
        ventas_efectivo: ventasEfectivo,
        ventas_transferencia: ventasTransf,
        total_ventas: totalVentas,
        num_ventas: numVentas,
        efectivo_esperado: esperado,
        efectivo_contado: contadoNum,
        diferencia,
        nota: nota.trim() || null,
        usuario_id: usuarioId,
      },
      { onConflict: "negocio_id,fecha" },
    );
    setGuardando(false);
    if (error) {
      alert("No se pudo guardar el cierre: " + error.message);
      return;
    }
    setGuardado(true);
    await cargarHistorial();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900 dark:text-white">
        <Calculator className="h-6 w-6 text-emerald-600" />
        Cierre de caja
      </h1>
      <p className="mt-1 text-neutral-500">
        Al final del día, contá el efectivo y revisá si cuadra con lo vendido.
      </p>

      {/* Día */}
      <div className="mt-5 flex items-center gap-2">
        <label className="text-sm text-neutral-600 dark:text-neutral-400">Día:</label>
        <input
          type="date"
          value={fecha}
          max={hoyISO()}
          onChange={(e) => setFecha(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        />
      </div>

      {/* Ventas del día */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Mini titulo="Ventas del día" valor={cordoba(totalVentas)} nota={`${numVentas} ventas`} />
        <Mini titulo="En efectivo" valor={cordoba(ventasEfectivo)} nota="lo que entró en efectivo" />
        <Mini titulo="En transferencia" valor={cordoba(ventasTransf)} nota="no cuenta en caja" />
      </div>

      {/* Conteo */}
      <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-neutral-700 dark:text-neutral-300">
              Fondo inicial (con lo que empezaste)
            </span>
            <input
              value={fondo}
              onChange={(e) => setFondo(e.target.value)}
              type="number"
              min="0"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-neutral-700 dark:text-neutral-300">
              Efectivo que contaste
            </span>
            <input
              value={contado}
              onChange={(e) => setContado(e.target.value)}
              type="number"
              min="0"
              placeholder="C$"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
            />
          </label>
        </div>

        <div className="mt-4 space-y-1.5 rounded-xl bg-neutral-50 p-4 text-sm dark:bg-neutral-950/40">
          <div className="flex justify-between">
            <span className="text-neutral-500">Deberías tener (fondo + efectivo vendido)</span>
            <span className="font-semibold">{cordoba(esperado)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Contaste</span>
            <span className="font-semibold">{hayContado ? cordoba(contadoNum) : "—"}</span>
          </div>
        </div>

        {hayContado && (
          <div
            className={
              "mt-3 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold " +
              (cuadra
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300")
            }
          >
            {cuadra ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            {cuadra
              ? "¡Cuadra! La caja está bien."
              : diferencia > 0
                ? `Sobran ${cordoba(diferencia)} en la caja.`
                : `Faltan ${cordoba(Math.abs(diferencia))} en la caja.`}
          </div>
        )}

        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Nota (opcional)"
          className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        />

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={guardar}
            disabled={guardando}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Guardar cierre"}
          </button>
          {guardado && (
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Cierre guardado.
            </span>
          )}
        </div>
      </div>

      {/* Historial */}
      <h2 className="mt-8 font-semibold text-neutral-900 dark:text-white">
        Cierres anteriores
      </h2>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 text-right font-medium">Esperado</th>
              <th className="px-4 py-3 text-right font-medium">Contado</th>
              <th className="px-4 py-3 text-right font-medium">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {historial.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-400">
                  Aún no has hecho cierres.
                </td>
              </tr>
            ) : (
              historial.map((c) => (
                <tr
                  key={c.fecha}
                  className="border-b border-neutral-100 last:border-0 dark:border-neutral-800"
                >
                  <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">
                    {new Date(c.fecha + "T00:00:00").toLocaleDateString("es-NI")}
                  </td>
                  <td className="px-4 py-2.5 text-right">{cordoba(c.efectivo_esperado)}</td>
                  <td className="px-4 py-2.5 text-right">{cordoba(c.efectivo_contado)}</td>
                  <td
                    className={
                      "px-4 py-2.5 text-right font-medium " +
                      (Math.abs(Number(c.diferencia)) < 0.5
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400")
                    }
                  >
                    {Number(c.diferencia) === 0 ? "—" : cordoba(c.diferencia)}
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

function Mini({ titulo, valor, nota }: { titulo: string; valor: string; nota: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs text-neutral-500">{titulo}</p>
      <p className="mt-0.5 text-lg font-bold text-neutral-900 dark:text-white">{valor}</p>
      <p className="text-xs text-neutral-400">{nota}</p>
    </div>
  );
}
