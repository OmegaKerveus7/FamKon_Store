import { describe, expect, test } from 'bun:test';
import {
  esLlaveroCircular,
  esNfcProducto,
  formaProducto,
  textoProducto,
} from '../src/domain/formaProducto';

describe('Forma del producto', () => {
  test('el texto junta nombre, sku y categoria', () => {
    expect(textoProducto('Llavero NFC circular', 'LLA-NFC-CIRC', 'Llaveros')).toContain('LLA-NFC-CIRC');
    expect(textoProducto(null, null, null).trim()).toBe('');
  });

  test('detecta el NFC por nombre, sku o categoria', () => {
    expect(esNfcProducto('Llavero NFC circular', 'LLA-NFC-CIRC', 'Llaveros')).toBe(true);
    expect(esNfcProducto('Llavero NFC rectangular', 'LLA-001', 'Llaveros')).toBe(true);
    expect(esNfcProducto('Tarjeta NFC', 'TAR-NFC-01', 'Tarjetas NFC')).toBe(true);
    expect(esNfcProducto('Llavero de acrilico', 'LLA-001', 'Llaveros')).toBe(false);
  });

  test('distingue llavero rectangular, circular, tarjeta y anillo', () => {
    expect(formaProducto('Llavero NFC circular', 'LLA-NFC-CIRC', 'Llaveros')).toBe('llaveroCircular');
    expect(formaProducto('Llavero NFC rectangular', 'LLA-001', 'Llaveros')).toBe('llavero');
    expect(formaProducto('Tarjeta NFC', 'TAR-NFC-01', 'Tarjetas NFC')).toBe('tarjeta');
    expect(formaProducto('Anillos Gris perlado', 'ANI001', 'Tarjetas NFC')).toBe('anillo');
    expect(formaProducto('Zapato', 'ZAP-01', 'Otros')).toBe('producto');
  });

  test('el circular gana aunque la categoria mentione llaveros', () => {
    expect(formaProducto('Ficha circular', 'LLA-NFC-CIRC', 'Llaveros de acrilico')).toBe('llaveroCircular');
    expect(esLlaveroCircular('Llavero NFC circular', 'LLA-NFC-CIRC', 'Llaveros')).toBe(true);
    expect(esLlaveroCircular('Llavero NFC rectangular', 'LLA-001', 'Llaveros')).toBe(false);
    expect(esLlaveroCircular('Tarjeta NFC', 'TAR-NFC-01', 'Tarjetas NFC')).toBe(false);
  });

  test('un producto que no es llavero nunca es circular', () => {
    expect(formaProducto('Tarjeta circular', 'TAR-CIRC', 'Tarjetas')).toBe('tarjeta');
    expect(esLlaveroCircular('Tarjeta circular', 'TAR-CIRC', 'Tarjetas')).toBe(false);
  });
});
