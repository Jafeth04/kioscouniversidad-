"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import FondoGueguense from "@/components/FondoGueguense";
import { CupSoda } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si ya hay una sesión guardada (aunque no haya internet), entrar directo.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/dashboard");
      }
    });
  }, [supabase, router]);

  async function iniciarSesion(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!navigator.onLine) {
      setError(
        "Necesitás internet para iniciar sesión la primera vez. Después ya podrás entrar sin señal.",
      );
      return;
    }

    setCargando(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: correo.trim(),
        password,
      });

      if (error) {
        const msg =
          error.message === "Invalid login credentials"
            ? "Correo o contraseña incorrectos."
            : error.message === "Email not confirmed"
              ? "El correo aún no ha sido confirmado."
              : "No se pudo iniciar sesión. Intenta de nuevo.";
        setError(msg);
        setCargando(false);
        return;
      }
    } catch {
      setError("No hay internet. Conéctate para iniciar sesión la primera vez.");
      setCargando(false);
      return;
    }

    // Sesión iniciada -> ir al panel
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      <FondoGueguense overlay="bg-white/75 dark:bg-neutral-950/85" />
      <div className="relative z-10 w-full max-w-md">
        {/* Marca */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-600/30">
            <CupSoda className="h-8 w-8 text-white" strokeWidth={2} />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Kiosco Universitario
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Panel de administración
          </p>
        </div>

        {/* Tarjeta */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-xl shadow-neutral-900/5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Iniciar sesión
          </h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Ingresa tus credenciales para continuar.
          </p>

          <form onSubmit={iniciarSesion} className="mt-6 space-y-4">
            {/* Correo */}
            <div>
              <label
                htmlFor="correo"
                className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                Correo electrónico
              </label>
              <input
                id="correo"
                type="email"
                autoComplete="email"
                required
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="tu@correo.com"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-neutral-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>

            {/* Contraseña */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={verPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 pr-12 text-neutral-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setVerPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3.5 text-sm font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {verPassword ? "Ocultar" : "Ver"}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
              >
                {error}
              </div>
            )}

            {/* Botón */}
            <button
              type="submit"
              disabled={cargando}
              className="flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cargando ? "Ingresando…" : "Ingresar"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-400 dark:text-neutral-600">
          Kiosco Universitario · Sistema de gestión
        </p>
      </div>
    </main>
  );
}
