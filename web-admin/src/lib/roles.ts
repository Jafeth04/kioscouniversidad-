// Control de acceso por rol (qué pantallas ve cada quien).
// Debe ir de la mano con las políticas de seguridad (RLS) de la base de datos.

export type Rol = "admin" | "cocina" | "vendedor" | "operador";

/** Rutas permitidas por rol. "*" = todas. */
export const RUTAS_POR_ROL: Record<string, string[]> = {
  admin: ["*"],
  operador: ["*"], // compatibilidad con el rol viejo
  cocina: [
    "/dashboard",
    "/dashboard/mercado",
    "/dashboard/cocina",
    "/dashboard/ingredientes",
    "/dashboard/mermas",
  ],
  vendedor: ["/dashboard", "/dashboard/caja"],
};

/** ¿El rol puede entrar a esta ruta? */
export function puedeVer(rol: string | null | undefined, href: string): boolean {
  if (!rol) return false;
  const permitidas = RUTAS_POR_ROL[rol] ?? ["*"];
  if (permitidas.includes("*")) return true;
  return permitidas.includes(href);
}

/** Sólo el dueño (admin) puede crear/editar/borrar configuración. */
export function esAdmin(rol: string | null | undefined): boolean {
  return rol === "admin" || rol === "operador";
}
