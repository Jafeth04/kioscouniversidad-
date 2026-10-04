"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cordoba } from "@/lib/formato";
import { Bot, Send, Sparkles } from "lucide-react";

type Mensaje = { de: "usuario" | "asistente"; texto: string };

type Plato = {
  id: string;
  nombre: string;
  precio_venta: number | null;
  costo: number | null;
  ganancia: number | null;
  margen_pct: number | null;
  cantidad_disponible: number | null;
};

const SUGERENCIAS = [
  "Resumen del día",
  "¿Cuánto gané hoy?",
  "¿Cómo voy vs la semana pasada?",
  "¿Qué día vendo más?",
  "¿Cuánto perdí en mermas?",
  "¿Cuadró la caja?",
  "¿Qué me falta comprar?",
  "¿Cuál es mi plato más rentable?",
  "Mi inventario",
];

export default function AsistentePage() {
  const supabase = createClient();
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      de: "asistente",
      texto:
        "¡Hola! Soy tu asistente del kiosco. Pregúntame sobre tus ventas, ganancias, inventario o qué comprar. Toca una sugerencia o escribe tu pregunta.",
    },
  ]);
  const [entrada, setEntrada] = useState("");
  const [pensando, setPensando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  function scrollAbajo() {
    setTimeout(() => finRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  async function responder(pregunta: string): Promise<string> {
    const q = pregunta
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, ""); // quita acentos

    const esMerma = /(merma|perd|desperdici|dano|danad|vencid|boto|tiro)/.test(q);
    const esCierre = /(cierre|cuadr|caja cerr|cerrar caja)/.test(q);
    const esComparar = /(semana pasada|compar|contra| vs |mejore o peor|voy esta semana)/.test(q);
    const esMejorDia = /(que dia|mejor dia|dia que mas|dia mas|dia vendo)/.test(q);
    const esRentable = /(rentable|mejor plato|mas gana|margen|deja mas)/.test(q);
    const esComprar = /(comprar|falta|stock bajo|reabastec|mercado)/.test(q);
    const esInventario = /(inventario|cuanto tengo|existencia|stock)/.test(q);
    const esResumen = /(resumen|como va|general)/.test(q);
    const esHoy = /(gane|ganancia|vend|ingreso|hoy)/.test(q);

    if (esResumen) return await resumenDia();
    if (esMerma) return await mermasResumen();
    if (esCierre) return await cierreCaja();
    if (esComparar) return await comparaSemana();
    if (esMejorDia) return await mejorDia();
    if (esRentable) return await platoRentable();
    if (esComprar) return await queComprar();
    if (esInventario) return await inventario();
    if (esHoy) return await gananciaHoy();

    return "Puedo ayudarte con: el **resumen del día**, lo que **ganaste hoy**, **cómo vas vs la semana pasada**, **qué día vendés más**, tus **mermas**, si **cuadró la caja**, **qué comprar**, tu **plato más rentable** y tu **inventario**. Toca una sugerencia de arriba.";
  }

  // ---- intenciones ----
  async function datosHoy() {
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    const [{ data: ventas }, { data: det }, { data: platos }, { data: prods }] =
      await Promise.all([
        supabase.from("venta").select("total, vendida_en").gte("vendida_en", inicio.toISOString()),
        supabase
          .from("venta_detalle")
          .select("cantidad, precio_unitario, producto_id, venta!inner(vendida_en)")
          .gte("venta.vendida_en", inicio.toISOString()),
        supabase.from("vw_plato_costeo").select("id, costo"),
        supabase.from("producto").select("id, costo"),
      ]);
    const ingresos = (ventas ?? []).reduce((s, v) => s + Number(v.total), 0);
    const nVentas = (ventas ?? []).length;
    const costoMap: Record<string, number> = {};
    (prods ?? []).forEach((p: { id: string; costo: number | null }) => {
      costoMap[p.id] = Number(p.costo ?? 0);
    });
    (platos ?? []).forEach((p: { id: string; costo: number | null }) => {
      costoMap[p.id] = Number(p.costo ?? 0);
    });
    const ganancia = (det ?? []).reduce(
      (s, d: { cantidad: number; precio_unitario: number; producto_id: string }) =>
        s + d.cantidad * (Number(d.precio_unitario) - (costoMap[d.producto_id] ?? 0)),
      0,
    );
    return { ingresos, nVentas, ganancia };
  }

  async function mermasResumen() {
    const inicio = new Date();
    inicio.setDate(1);
    inicio.setHours(0, 0, 0, 0);
    const [{ data: mermas }, { data: platos }] = await Promise.all([
      supabase
        .from("merma")
        .select(
          "tipo, cantidad, producto_id, ingrediente(costo_compra, tipo_costeo, contenido_base)",
        )
        .gte("created_at", inicio.toISOString()),
      supabase.from("vw_plato_costeo").select("id, costo"),
    ]);
    const costoMap: Record<string, number> = {};
    (platos ?? []).forEach((p: { id: string; costo: number | null }) => {
      costoMap[p.id] = Number(p.costo ?? 0);
    });
    type M = {
      tipo: string;
      cantidad: number;
      producto_id: string | null;
      ingrediente: {
        costo_compra: number | null;
        tipo_costeo: string;
        contenido_base: number | null;
      } | null;
    };
    const rows = (mermas as unknown as M[]) ?? [];
    if (rows.length === 0)
      return "Este mes no registraste mermas. ¡Buen control!";
    let total = 0;
    for (const m of rows) {
      if (m.tipo === "ingrediente" && m.ingrediente) {
        const cc = Number(m.ingrediente.costo_compra ?? 0);
        if (m.ingrediente.tipo_costeo === "medida" && m.ingrediente.contenido_base)
          total += (Number(m.cantidad) / Number(m.ingrediente.contenido_base)) * cc;
        else total += Number(m.cantidad) * cc;
      } else if (m.tipo === "plato" && m.producto_id) {
        total += Number(m.cantidad) * (costoMap[m.producto_id] ?? 0);
      }
    }
    return `**Mermas de este mes:**\n• Registros: ${rows.length}\n• Pérdida estimada: ${cordoba(total)}\n\nEs lo que se perdió sin venderse. Mientras más bajo, mejor.`;
  }

  async function cierreCaja() {
    const { data } = await supabase
      .from("cierre_caja")
      .select("fecha, efectivo_esperado, efectivo_contado, diferencia")
      .order("fecha", { ascending: false })
      .limit(1);
    const c = (data ?? [])[0] as
      | { fecha: string; efectivo_esperado: number; efectivo_contado: number; diferencia: number }
      | undefined;
    if (!c)
      return "Todavía no has hecho ningún cierre de caja. Podés hacerlo en la pantalla **Cierre de caja**.";
    const dif = Number(c.diferencia);
    const fecha = new Date(c.fecha + "T00:00:00").toLocaleDateString("es-NI");
    const estado =
      Math.abs(dif) < 0.5
        ? "**cuadró perfecto.**"
        : dif > 0
          ? `sobraron ${cordoba(dif)}.`
          : `faltaron ${cordoba(Math.abs(dif))}.`;
    return `**Último cierre (${fecha}):**\n• Deberías tener: ${cordoba(c.efectivo_esperado)}\n• Contaste: ${cordoba(c.efectivo_contado)}\n• Resultado: ${estado}`;
  }

  async function comparaSemana() {
    const ahora = new Date();
    const d = (ahora.getDay() + 6) % 7; // 0 = lunes
    const lunesEsta = new Date(ahora);
    lunesEsta.setDate(ahora.getDate() - d);
    lunesEsta.setHours(0, 0, 0, 0);
    const lunesPasada = new Date(lunesEsta);
    lunesPasada.setDate(lunesEsta.getDate() - 7);
    const { data } = await supabase
      .from("venta")
      .select("total, vendida_en")
      .gte("vendida_en", lunesPasada.toISOString());
    let esta = 0,
      pasada = 0;
    for (const v of (data ?? []) as { total: number; vendida_en: string }[]) {
      const f = new Date(v.vendida_en);
      if (f >= lunesEsta) esta += Number(v.total);
      else pasada += Number(v.total);
    }
    let txt = `**Ventas de la semana:**\n• Esta semana: ${cordoba(esta)}\n• Semana pasada: ${cordoba(pasada)}`;
    const dif = esta - pasada;
    if (pasada > 0) {
      const pct = Math.round((dif / pasada) * 100);
      txt +=
        dif >= 0
          ? `\n\nVas **${pct}% arriba** que la semana pasada.`
          : `\n\nVas **${Math.abs(pct)}% abajo** que la semana pasada.`;
    }
    return txt;
  }

  async function mejorDia() {
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 30);
    inicio.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("venta")
      .select("total, vendida_en")
      .gte("vendida_en", inicio.toISOString());
    const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const suma = [0, 0, 0, 0, 0, 0, 0];
    for (const v of (data ?? []) as { total: number; vendida_en: string }[]) {
      suma[new Date(v.vendida_en).getDay()] += Number(v.total);
    }
    const total = suma.reduce((a, b) => a + b, 0);
    if (total === 0)
      return "Todavía no hay suficientes ventas para saber qué día vendés más. Segui registrando en la Caja.";
    let maxI = 0;
    suma.forEach((s, i) => {
      if (s > suma[maxI]) maxI = i;
    });
    return `En los últimos 30 días, el día que **más vendés** es el **${dias[maxI]}** (${cordoba(suma[maxI])} en total). Conviene tener más platos listos ese día.`;
  }

  async function gananciaHoy() {
    const { ingresos, nVentas, ganancia } = await datosHoy();
    if (nVentas === 0)
      return "Hoy todavía no hay ventas registradas. Cuando vendas en la Caja, aquí verás tus números.";
    return `**Hoy:**\n• Ventas: ${nVentas}\n• Ingresos: ${cordoba(ingresos)}\n• Ganancia estimada: ${cordoba(ganancia)}`;
  }

  async function queComprar() {
    const { data } = await supabase
      .from("ingrediente")
      .select("nombre, unidad_compra, stock_actual, stock_minimo")
      .eq("activo", true)
      .order("nombre");
    const bajos = (data ?? []).filter((i: { stock_actual: number | null; stock_minimo: number | null }) => {
      const s = Number(i.stock_actual ?? 0);
      const m = Number(i.stock_minimo ?? 0);
      return s <= 0 || (m > 0 && s <= m);
    });
    if (bajos.length === 0)
      return "¡Todo bien! No tienes ingredientes bajos por ahora.";
    const lista = bajos
      .map(
        (i: { nombre: string; unidad_compra: string | null; stock_actual: number | null }) =>
          `• ${i.nombre} — te quedan ${Number(i.stock_actual ?? 0)} ${i.unidad_compra ?? ""}`,
      )
      .join("\n");
    return `**Te conviene comprar:**\n${lista}\n\nRegístralo en la pantalla de Mercado cuando lo compres.`;
  }

  async function platoRentable() {
    const { data } = await supabase
      .from("vw_plato_costeo")
      .select("nombre, precio_venta, ganancia, margen_pct")
      .not("precio_venta", "is", null);
    const platos = (data as Plato[]) ?? [];
    if (platos.length === 0)
      return "Aún no tienes platos con precio. Créalos en la pantalla de Platos.";
    const orden = [...platos].sort(
      (a, b) => Number(b.ganancia ?? 0) - Number(a.ganancia ?? 0),
    );
    const mejor = orden[0];
    const peor = orden[orden.length - 1];
    let txt = `**Tu plato más rentable:** ${mejor.nombre}\n• Ganas ${cordoba(mejor.ganancia)} por plato (margen ${mejor.margen_pct}%)`;
    if (orden.length > 1) {
      txt += `\n\nEl que menos deja: ${peor.nombre} (${cordoba(peor.ganancia)} por plato).`;
    }
    return txt;
  }

  async function inventario() {
    const { data } = await supabase
      .from("ingrediente")
      .select("nombre, unidad_compra, stock_actual")
      .eq("activo", true)
      .order("nombre");
    const items = (data ?? []) as {
      nombre: string;
      unidad_compra: string | null;
      stock_actual: number | null;
    }[];
    if (items.length === 0) return "Aún no tienes ingredientes registrados.";
    const lista = items
      .map(
        (i) => `• ${i.nombre}: ${Number(i.stock_actual ?? 0)} ${i.unidad_compra ?? ""}`,
      )
      .join("\n");
    return `**Tu inventario:**\n${lista}`;
  }

  async function resumenDia() {
    const hoy = await datosHoy();
    const { data: ing } = await supabase
      .from("ingrediente")
      .select("stock_actual, stock_minimo")
      .eq("activo", true);
    const bajos = (ing ?? []).filter((i: { stock_actual: number | null; stock_minimo: number | null }) => {
      const s = Number(i.stock_actual ?? 0);
      const m = Number(i.stock_minimo ?? 0);
      return s <= 0 || (m > 0 && s <= m);
    }).length;
    const { data: platos } = await supabase
      .from("vw_plato_costeo")
      .select("cantidad_disponible");
    const listos = (platos ?? []).reduce(
      (s, p: { cantidad_disponible: number | null }) => s + Number(p.cantidad_disponible ?? 0),
      0,
    );
    return (
      `**Resumen de hoy:**\n` +
      `• Ventas: ${hoy.nVentas} (${cordoba(hoy.ingresos)})\n` +
      `• Ganancia estimada: ${cordoba(hoy.ganancia)}\n` +
      `• Platos listos para vender: ${listos}\n` +
      `• Ingredientes por reponer: ${bajos}`
    );
  }

  async function enviar(texto: string) {
    const pregunta = texto.trim();
    if (!pregunta || pensando) return;
    setMensajes((m) => [...m, { de: "usuario", texto: pregunta }]);
    setEntrada("");
    setPensando(true);
    scrollAbajo();
    try {
      const resp = await responder(pregunta);
      setMensajes((m) => [...m, { de: "asistente", texto: resp }]);
    } catch {
      setMensajes((m) => [
        ...m,
        { de: "asistente", texto: "Ups, no pude revisar los datos. Intenta de nuevo." },
      ]);
    }
    setPensando(false);
    scrollAbajo();
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900 dark:text-white">
        <Bot className="h-6 w-6 text-emerald-600" />
        Asistente
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Pregunta sobre tu negocio. Respondo con tus datos reales — sin costo.
      </p>

      {/* Sugerencias */}
      <div className="mt-4 flex flex-wrap gap-2">
        {SUGERENCIAS.map((s) => (
          <button
            key={s}
            onClick={() => enviar(s)}
            className="flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <Sparkles className="h-3 w-3" />
            {s}
          </button>
        ))}
      </div>

      {/* Conversación */}
      <div className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-neutral-200 bg-white/70 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
        {mensajes.map((m, i) => (
          <div
            key={i}
            className={m.de === "usuario" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                "max-w-[80%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm " +
                (m.de === "usuario"
                  ? "bg-emerald-600 text-white"
                  : "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200")
              }
            >
              {m.texto}
            </div>
          </div>
        ))}
        {pensando && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-neutral-100 px-4 py-2.5 text-sm text-neutral-400 dark:bg-neutral-800">
              Revisando tus datos…
            </div>
          </div>
        )}
        <div ref={finRef} />
      </div>

      {/* Entrada */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(entrada);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          placeholder="Escribe tu pregunta…"
          className="flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-700 dark:bg-neutral-800"
        />
        <button
          type="submit"
          disabled={pensando}
          className="flex items-center justify-center rounded-xl bg-emerald-600 px-4 text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
