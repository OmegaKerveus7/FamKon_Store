import { afterEach, describe, expect, test } from 'bun:test';
import {
  bytesEnChip,
  cabeEnChip,
  grabarUrlEnChip,
  mensajeErrorNfc,
  nfcSoportado,
  urlParaChip,
} from '../src/domain/nfc';

const global = globalThis as unknown as { window?: Record<string, unknown> };

afterEach(() => {
  delete global.window;
});

describe('URL para el chip', () => {
  test('acepta http y https y recorta espacios', () => {
    expect(urlParaChip('  https://open.spotify.com/track/1 ')).toBe('https://open.spotify.com/track/1');
    expect(urlParaChip('http://famkon.site')).toBe('http://famkon.site');
  });

  test('rechaza vacío, otros esquemas y texto suelto', () => {
    expect(urlParaChip('')).toBeNull();
    expect(urlParaChip(null)).toBeNull();
    expect(urlParaChip('javascript:alert(1)')).toBeNull();
    expect(urlParaChip('mailto:a@b.com')).toBeNull();
    expect(urlParaChip('famkon.site')).toBeNull();
  });
});

describe('Tamaño en el chip', () => {
  test('https:// y www. cuentan como un solo byte de prefijo', () => {
    expect(bytesEnChip('https://famkon.site')).toBe('famkon.site'.length + 5);
    expect(bytesEnChip('https://www.famkon.site')).toBe('famkon.site'.length + 5);
  });

  test('una URL corta cabe y una de 500 caracteres no', () => {
    expect(cabeEnChip('https://famkon.site')).toBe(true);
    expect(cabeEnChip('https://famkon.site/' + 'a'.repeat(480))).toBe(false);
  });
});

describe('Escritura con Web NFC', () => {
  test('sin Web NFC no está soportado y no escribe', async () => {
    global.window = { isSecureContext: true };
    expect(nfcSoportado()).toBe(false);
    await expect(grabarUrlEnChip('https://famkon.site')).rejects.toMatchObject({ name: 'NotSupportedError' });
  });

  test('en contexto no seguro (http) no se ofrece grabar', () => {
    global.window = { isSecureContext: false, NDEFReader: class {} };
    expect(nfcSoportado()).toBe(false);
  });

  test('graba un único registro url con la URL del cliente', async () => {
    const llamadas: unknown[] = [];
    global.window = {
      isSecureContext: true,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      NDEFReader: class {
        async write(mensaje: unknown, opciones: unknown) { llamadas.push([mensaje, opciones]); }
      },
    };
    await grabarUrlEnChip('https://open.spotify.com/track/1');
    const [mensaje, opciones] = llamadas[0] as [{ records: unknown[] }, { overwrite: boolean }];
    expect(mensaje.records).toEqual([{ recordType: 'url', data: 'https://open.spotify.com/track/1' }]);
    expect(opciones.overwrite).toBe(true);
  });

  test('no escribe una URL inválida', async () => {
    let escribio = false;
    global.window = {
      isSecureContext: true,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      NDEFReader: class { async write() { escribio = true; } },
    };
    await expect(grabarUrlEnChip('javascript:alert(1)')).rejects.toThrow();
    expect(escribio).toBe(false);
  });

  test('cancelar la señal aborta la escritura', async () => {
    let senalChip: AbortSignal | undefined;
    global.window = {
      isSecureContext: true,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      NDEFReader: class {
        write(_m: unknown, o: { signal: AbortSignal }) {
          senalChip = o.signal;
          return new Promise((_ok, no) => o.signal.addEventListener('abort', () => no(new DOMException('x', 'AbortError'))));
        }
      },
    };
    const control = new AbortController();
    const promesa = grabarUrlEnChip('https://famkon.site', control.signal);
    control.abort();
    await expect(promesa).rejects.toMatchObject({ name: 'AbortError' });
    expect(senalChip?.aborted).toBe(true);
  });

  test('traduce los errores a mensajes para producción', () => {
    expect(mensajeErrorNfc(new DOMException('x', 'AbortError'))).toContain('canceló');
    expect(mensajeErrorNfc(new DOMException('x', 'NotAllowedError'))).toContain('Permití');
    expect(mensajeErrorNfc(new DOMException('x', 'NetworkError'))).toContain('No se pudo grabar');
    expect(mensajeErrorNfc(new Error('otro'))).toContain('NFC');
  });
});
