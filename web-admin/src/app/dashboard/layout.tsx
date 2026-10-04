"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import FondoGueguense from "@/components/FondoGueguense";
import { puedeVer } from "@/lib/roles";
import {
  useOnline,
  usePendientes,
  sincronizar,
  obtenerCola,
  guardarCache,
  leerCache,
} from "@/lib/offline";
import {
  CupSoda,
  Home,
  Carrot,
  UtensilsCrossed,
  QrCode,
  TrendingUp,
  Banknote,
  ChefHat,
  ShoppingCart,
  Bot,
  BarChart3,
  Calculator,
  Trash2,
  Menu,
  X,
  WifiOff,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon };

// Orden lógico del sistema: primero se configura, luego el ciclo diario, al final las herramientas.
const GRUPOS: { titulo: string | null; items: NavItem[] }[] = [
  {
    titulo: null,
    items: [{ href: "/dashboard", label: "Resumen", icon: Home }],
  },
  {
    titulo: "Configuración",
    items: [
      { href: "/dashboard/ingredientes", label: "Ingredientes", icon: Carrot },
      { href: "/dashboard/platos", label: "Platos y costeo", icon: UtensilsCrossed },
      { href: "/dashboard/bebidas", label: "Bebidas", icon: CupSoda },
    ],
  },
  {
    titulo: "Día a día",
    items: [
      { href: "/dashboard/mercado", label: "Mercado", icon: ShoppingCart },
      { href: "/dashboard/cocina", label: "Cocina", icon: ChefHat },
      { href: "/dashboard/mermas", label: "Mermas", icon: Trash2 },
      { href: "/dashboard/caja", label: "Caja (ventas)", icon: Banknote },
    ],
  },
  {
    titulo: "Análisis",
    items: [
      { href: "/dashboard/reportes", label: "Reportes", icon: BarChart3 },
      { href: "/dashboard/cierre", label: "Cierre de caja", icon: Calculator },
      { href: "/dashboard/proyecciones", label: "Proyecciones", icon: TrendingUp },
    ],
  },
  {
    titulo: "Herramientas",
    items: [
      { href: "/dashboard/menu-qr", label: "Menú QR", icon: QrCode },
      { href: "/dashboard/asistente", label: "Asistente", icon: Bot },
    ],
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [nombre, setNombre] = useState<string | null>(null);
  const [rol, setRol] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(true);
  const [menuAbierto, setMenuAbierto] = useState(false);

  const online = useOnline();
  const pendientes = usePendientes();
  const [sincronizando, setSincronizando] = useState(false);

  const sincAuto = useCallback(async () => {
    if (!navigator.onLine || obtenerCola().length === 0) return;
    setSincronizando(true);
    await sincronizar(supabase);
    setSincronizando(false);
  }, [supabase]);

  // Sincronizar al abrir y cada vez que vuelve el internet
  useEffect(() => {
    sincAuto();
    const h = () => sincAuto();
    window.addEventListener("online", h);
    return () => window.removeEventListener("online", h);
  }, [sincAuto]);

  // Cerrar el menú al cambiar de pantalla
  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  useEffect(() => {
    // getSession lee del dispositivo (funciona sin internet); getUser pediría red.
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) {
        router.replace("/login");
        return;
      }
      let perfil = leerCache<{
        nombre?: string;
        rol?: string;
        negocio_id?: string;
      } | null>("perfil", null);
      if (navigator.onLine) {
        const { data: p } = await supabase
          .from("perfil")
          .select("id, nombre, rol, negocio_id")
          .eq("id", user.id)
          .single();
        if (p) {
          perfil = p;
          guardarCache("perfil", p);
        }
      }
      setNombre(perfil?.nombre ?? user.email ?? "Usuario");
      setRol(perfil?.rol ?? null);
      setVerificando(false);
    });
  }, [router, supabase]);

  // Si el usuario entra a una pantalla que su rol no puede ver, lo mandamos al inicio.
  useEffect(() => {
    if (!rol) return;
    if (!puedeVer(rol, pathname)) router.replace("/dashboard");
  }, [rol, pathname, router]);

  const nombreRol: Record<string, string> = {
    admin: "Dueño",
    operador: "Dueño",
    cocina: "Cocina",
    vendedor: "Vendedor",
  };

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (verificando) {
    return (
      <div className="flex min-h-screen items-center justify-center text-neutral-500">
        Cargando…
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen">
      <FondoGueguense overlay="bg-neutral-100/92 dark:bg-neutral-950/92" />

      {/* Fondo oscuro cuando el menú está abierto en celular */}
      {menuAbierto && (
        <div
          onClick={() => setMenuAbierto(false)}
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          aria-hidden="true"
        />
      )}

      {/* Barra lateral (fija en escritorio, cajón deslizable en celular) */}
      <aside
        className={
          "fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-neutral-200 bg-white transition-transform dark:border-neutral-800 dark:bg-neutral-900 md:static md:z-10 md:translate-x-0 print:hidden " +
          (menuAbierto ? "translate-x-0" : "-translate-x-full")
        }
      >
        <div className="flex items-center gap-2 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600">
            <CupSoda className="h-5 w-5 text-white" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold text-neutral-900 dark:text-white">
              Kiosco
            </p>
            <p className="text-xs text-neutral-500">Administración</p>
          </div>
          <button
            onClick={() => setMenuAbierto(false)}
            className="ml-auto text-neutral-400 hover:text-neutral-600 md:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          {GRUPOS.map((grupo, gi) => {
            const items = grupo.items.filter((it) => puedeVer(rol, it.href));
            if (items.length === 0) return null;
            return (
            <div key={gi} className="space-y-1">
              {grupo.titulo && (
                <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  {grupo.titulo}
                </p>
              )}
              {items.map((item) => {
                const activo =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition " +
                      (activo
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800")
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
            );
          })}
        </nav>

        <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
          <div className="pb-2">
            <EstadoConexion
              online={online}
              pendientes={pendientes}
              sincronizando={sincronizando}
              onSync={sincAuto}
            />
          </div>
          <div className="px-3 pb-2">
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {nombre}
            </p>
            {rol && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                {nombreRol[rol] ?? rol}
              </p>
            )}
          </div>
          <button
            onClick={cerrarSesion}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Columna derecha: barra superior (celular) + contenido */}
      <div className="relative z-10 flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90 md:hidden print:hidden">
          <button
            onClick={() => setMenuAbierto(true)}
            aria-label="Abrir menú"
            className="text-neutral-700 dark:text-neutral-200"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="flex items-center gap-1.5 font-bold text-neutral-900 dark:text-white">
            <CupSoda className="h-5 w-5 text-emerald-600" />
            Kiosco
          </span>
          <div className="ml-auto">
            <EstadoConexion
              online={online}
              pendientes={pendientes}
              sincronizando={sincronizando}
              onSync={sincAuto}
              compact
            />
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}

function EstadoConexion({
  online,
  pendientes,
  sincronizando,
  onSync,
  compact,
}: {
  online: boolean;
  pendientes: number;
  sincronizando: boolean;
  onSync: () => void;
  compact?: boolean;
}) {
  if (!online) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        <WifiOff className="h-3.5 w-3.5" />
        {compact ? (pendientes > 0 ? pendientes : "") : "Sin internet"}
        {!compact && pendientes > 0 ? ` · ${pendientes} por subir` : ""}
      </span>
    );
  }
  if (pendientes > 0) {
    return (
      <button
        onClick={onSync}
        disabled={sincronizando}
        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200 disabled:opacity-60 dark:bg-emerald-950/50 dark:text-emerald-300"
      >
        <UploadCloud className="h-3.5 w-3.5" />
        {sincronizando ? "Subiendo…" : compact ? pendientes : `Subir ${pendientes}`}
      </button>
    );
  }
  if (compact) return null;
  return (
    <span className="inline-flex items-center gap-1.5 px-1 text-xs text-neutral-400">
      <span className="h-2 w-2 rounded-full bg-emerald-500" />
      En línea
    </span>
  );
}
