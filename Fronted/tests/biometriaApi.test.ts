import { expect, spyOn, test } from 'bun:test';
import { accederConRostro, ErrorFacial } from '../src/modules/biometria/api';

test('el acceso facial envía solo la captura, sin correo ni usuario', async () => {
  const original = globalThis.fetch;
  let cuerpo: unknown;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    cuerpo = JSON.parse(init!.body as string);
    return new Response(JSON.stringify({ codigoS: 200, codigo: 'BIO_LOGIN_OK', token: 'prueba', usuario: { idUsuario: 1 } }));
  }) as typeof fetch;
  try {
    const respuesta = await accederConRostro('captura-de-prueba');
    expect(cuerpo).toEqual({ imagenCompararBase64: 'captura-de-prueba', pista: null, idsDescartados: null });
    expect(respuesta.token).toBe('prueba');
  } finally { globalThis.fetch = original; }
});

test('el acceso facial envía la pista y las referencias ya comparadas', async () => {
  const original = globalThis.fetch;
  let cuerpo: unknown;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    cuerpo = JSON.parse(init!.body as string);
    return new Response(JSON.stringify({ codigoS: 200, codigo: 'BIO_LOGIN_OK', token: 'prueba', usuario: { idUsuario: 1 } }));
  }) as typeof fetch;
  try {
    await accederConRostro('captura', { pista: '  Gustavo  ', descartados: [8, 48] });
    expect(cuerpo).toEqual({ imagenCompararBase64: 'captura', pista: 'Gustavo', idsDescartados: [8, 48] });
  } finally { globalThis.fetch = original; }
});

test('un fallo facial conserva las referencias comparadas para no repetirlas', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    codigoS: 504, codigo: 'BIO_TIMEOUT', mensaje: 'Se agotó el tiempo.',
    referencia: 'abc', comparados: [8, 48, 94],
  }))) as typeof fetch;
  try {
    const error = await accederConRostro('captura', { pista: 'Gustavo' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorFacial);
    expect((error as ErrorFacial).comparados).toEqual([8, 48, 94]);
    expect((error as ErrorFacial).codigo).toBe('BIO_TIMEOUT');
  } finally { globalThis.fetch = original; }
});

test('una solicitud facial detenida se cancela y permite informar el tiempo agotado', async () => {
  const originalFetch = globalThis.fetch;
  const originalTimeout = globalThis.setTimeout;
  const timer = spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void) =>
    originalTimeout(callback, 0)) as typeof setTimeout);
  let signal: AbortSignal | undefined;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    signal = init?.signal ?? undefined;
    return await new Promise<Response>((_resolve, reject) => {
      signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
  }) as typeof fetch;
  try {
    await expect(accederConRostro('captura-de-prueba')).rejects.toThrow('La verificación facial tardó demasiado');
    expect(signal?.aborted).toBe(true);
    expect(timer).toHaveBeenCalledWith(expect.any(Function), 75_000);
  } finally {
    globalThis.fetch = originalFetch;
    timer.mockRestore();
  }
});
