"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    // La primera pantalla del sistema es el login.
    router.replace("/login");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-neutral-500">
      Cargando…
    </div>
  );
}
