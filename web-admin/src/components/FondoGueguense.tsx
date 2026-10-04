/**
 * Fondo con la ilustración de "El Güegüense" (aves, sacuanjoche, comida típica).
 * Va detrás del contenido, con una capa semitransparente encima para que los
 * textos y formularios se lean bien.
 *
 * Colocar como primer elemento; el contenido debe ir con `relative z-10`.
 */
export default function FondoGueguense({
  overlay = "bg-white/70 dark:bg-neutral-950/80",
}: {
  overlay?: string;
}) {
  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/fondo-gueguense.jpg)" }}
      />
      <div aria-hidden="true" className={"fixed inset-0 z-0 " + overlay} />
    </>
  );
}
