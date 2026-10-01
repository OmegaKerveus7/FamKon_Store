import type { Usuario } from '../../api/famkon';

type RespuestaBiometria = {
  codigoS: number;
  codigo: string;
  mensaje: string;
  referencia: string;
};

async function solicitar<T extends RespuestaBiometria>(ruta: string, datos: object, token?: string): Promise<T> {
  const response = await fetch(`/api/famkon/biometria/${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(datos),
  });
  if (response.status === 401) throw new Error('Tu sesión expiró. Inicia sesión con tu contraseña nuevamente.');
  const body = await response.json() as T;
  if (!response.ok || body.codigoS !== 200) {
    throw new Error(`${body.mensaje || 'No se pudo completar la operación facial.'}${body.referencia ? ` Referencia: ${body.referencia}` : ''}`);
  }
  return body;
}

export function accederConRostro(imagenCompararBase64: string) {
  return solicitar<RespuestaBiometria & { token: string; usuario: Usuario }>('login', { imagenCompararBase64 });
}

export function registrarRostro(contrasena: string, fotoBase64: string) {
  const token = localStorage.getItem('famkon.token');
  if (!token) throw new Error('Inicia sesión antes de registrar tu rostro.');
  return solicitar<RespuestaBiometria & { fotoSegmentada: string }>('enrolar', { contrasena, fotoBase64 }, token);
}
