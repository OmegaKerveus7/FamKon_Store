/**
 * Grabación de la URL del cliente en un chip NFC con Web NFC (NDEFReader).
 * Solo funciona en Android con Chrome/Edge sobre HTTPS; iPhone no puede escribir.
 */

interface NdefWriteOptions {
  overwrite?: boolean;
  signal?: AbortSignal;
}

interface NdefWriter {
  write: (
    message: { records: { recordType: string; data: string }[] },
    options?: NdefWriteOptions,
  ) => Promise<void>;
}

type NdefConstructor = new () => NdefWriter;

/** Capacidad útil aproximada de un NTAG213 (el chip más común y chico). */
export const CAPACIDAD_CHIP_BYTES = 137;

/** true si el navegador puede escribir etiquetas NFC. */
export function nfcSoportado(): boolean {
  return typeof window !== "undefined"
    && window.isSecureContext
    && "NDEFReader" in window;
}

/** Devuelve la URL lista para grabar, o null si no es http/https válida. */
export function urlParaChip(url: string | null | undefined): string | null {
  const valor = (url ?? "").trim();
  if (!valor) return null;
  try {
    const parsed = new URL(valor);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? valor : null;
  } catch {
    return null;
  }
}

/**
 * Bytes aproximados que ocupa el registro URL en el chip.
 * NDEF abrevia "https://" y "https://www." con un solo byte, y suma ~4 bytes de cabecera.
 */
export function bytesEnChip(url: string): number {
  const sinPrefijo = url.replace(/^https?:\/\/(www\.)?/i, "");
  return new TextEncoder().encode(sinPrefijo).length + 1 + 4;
}

export function cabeEnChip(url: string, capacidad = CAPACIDAD_CHIP_BYTES): boolean {
  return bytesEnChip(url) <= capacidad;
}

/** Traduce los errores de Web NFC a un mensaje para producción. */
export function mensajeErrorNfc(error: unknown): string {
  const nombre = error instanceof DOMException || error instanceof Error ? error.name : "";
  switch (nombre) {
    case "AbortError":
      return "Se canceló la grabación. No se escribió nada.";
    case "NotAllowedError":
      return "Permití el acceso a NFC en el navegador para poder grabar.";
    case "NotSupportedError":
      return "Este teléfono no tiene NFC o lo tiene apagado. Activá NFC y volvé a intentar.";
    case "NotReadableError":
      return "No se pudo leer el chip. Acercalo a la parte de atrás del teléfono.";
    case "NetworkError":
      return "No se pudo grabar el chip. Mantenelo quieto sobre el teléfono; si sigue fallando, la URL puede ser muy larga para el chip.";
    default:
      return "No se pudo grabar el chip. Revisá que NFC esté activado y volvé a intentar.";
  }
}

/**
 * Espera a que se acerque un chip y le escribe la URL (reemplaza lo que tenga).
 * Se cancela con la señal recibida; sin respuesta en `esperaMs` se cancela sola.
 */
export async function grabarUrlEnChip(url: string, senal?: AbortSignal, esperaMs = 30000): Promise<void> {
  const valida = urlParaChip(url);
  if (!valida) throw new Error("La URL no es http:// o https:// válida.");
  if (!nfcSoportado()) throw new DOMException("Web NFC no disponible.", "NotSupportedError");

  const Escritor = (window as unknown as { NDEFReader: NdefConstructor }).NDEFReader;
  const control = new AbortController();
  const cancelar = () => control.abort();
  senal?.addEventListener("abort", cancelar);
  const temporizador = window.setTimeout(cancelar, esperaMs);
  try {
    await new Escritor().write(
      { records: [{ recordType: "url", data: valida }] },
      { overwrite: true, signal: control.signal },
    );
  } finally {
    window.clearTimeout(temporizador);
    senal?.removeEventListener("abort", cancelar);
  }
}
