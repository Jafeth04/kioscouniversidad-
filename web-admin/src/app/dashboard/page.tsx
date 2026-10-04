"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { puedeVer } from "@/lib/roles";
import { leerCache } from "@/lib/offline";
import {
  Carrot,
  UtensilsCrossed,
  TrendingUp,
  Banknote,
  ChefHat,
  ShoppingCart,
  Bot,
  BarChart3,
  Calculator,
  Trash2,
  CupSoda,
  type LucideIcon,
} from "lucide-react";

const ACCESOS: {
  href: string;
  icon: LucideIcon;
  titulo: string;
  desc: string;
}[] = [
  {
    href: "/dashboard/caja",
    icon: Banknote,
    titulo: "Caja (ventas)",
    desc: "Registra las ventas del día. Baja los platos listos y suma ingresos.",
  },
  {
    href: "/dashboard/cocina",
    icon: ChefHat,
    titulo: "Cocina",
    desc: "Anota lo que cocinaste. Gasta ingredientes y crea platos listos.",
  },
  {
    href: "/dashboard/mercado",
    icon: ShoppingCart,
    titulo: "Mercado",
    desc: "Registra tus compras. El inventario de ingredientes sube solo.",
  },
  {
    href: "/dashboard/ingredientes",
    icon: Carrot,
    titulo: "Ingredientes",
    desc: "Precios, rendimiento y cuánto tienes en inventario.",
  },
  {
    href: "/dashboard/mermas",
    icon: Trash2,
    titulo: "Mermas",
    desc: "Registra lo que se perdió (dañado, vencido) y baja del inventario.",
  },
  {
    href: "/dashboard/platos",
    icon: UtensilsCrossed,
    titulo: "Platos y costeo",
    desc: "Arma tus platos y ve el costo, la ganancia y el margen automáticos.",
  },
  {
    href: "/dashboard/bebidas",
    icon: CupSoda,
    titulo: "Bebidas",
    desc: "Gaseosas, energizantes y productos que compras ya hechos y revendes.",
  },
  {
    href: "/dashboard/reportes",
    icon: BarChart3,
    titulo: "Reportes",
    desc: "Ventas por día, semana o mes, platos más vendidos y ganancia.",
  },
  {
    href: "/dashboard/cierre",
    icon: Calculator,
    titulo: "Cierre de caja",
    desc: "Cuenta el efectivo del día y revisa si cuadra con lo vendido.",
  },
  {
    href: "/dashboard/proyecciones",
    icon: TrendingUp,
    titulo: "Proyecciones",
    desc: "Gastos fijos, utilidad del mes y punto de equilibrio.",
  },
  {
    href: "/dashboard/asistente",
    icon: Bot,
    titulo: "Asistente",
    desc: "Pregúntale a tu negocio: ganancias, qué comprar, plato más rentable.",
  },
];

export default function DashboardPage() {
  const supabase = createClient();
  const [rol, setRol] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return;
      if (navigator.onLine) {
        const { data: perfil } = await supabase
          .from("perfil")
          .select("rol")
          .eq("id", user.id)
          .single();
        setRol(perfil?.rol ?? null);
      } else {
        const p = leerCache<{ rol?: string } | null>("perfil", null);
        setRol(p?.rol ?? null);
      }
    })();
  }, [supabase]);

  const accesos = ACCESOS.filter((a) => puedeVer(rol, a.href));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
        Bienvenido
      </h1>
      <p className="mt-1 text-neutral-500">
        Panel de administración del kiosco. ¿Qué quieres hacer?
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accesos.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="group rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-emerald-400 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <Icon className="h-6 w-6" />
              </span>
              <h2 className="mt-3 font-semibold text-neutral-900 group-hover:text-emerald-700 dark:text-white">
                {a.titulo}
              </h2>
              <p className="mt-1 text-sm text-neutral-500">{a.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
