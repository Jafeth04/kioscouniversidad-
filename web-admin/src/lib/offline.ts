"use client";

// Cola de operaciones offline: guarda inserts en el dispositivo y los sube
// cuando vuelve el internet. Cada operación es una lista ordenada de inserts
// (tabla + filas), con los IDs ya generados para que no dependan del servidor.

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export type InsertPaso = { tabla: string; filas: Record<string, unknown>[] };
export type Operacion = {
  id: string;
  tipo: "venta" | "produccion" | "compra";
  etiqueta: string; // texto para mostrar ("Venta C$120")
  inserts: InsertPaso[];
  creado_en: string;
};

const KEY = "kiosco_cola_offline";
const EVENTO = "kiosco-cola-cambio";

// --- Caché de datos en el dispositivo (para leer sin internet) ---
const PREFIJO = "kiosco_cache_";

export function guardarCache(clave: string, valor: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
  } catch {
    // almacenamiento lleno: ignorar
  }
}

export function leerCache<T>(clave: string, porDefecto: T): T {
  if (typeof window === "undefined") return porDefecto;
  try {
    const v = localStorage.getItem(PREFIJO + clave);
    return v ? (JSON.parse(v) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}

export function nuevoId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function obtenerCola(): Operacion[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function guardarCola(ops: Operacion[]) {
  localStorage.setItem(KEY, JSON.stringify(ops));
  window.dispatchEvent(new Event(EVENTO));
}

export function encolar(
  tipo: Operacion["tipo"],
  etiqueta: string,
  inserts: InsertPaso[],
) {
  const ops = obtenerCola();
  ops.push({ id: nuevoId(), tipo, etiqueta, inserts, creado_en: new Date().toISOString() });
  guardarCola(ops);
}

let sincronizando = false;

/** Sube las operaciones pendientes en orden. Se detiene en el primer error. */
export async function sincronizar(
  supabase: SupabaseClient,
): Promise<{ subidas: number; pendientes: number; error?: string }> {
  if (sincronizando) return { subidas: 0, pendientes: obtenerCola().length };
  sincronizando = true;
  try {
    let ops = obtenerCola();
    let subidas = 0;
    // Orden por fecha de creación (compra -> cocina -> venta si se hizo en orden)
    ops = ops.sort((a, b) => a.creado_en.localeCompare(b.creado_en));
    for (const op of ops) {
      try {
        for (const paso of op.inserts) {
          const { error } = await supabase.from(paso.tabla).insert(paso.filas);
          if (error) throw new Error(error.message);
        }
        // quitar esta operación de la cola
        const restantes = obtenerCola().filter((x) => x.id !== op.id);
        guardarCola(restantes);
        subidas++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "error";
        return { subidas, pendientes: obtenerCola().length, error: msg };
      }
    }
    return { subidas, pendientes: obtenerCola().length };
  } finally {
    sincronizando = false;
  }
}

/** Hook: ¿hay conexión? */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/** Hook: cuántas operaciones hay pendientes de subir. */
export function usePendientes(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const actualizar = () => setN(obtenerCola().length);
    actualizar();
    window.addEventListener(EVENTO, actualizar);
    window.addEventListener("storage", actualizar);
    return () => {
      window.removeEventListener(EVENTO, actualizar);
      window.removeEventListener("storage", actualizar);
    };
  }, []);
  return n;
}
