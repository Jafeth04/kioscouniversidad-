/** Formatea un número como Córdobas nicaragüenses (C$). */
export function cordoba(valor: number | null | undefined): string {
  const n = typeof valor === "number" ? valor : 0;
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: "NIO",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Unidades de compra disponibles para los ingredientes. */
export const UNIDADES_COMPRA = [
  "unidad",
  "docena",
  "libra",
  "kilo",
  "gramo",
  "onza",
  "litro",
  "mililitro",
  "galón",
  "bolsa",
  "paquete",
] as const;

/** Unidades base para ingredientes "por medida" (lo que se mide en la receta). */
export const UNIDADES_BASE = ["onza", "mililitro", "gramo"] as const;

/**
 * Sugerencia de cuántas unidades base trae un envase de compra.
 * Ej: 1 galón ≈ 128 onzas, 1 litro ≈ 34 onzas. El dueño puede ajustar el número.
 */
export function sugerirContenidoBase(
  unidadCompra: string | null,
  unidadBase: string,
): number | null {
  const tabla: Record<string, Record<string, number>> = {
    galón: { onza: 128, mililitro: 3785 },
    litro: { onza: 34, mililitro: 1000 },
    mililitro: { mililitro: 1 },
    onza: { onza: 1 },
    libra: { onza: 16, gramo: 454 },
    kilo: { gramo: 1000, onza: 35 },
    gramo: { gramo: 1 },
  };
  return tabla[unidadCompra ?? ""]?.[unidadBase] ?? null;
}
