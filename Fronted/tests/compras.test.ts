import { describe, expect, test } from 'bun:test';
import { costoEnvio, puedePreparar, puedePagar, puedeFinalizar, entregaActiva } from '../src/domain/compras';
import type { Compra, DetalleCompra } from '../src/api/compras';
const pedido = { idPedido: 1, idModalidadEntrega: 2, estado: 'GENERADO', metodoPago: 'EFECTIVO', estadoPago: 'PENDIENTE' } as Compra;
describe('Reglas visibles de compra', () => {
  test('tienda sin envío y domicilio Q25', () => { expect(costoEnvio(1)).toBe(0); expect(costoEnvio(2)).toBe(25); });
  test('efectivo se prepara sin cobrar', () => { expect(puedePreparar(pedido)).toBe(true); });
  test('tarjeta requiere confirmación', () => { expect(puedePreparar({ ...pedido, metodoPago: 'TARJETA' })).toBe(false); expect(puedePreparar({ ...pedido, metodoPago: 'TARJETA', estadoPago: 'APROBADO' })).toBe(true); });
  test('cancelado no se paga ni prepara', () => { const p = { ...pedido, estado: 'CANCELADO', metodoPago: 'TARJETA' }; expect(puedePagar(p)).toBe(false); expect(puedePreparar(p)).toBe(false); });
  test('mensajero solo cierra su intento activo en ruta', () => {
    const d = { pedido: { ...pedido, estado: 'EN_RUTA' }, entregas: [{ idRepartidor: 7, estado: 'NO_ENCONTRADO' }, { idRepartidor: 8, estado: 'EN_RUTA' }] } as DetalleCompra;
    expect(entregaActiva(d, 7)).toBeUndefined(); expect(puedeFinalizar(d, 'repartidor', 7)).toBe(false); expect(puedeFinalizar(d, 'repartidor', 8)).toBe(true); expect(puedeFinalizar(d, 'cliente', 8)).toBe(false);
  });
  test('administración registra recogida únicamente cuando está lista', () => {
    const d = { pedido: { ...pedido, idModalidadEntrega: 1, estado: 'LISTO_RECOGER' }, entregas: [] } as unknown as DetalleCompra;
    expect(puedeFinalizar(d, 'admin', 1)).toBe(true); d.pedido.estado = 'EN_ELABORACION'; expect(puedeFinalizar(d, 'admin', 1)).toBe(false);
  });
});
