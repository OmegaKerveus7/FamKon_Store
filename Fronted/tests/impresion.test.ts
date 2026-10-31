import { describe, expect, test } from 'bun:test';
import {
  recorteHtml,
  empacarEnHojas,
  areaUtil,
  cabeEnHoja,
  medidasPar,
  PAPELES,
} from '../src/domain/impresion';

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

describe('Papel de impresión', () => {
  const carta = areaUtil(PAPELES.carta);
  const foto = areaUtil(PAPELES.foto);
  const llavero = (id: number) => ({ id, anchoCm: 3.1, altoCm: 4.5 });
  const tarjeta = (id: number) => ({ id, anchoCm: 8.5, altoCm: 5.5 });
  const circular = (id: number) => ({ id, anchoCm: 4, altoCm: 4 });

  test('el área útil descuenta los márgenes de cada papel', () => {
    expect(carta).toEqual({ ancho: 19.1, alto: 25.5 });
    expect(foto).toEqual({ ancho: 9, alto: 14 });
  });

  test('en carta todos los pares van lado a lado', () => {
    for (const item of [llavero(1), tarjeta(2), circular(3)]) {
      expect(medidasPar(item, carta.ancho).vertical).toBe(false);
    }
  });

  test('en papel foto la tarjeta apila A y B, y llavero y circular van lado a lado', () => {
    expect(medidasPar(tarjeta(1), foto.ancho).vertical).toBe(true);
    expect(medidasPar(llavero(2), foto.ancho).vertical).toBe(false);
    expect(medidasPar(circular(3), foto.ancho).vertical).toBe(false);
  });

  test('los productos de la tienda caben en los dos papeles sin cambiar su tamaño', () => {
    for (const item of [llavero(1), tarjeta(2), circular(3)]) {
      expect(cabeEnHoja(item, carta.ancho, carta.alto)).toBe(true);
      expect(cabeEnHoja(item, foto.ancho, foto.alto)).toBe(true);
    }
  });

  test('lo que no entra ni apilado se detecta (no se reescala)', () => {
    expect(cabeEnHoja({ id: 1, anchoCm: 12, altoCm: 5 }, foto.ancho, foto.alto)).toBe(false);
    expect(cabeEnHoja({ id: 2, anchoCm: 8.5, altoCm: 8 }, foto.ancho, foto.alto)).toBe(false);
  });

  test('en papel foto el empaque marca la tarjeta como vertical y respeta el orden', () => {
    const hojas = empacarEnHojas([tarjeta(1), llavero(2), circular(3)], foto.ancho, foto.alto);
    const colocados = hojas.flatMap((h) => h.filas).flat();
    expect(colocados.map((i) => i.id)).toEqual([1, 2, 3]);
    expect(colocados.find((i) => i.id === 1)?.vertical).toBe(true);
    expect(colocados.find((i) => i.id === 2)?.vertical).toBe(false);
  });

  test('cada hoja foto respeta el alto útil', () => {
    const items = Array.from({ length: 10 }, (_, i) => tarjeta(i + 1));
    const hojas = empacarEnHojas(items, foto.ancho, foto.alto);
    for (const hoja of hojas) {
      const alto = hoja.filas.reduce((suma, fila) => suma + Math.max(...fila.map((i) => medidasPar(i, foto.ancho).alto)) + 0.6, 0);
      expect(alto).toBeLessThanOrEqual(foto.alto + 0.6);
    }
    expect(hojas.flatMap((h) => h.filas).flat().length).toBe(10);
  });
});
