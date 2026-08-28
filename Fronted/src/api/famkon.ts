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

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    const text = await res.text();
    let mensaje = `Error ${res.status}`;

    if (text) {
      try {
        const respuesta = JSON.parse(text) as {
          mensaje?: string;
        };

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

export async function actualizarFoto(opts: {
  correo: string;
  contrasena: string;
  fotoOriginalBase64: string;
}): Promise<Usuario> {
  const res = await request<{ codigoS: number; mensaje: string; data: Usuario | null }>("/actualizar-foto", {
    method: "PUT",
    body: JSON.stringify({
      correo: opts.correo,
      contrasena: opts.contrasena,
      fotoOriginalBase64: opts.fotoOriginalBase64,
    }),
  });
  if (!res.data) throw new Error(res.mensaje || "No se pudo actualizar la foto.");
  return res.data;
}