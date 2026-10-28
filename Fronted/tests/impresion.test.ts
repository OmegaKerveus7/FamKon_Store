import { describe, expect, test } from 'bun:test';
import { recorteHtml } from '../src/domain/impresion';

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
