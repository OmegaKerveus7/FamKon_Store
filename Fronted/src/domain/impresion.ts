/** Radio de las esquinas y recorte que se descuenta a la imagen. */
export const RADIO_ESQUINA_CM = 0.5;
export const RECORTE_CM = 0.5;

/** Papeles disponibles para imprimir. El diseño siempre sale a su tamaño real en cm. */
export type PapelClave = "carta" | "foto";

export interface Papel {
  clave: PapelClave;
  nombre: string;
  /** Valor de `size` en @page. */
  tamanoCss: string;
  anchoCm: number;
  altoCm: number;
  margenMm: number;
}

export const PAPELES: Record<PapelClave, Papel> = {
  carta: { clave: "carta", nombre: "Carta (21.6 × 27.9 cm)", tamanoCss: "letter", anchoCm: 21.59, altoCm: 27.94, margenMm: 12 },
  foto: { clave: "foto", nombre: "Fotográfico 10 × 15 cm", tamanoCss: "100mm 150mm", anchoCm: 10, altoCm: 15, margenMm: 5 },
};

export const PAPEL_POR_DEFECTO: PapelClave = "carta";

/** Area util del papel (sin margenes), redondeada hacia abajo a 1 mm. */
export function areaUtil(papel: Papel): { ancho: number; alto: number } {
  const margenCm = (papel.margenMm * 2) / 10;
  return {
    ancho: Math.floor((papel.anchoCm - margenCm) * 10) / 10,
    alto: Math.floor((papel.altoCm - margenCm) * 10) / 10,
  };
}

/** Area util de una hoja carta con margenes de 12 mm. */
export const ANCHO_HOJA_CM = areaUtil(PAPELES.carta).ancho;
export const ALTO_HOJA_CM = areaUtil(PAPELES.carta).alto;
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

/** Producto ya ubicado: `vertical` = el lado B va debajo del A porque el par no cabe a lo ancho. */
export interface ItemColocado extends ItemParaImprimir {
  vertical: boolean;
}

/** Hoja con las filas de productos que caben en ella. */
export interface HojaImpresion {
  filas: ItemColocado[][];
}

/**
 * Espacio que ocupa el par A/B con su pie. Si el par no cabe a lo ancho se
 * apila (A arriba, B abajo) en vez de reducir el diseño.
 */
export function medidasPar(item: ItemParaImprimir, anchoHoja: number): { vertical: boolean; ancho: number; alto: number } {
  const ancho = item.anchoCm * 2 + SEPARACION_PAREJA_CM;
  if (ancho <= anchoHoja) return { vertical: false, ancho, alto: item.altoCm + ALTO_PIE_CM };
  return { vertical: true, ancho: item.anchoCm, alto: item.altoCm * 2 + SEPARACION_PAREJA_CM + ALTO_PIE_CM };
}

/** false si el producto no entra en el papel ni apilando sus dos lados. */
export function cabeEnHoja(item: ItemParaImprimir, anchoHoja: number, altoHoja: number): boolean {
  const par = medidasPar(item, anchoHoja);
  return par.ancho <= anchoHoja && par.alto + SEPARACION_CM <= altoHoja;
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
  let hoja: ItemColocado[][] = [];
  let fila: ItemColocado[] = [];
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
    const { vertical, ancho: anchoItem, alto: altoItem } = medidasPar(item, anchoHoja);
    // En esta fila ya no cabe otro producto: se cierra y se sigue abajo.
    if (fila.length && anchoFila + anchoItem > anchoHoja) cerrarFila();
    // Tampoco queda alto para otra fila en esta hoja: se continua en otra hoja.
    if (!fila.length && altoUsado + altoItem + SEPARACION_CM > altoHoja) {
      if (hoja.length) hojas.push({ filas: hoja });
      hoja = [];
      altoUsado = 0;
    }
    fila.push({ ...item, vertical });
    anchoFila += anchoItem + SEPARACION_CM;
    altoFila = Math.max(altoFila, altoItem);
  }

  cerrarFila();
  if (hoja.length) hojas.push({ filas: hoja });
  return hojas;
}
