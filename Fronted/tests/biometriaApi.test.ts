import { expect, test } from 'bun:test';
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
