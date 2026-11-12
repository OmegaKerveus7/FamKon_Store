import { expect, test } from 'bun:test';
import { seguimientoAdmin } from '../src/domain/seguimientoAdmin';
import { puedePreparar } from '../src/domain/compras';
import type { Compra } from '../src/api/compras';
test('pedidos nuevos o recién pagados esperan aceptación explícita', () => {
  for (const estado of ['GENERADO', 'PAGO_PENDIENTE', 'PAGO_CONFIRMADO']) expect(seguimientoAdmin(estado).titulo).toBe('Pendiente de aceptación');
});
test('aceptación no permite preparar tarjeta sin confirmar, pero sí efectivo', () => {
  const p = { estado: 'GENERADO', metodoPago: 'TARJETA', estadoPago: 'PENDIENTE' } as Compra;
  expect(puedePreparar(p)).toBe(false);
  expect(puedePreparar({ ...p, estadoPago: 'APROBADO' })).toBe(true);
  expect(puedePreparar({ ...p, metodoPago: 'EFECTIVO' })).toBe(true);
});
test('distingue preparación, recogida, asignación y entregas fallidas', () => {
  expect(seguimientoAdmin('EN_ELABORACION').titulo).toContain('Aceptado');
  expect(seguimientoAdmin('LISTO_RECOGER').descripcion).toContain('no requiere repartidor');
  expect(seguimientoAdmin('LISTO_ENTREGA').descripcion).toContain('asignación');
  expect(seguimientoAdmin('COMPRADOR_NO_ENCONTRADO').titulo).toBe('Requiere seguimiento');
  expect(seguimientoAdmin('ENTREGADO').titulo).toBe('');
});
