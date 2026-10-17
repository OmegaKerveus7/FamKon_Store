import { expect, test } from 'bun:test';
import { guiaDesdeQr, lecturaDesdeQr, pedidoDesdeQr } from '../src/domain/rastreoQr';
const guia = 'FK-5E0B16EA964433BAE063';
test('extrae la guía de un QR de comprobante o texto sin navegar al origen', () => {
  expect(guiaDesdeQr(`https://tienda.example/rastreo?guia=${guia}`)).toBe(guia);
  expect(guiaDesdeQr(` ${guia.toLowerCase()} `)).toBe(guia);
});
test('rechaza IDs antiguos, enlaces ajenos y contenidos inválidos', () => {
  for (const texto of ['https://tienda.example/comprador/tracking?pedido=185', 'javascript:alert(1)', '185', 'https://otra.example/login?guia='+guia, 'FK-123'])
    expect(() => guiaDesdeQr(texto)).toThrow();
});

test('lector acepta el QR real del comprobante 189 y los anteriores sin abrir su origen', () => {
  expect(lecturaDesdeQr('https://famkon.site/comprador/tracking?pedido=189')).toEqual({ pedido: '189' });
  expect(lecturaDesdeQr('http://localhost:5173/comprador/tracking?pedido=185')).toEqual({ pedido: '185' });
});
test('lector sigue aceptando guías nuevas, URL pública y minúsculas', () => {
  expect(lecturaDesdeQr(`https://famkon.site/rastreo?guia=${guia}`)).toEqual({ guia });
  expect(lecturaDesdeQr(` ${guia.toLowerCase()} `)).toEqual({ guia });
});
test('lector rechaza rutas ajenas, esquemas ejecutables e IDs malformados', () => {
  for (const texto of ['javascript:alert(1)', '189',
    'https://famkon.site/login?pedido=189', 'https://famkon.site/comprador/tracking?pedido=-1',
    'https://famkon.site/comprador/tracking?pedido=0', 'https://famkon.site/comprador/tracking?pedido=1.5',
    'https://famkon.site/comprador/tracking?pedido=99999999999999999999',
    'https://famkon.site/comprador/tracking?pedido=189&pedido=190'])
    expect(() => lecturaDesdeQr(texto)).toThrow();
});

test('lector privado acepta comprobantes de producción desde localhost y comprueba acceso en servidor', async () => {
  const consultas: unknown[] = [];
  const resolver = async (lectura: { guia: string } | { pedido: string }) => { consultas.push(lectura); return { idPedido: 189 }; };
  expect(await pedidoDesdeQr('https://famkon.site/comprador/tracking?pedido=189', resolver)).toBe(189);
  expect(await pedidoDesdeQr(`https://famkon.site/rastreo?guia=${guia}`, resolver)).toBe(189);
  expect(consultas).toEqual([{ pedido: '189' }, { guia }]);
});
test('lector privado conserva los errores de permisos y no interpreta un fallo como QR inválido', async () => {
  await expect(pedidoDesdeQr(`https://famkon.site/rastreo?guia=${guia}`, async () => { throw new Error('No encontramos ese pedido en tu cuenta.'); })).rejects.toThrow('en tu cuenta');
  await expect(pedidoDesdeQr(guia, async () => ({ idPedido: 0 }))).rejects.toThrow('identificar');
});
