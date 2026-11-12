import { describe, expect, test } from 'bun:test';
import {
  evaluarCalidad,
  evaluarIluminacion,
  evaluarRostro,
  medirBrillo,
  medirNitidez,
  type DatosImagen,
} from '../src/domain/../utils/calidadFoto';

function imagen(
  ancho: number,
  alto: number,
  relleno: (x: number, y: number) => [number, number, number],
): DatosImagen {
  const data = new Array<number>(ancho * alto * 4).fill(0);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const [r, g, b] = relleno(x, y);
      const i = (y * ancho + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { data, width: ancho, height: alto };
}

const plano = (valor: number) => imagen(40, 40, () => [valor, valor, valor]);
const ajedrez = (tamano = 6) =>
  imagen(48, 48, (x, y) => {
    const claro = (Math.floor(x / tamano) + Math.floor(y / tamano)) % 2 === 0;
    return claro ? [235, 235, 235] : [25, 25, 25];
  });

describe('Calidad de la foto para el rostro', () => {
  test('mide el brillo de la imagen', () => {
    expect(Math.round(medirBrillo(plano(128)))).toBe(128);
    expect(Math.round(medirBrillo(plano(0)))).toBe(0);
    expect(Math.round(medirBrillo(plano(255)))).toBe(255);
  });

  test('una imagen plana es borrosa y una con detalle es nitida', () => {
    expect(medirNitidez(plano(120))).toBe(0);
    expect(medirNitidez(ajedrez())).toBeGreaterThan(200);
  });

  test('avisa de poca luz, mucha luz y falta de nitidez', () => {
    expect(evaluarIluminacion(plano(30))).toContain('poco_luz');
    expect(evaluarIluminacion(plano(240))).toContain('mucha_luz');
    expect(evaluarIluminacion(plano(120))).toContain('borrosa');
    // Con detalle y luz media no hay problemas de luz.
    expect(evaluarIluminacion(ajedrez())).toEqual([]);
  });

  test('detecta que no hay rostro o que hay varias personas', () => {
    expect(evaluarRostro([], 0)).toEqual(['sin_rostro']);
    expect(evaluarRostro([{ x: 0.5, y: 0.5 }], 2)).toEqual(['varias_personas']);
  });

  test('detecta el rostro pequeno y fuera de centro', () => {
    const pequeno = [
      { x: 0.48, y: 0.48 },
      { x: 0.52, y: 0.48 },
      { x: 0.5, y: 0.52 },
    ];
    expect(evaluarRostro(pequeno)).toContain('rostro_pequeno');
    const grande = Array.from({ length: 20 }, (_, i) => ({
      x: 0.2 + (i % 5) * 0.12,
      y: 0.1 + Math.floor(i / 5) * 0.08,
    }));
    expect(evaluarRostro(grande)).not.toContain('rostro_pequeno');
    const lejos = [
      { x: 0.7, y: 0.2 },
      { x: 0.9, y: 0.25 },
      { x: 0.8, y: 0.45 },
    ];
    expect(evaluarRostro(lejos)).toContain('rostro_descentrado');
  });

  test('sospecha que el rostro esta tapado cuando la textura es baja', () => {
    const puntos = Array.from({ length: 20 }, (_, i) => ({
      x: 0.3 + (i % 5) * 0.1,
      y: 0.2 + Math.floor(i / 5) * 0.06,
    }));
    expect(evaluarRostro(puntos, 1, 5)).toContain('rostro_tapado');
    expect(evaluarRostro(puntos, 1, 90)).not.toContain('rostro_tapado');
  });

  test('arma el mensaje y el puntaje final', () => {
    const resultado = evaluarCalidad(['poco_luz', 'borrosa']);
    expect(resultado.ok).toBe(false);
    expect(resultado.puntaje).toBe(50);
    expect(resultado.mensaje).toMatch(/poca luz/i);
    expect(evaluarCalidad([]).ok).toBe(true);
    expect(evaluarCalidad([]).puntaje).toBe(100);
  });
});
