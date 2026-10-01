import { afterEach, expect, test } from 'bun:test';
import { cambiarPassword, restablecerPassword, solicitarCodigoPassword, verificarCodigoPassword } from '../src/api/password';
const originalFetch = globalThis.fetch;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});
function mockRequest(status = 200, response: object = {}) {
  const calls: { path: string; body: object; headers: Headers }[] = [];
  globalThis.fetch = (async (path: unknown, init?: RequestInit) => {
    calls.push({ path: String(path), body: JSON.parse(init!.body as string), headers: new Headers(init!.headers) });
    return new Response(JSON.stringify(response), { status });
  }) as typeof fetch;
  return calls;
}
test('recuperación pública envía identificador y canal, sin inventar código ni destino', async () => {
  const calls = mockRequest(200, { solicitud: 'challenge', mensaje: 'Enviado' });
  expect((await solicitarCodigoPassword(' comprador ', 'WHATSAPP')).solicitud).toBe('challenge');
  expect(calls[0].body).toEqual({ identificador: 'comprador', canal: 'WHATSAPP' });
  expect(calls[0].headers.has('Authorization')).toBe(false);
});
test('el perfil usa JWT y no permite seleccionar otra cuenta en el cuerpo', async () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'token-prueba' } });
  const calls = mockRequest();
  await solicitarCodigoPassword('otra-cuenta', 'EMAIL', true);
  expect(calls[0].path).toEndWith('/perfil/solicitar');
  expect(calls[0].body).toEqual({ canal: 'EMAIL' });
  expect(calls[0].headers.get('Authorization')).toBe('Bearer token-prueba');
  await cambiarPassword('Anterior1', 'NuevaClave2');
  expect(calls[1].body).toEqual({ contrasenaActual: 'Anterior1', nuevaContrasena: 'NuevaClave2' });
});
test('el cambio por recuperación presenta el permiso emitido por el servidor', async () => {
  const calls = mockRequest(200, { permiso: 'permiso-servidor' });
  const result = await verificarCodigoPassword('solicitud', '012345');
  await restablecerPassword('solicitud', result.permiso, 'NuevaClave2');
  expect(calls[0].body).toEqual({ solicitud: 'solicitud', codigo: '012345' });
  expect(calls[1].body).toEqual({ solicitud: 'solicitud', permiso: 'permiso-servidor', nuevaContrasena: 'NuevaClave2' });
});
test('muestra errores de expiración o límite enviados por el backend', async () => {
  mockRequest(429, { mensaje: 'Espera antes de reintentar.' });
  await expect(verificarCodigoPassword('solicitud', '123456')).rejects.toThrow('Espera antes de reintentar.');
});
