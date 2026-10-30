import { describe, expect, test } from 'bun:test';
import { recorteHtml, empacarEnHojas } from '../src/domain/impresion';

describe('Impresión de personalizaciones', () => {
  test('el recorte normal descuenta 0.5 cm y redondea las esquinas', () => {
    const html = recorteHtml('data:image/png;base64,AAA', 8.5, 5.5);
    expect(html).toContain('width:8.5cm;height:5.5cm');
    expect(html).toContain('width:calc(8.5cm - 0.5cm)');
    expect(html).toContain('height:calc(5.5cm - 0.5cm)');
    expect(html).toContain('border-radius:0.5cm');
  });

  test('el circular imprime la imagen completa, sin borde', () => {
    const html = recorteHtml('data:image/png;base64,AAA', 4, 4, true);
    expect(html).toContain('width:4cm;height:4cm');
    expect(html).toContain('width:4cm;height:4cm;border-radius:50%');
    expect(html).not.toContain('calc(');
  });

  test('sin imagen deja el recuadro vacío', () => {
    const html = recorteHtml(null, 4, 4, true);
    expect(html).toContain('<div class="recorte"');
    expect(html).not.toContain('<img');
  });
});

describe('Empaquetado de la impresión', () => {
  const llavero = (id: number) => ({ id, anchoCm: 3.1, altoCm: 4.5 });
  const tarjeta = (id: number) => ({ id, anchoCm: 8.5, altoCm: 5.5 });
  const circular = (id: number) => ({ id, anchoCm: 4, altoCm: 4 });

  test('los productos chicos entran varios por hoja', () => {
    const items = Array.from({ length: 12 }, (_, i) => llavero(i + 1));
    const hojas = empacarEnHojas(items);
    const total = hojas.flatMap((h) => h.filas).flat().length;
    expect(total).toBe(12);
    expect(hojas.length).toBeGreaterThan(1);
    // El orden se respeta: es una lista para ir cortando en orden.
    expect(hojas.flatMap((h) => h.filas).flat().map((i) => i.id)).toEqual(items.map((i) => i.id));
  });

  test('las tarjetas anchas van solas en su fila', () => {
    const hojas = empacarEnHojas([tarjeta(1), tarjeta(2)]);
    expect(hojas[0].filas[0].length).toBe(1);
  });

  test('un circular y un llavero comparten la misma fila', () => {
    // Par A/B: 4x2 = 8.8 cm y 3.1x2 = 7 cm: juntos 15.8 cm, entran en 18.6.
    const hojas = empacarEnHojas([circular(1), llavero(2)]);
    expect(hojas[0].filas[0].length).toBe(2);
  });

  test('si no cabe todo en una hoja se continua en otra', () => {
    const items = Array.from({ length: 30 }, (_, i) => tarjeta(i + 1));
    const hojas = empacarEnHojas(items);
    expect(hojas.length).toBeGreaterThan(1);
    expect(hojas.flatMap((h) => h.filas).flat().length).toBe(30);
  });

  test('sin productos no hay hojas', () => {
    expect(empacarEnHojas([])).toEqual([]);
  });
});
