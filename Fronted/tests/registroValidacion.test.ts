import { expect, test } from 'bun:test';
import {
  validarPassword,
  validarTelefono,
  normalizarTelefono,
  validarNombre,
  validarCorreo,
  validarFechaNacimiento,
  hoyEnISO,
  limpiarNombre,
  limpiarCorreo,
} from '../src/utils/registroValidacion';

test('exige 8 a 128 caracteres y al menos una mayúscula', () => {
  for (const clave of ['Abcdefgh', 'ABCDEFGH', 'Lunas725', 'Lunas!!!', 'Árbolito', 'A' + 'x'.repeat(127)]) {
    expect(validarPassword(clave)).toBe(true);
  }
  for (const clave of ['', 'Abcdefg', 'abcdefgh', '8275691!', 'A' + 'x'.repeat(128), 'Abcdefgh\n']) {
    expect(validarPassword(clave)).toBe(false);
  }
});

test('normaliza teléfonos y valida país, longitud y caracteres', () => {
  expect(normalizarTelefono(' +502 (4567)-8901 ')).toBe('+50245678901');
  expect(validarTelefono('+502 (4567)-8901')).toBe(true);
  expect(validarTelefono('+1 415 555 2671')).toBe(true);
  for (const numero of ['45678901', '+5024567890', '+502456789012', '+0123456789', '+502abcdefgh', '+50200000000', '+1234567890123456', '']) {
    expect(validarTelefono(numero)).toBe(false);
  }
});

test('valida números nacionales según el país elegido', () => {
  expect(validarTelefono('45678901', 'GT')).toBe(true);
  expect(normalizarTelefono('4567 8901', 'GT')).toBe('+50245678901');
  expect(validarTelefono('4567890', 'GT')).toBe(false);
  expect(validarTelefono('456789012', 'GT')).toBe(false);
  expect(validarTelefono('12345678', 'GT')).toBe(false);
  expect(validarTelefono('4155552671', 'US')).toBe(true);
  expect(validarTelefono('4155552671', 'GT')).toBe(false);
  expect(validarTelefono('612345678', 'ES')).toBe(true);
  expect(validarTelefono('5512345678', 'MX')).toBe(true);
  expect(validarTelefono('+14155552671', 'GT')).toBe(false);
  expect(validarTelefono('abc45678901', 'GT')).toBe(false);
});

test('los nombres solo admiten letras', () => {
  for (const nombre of ['Gustavo', 'María José', "O'Brien", 'Jean-Luc', 'Ángeles']) {
    expect(validarNombre(nombre)).toBe(true);
  }
  for (const nombre of ['', '  ', 'Gustavo2', 'Gustavo_', 'Gus-tavo!', '-Gustavo', 'Gustavo-', '123']) {
    expect(validarNombre(nombre)).toBe(false);
  }
});

test('el correo exige un dominio legible y admite niveles múltiples', () => {
  for (const correo of [
    'josaftbck@gmail.com',
    'nombre.apellido@miumg.edu.gt',
    'usuario@gmail.com.gt',
    'usuario@claro.org.gt',
    'correo@tienda.ec',
    'user+tag@mail.com',
  ]) {
    expect(validarCorreo(correo)).toBe(true);
  }
  for (const correo of [
    '',
    'avvav@@q.com',
    'avvav@',
    '@q.com',
    'avvav@q',
    'avvav@q..com',
    'avvav@.com',
    'avvav q@x.com',
    'avvav@x.c',
    'avvav@@',
  ]) {
    expect(validarCorreo(correo)).toBe(false);
  }
});

test('la fecha de nacimiento solo admite fechas pasadas con edad razonable', () => {
  const hoy = new Date(2026, 9, 28);
  expect(validarFechaNacimiento('1990-05-04', hoy)).toBe(true);
  expect(validarFechaNacimiento('2000-10-01', hoy)).toBe(true);
  expect(validarFechaNacimiento('3000-10-01', hoy)).toBe(false);
  expect(validarFechaNacimiento('2026-10-28', hoy)).toBe(false);
  expect(validarFechaNacimiento('2026-10-29', hoy)).toBe(false);
  expect(validarFechaNacimiento('2020-01-01', hoy)).toBe(false);
  expect(validarFechaNacimiento('1800-01-01', hoy)).toBe(false);
  expect(validarFechaNacimiento('', hoy)).toBe(false);
});

test('hoyEnISO devuelve la fecha local en yyyy-mm-dd', () => {
  expect(hoyEnISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  expect(hoyEnISO(new Date(2026, 11, 31))).toBe('2026-12-31');
});

test('el input del nombre no deja escribir numeros ni simbolos', () => {
  expect(limpiarNombre('Gustavo2')).toBe('Gustavo');
  expect(limpiarNombre('Juan_Pérez-1')).toBe('JuanPérez-');
  expect(limpiarNombre("O'Brien")).toBe("O'Brien");
  expect(limpiarNombre('María  José')).toBe('María José');
  expect(limpiarNombre('123')).toBe('');
});

test('el input del correo no deja escribir espacios ni dos arrobas', () => {
  expect(limpiarCorreo('avvav@@q.com')).toBe('avvav@q.com');
  expect(limpiarCorreo('mi correo@x.com')).toBe('micorreo@x.com');
  expect(limpiarCorreo('nombre.apellido@gmail.com.gt')).toBe('nombre.apellido@gmail.com.gt');
  expect(limpiarCorreo('a+b@x.com')).toBe('a+b@x.com');
});

