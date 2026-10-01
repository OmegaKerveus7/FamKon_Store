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
  if (!/^[+]?[0-9]+$/.test(limpio) || (!pais && !limpio.startsWith("+"))) return false;
  const numero = parsePhoneNumberFromString(limpio, pais);
  return !!numero && numero.isValid() && (!pais || numero.country === pais);
}
