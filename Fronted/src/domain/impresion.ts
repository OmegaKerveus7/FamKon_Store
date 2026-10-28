/** Radio de las esquinas y recorte que se descuenta a la imagen. */
export const RADIO_ESQUINA_CM = 0.5;
export const RECORTE_CM = 0.5;

/**
 * Recuadro de impresión de un lado (A/B).
 * El llavero circular va sin borde: la imagen ocupa todo el diámetro.
 */
export function recorteHtml(
  imagen: string | null,
  ancho: number,
  alto: number,
  circular = false,
): string {
  if (circular) {
    const contenido = imagen
      ? `<img src="${imagen}" alt="" style="width:${ancho}cm;height:${alto}cm;border-radius:50%">`
      : "";
    return `<div class="recorte" style="width:${ancho}cm;height:${alto}cm;border-radius:50%">${contenido}</div>`;
  }
  const contenido = imagen
    ? `<img src="${imagen}" alt="" style="width:calc(${ancho}cm - ${RECORTE_CM}cm);height:calc(${alto}cm - ${RECORTE_CM}cm);border-radius:${RADIO_ESQUINA_CM}cm">`
    : "";
  return `<div class="recorte" style="width:${ancho}cm;height:${alto}cm;border-radius:${RADIO_ESQUINA_CM}cm">${contenido}</div>`;
}
