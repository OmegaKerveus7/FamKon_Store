import type { Usuario } from '../../api/famkon';

type RespuestaBiometria = {
  codigoS: number;
  codigo: string;
  mensaje: string;
  referencia: string;
  comparados?: number[];
};

/** Error de la identificación facial: conserva las referencias ya comparadas. */
export class ErrorFacial extends Error {
  readonly codigo: string;
  readonly comparados: number[];
  constructor(mensaje: string, codigo: string, comparados: number[] = []) {
    super(mensaje);
    this.name = 'ErrorFacial';
    this.codigo = codigo;
    this.comparados = comparados;
  }
}

async function solicitar<T extends RespuestaBiometria>(ruta: string, datos: object, token?: string): Promise<T> {
  // La identificación dispone de 60 s en el servidor; dar margen a la respuesta.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75_000);
  try {
    const response = await fetch(`/api/famkon/biometria/${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(datos),
      signal: controller.signal,
    });
    if (response.status === 401) throw new Error('Tu sesión expiró. Inicia sesión con tu contraseña nuevamente.');
    const body = await response.json() as T;
    if (!response.ok || body.codigoS !== 200) {
      throw new ErrorFacial(
        `${body.mensaje || 'No se pudo completar la operación facial.'}${body.referencia ? ` Referencia: ${body.referencia}` : ''}`,
        body.codigo ?? 'BIO_ERROR',
        body.comparados ?? [],
      );
    }
    return body;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ErrorFacial('La verificación facial tardó demasiado. Intenta de nuevo o inicia sesión con tu contraseña.', 'BIO_TIMEOUT');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export interface OpcionesAccesoFacial {
  /** Nickname o correo: acota la búsqueda a las cuentas que coinciden. */
  pista?: string;
  /** Referencias ya comparadas en intentos anteriores: no se repiten. */
  descartados?: number[];
}

export function accederConRostro(imagenCompararBase64: string, opciones: OpcionesAccesoFacial = {}) {
  const pista = opciones.pista?.trim() ?? '';
  return solicitar<RespuestaBiometria & { token: string; usuario: Usuario }>('login', {
    imagenCompararBase64,
    pista: pista || null,
    idsDescartados: opciones.descartados?.length ? opciones.descartados : null,
  });
}

export function registrarRostro(contrasena: string, fotoBase64: string) {
  const token = localStorage.getItem('famkon.token');
  if (!token) throw new Error('Inicia sesión antes de registrar tu rostro.');
  return solicitar<RespuestaBiometria & { fotoSegmentada: string }>('enrolar', { contrasena, fotoBase64 }, token);
}
