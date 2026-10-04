/**
 * Fondo decorativo con íconos culturales de Nicaragua (SVG inline).
 * Principal: El Güegüense (máscara del teatro-danza, Patrimonio de la Humanidad).
 * Otros: volcán, marimba, sacuanjoche (flor nacional) y guardabarrancos (ave nacional).
 * Se renderiza detrás del contenido, con baja opacidad, para no afectar la lectura.
 */

type IconProps = { className?: string };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** El Güegüense — máscara con sombrero de plumas y bigote (ícono principal). */
export function GueguenseMask({ className }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} {...base}>
      {/* plumas del sombrero */}
      <path d="M50 4 C47 14 47 20 50 26" />
      <path d="M37 9 C38 19 43 23 48 27" />
      <path d="M63 9 C62 19 57 23 52 27" />
      {/* ala del sombrero */}
      <path d="M26 30 Q50 18 74 30" />
      {/* rostro / máscara */}
      <path d="M32 31 Q29 58 50 75 Q71 58 68 31" />
      {/* ojos */}
      <path d="M40 45 h6" />
      <path d="M54 45 h6" />
      {/* nariz */}
      <path d="M50 49 v7" />
      {/* bigote */}
      <path d="M38 62 Q50 69 62 62" />
      <path d="M38 62 Q34 59 31 61" />
      <path d="M62 62 Q66 59 69 61" />
    </svg>
  );
}

/** Volcán con humo (los volcanes son símbolo de Nicaragua). */
export function Volcano({ className }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} {...base}>
      <path d="M16 80 L40 42 Q50 30 60 42 L84 80" />
      <path d="M44 42 Q42 33 48 27 Q56 31 54 41" />
    </svg>
  );
}

/** Marimba (instrumento tradicional del folclor nicaragüense). */
export function Marimba({ className }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} {...base}>
      {/* marco */}
      <path d="M22 44 L78 34 L84 58 L28 68 Z" />
      {/* teclas */}
      <path d="M36 45 v18" />
      <path d="M46 43 v18" />
      <path d="M56 41 v18" />
      <path d="M66 39 v18" />
      {/* baquetas */}
      <path d="M42 24 L48 46" />
      <circle cx="41" cy="23" r="3" />
      <path d="M58 22 L62 44" />
      <circle cx="57" cy="21" r="3" />
    </svg>
  );
}

/** Sacuanjoche (flor nacional de Nicaragua) — 5 pétalos. */
export function Sacuanjoche({ className }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} {...base}>
      <ellipse cx="50" cy="28" rx="9" ry="16" />
      <ellipse cx="50" cy="28" rx="9" ry="16" transform="rotate(72 50 50)" />
      <ellipse cx="50" cy="28" rx="9" ry="16" transform="rotate(144 50 50)" />
      <ellipse cx="50" cy="28" rx="9" ry="16" transform="rotate(216 50 50)" />
      <ellipse cx="50" cy="28" rx="9" ry="16" transform="rotate(288 50 50)" />
      <circle cx="50" cy="50" r="6" />
    </svg>
  );
}

/** Guardabarrancos (ave nacional) — con su cola larga de raqueta. */
export function Guardabarrancos({ className }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} {...base}>
      {/* cuerpo */}
      <path d="M40 40 Q30 42 30 50 Q30 60 41 60 Q54 60 54 47" />
      {/* cabeza y pico */}
      <path d="M40 40 Q44 31 52 31 L62 35 L52 40" />
      {/* cola larga con raqueta */}
      <path d="M48 58 Q52 78 54 86" />
      <circle cx="54" cy="90" r="4" />
    </svg>
  );
}

type Placed = {
  C: (p: IconProps) => React.JSX.Element;
  top: string;
  left: string;
  size: number;
  rotate: number;
  tone: "emerald" | "amber";
};

// El Güegüense se repite como motivo principal; los demás lo acompañan.
const ICONS: Placed[] = [
  { C: GueguenseMask, top: "5%", left: "6%", size: 140, rotate: -12, tone: "emerald" },
  { C: GueguenseMask, top: "58%", left: "82%", size: 150, rotate: 10, tone: "emerald" },
  { C: GueguenseMask, top: "80%", left: "10%", size: 120, rotate: 6, tone: "emerald" },
  { C: GueguenseMask, top: "26%", left: "90%", size: 90, rotate: -8, tone: "emerald" },
  { C: Volcano, top: "10%", left: "72%", size: 110, rotate: 0, tone: "amber" },
  { C: Marimba, top: "82%", left: "64%", size: 120, rotate: -6, tone: "amber" },
  { C: Sacuanjoche, top: "18%", left: "26%", size: 72, rotate: 0, tone: "amber" },
  { C: Sacuanjoche, top: "70%", left: "44%", size: 58, rotate: 0, tone: "emerald" },
  { C: Guardabarrancos, top: "46%", left: "4%", size: 92, rotate: 0, tone: "amber" },
  { C: Volcano, top: "42%", left: "58%", size: 80, rotate: 0, tone: "emerald" },
];

export default function NicaraguaBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      {ICONS.map(({ C, top, left, size, rotate, tone }, i) => (
        <div
          key={i}
          className={
            "absolute " +
            (tone === "emerald"
              ? "text-emerald-800/[0.07] dark:text-emerald-300/[0.06]"
              : "text-amber-700/[0.08] dark:text-amber-200/[0.06]")
          }
          style={{
            top,
            left,
            width: size,
            height: size,
            transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
          }}
        >
          <C className="h-full w-full" />
        </div>
      ))}
    </div>
  );
}
