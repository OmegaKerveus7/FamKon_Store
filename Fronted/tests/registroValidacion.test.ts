import { expect, test } from 'bun:test';
import { validarPassword, validarTelefono, normalizarTelefono } from '../src/utils/registroValidacion';

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

