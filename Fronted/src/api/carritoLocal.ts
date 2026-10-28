import { agregarAlCarritoAPI, type PersonalizacionContenido, type Producto } from "./famkon";
import {
  EVENTO_CARRITO,
  type ItemCarritoLocal,
  normalizarCarritoVisitante,
} from "../domain/carritoVisitante";

/**
 * Carrito de un visitante que todavía no tiene cuenta.
 * Vive en localStorage y se sube al carrito real al iniciar sesión.
 */
const CLAVE = "famkon.carrito.local";

export type { ItemCarritoLocal };

function leer(): ItemCarritoLocal[] {
  try {
    const raw = localStorage.getItem(CLAVE);
    if (!raw) return [];
    return normalizarCarritoVisitante(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Avisa que el carrito local cambió. No depende de que exista `window` (tests/SSR). */
function notificarCambioLocal() {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  window.dispatchEvent(new Event("carrito-local-cambiado"));
  window.dispatchEvent(new Event(EVENTO_CARRITO));
}

function guardar(items: ItemCarritoLocal[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(items));
  } catch {
    // Si no se puede guardar (modo privado), el carrito local no estará disponible.
  }
  notificarCambioLocal();
}

export function obtenerCarritoLocal(): ItemCarritoLocal[] {
  return leer();
}

export function cantidadCarritoLocal(): number {
  return leer().reduce((total, item) => total + item.cantidad, 0);
}

/** Personalización de texto (o URL de NFC) que se puede guardar sin sesión. */
function contenidoLocal(
  personalizacion?: PersonalizacionContenido | null,
): Pick<
  ItemCarritoLocal,
  "mensajeLadoA" | "mensajeLadoB" | "configLadoA" | "configLadoB"
> {
  return {
    mensajeLadoA: personalizacion?.mensajeLadoA?.trim() || null,
    mensajeLadoB: personalizacion?.mensajeLadoB?.trim() || null,
    configLadoA: personalizacion?.configLadoA?.trim() || null,
    configLadoB: personalizacion?.configLadoB?.trim() || null,
  };
}

export function agregarCarritoLocal(
  producto: Producto,
  cantidad = 1,
  personalizacion?: PersonalizacionContenido | null,
) {
  const items = leer();
  const existente = items.find((i) => i.idProducto === producto.idProducto);
  const extra = contenidoLocal(personalizacion);
  if (existente) {
    existente.cantidad += cantidad;
    existente.mensajeLadoA = extra.mensajeLadoA ?? existente.mensajeLadoA;
    existente.mensajeLadoB = extra.mensajeLadoB ?? existente.mensajeLadoB;
    existente.configLadoA = extra.configLadoA ?? existente.configLadoA;
    existente.configLadoB = extra.configLadoB ?? existente.configLadoB;
  } else {
    items.push({
      idProducto: producto.idProducto,
      nombre: producto.nombre,
      sku: producto.sku,
      precioUnitario: producto.precioBase,
      cantidad,
      idArchivoImagen: producto.idArchivoImagen ?? null,
      ...extra,
    });
  }
  guardar(items);
}

export function actualizarCantidadLocal(idProducto: number, cantidad: number) {
  const items = leer()
    .map((i) => (i.idProducto === idProducto ? { ...i, cantidad: Math.max(1, cantidad) } : i))
    .filter((i) => i.cantidad > 0);
  guardar(items);
}

export function eliminarCarritoLocal(idProducto: number) {
  guardar(leer().filter((i) => i.idProducto !== idProducto));
}

export function vaciarCarritoLocal() {
  guardar([]);
}

/** Contenido de personalización que se puede enviar al carrito del servidor. */
export function contenidoParaEnviar(
  item: ItemCarritoLocal,
): PersonalizacionContenido | null {
  const contenido: PersonalizacionContenido = {};
  if (item.mensajeLadoA) contenido.mensajeLadoA = item.mensajeLadoA;
  if (item.mensajeLadoB) contenido.mensajeLadoB = item.mensajeLadoB;
  if (item.configLadoA) contenido.configLadoA = item.configLadoA;
  if (item.configLadoB) contenido.configLadoB = item.configLadoB;
  return Object.keys(contenido).length ? contenido : null;
}

export interface ResultadoFusion {
  /** Líneas que se pudieron subir al carrito real. */
  subidos: number;
  /** Líneas que quedaron en el carrito local (producto no disponible, etc.). */
  pendientes: number;
}

/**
 * Sube el carrito de visitante al carrito real del usuario.
 * Se ejecuta al iniciar sesión; si algún producto falla se omite sin romper
 * el resto y esa línea permanece en el carrito local.
 */
export async function fusionarCarritoLocal(): Promise<ResultadoFusion> {
  const items = leer();
  if (!items.length) return { subidos: 0, pendientes: 0 };

  const subidos = new Set<number>();
  let cantidadSubida = 0;
  for (const item of items) {
    try {
      await agregarAlCarritoAPI({
        idProducto: item.idProducto,
        cantidad: item.cantidad,
        personalizacion: contenidoParaEnviar(item),
      });
      subidos.add(item.idProducto);
      cantidadSubida++;
    } catch {
      // Producto no disponible, sin existencia o error puntual: se sigue con el resto.
    }
  }

  const restantes = items.filter((i) => !subidos.has(i.idProducto));
  if (restantes.length !== items.length) guardar(restantes);

  return { subidos: cantidadSubida, pendientes: restantes.length };
}
