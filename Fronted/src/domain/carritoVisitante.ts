import type { CarritoItem } from "../api/famkon";

/** Evento global que avisa que el carrito cambió (servidor o local). */
export const EVENTO_CARRITO = "famkon-carrito-cambiado";

/**
 * Línea del carrito de un visitante sin sesión.
 * Vive en localStorage y se sube al carrito real al iniciar sesión.
 */
export interface ItemCarritoLocal {
  idProducto: number;
  nombre: string;
  sku: string;
  precioUnitario: number;
  cantidad: number;
  idArchivoImagen?: number | null;
  mensajeLadoA?: string | null;
  mensajeLadoB?: string | null;
  configLadoA?: string | null;
  configLadoB?: string | null;
}

/** Línea de carrito normalizada para la interfaz (sea del servidor o del visitante). */
export interface LineaCarrito {
  /** idDetalle del servidor; en el carrito local coincide con el idProducto. */
  id: number;
  idProducto: number;
  nombre: string;
  sku: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  idArchivoImagen: number | null;
  idArchivoLadoA: number | null;
  idArchivoLadoB: number | null;
  mensajeLadoA: string | null;
  mensajeLadoB: string | null;
  configLadoA: string | null;
  configLadoB: string | null;
  idPersonalizacion: number | null;
}

function textoOpcional(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return limpio.length ? limpio : null;
}

function numeroOpcional(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

/**
 * Convierte lo guardado en localStorage en líneas válidas.
 * Tolera datos corruptos o de versiones anteriores (no borra lo válido).
 */
export function normalizarCarritoVisitante(datos: unknown): ItemCarritoLocal[] {
  if (!Array.isArray(datos)) return [];
  const salida: ItemCarritoLocal[] = [];
  for (const bruto of datos) {
    if (!bruto || typeof bruto !== "object") continue;
    const item = bruto as Record<string, unknown>;
    const idProducto = Number(item.idProducto);
    const cantidad = Math.floor(Number(item.cantidad));
    const precioUnitario = Number(item.precioUnitario);
    if (!Number.isFinite(idProducto) || idProducto <= 0) continue;
    if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
    if (!Number.isFinite(precioUnitario) || precioUnitario < 0) continue;
    salida.push({
      idProducto,
      nombre: typeof item.nombre === "string" && item.nombre.trim() ? item.nombre : "Producto",
      sku: typeof item.sku === "string" ? item.sku : "",
      precioUnitario,
      cantidad,
      idArchivoImagen: numeroOpcional(item.idArchivoImagen),
      mensajeLadoA: textoOpcional(item.mensajeLadoA),
      mensajeLadoB: textoOpcional(item.mensajeLadoB),
      configLadoA: textoOpcional(item.configLadoA),
      configLadoB: textoOpcional(item.configLadoB),
    });
  }
  return salida;
}

/** Líneas del carrito local ya normalizadas. */
export function lineasVisitantes(items: ItemCarritoLocal[]): LineaCarrito[] {
  return items.map((item) => ({
    id: item.idProducto,
    idProducto: item.idProducto,
    nombre: item.nombre,
    sku: item.sku,
    cantidad: item.cantidad,
    precioUnitario: item.precioUnitario,
    subtotal: item.cantidad * item.precioUnitario,
    idArchivoImagen: item.idArchivoImagen ?? null,
    idArchivoLadoA: null,
    idArchivoLadoB: null,
    mensajeLadoA: item.mensajeLadoA ?? null,
    mensajeLadoB: item.mensajeLadoB ?? null,
    configLadoA: item.configLadoA ?? null,
    configLadoB: item.configLadoB ?? null,
    idPersonalizacion: null,
  }));
}

/** Líneas del carrito del servidor ya normalizadas. */
export function lineasServidor(items: CarritoItem[]): LineaCarrito[] {
  return items.map((item) => ({
    id: item.idDetalle,
    idProducto: item.idProducto,
    nombre: item.producto,
    sku: item.sku,
    cantidad: item.cantidad,
    precioUnitario: item.precioUnitario,
    subtotal: item.subtotal,
    idArchivoImagen: item.idArchivoImagen ?? null,
    idArchivoLadoA: item.idArchivoLadoA ?? null,
    idArchivoLadoB: item.idArchivoLadoB ?? null,
    mensajeLadoA: item.mensajeLadoA ?? null,
    mensajeLadoB: item.mensajeLadoB ?? null,
    configLadoA: item.configLadoA ?? null,
    configLadoB: item.configLadoB ?? null,
    idPersonalizacion: item.idPersonalizacion ?? null,
  }));
}

export function unidadesCarrito(items: LineaCarrito[]): number {
  return items.reduce((total, item) => total + item.cantidad, 0);
}

/** Extrae la URL guardada en la configuración de personalización de un lado. */
export function urlDeConfig(config?: string | null): string | null {
  if (!config) return null;
  try {
    const datos = JSON.parse(config) as { url?: unknown };
    return typeof datos.url === "string" ? datos.url : null;
  } catch {
    return null;
  }
}

export function subtotalCarrito(items: LineaCarrito[]): number {
  return items.reduce((total, item) => total + item.subtotal, 0);
}

/** Roles que pueden crear pedidos (y por lo tanto pagar desde el checkout). */
export function puedeCrearPedido(roles: string | null | undefined): boolean {
  const lista = (roles ?? "").toUpperCase().split(/[,;\s]+/).filter(Boolean);
  return lista.includes("COMPRADOR") || lista.includes("ADMIN");
}

/** Pantalla de inicio según el rol principal del usuario. */
export function rutaInicialPorRol(roles: string | null | undefined): string {
  const superiores = (roles ?? "").toUpperCase().split(/[,;\s]+/).filter(Boolean);
  const orden = ["ADMIN", "SUPERVISOR", "REPARTIDOR", "COMPRADOR"];
  for (const rol of orden) {
    if (superiores.includes(rol)) return rol === "ADMIN" ? "/admin/pedidos" : "/inicio";
  }
  return "/inicio";
}

/**
 * Acepta solo rutas internas de la SPA (nunca URLs externas ni rutas
 * relativas al protocolo como "//sitio.com").
 */
export function rutaSeguraInterna(ruta: unknown): string | null {
  if (typeof ruta !== "string") return null;
  const valor = ruta.trim();
  if (!valor.startsWith("/")) return null;
  if (valor.startsWith("//")) return null;
  if (valor.includes("://")) return null;
  return valor;
}

/** Destino al que se va después de iniciar sesión. */
export function rutaTrasIngreso(
  roles: string | null | undefined,
  volverA: unknown,
): string {
  return rutaSeguraInterna(volverA) ?? rutaInicialPorRol(roles);
}

/**
 * Destino tras iniciar sesión cuando el visitante estaba pagando:
 * si el usuario no puede crear pedidos se lo deja en el carrito.
 */
export function rutaTrasPago(
  roles: string | null | undefined,
  volverA: unknown,
): string {
  const destino = rutaTrasIngreso(roles, volverA);
  if (destino === "/comprador/checkout" && !puedeCrearPedido(roles)) {
    return "/carrito";
  }
  return destino;
}
