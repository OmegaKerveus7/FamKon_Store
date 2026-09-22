import { obtenerToken } from './famkon';
export type VistaCompra = 'cliente' | 'admin' | 'repartidor';
export interface DireccionCompra {
  telefonoContacto: string; telefonoAlterno?: string | null; departamento?: string | null;
  municipio?: string | null; direccionEntrega?: string | null; referenciaEntrega?: string | null;
}
export interface Compra extends DireccionCompra {
  idPedido: number; idUsuario: number; numeroPedido: string; idModalidadEntrega: number;
  subtotal: number; cargoEntrega: number; total: number; codMoneda: string; fechaPedido: string;
  estado: string; estadoNombre: string; cliente: string; metodoPago: string; estadoPago: string;
  entorno: string; idPago: number; idCheckoutProveedor: string | null; entregasActivas: number;
}
export interface EntregaCompra {
  idEntrega: number; idRepartidor: number | null; repartidor: string | null; numeroIntento: number;
  estado: string; nombreReceptor: string | null; idArchivoEvidencia: number | null;
  montoEfectivo: number; observaciones: string | null; fechaAsignacion: string | null;
  fechaIntento: string | null; fechaEntrega: string | null;
}
export interface DetalleCompra {
  pedido: Compra;
  productos: { idProducto: number; nombreProducto: string; skuProducto: string; cantidad: number; precioUnitario: number; precioPersonaliza: number; subtotal: number }[];
  historial: { idHistorial: number; estado: string; nombre: string; comentario: string | null; fecha: string; actor: string | null }[];
  entregas: EntregaCompra[];
  auditoria: { motivo: string; actor: string; fecha: string }[];
}
export interface ConfigCompra { direccionTienda: string; horario: string; cargoDomicilio: number; cargoTienda: number; tarjetaDisponible: boolean; entorno: string }
export async function comprasRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await comprasFetch(path, init);
  return res.json() as Promise<T>;
}
async function comprasFetch(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const token = obtenerToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init?.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const res = await fetch(`/api/famkon${path}`, { ...init, headers });
  if (res.status === 401) {
    ['famkon.token', 'famkon.usuario', 'famkon.permisos'].forEach(k => localStorage.removeItem(k));
    window.location.assign('/login'); throw new Error('Tu sesión expiró. Iniciá sesión nuevamente.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.mensaje || (res.status === 404 ? 'Pedido no disponible.' : res.status === 403 ? 'No tienes permiso para esta operación.' : 'No se pudo completar la operación.'));
  }
  return res;
}
export const configCompra = () => comprasRequest<ConfigCompra>('/compras/configuracion');
export const listarCompras = (vista: VistaCompra, pagina: number, estado: string, busqueda: string, signal?: AbortSignal) =>
  comprasRequest<{ pedidos: Compra[]; total: number; pagina: number; tamanoPagina: number }>(`/compras?${new URLSearchParams({ vista, pagina: String(pagina), estado, busqueda })}`, { signal });
export const detalleCompra = (id: number, vista: VistaCompra, signal?: AbortSignal) => comprasRequest<DetalleCompra>(`/compras/${id}?vista=${vista}`, { signal });
export const crearCompra = (body: DireccionCompra & { idCarrito: number; idModalidadEntrega: number; metodoPago: string }) => comprasRequest<{ idPedido: number }>('/compras', { method: 'POST', body: JSON.stringify(body) });
export const accionCompra = (id: number, accion: string, body: object = {}, method = 'POST') => comprasRequest<{ mensaje: string }>(`/compras/${id}/${accion}`, { method, body: JSON.stringify(body) });
export const iniciarPago = (id: number) => comprasRequest<{ url: string }>(`/compras/${id}/pago`, { method: 'POST' });
export const verificarPago = (id: number) => comprasRequest<{ estado: string }>(`/compras/${id}/verificar-pago`, { method: 'POST' });
export const repartidoresCompra = () => comprasRequest<{ idUsuario: number; nickname: string }[]>('/compras/repartidores');
export async function subirEvidenciaCompra(id: number, archivo: File) {
  const data = new FormData(); data.append('archivo', archivo);
  return comprasRequest<{ idArchivo: number }>(`/compras/${id}/evidencia`, { method: 'POST', body: data });
}
export async function descargarCompra(path: string, nombre: string) {
  const res = await comprasFetch(path); const blob = await res.blob();
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = nombre;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function fotoCompra(id: number, signal?: AbortSignal) {
  const res = await comprasFetch(`/archivos/${id}`, { signal }); return URL.createObjectURL(await res.blob());
}
