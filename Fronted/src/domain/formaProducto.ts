/**
 * Forma del producto. Se deduce del nombre, el SKU y la categoría porque así
 * se comporta hoy la vista 3D del editor de personalización.
 */
export type FormaProducto = "tarjeta" | "llavero" | "llaveroCircular" | "anillo" | "producto";

export function textoProducto(
  nombre?: string | null,
  sku?: string | null,
  categoria?: string | null,
): string {
  return `${nombre ?? ""} ${sku ?? ""} ${categoria ?? ""}`;
}

/** true si el producto lleva chip NFC (pide la URL que se graba). */
export function esNfcProducto(
  nombre?: string | null,
  sku?: string | null,
  categoria?: string | null,
): boolean {
  return /nfc/i.test(textoProducto(nombre, sku, categoria));
}

/** Forma del producto: la circular gana sobre la rectangular de llavero. */
export function formaProducto(
  nombre?: string | null,
  sku?: string | null,
  categoria?: string | null,
): FormaProducto {
  // El nombre y el SKU mandan; la categoria solo sirve de respaldo.
  const principal = `${nombre ?? ""} ${sku ?? ""}`;
  const todo = `${principal} ${categoria ?? ""}`;
  if (/llavero|llave/i.test(todo) && /circular|redondo|ficha/i.test(todo)) {
    return "llaveroCircular";
  }
  const detectar = (texto: string): FormaProducto | null => {
    if (/llavero|llave/i.test(texto)) return "llavero";
    if (/anillo/i.test(texto)) return "anillo";
    if (/tarjeta/i.test(texto)) return "tarjeta";
    return null;
  };
  return detectar(principal) ?? detectar(categoria ?? "") ?? "producto";
}

/** El llavero circular se imprime sin borde: la imagen ocupa el diámetro completo. */
export function esLlaveroCircular(
  nombre?: string | null,
  sku?: string | null,
  categoria?: string | null,
): boolean {
  return formaProducto(nombre, sku, categoria) === "llaveroCircular";
}
