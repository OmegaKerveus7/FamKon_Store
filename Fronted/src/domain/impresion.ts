/** Radio de las esquinas y recorte que se descuenta a la imagen. */
export const RADIO_ESQUINA_CM = 0.5;
export const RECORTE_CM = 0.5;

/** Area util de una hoja A4 con margenes de 12 mm. */
export const ANCHO_HOJA_CM = 18.6;
export const ALTO_HOJA_CM = 27.3;
/** Separacion entre celdas y entre el par A/B. */
export const SEPARACION_CM = 0.6;
export const SEPARACION_PAREJA_CM = 0.8;
/** Alto reservado para el pie con el pedido y el producto. */
export const ALTO_PIE_CM = 0.5;

/**
 * Recuadro de impresion de un lado (A/B).
 * El llavero circular va sin borde: la imagen ocupa todo el diametro.
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

/** Producto a imprimir (par A/B) con el tamaño de su recorte. */
export interface ItemParaImprimir {
  id: number;
  anchoCm: number;
  altoCm: number;
}

/** Hoja con las filas de productos que caben en ella. */
export interface HojaImpresion {
  filas: ItemParaImprimir[][];
}

/**
 * Reparte los productos en hojas aprovechando el papel: cada fila mete los
 * productos que caben a lo ancho (un par A/B mide el doble de ancho) y cuando
 * ya no caben mas se continua en la siguiente fila u hoja.
 */
export function empacarEnHojas(
  items: ItemParaImprimir[],
  anchoHoja: number = ANCHO_HOJA_CM,
  altoHoja: number = ALTO_HOJA_CM,
): HojaImpresion[] {
  if (!items.length) return [];

  const hojas: HojaImpresion[] = [];
  let hoja: ItemParaImprimir[][] = [];
  let fila: ItemParaImprimir[] = [];
  let anchoFila = 0;
  let altoFila = 0;
  let altoUsado = 0;

  const cerrarFila = () => {
    if (!fila.length) return;
    hoja.push(fila);
    altoUsado += altoFila + SEPARACION_CM;
    fila = [];
    anchoFila = 0;
    altoFila = 0;
  };

  for (const item of items) {
    const anchoItem = item.anchoCm * 2 + SEPARACION_PAREJA_CM;
    const altoItem = item.altoCm + ALTO_PIE_CM;
    // En esta fila ya no cabe otro producto: se cierra y se sigue abajo.
    if (fila.length && anchoFila + anchoItem > anchoHoja) cerrarFila();
    // Tampoco queda alto para otra fila en esta hoja: se continua en otra hoja.
    if (!fila.length && altoUsado + altoItem + SEPARACION_CM > altoHoja) {
      if (hoja.length) hojas.push({ filas: hoja });
      hoja = [];
      altoUsado = 0;
    }
    fila.push(item);
    anchoFila += anchoItem + SEPARACION_CM;
    altoFila = Math.max(altoFila, altoItem);
  }

  cerrarFila();
  if (hoja.length) hojas.push({ filas: hoja });
  return hojas;
}
