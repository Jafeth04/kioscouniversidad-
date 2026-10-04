"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cordoba } from "@/lib/formato";
import FondoGueguense from "@/components/FondoGueguense";
import { CupSoda, UtensilsCrossed } from "lucide-react";

type ItemMenu = {
  id: string;
  nombre: string;
  precio: number;
  categoria: string;
  categoria_orden: number;
  imagen_url: string | null;
};

export default function MenuPublicoPage() {
  const supabase = createClient();
  const [items, setItems] = useState<ItemMenu[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase
      .from("vw_menu_publico")
      .select("id, nombre, precio, categoria, categoria_orden, imagen_url")
      .order("categoria_orden")
      .order("nombre")
      .then(({ data }) => {
        setItems((data as ItemMenu[]) ?? []);
        setCargando(false);
      });
  }, [supabase]);

  // Agrupar por categoría, respetando el orden
  const categorias: { nombre: string; items: ItemMenu[] }[] = [];
  for (const it of items) {
    let g = categorias.find((c) => c.nombre === it.categoria);
    if (!g) {
      g = { nombre: it.categoria, items: [] };
      categorias.push(g);
    }
    g.items.push(it);
  }

  return (
    <main className="relative min-h-screen">
      <FondoGueguense overlay="bg-white/75 dark:bg-neutral-950/85" />

      <div className="relative z-10 mx-auto max-w-lg px-5 py-10">
        {/* Encabezado */}
        <header className="mb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-600/30">
            <CupSoda className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Kiosco Universitario
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Nuestro menú de hoy
          </p>
        </header>

        {cargando ? (
          <p className="text-center text-neutral-400">Cargando menú…</p>
        ) : categorias.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-8 text-center text-neutral-500 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <UtensilsCrossed className="h-8 w-8 text-neutral-300" />
            Por ahora no hay platos disponibles. ¡Vuelve pronto!
          </div>
        ) : (
          <div className="space-y-7">
            {categorias.map((cat) => (
              <section key={cat.nombre}>
                <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  <span className="h-px flex-1 bg-emerald-200 dark:bg-emerald-900" />
                  {cat.nombre}
                  <span className="h-px flex-1 bg-emerald-200 dark:bg-emerald-900" />
                </h2>
                <ul className="space-y-2">
                  {cat.items.map((it) => (
                    <li
                      key={it.id}
                      className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
                    >
                      {it.imagen_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.imagen_url}
                          alt={it.nombre}
                          className="h-16 w-16 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-300 dark:bg-emerald-950/40">
                          <UtensilsCrossed className="h-6 w-6" />
                        </span>
                      )}
                      <span className="flex-1 font-medium text-neutral-900 dark:text-white">
                        {it.nombre}
                      </span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        {cordoba(it.precio)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <footer className="mt-10 text-center text-xs text-neutral-400">
          Precios en córdobas (C$) · Menú actualizado en tiempo real
        </footer>
      </div>
    </main>
  );
}
