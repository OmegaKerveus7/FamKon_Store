import { expect, spyOn, test } from 'bun:test';
import { accederConRostro } from '../src/modules/biometria/api';

test('el acceso facial envía solo la captura, sin correo ni usuario', async () => {
  const original = globalThis.fetch;
  let cuerpo: unknown;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    cuerpo = JSON.parse(init!.body as string);
    return new Response(JSON.stringify({ codigoS: 200, codigo: 'BIO_LOGIN_OK', token: 'prueba', usuario: { idUsuario: 1 } }));
  }) as typeof fetch;
  try {
    const respuesta = await accederConRostro('captura-de-prueba');
    expect(cuerpo).toEqual({ imagenCompararBase64: 'captura-de-prueba' });
    expect(respuesta.token).toBe('prueba');
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
