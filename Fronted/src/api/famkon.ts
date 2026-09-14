export interface EstadoResponse {
  api: boolean;
  baseDeDatos: boolean;
  codigo: number;
  mensaje: string;
  fecha: string;
}

export interface Usuario {
  idUsuario: number;
  correo: string | null;
  nickname: string | null;
  telefono: string | null;
  fechaNacimiento: string | null;
  activo: string;
  bloqueado: string;
  roles: string | null;
}

export interface LoginApiResponse {
  codigoS: number;
  mensaje: string;
  token: string | null;
  usuario: Usuario | null;
}

export interface RegistroRequest {
  nombres: string;
  apellidos: string;
  correo: string;
  contrasena: string;
  fechaNacimiento: string;
  nickname: string;
  fotoOriginalBase64: string;
  fotoEditadaBase64?: string;
}

export interface RegistroData {
  idUsuario: number;
  nickname: string;
  codigoQr: string;
}

export interface RegistroResponse {
  codigoS: number;
  mensaje: string;
  data: RegistroData | null;
}

const BASE_URL = "/api/famkon";
const TOKEN_KEY = "famkon.token";

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("famkon.usuario");
    window.location.href = "/login";
    throw new Error("Sesión expirada. Inicie sesión nuevamente.");
  }

  if (!res.ok) {
    const text = await res.text();
    let mensaje = `Error ${res.status}`;

    if (text) {
      try {
        const respuesta = JSON.parse(text) as { mensaje?: string };
        mensaje = respuesta.mensaje || mensaje;
      } catch {
        mensaje = text;
      }
    }

    throw new Error(mensaje);
  }

  return (await res.json()) as T;
}

export async function checkEstado(): Promise<{ ok: boolean; estado: EstadoResponse | null }> {
  try {
    const estado = await request<EstadoResponse>("/estado");
    return { ok: estado.codigo === 200, estado };
  } catch {
    return { ok: false, estado: null };
  }
}

export async function login(
  correo?: string,
  nickname?: string,
  contrasena = "",
): Promise<LoginApiResponse> {
  return request<LoginApiResponse>("/login_basic", {
    method: "POST",
    body: JSON.stringify({ correo, nickname, contrasena }),
  });
}

export async function registrarComprador(
  datos: RegistroRequest,
): Promise<RegistroResponse> {
  return request<RegistroResponse>("/registro", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export async function loginFacial(opts: {
  identificacion?: string;
  imagenOriginalBase64?: string;
  imagenCompararBase64: string;
}): Promise<LoginApiResponse> {
  return request<LoginApiResponse>("/login/facial", {
    method: "POST",
    body: JSON.stringify({
      identificacion: opts.identificacion,
      imagenOriginalBase64: opts.imagenOriginalBase64,
      imagenCompararBase64: opts.imagenCompararBase64,
    }),
  });
}

export async function loginCarnet(opts: {
  carnetImagenBase64?: string;
  codigoQr?: string;
  identificacion?: string;
}): Promise<LoginApiResponse> {
  return request<LoginApiResponse>("/login/carnet", {
    method: "POST",
    body: JSON.stringify({
      carnetImagenBase64: opts.carnetImagenBase64,
      codigoQr: opts.codigoQr,
      identificacion: opts.identificacion,
    }),
  });
}

export function stripBase64Prefix(dataUrl: string): string {
  return dataUrl.replace(/^data:image\/[^;]+;base64,/, "");
}

export async function actualizarFoto(opts: {
  correo: string;
  contrasena: string;
  fotoOriginalBase64: string;
}): Promise<LoginApiResponse> {
  return request<LoginApiResponse>("/actualizar-foto", {
    method: "PUT",
    body: JSON.stringify({
      correo: opts.correo,
      contrasena: opts.contrasena,
      fotoOriginalBase64: opts.fotoOriginalBase64,
    }),
  });
}

export function guardarToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function eliminarToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function obtenerToken(): string | null {
  return getToken();
}
