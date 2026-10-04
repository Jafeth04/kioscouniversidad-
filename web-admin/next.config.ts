import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Exportación estática (HTML/JS) para publicar en Cloudflare Pages.
  output: "export",
  // La app es 100% del lado del cliente (Supabase en el navegador).
  images: { unoptimized: true },
  // Fija la raíz del proyecto para Turbopack (evita que infiera la carpeta
  // de usuario por un package-lock.json ajeno).
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
