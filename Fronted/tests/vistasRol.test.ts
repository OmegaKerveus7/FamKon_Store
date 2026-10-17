import { expect, test } from 'bun:test';
import { esAdministrador, grupoPermitidoParaAdmin, rutaPersonalBloqueada } from '../src/domain/vistasRol';
test('admin no ve compras ni entregas personales, incluso con roles múltiples', () => {
  for (const roles of ['ADMIN', 'ADMIN,COMPRADOR,REPARTIDOR', 'admin; comprador']) {
    expect(esAdministrador(roles)).toBe(true);
    for (const path of ['/comprador/catalogo', '/comprador/carrito', '/comprador/tracking', '/comprador/checkout', '/comprador/pago/189', '/repartidor/asignados']) expect(rutaPersonalBloqueada(roles, path)).toBe(true);
    expect(grupoPermitidoParaAdmin('compras', true)).toBe(false);
    expect(grupoPermitidoParaAdmin('entregas', true)).toBe(false);
  }
});
test('admin conserva administración, seguimiento general, perfil y rastreo público', () => {
  for (const path of ['/admin', '/admin/pedidos', '/admin/usuarios', '/entregas/tracking', '/perfil', '/rastreo']) expect(rutaPersonalBloqueada('ADMIN', path)).toBe(false);
  for (const id of ['administracion', 'tracking', 'supervision', 'cuenta']) expect(grupoPermitidoParaAdmin(id, true)).toBe(true);
});
test('comprador y repartidor conservan sus vistas', () => {
  expect(rutaPersonalBloqueada('COMPRADOR', '/comprador/tracking')).toBe(false);
  expect(rutaPersonalBloqueada('REPARTIDOR', '/repartidor/asignados')).toBe(false);
  expect(grupoPermitidoParaAdmin('compras', false)).toBe(true);
  expect(grupoPermitidoParaAdmin('entregas', false)).toBe(true);
});
