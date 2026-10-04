"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cordoba } from "@/lib/formato";
import {
  BarChart3,
  Banknote,
  ArrowLeftRight,
  TrendingUp,
  ShoppingBag,
  Download,
  Printer,
} from "lucide-react";

type Pago = { metodo: string; monto: number };
type Detalle = {
  cantidad: number;
  precio_unitario: number;
  producto_id: string;
  descripcion: string;
};
type Venta = {
  id: string;
  total: number;
  vendida_en: string;
  pago: Pago[];
  venta_detalle: Detalle[];
};

type Rango = "hoy" | "semana" | "mes" | "custom";

export default function ReportesPage() {
  const supabase = createClient();
  const [rango, setRango] = useState<Rango>("hoy");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [costoMap, setCostoMap] = useState<Record<string, number>>({});
  const [cargando, setCargando] = useState(true);

  // Calcula el rango de fechas según la opción elegida.
  const { inicio, fin, etiqueta } = useMemo(() => {
    const ini = new Date();
    const f = new Date();
    if (rango === "hoy") {
      ini.setHours(0, 0, 0, 0);
      return { inicio: ini, fin: f, etiqueta: "Hoy" };
    }
    if (rango === "semana") {
      const d = ini.getDay(); // 0=domingo
      const lunes = (d + 6) % 7;
      ini.setDate(ini.getDate() - lunes);
      ini.setHours(0, 0, 0, 0);
      return { inicio: ini, fin: f, etiqueta: "Esta semana" };
    }
    if (rango === "mes") {
      ini.setDate(1);
      ini.setHours(0, 0, 0, 0);
      return { inicio: ini, fin: f, etiqueta: "Este mes" };
    }
    // personalizado
    const i = desde ? new Date(desde + "T00:00:00") : new Date(0);
    const h = hasta ? new Date(hasta + "T23:59:59.999") : f;
    return { inicio: i, fin: h, etiqueta: "Personalizado" };
  }, [rango, desde, hasta]);

  const cargar = useCallback(async () => {
    setCargando(true);
    const [{ data: v }, { data: p }, { data: prod }] = await Promise.all([
      supabase
        .from("venta")
        .select(
          "id, total, vendida_en, pago(metodo, monto), venta_detalle(cantidad, precio_unitario, producto_id, descripcion)",
        )
        .gte("vendida_en", inicio.toISOString())
        .lte("vendida_en", fin.toISOString())
        .order("vendida_en", { ascending: false }),
      supabase.from("vw_plato_costeo").select("id, costo"),
      supabase.from("producto").select("id, costo"),
    ]);
    setVentas((v as unknown as Venta[]) ?? []);
    const m: Record<string, number> = {};
    // base: costo de bebidas (empaquetado) desde producto
    (prod ?? []).forEach((x: { id: string; costo: number | null }) => {
      m[x.id] = Number(x.costo ?? 0);
    });
    // override: costo real de comida desde la vista de costeo
    (p ?? []).forEach((x: { id: string; costo: number | null }) => {
      m[x.id] = Number(x.costo ?? 0);
    });
    setCostoMap(m);
    setCargando(false);
  }, [supabase, inicio, fin]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ---- totales ----
  const resumen = useMemo(() => {
    let ingresos = 0,
      efectivo = 0,
      transferencia = 0,
      ganancia = 0;
    const platos: Record<string, { cantidad: number; monto: number }> = {};
    for (const v of ventas) {
      ingresos += Number(v.total);
      for (const pg of v.pago ?? []) {
        if (pg.metodo === "efectivo") efectivo += Number(pg.monto);
        else if (pg.metodo === "transferencia") transferencia += Number(pg.monto);
      }
      for (const d of v.venta_detalle ?? []) {
        const costo = costoMap[d.producto_id] ?? 0;
        ganancia += d.cantidad * (Number(d.precio_unitario) - costo);
        const key = d.descripcion || "Plato";
        if (!platos[key]) platos[key] = { cantidad: 0, monto: 0 };
        platos[key].cantidad += Number(d.cantidad);
        platos[key].monto += Number(d.cantidad) * Number(d.precio_unitario);
      }
    }
    const top = Object.entries(platos)
      .map(([nombre, x]) => ({ nombre, ...x }))
      .sort((a, b) => b.cantidad - a.cantidad);
    return { ingresos, efectivo, transferencia, ganancia, top, n: ventas.length };
  }, [ventas, costoMap]);

  function descargarExcel() {
    const filas: string[][] = [["Fecha", "Hora", "Total (C$)", "Método"]];
    for (const v of ventas) {
      const d = new Date(v.vendida_en);
      const metodo = (v.pago ?? []).map((p) => p.metodo).join(", ") || "—";
      filas.push([
        d.toLocaleDateString("es-NI"),
        d.toLocaleTimeString("es-NI", { hour: "2-digit", minute: "2-digit" }),
        Number(v.total).toFixed(2),
        metodo,
      ]);
    }
    filas.push([]);
    filas.push(["Platos más vendidos", "Cantidad", "Monto (C$)"]);
    for (const t of resumen.top) filas.push([t.nombre, String(t.cantidad), t.monto.toFixed(2)]);
    filas.push([]);
    filas.push(["Ingresos", resumen.ingresos.toFixed(2)]);
    filas.push(["Efectivo", resumen.efectivo.toFixed(2)]);
    filas.push(["Transferencia", resumen.transferencia.toFixed(2)]);
    filas.push(["Ganancia estimada", resumen.ganancia.toFixed(2)]);

    const csv =
      "﻿" +
      filas
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
        .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-${etiqueta.toLowerCase().replace(/\s/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const maxTop = resumen.top.length ? resumen.top[0].cantidad : 1;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900 dark:text-white">
          <BarChart3 className="h-6 w-6 text-emerald-600" />
          Reportes
        </h1>
        <div className="flex gap-2 print:hidden">
          <button
            onClick={descargarExcel}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
          >
            <Download className="h-4 w-4" />
            Excel
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            <Printer className="h-4 w-4" />
            Imprimir / PDF
          </button>
        </div>
      </div>
      <p className="mt-1 text-neutral-500">
        El resumen de tus ventas. Elegí el periodo que quieras ver.
      </p>

      {/* Selector de rango */}
      <div className="mt-5 flex flex-wrap items-center gap-2 print:hidden">
        {([
          ["hoy", "Hoy"],
          ["semana", "Esta semana"],
          ["mes", "Este mes"],
          ["custom", "Personalizado"],
        ] as [Rango, string][]).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setRango(v)}
            className={
              "rounded-lg border px-3 py-1.5 text-sm font-medium " +
              (rango === v
                ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400")
            }
          >
            {label}
          </button>
        ))}
        {rango === "custom" && (
          <span className="flex items-center gap-2 text-sm">
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="rounded-lg border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            />
            <span className="text-neutral-400">a</span>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="rounded-lg border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            />
          </span>
        )}
      </div>

      {cargando ? (
        <p className="mt-6 text-neutral-400">Cargando…</p>
      ) : (
        <>
          {/* Tarjetas */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Tarjeta icon={ShoppingBag} color="emerald" titulo="Ventas" valor={String(resumen.n)} nota={etiqueta} />
            <Tarjeta icon={TrendingUp} color="emerald" titulo="Ingresos" valor={cordoba(resumen.ingresos)} nota={etiqueta} />
            <Tarjeta icon={TrendingUp} color="sky" titulo="Ganancia estimada" valor={cordoba(resumen.ganancia)} nota="precio − costo" />
            <Tarjeta icon={Banknote} color="emerald" titulo="En efectivo" valor={cordoba(resumen.efectivo)} nota="recibido" />
            <Tarjeta icon={ArrowLeftRight} color="sky" titulo="En transferencia" valor={cordoba(resumen.transferencia)} nota="recibido" />
          </div>

          {/* Platos más vendidos */}
          <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="mb-3 font-semibold text-neutral-900 dark:text-white">
              Platos más vendidos
            </h2>
            {resumen.top.length === 0 ? (
              <p className="text-sm text-neutral-400">No hay ventas en este periodo.</p>
            ) : (
              <ul className="space-y-2">
                {resumen.top.map((t) => (
                  <li key={t.nombre} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">
                        {t.nombre}
                      </span>
                      <span className="text-neutral-500">
                        {t.cantidad} vendidos · {cordoba(t.monto)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.max(6, (t.cantidad / maxTop) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Detalle de ventas */}
          <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Hora</th>
                  <th className="px-4 py-3 font-medium">Método</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {ventas.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-neutral-400">
                      Sin ventas en este periodo.
                    </td>
                  </tr>
                ) : (
                  ventas.map((v) => {
                    const d = new Date(v.vendida_en);
                    const metodo = (v.pago ?? []).map((p) => p.metodo).join(", ") || "—";
                    return (
                      <tr
                        key={v.id}
                        className="border-b border-neutral-100 last:border-0 dark:border-neutral-800"
                      >
                        <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">
                          {d.toLocaleDateString("es-NI")}
                        </td>
                        <td className="px-4 py-2.5 text-neutral-500">
                          {d.toLocaleTimeString("es-NI", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-2.5 capitalize text-neutral-500">{metodo}</td>
                        <td className="px-4 py-2.5 text-right font-medium">
                          {cordoba(v.total)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Tarjeta({
  icon: Icon,
  color,
  titulo,
  valor,
  nota,
}: {
  icon: typeof BarChart3;
  color: "emerald" | "sky";
  titulo: string;
  valor: string;
  nota: string;
}) {
  const c =
    color === "emerald"
      ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50"
      : "text-sky-600 bg-sky-50 dark:bg-sky-950/40";
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <span className={"flex h-9 w-9 items-center justify-center rounded-lg " + c}>
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-xs text-neutral-500">{titulo}</p>
      <p className="text-2xl font-bold text-neutral-900 dark:text-white">{valor}</p>
      <p className="text-xs text-neutral-400">{nota}</p>
    </div>
  );
}
