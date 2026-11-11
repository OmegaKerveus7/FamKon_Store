import { expect, test } from 'bun:test';
import { progresoRastreo } from '../src/domain/progresoRastreo';
test('recogida tiene cuatro etapas y respeta el estado actual', () => {
  expect(progresoRastreo('GENERADO', 1)).toMatchObject({ actual: 0, pasos: ['Confirmado', 'Preparación', 'Listo', 'Recogido'] });
  expect(progresoRastreo('RECOGIDO', 1).actual).toBe(3);
});
test('domicilio incluye ruta y entrega, sin inventar progreso en cancelados o desconocidos', () => {
  expect(progresoRastreo('ENTREGADO', 2)).toMatchObject({ actual: 4 });
  expect(progresoRastreo('EN_RUTA', 2).actual).toBe(3);
  expect(progresoRastreo('CANCELADO', 1)).toMatchObject({ actual: -1, cancelado: true });
  expect(progresoRastreo('OTRO', 1).actual).toBe(-1);
});
