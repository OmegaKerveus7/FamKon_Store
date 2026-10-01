import { afterEach, expect, test } from 'bun:test';
import { crearCompra } from '../src/api/compras';
const original = globalThis.fetch;
const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
afterEach(() => { globalThis.fetch = original; if (storage) Object.defineProperty(globalThis, 'localStorage', storage); else Reflect.deleteProperty(globalThis, 'localStorage'); });
test('checkout envía token reCAPTCHA junto con pedido y JWT', async () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'session-token' } });
  let sent: RequestInit | undefined;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => { sent = init; return Response.json({ idPedido: 15 }); }) as typeof fetch;
  const result = await crearCompra({ telefonoContacto: '+50245678901', idCarrito: 2, idModalidadEntrega: 1, metodoPago: 'EFECTIVO', recaptchaToken: 'google-response' });
  expect(result.idPedido).toBe(15);
  expect(JSON.parse(sent!.body as string).recaptchaToken).toBe('google-response');
  expect(new Headers(sent!.headers).get('Authorization')).toBe('Bearer session-token');
});
test('un rechazo reCAPTCHA no se presenta como compra exitosa', async () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
  globalThis.fetch = (async () => Response.json({ mensaje: 'La verificación venció.' }, { status: 400 })) as typeof fetch;
  await expect(crearCompra({ telefonoContacto: '+50245678901', idCarrito: 2, idModalidadEntrega: 1, metodoPago: 'EFECTIVO', recaptchaToken: 'expired' })).rejects.toThrow('La verificación venció.');
});
