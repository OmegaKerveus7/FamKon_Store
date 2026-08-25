export interface EstadoResponse {
  api: boolean;
  baseDeDatos: boolean;
  codigo: number;
  mensaje: string;
  fecha: string;
}

export interface Usuario {
  id: number;
  nombre: string;
  correo: string | null;
  nickname: string | null;
  contrasena: string;
  imagenOriginalBase64: string;
  codigoQr: string | null;
  rol: number;
}

const BASE_URL = "/api/famkon";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Error ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function checkEstado(): Promise<{ ok: boolean; estado: EstadoResponse | null }> {
  try {
    const res = await fetch(`${BASE_URL}/estado`);
    const estado = (await res.json()) as EstadoResponse;
    return { ok: res.ok && estado.codigo === 200, estado };
  } catch {
    return { ok: false, estado: null };
  }
}

export async function login(
  correo?: string,
  nickname?: string,
  contrasena = "",
): Promise<Usuario> {
  return request<Usuario>("/login", {
    method: "POST",
    body: JSON.stringify({ correo, nickname, contrasena }),
  });
}

export async function loginFacial(opts: {
  identificacion?: string;
  imagenOriginalBase64?: string;
  imagenCompararBase64: string;
}): Promise<Usuario> {
  return request<Usuario>("/login/facial", {
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
}): Promise<Usuario> {
  return request<Usuario>("/login/carnet", {
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