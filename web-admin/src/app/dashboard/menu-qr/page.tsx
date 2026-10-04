"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { QrCode, Eye, Download } from "lucide-react";

export default function MenuQrPage() {
  const [url, setUrl] = useState("");
  const [copiado, setCopiado] = useState(false);
  const contRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUrl(window.location.origin + "/menu");
  }, []);

  function copiar() {
    navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function descargar() {
    const canvas = contRef.current?.querySelector("canvas");
    if (!canvas) return;
    const enlace = document.createElement("a");
    enlace.download = "menu-qr-kiosco.png";
    enlace.href = canvas.toDataURL("image/png");
    enlace.click();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900 dark:text-white">
        <QrCode className="h-6 w-6 text-emerald-600" />
        Menú por código QR
      </h1>
      <p className="mt-1 text-neutral-500">
        Imprime este código y pégalo en el mostrador. Los estudiantes lo escanean
        y ven el menú con los platos que marcaste como <b>disponibles</b>.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* QR */}
        <div className="flex flex-col items-center rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div ref={contRef} className="rounded-xl bg-white p-4">
            {url ? (
              <QRCodeCanvas value={url} size={220} level="M" includeMargin />
            ) : (
              <div className="h-[220px] w-[220px] animate-pulse rounded bg-neutral-100" />
            )}
          </div>
          <button
            onClick={descargar}
            className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Download className="h-4 w-4" />
            Descargar imagen (PNG)
          </button>
        </div>

        {/* Info */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="font-semibold text-neutral-900 dark:text-white">
            Dirección del menú
          </h2>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              {url || "…"}
            </code>
            <button
              onClick={copiar}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              {copiado ? "¡Copiado!" : "Copiar"}
            </button>
          </div>

          <Link
            href="/menu"
            target="_blank"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            <Eye className="h-4 w-4" />
            Ver el menú como lo ven los clientes →
          </Link>

          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
            <b>Listo:</b> este QR ya funciona en <b>cualquier celular</b>. Imprímelo
            y pégalo en el mostrador. Siempre muestra el menú actualizado con los
            platos y bebidas marcados como <b>disponibles</b>.
          </div>
        </div>
      </div>
    </div>
  );
}
