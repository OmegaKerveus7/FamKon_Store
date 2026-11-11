import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";
export const REGLA_PASSWORD = "Usa entre 8 y 128 caracteres, con al menos una letra mayúscula.";

export function validarPassword(valor: string): boolean {
  return valor.length >= 8 && valor.length <= 128 && /\p{Lu}/u.test(valor) && !/[\r\n]/.test(valor);
}

export function normalizarTelefono(valor: string, pais?: CountryCode): string {
  const limpio = valor.trim().replace(/[ ()-]/g, "");
  return parsePhoneNumberFromString(limpio, pais)?.number ?? limpio;
}

export function validarTelefono(valor: string, pais?: CountryCode): boolean {
  const limpio = valor.trim().replace(/[ ()-]/g, "");
  if (!/^\+?[0-9]+$/.test(limpio) || (!pais && !limpio.startsWith("+"))) return false;
  const numero = parsePhoneNumberFromString(limpio, pais);
  return !!numero && numero.isValid() && (!pais || numero.country === pais);
}

/**
 * Expresiones regulares (fuente única) para el input y para la validación.
 * El input usa el mismo criterio para que no se pueda escribir lo inválido.
 */
export const REGEX_NOMBRE = /^[\p{L}][\p{L}\p{M}'’\- ]*$/u;
export const REGEX_CORREO =
  /^[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;
/** Caracteres admitidos en el input de correo (sin el dominio). */
export const CARACTERES_CORREO = /[^A-Za-z0-9@._%+-]/g;

/**
 * Deja solo letras (con espacios, apóstrofos, guiones y acentos).
 * Evita que se escriban números o símbolos en el nombre.
 */
export function limpiarNombre(valor: string): string {
  const limpio = valor.replace(/[^\p{L}\p{M}'’\- ]/gu, "");
  return limpio.replace(/\s{2,}/g, " ");
}

/**
 * Deja solo lo que puede tener un correo y como máximo una arroba.
 * Evita "avvav@@q.com" o los espacios dentro del correo.
 */
export function limpiarCorreo(valor: string): string {
  const sinEspacios = valor.replace(/\s+/g, "");
  const arrobas = sinEspacios.split("@");
  if (arrobas.length <= 1) return sinEspacios;
  return `${arrobas[0]}@${arrobas.slice(1).join("")}`;
}

/**
 * Nombre y apellido: solo letras (con espacios, apóstrofos, guiones y
 * acentos). No admite números ni símbolos.
 */
export function validarNombre(valor: string): boolean {
  const limpio = valor.trim().replace(/\s+/g, " ");
  if (!limpio || limpio.length > 60) return false;
  if (!REGEX_NOMBRE.test(limpio)) return false;
  return /[\p{L}\p{M}]$/u.test(limpio);
}

/**
 * Correo legible: una sola arroba, dominio con puntos y niveles múltiples
 * (gmail.com.gt, claro.org.gt, correo.ec). Rechaza "avvav@@q.com" y cualquier
 * variante sin punto en el dominio o con espacios.
 */
export function validarCorreo(valor: string): boolean {
  const limpio = valor.trim();
  if (!limpio || limpio.length > 254) return false;
  return REGEX_CORREO.test(limpio);
}

/** Fecha de nacimiento: solo fechas pasadas y con una edad razonable. */
export function validarFechaNacimiento(valor: string, hoy: Date = new Date()): boolean {
  if (!valor) return false;
  const fecha = new Date(`${valor}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) return false;
  if (fecha.getTime() >= hoy.getTime()) return false;
  const edad = hoy.getFullYear() - fecha.getFullYear();
  const mes = hoy.getMonth() - fecha.getMonth();
  const ajuste = mes < 0 || (mes === 0 && hoy.getDate() < fecha.getDate()) ? 1 : 0;
  return edad - ajuste >= 10 && edad - ajuste <= 120;
}

/** Fecha de hoy en formato yyyy-mm-dd (para el max del input type="date"). */
export function hoyEnISO(fecha: Date = new Date()): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}
