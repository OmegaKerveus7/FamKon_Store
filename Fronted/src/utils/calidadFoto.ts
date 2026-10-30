/**
 * Calidad de la foto para el reconocimiento facial.
 * Todo se analiza en el navegador (MediaPipe + canvas) para dar la.devolución
 * al instante y no gastar intentos del servicio de rostros.
 */

export type ProblemaFoto =
  | "poco_luz"
  | "mucha_luz"
  | "borrosa"
  | "sin_rostro"
  | "varias_personas"
  | "rostro_pequeno"
  | "rostro_descentrado"
  | "rostro_tapado";

export const MENSAJES: Record<ProblemaFoto, string> = {
  poco_luz: "Hay poca luz. Buscá un lugar más iluminado o acercate a una ventana.",
  mucha_luz: "Hay demasiada luz reflejada. Evitá que el foco quede atrás de vos.",
  borrosa: "La foto está borrosa. Mantené el celular firme y pedí que no te muevas.",
  sin_rostro: "No detectamos un rostro. Centrá tu cara dentro del óvalo.",
  varias_personas: "Debe aparecer solamente una persona en la foto.",
  rostro_pequeno: "Acercate un poco más para que tu rostro se vea completo.",
  rostro_descentrado: "Centrá tu rostro dentro del óvalo.",
  rostro_tapado:
    "Parece que tenés algo tapando el rostro (por ejemplo, una máscara). Quitáselo para poder reconocerte.",
};

export interface ResultadoCalidad {
  problemas: ProblemaFoto[];
  /** Mensaje principal para el usuario (el primero detectado). */
  mensaje: string;
  /** 0 a 100: cuanto más alto, mejor foto. */
  puntaje: number;
  ok: boolean;
}

export interface DatosImagen {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

export interface PuntoRostro {
  x: number;
  y: number;
}

/** Umbrales de la captura. */
export const UMBRAL_POCO_LUZ = 70;
export const UMBRAL_MUCHA_LUZ = 205;
export const UMBRAL_BORROSA = 45;
export const UMBRAL_ROSTRO_PEQUENO = 0.22;
export const UMBRAL_TEXTERA_TAPADA = 18;

/** Luminancia media de la imagen (0 a 255). */
export function medirBrillo(datos: DatosImagen): number {
  const { data } = datos;
  if (!data.length) return 0;
  let suma = 0;
  let cuenta = 0;
  for (let i = 0; i + 2 < data.length; i += 4) {
    suma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    cuenta++;
  }
  return cuenta ? suma / cuenta : 0;
}

/**
 * Varianza del Laplaciano: mide la nitidez.
 * Una foto borrosa tiene menos cambios de brillo y una varianza baja.
 */
export function medirNitidez(datos: DatosImagen): number {
  const { data, width, height } = datos;
  if (width < 3 || height < 3) return 0;
  const gris = new Float64Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      gris[y * width + x] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
  }
  let suma = 0;
  let sumaCuadrada = 0;
  let cuenta = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const laplaciano =
        4 * gris[idx] - gris[idx - 1] - gris[idx + 1] - gris[idx - width] - gris[idx + width];
      suma += laplaciano;
      sumaCuadrada += laplaciano * laplaciano;
      cuenta++;
    }
  }
  if (!cuenta) return 0;
  const media = suma / cuenta;
  return Math.max(0, sumaCuadrada / cuenta - media * media);
}

/** Luz y nitidez de la captura. */
export function evaluarIluminacion(datos: DatosImagen): ProblemaFoto[] {
  const problemas: ProblemaFoto[] = [];
  const brillo = medirBrillo(datos);
  if (brillo < UMBRAL_POCO_LUZ) problemas.push("poco_luz");
  else if (brillo > UMBRAL_MUCHA_LUZ) problemas.push("mucha_luz");
  if (medirNitidez(datos) < UMBRAL_BORROSA) problemas.push("borrosa");
  return problemas;
}

/**
 * Encuadre del rostro a partir de los puntos de MediaPipe.
 * `textura` es la variación de brillo dentro de la zona del rostro: si es
 * muy baja, el rostro está tapado (por ejemplo, con una máscara).
 */
export function evaluarRostro(
  puntos: PuntoRostro[],
  carasDetectadas = puntos.length ? 1 : 0,
  textura?: number,
): ProblemaFoto[] {
  const problemas: ProblemaFoto[] = [];
  if (carasDetectadas > 1) {
    problemas.push("varias_personas");
    return problemas;
  }
  if (!puntos.length) {
    problemas.push("sin_rostro");
    return problemas;
  }
  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  if (maxY - minY < UMBRAL_ROSTRO_PEQUENO) problemas.push("rostro_pequeno");
  const centroX = (minX + maxX) / 2;
  const centroY = (minY + maxY) / 2;
  if (Math.abs(centroX - 0.5) > 0.18 || Math.abs(centroY - 0.45) > 0.2) {
    problemas.push("rostro_descentrado");
  }
  if (textura !== undefined && textura < UMBRAL_TEXTERA_TAPADA) problemas.push("rostro_tapado");
  return problemas;
}

/** Arma el resultado final con el mensaje y el puntaje. */
export function evaluarCalidad(problemas: ProblemaFoto[]): ResultadoCalidad {
  return {
    problemas,
    mensaje: problemas.length ? MENSAJES[problemas[0]] : "",
    puntaje: Math.max(0, 100 - problemas.length * 25),
    ok: problemas.length === 0,
  };
}

/** Variación de brillo dentro de una zona de la imagen (para detectar rostros tapados). */
export function medirTextura(datos: DatosImagen, region?: { x: number; y: number; ancho: number; alto: number }): number {  const { data, width, height } = datos;
  if (!width || !height) return 0;
  const x0 = region ? Math.max(0, Math.floor(region.x * width)) : 0;
  const y0 = region ? Math.max(0, Math.floor(region.y * height)) : 0;
  const x1 = region ? Math.min(width, Math.ceil((region.x + region.ancho) * width)) : width;
  const y1 = region ? Math.min(height, Math.ceil((region.y + region.alto) * height)) : height;
  let suma = 0;
  let sumaCuadrada = 0;
  let cuenta = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      const gris = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      suma += gris;
      sumaCuadrada += gris * gris;
      cuenta++;
    }
  }
  if (cuenta < 4) return 0;
  const media = suma / cuenta;
  return Math.max(0, sumaCuadrada / cuenta - media * media);
}

/**
 * Analiza una captura (data URL) en el navegador: luz y nitidez.
 * Se usa antes de enviar la foto al servidor para avisar al instante.
 */
export async function analizarCaptura(dataUrl: string): Promise<ResultadoCalidad> {
  const vacio: ResultadoCalidad = { problemas: [], mensaje: "", puntaje: 100, ok: true };
  if (!dataUrl) return vacio;
  try {
    const imagen = new Image();
    imagen.src = dataUrl;
    await imagen.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = Math.max(1, Math.round((320 * imagen.height) / Math.max(1, imagen.width)));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return vacio;
    ctx.drawImage(imagen, 0, 0, canvas.width, canvas.height);
    const datos = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return evaluarCalidad(evaluarIluminacion(datos));
  } catch {
    return vacio;
  }
}
