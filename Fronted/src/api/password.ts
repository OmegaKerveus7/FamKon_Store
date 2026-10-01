export type CanalPassword = 'EMAIL' | 'WHATSAPP';

async function request<T>(path: string, body: object, autenticado = false): Promise<T> {
  const token = autenticado ? localStorage.getItem('famkon.token') : null;
  const response = await fetch(`/api/famkon/password/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) throw new Error('Tu sesión venció. Inicia sesión nuevamente o recupera tu contraseña desde el login.');
    throw new Error(data?.mensaje || (response.status === 400 ? 'Revisa los datos ingresados.' : 'No se pudo completar la operación. Intenta nuevamente.'));
  }
  return data as T;
}

export function solicitarCodigoPassword(identificador: string, canal: CanalPassword, perfil = false) {
  return request<{ solicitud: string; mensaje: string }>(perfil ? 'perfil/solicitar' : 'solicitar', perfil ? { canal } : { identificador: identificador.trim(), canal }, perfil);
}
export function verificarCodigoPassword(solicitud: string, codigo: string) {
  return request<{ permiso: string; mensaje: string }>('verificar', { solicitud, codigo });
}
export function restablecerPassword(solicitud: string, permiso: string, nuevaContrasena: string) {
  return request<{ mensaje: string }>('restablecer', { solicitud, permiso, nuevaContrasena });
}
export function cambiarPassword(contrasenaActual: string, nuevaContrasena: string) {
  return request<{ mensaje: string }>('cambiar', { contrasenaActual, nuevaContrasena }, true);
}
