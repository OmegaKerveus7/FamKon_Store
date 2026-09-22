import type { Compra, DetalleCompra, VistaCompra } from '../api/compras';
export const ESTADOS_COMPRA: Record<string, string> = {
  GENERADO: 'Pedido recibido', PAGO_PENDIENTE: 'Pago pendiente', PAGO_CONFIRMADO: 'Pago confirmado',
  EN_ELABORACION: 'En preparación', LISTO_RECOGER: 'Listo para recoger', LISTO_ENTREGA: 'Listo para entrega',
  EN_RUTA: 'En ruta', ENTREGADO: 'Entregado', RECOGIDO: 'Recogido', COMPRADOR_NO_ENCONTRADO: 'Intento fallido', CANCELADO: 'Cancelado',
};
export const ESTADOS_PAGO: Record<string, string> = { PENDIENTE: 'Pendiente de pago', APROBADO: 'Pagado con tarjeta', PAGADO_EFECTIVO: 'Efectivo recibido', RECHAZADO: 'Pago rechazado', ANULADO: 'Anulado', REEMBOLSO_PENDIENTE: 'Reembolso pendiente', REEMBOLSADO: 'Reembolsado' };
export const finalizado = (p: Compra) => ['ENTREGADO', 'RECOGIDO', 'CANCELADO'].includes(p.estado);
export const puedePreparar = (p: Compra) => ['GENERADO', 'PAGO_CONFIRMADO', 'PAGO_PENDIENTE'].includes(p.estado) && (p.metodoPago === 'EFECTIVO' || p.estadoPago === 'APROBADO');
export const puedePagar = (p: Compra) => p.metodoPago === 'TARJETA' && ['PENDIENTE', 'RECHAZADO'].includes(p.estadoPago) && !finalizado(p);
export function entregaActiva(d: DetalleCompra, usuario: number) { return d.entregas.find(e => e.idRepartidor === usuario && ['ASIGNADA', 'EN_RUTA'].includes(e.estado)); }
export function puedeFinalizar(d: DetalleCompra, vista: VistaCompra, usuario: number) {
  return vista === 'admin' ? d.pedido.idModalidadEntrega === 1 && d.pedido.estado === 'LISTO_RECOGER' : vista === 'repartidor' && d.pedido.estado === 'EN_RUTA' && entregaActiva(d, usuario)?.estado === 'EN_RUTA';
}
export function costoEnvio(modalidad: number) { return modalidad === 1 ? 0 : 25; }
export const moneda = (n: number) => new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(n);
export const fechaCompra = (fecha?: string | null) => fecha ? new Date(fecha).toLocaleString('es-GT', { timeZone: 'America/Guatemala', dateStyle: 'medium', timeStyle: 'short' }) : '—';
