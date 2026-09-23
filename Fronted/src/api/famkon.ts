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

export interface RefreshTokenResponse {
  codigoS: number;
  mensaje: string;
  token: string | null;
}

export interface RegistroRequest {
  telefono: string;
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

export type CanalVerificacion = "EMAIL" | "WHATSAPP" | "AMBOS";

export interface EnviarCodigoRequest {
  codigo: string;
  correo: string;
  telefono?: string;
  canal: CanalVerificacion;
}

export interface EnviarCodigoResponse {
  codigoS: number;
  mensaje: string;
  emailEnviado: boolean;
  whatsAppEnviado: boolean;
  minutosExpiracion: number;
}

export interface Permiso {
  codigoRol: string;
  rol: string;
  codigoPermiso: string;
  permisoNombre: string;
  modulo: string;
}

export interface PermisosResponse {
  codigoS: number;
  permisos: Permiso[];
}

// En desarrollo usa el proxy de Vite (/api → localhost:5299).
// En producción usa la variable de entorno VITE_API_BASE_URL (configurada en vite.config.ts)
// que debería apuntar a la URL completa del backend (ej: https://famkon.site/api/famkon)
// o mantener "/api/famkon" si Nginx hace el proxy en el mismo dominio.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/famkon";
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

export async function enviarCodigoVerificacion(
  datos: EnviarCodigoRequest,
): Promise<EnviarCodigoResponse> {
  return request<EnviarCodigoResponse>("/verificacion/enviar-codigo", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export async function obtenerPermisos(): Promise<PermisosResponse> {
  return request<PermisosResponse>("/permisos");
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

export async function refreshToken(token: string): Promise<RefreshTokenResponse> {
  return request<RefreshTokenResponse>("/refresh-token", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

// ─── Interfaces de la Tienda ────────────────────────────────────────────────

export interface Producto {
  idProducto: number;
  idSitio: number;
  idCategoria: number;
  categoria: string;
  sku: string;
  nombre: string;
  descripcion: string;
  precioBase: number;
  permiteLadoA: string;
  permiteLadoB: string;
  activo: string;
  imagen?: string;
  idArchivoImagen?: number | null;
}

export interface Categoria {
  idCategoria: number;
  codigo: string;
  nombre: string;
  descripcion: string;
}

export interface CarritoItem {
  idDetalle: number;
  idProducto: number;
  producto: string;
  sku: string;
  idPersonalizacion: number | null;
  cantidad: number;
  precioUnitario: number;
  precioPersonaliza: number;
  subtotal: number;
}

export interface Carrito {
  idCarrito: number;
  idUsuario: number;
  idSitio: number;
  estado: string;
  detalles: CarritoItem[];
  total: number;
}

export interface PedidoResumen {
  idPedido: number;
  idUsuario: number;
  idSitio: number;
  numeroPedido: string;
  estado: string;
  subtotal: number;
  cargoEntrega: number;
  total: number;
  moneda: string;
  fechaPedido: string;
}

export interface TrackingPaso {
  estado: string;
  fechaEstado: string;
  comentario: string | null;
  actor: string | null;
}

export interface PedidoDetalle {
  idDetalle: number;
  idProducto: number;
  numeroLinea: number;
  skuProducto: string;
  nombreProducto: string;
  cantidad: number;
  precioUnitario: number;
  precioPersonaliza: number;
  subtotal: number;
}

// ─── Funciones de la Tienda ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = Record<string, any>;

export async function listarCategorias(): Promise<Categoria[]> {
  const res = await request<ApiResponse>("/categorias");
  return (res.categorias as Categoria[]) ?? [];
}

export async function listarProductos(
  idCategoria?: number,
): Promise<Producto[]> {
  const params = new URLSearchParams();
  if (idCategoria) params.set("idCategoria", String(idCategoria));
  const qs = params.toString();
  const res = await request<ApiResponse>(
    `/productos${qs ? `?${qs}` : ""}`,
  );
  return (res.productos as Producto[]) ?? [];
}

export async function obtenerProducto(
  id: number,
): Promise<Producto | null> {
  const res = await request<ApiResponse>(`/productos/${id}`);
  return (res.producto as Producto) ?? null;
}

export async function obtenerCarrito(
  idSitio = 1,
): Promise<Carrito> {
  const res = await request<ApiResponse>(`/carrito?idSitio=${idSitio}`);
  return (res.carrito as Carrito) ?? {
    idCarrito: 0,
    idUsuario: 0,
    idSitio,
    estado: "ACTIVO",
    detalles: [],
    total: 0,
  };
}

export async function agregarAlCarritoAPI(data: {
  idProducto: number;
  cantidad: number;
  idSitio?: number;
  idPersonalizacion?: number | null;
  precioPersonaliza?: number;
}): Promise<{ idDetalle: number }> {
  const res = await request<ApiResponse>("/carrito/productos", {
    method: "POST",
    body: JSON.stringify({
      idProducto: data.idProducto,
      cantidad: data.cantidad,
      idSitio: data.idSitio ?? 1,
      idPersonalizacion: data.idPersonalizacion ?? null,
      precioPersonaliza: data.precioPersonaliza ?? 0,
    }),
  });
  return { idDetalle: res.idDetalle as number };
}

export async function actualizarCantidadCarritoAPI(
  idDetalle: number,
  cantidad: number,
): Promise<void> {
  await request(`/carrito/detalle/${idDetalle}`, {
    method: "PUT",
    body: JSON.stringify({ cantidad }),
  });
}

export async function eliminarDelCarritoAPI(
  idDetalle: number,
): Promise<void> {
  await request(`/carrito/detalle/${idDetalle}`, { method: "DELETE" });
}

export async function listarPedidos(): Promise<PedidoResumen[]> {
  const res = await request<ApiResponse>("/pedidos");
  return (res.pedidos as PedidoResumen[]) ?? [];
}

export async function obtenerPedido(
  id: number,
): Promise<{ resumen: PedidoResumen | null; detalles: PedidoDetalle[] }> {
  const res = await request<ApiResponse>(`/pedidos/${id}`);
  return {
    resumen: (res.resumen as PedidoResumen) ?? null,
    detalles: (res.detalles as PedidoDetalle[]) ?? [],
  };
}

export async function crearPedido(data: {
  idCarrito: number;
  idAreaEntrega: number;
  moneda?: string;
  referencia?: string;
  observaciones?: string;
}): Promise<{ idPedido: number; numeroPedido: string; tokenQr: string }> {
  const res = await request<ApiResponse>("/pedidos", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return {
    idPedido: res.idPedido as number,
    numeroPedido: res.numeroPedido as string,
    tokenQr: res.tokenQr as string,
  };
}

export async function consultarTracking(
  tokenHash: string,
): Promise<TrackingPaso[]> {
  const res = await request<ApiResponse>(
    `/tracking/${encodeURIComponent(tokenHash)}`,
  );
  return (res.pasos as TrackingPaso[]) ?? [];
}

// ─── Funciones compatibilidad (localStorage) ──────────────────────────────────

const CARRITO_KEY = "famkon.carrito";

export function obtenerCarritoLocal(): CarritoItem[] {
  const raw = localStorage.getItem(CARRITO_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function guardarCarritoLocal(items: CarritoItem[]) {
  localStorage.setItem(CARRITO_KEY, JSON.stringify(items));
}

export function vaciarCarrito() {
  localStorage.removeItem(CARRITO_KEY);
}

// ─── Gestor de Usuarios (Admin) ──────────────────────────────────────────────

export interface UsuarioAdmin {
  idUsuario: number;
  idSitio: number | null;
  correo: string;
  telefono: string;
  fechaNacimiento: string;
  nickname: string;
  activo: string;
  bloqueado: string;
  notificaEmail: string;
  notificaWhatsapp: string;
  intentosFallidos: number;
  ultimoAcceso: string | null;
  fechaCreacion: string | null;
  roles: string;
}

// Modelo enriquecido que devuelve la vista VW_GESTOR_USUARIOS
// a traves de PKG_SEGURIDAD.SP_LISTAR_USUARIOS_GESTOR.
export interface UsuarioGestor {
  idUsuario: number;
  nickname: string;
  correo: string;
  telefono: string;
  fechaNacimiento: string;
  edad: number | null;
  idSitio: number | null;
  activo: string;
  bloqueado: string;
  intentosFallidos: number;
  ultimoAcceso: string | null;
  notificaEmail: string;
  notificaWhatsapp: string;
  roles: string;
  cantRoles: number;
  cantPermisos: number;
  ultimaConexionOk: string | null;
  ultimaConexionFallida: string | null;
  totalAccesos: number;
}

export interface RolDisponible {
  idRol: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: string;
}

export interface CrearUsuarioAdminBody {
  correo: string;
  nickname: string;
  password: string;
  telefono?: string;
  fechaNacimiento?: string;
  notificaEmail?: string;
  notificaWhatsapp?: string;
  codigoRol: string;
}

export interface ActualizarUsuarioAdminBody {
  correo?: string;
  nickname?: string;
  telefono?: string;
  fechaNacimiento?: string;
  notificaEmail?: string;
  notificaWhatsapp?: string;
}

export async function listarUsuariosAdmin(soloActivos = "N"): Promise<UsuarioGestor[]> {
  const res = await request<ApiResponse>(`/admin/usuarios?soloActivos=${soloActivos}`);
  return (res.usuarios as UsuarioGestor[]) ?? [];
}

export async function obtenerUsuarioAdmin(id: number): Promise<UsuarioGestor | null> {
  const res = await request<ApiResponse>(`/admin/usuarios/${id}`);
  return (res.usuario as UsuarioGestor) ?? null;
}

export async function crearUsuarioAdmin(
  body: CrearUsuarioAdminBody
): Promise<{ codigoS: number; mensaje: string; idUsuario?: number; codigoQr?: string }> {
  const res = await request<ApiResponse>("/admin/usuarios", {
    method: "POST",
    body: JSON.stringify(body),
  });
  let idUsuario: number | undefined;
  let codigoQr: string | undefined;
  try {
    const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
    if (data && typeof data === "object") {
      idUsuario = data.id_usuario;
      codigoQr = data.token_qr;
    }
  } catch {
  }
  return {
    codigoS: res.codigoS as number,
    mensaje: (res.mensaje as string) ?? "",
    idUsuario,
    codigoQr,
  };
}

export async function actualizarUsuarioAdmin(
  id: number,
  body: ActualizarUsuarioAdminBody
): Promise<{ codigoS: number; mensaje: string }> {
  const res = await request<ApiResponse>(`/admin/usuarios/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return {
    codigoS: res.codigoS as number,
    mensaje: (res.mensaje as string) ?? "",
  };
}

export async function cambiarEstadoUsuarioAdmin(
  id: number,
  opcion: "A" | "D" | "B" | "L" | boolean,
): Promise<{ codigoS: number; mensaje: string }> {
  const body =
    typeof opcion === "boolean"
      ? { activo: opcion }
      : { opcion };
  const res = await request<ApiResponse>(`/admin/usuarios/${id}/estado`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return {
    codigoS: res.codigoS as number,
    mensaje: (res.mensaje as string) ?? "",
  };
}

export async function asignarRolUsuarioAdmin(
  id: number,
  codigoRol: string
): Promise<{ codigoS: number; mensaje: string }> {
  const res = await request<ApiResponse>(`/admin/usuarios/${id}/roles`, {
    method: "POST",
    body: JSON.stringify({ codigoRol }),
  });
  return {
    codigoS: res.codigoS as number,
    mensaje: (res.mensaje as string) ?? "",
  };
}

export async function listarRolesAdmin(): Promise<RolDisponible[]> {
  const res = await request<ApiResponse>("/admin/roles");
  return (res.roles as RolDisponible[]) ?? [];
}

// Gestión de productos: las bajas se realizan cambiando ACTIVO.
export interface ProductoAdminBody {
  idCategoria: number;
  idArchivoImagen: number | null;
  nombre: string;
  descripcion: string;
  precioBase: number;
  permiteLadoA: "S" | "N";
  permiteLadoB: "S" | "N";
}

interface ResultadoProducto {
  codigoS: number;
  mensaje?: string;
  idProducto?: number;
}

function comprobarResultadoProducto(res: ResultadoProducto) {
  if (res.codigoS !== 200) throw new Error(res.mensaje || "No se pudo completar la operación.");
  return res;
}

export async function listarProductosAdmin(): Promise<Producto[]> {
  const res = await request<ResultadoProducto & { productos: Producto[] }>("/admin/productos");
  comprobarResultadoProducto(res);
  return res.productos;
}

export async function listarCategoriasProductoAdmin(): Promise<Categoria[]> {
  const res = await request<ResultadoProducto & { categorias: Categoria[] }>("/categorias?soloActivas=N");
  comprobarResultadoProducto(res);
  return res.categorias;
}

export async function crearProductoAdmin(body: ProductoAdminBody & { sku: string; idSitio: number }) {
  return comprobarResultadoProducto(await request<ResultadoProducto>("/admin/productos", {
    method: "POST", body: JSON.stringify(body),
  }));
}

export async function actualizarProductoAdmin(id: number, body: ProductoAdminBody) {
  return comprobarResultadoProducto(await request<ResultadoProducto>(`/admin/productos/${id}`, {
    method: "PUT", body: JSON.stringify(body),
  }));
}

export async function cambiarEstadoProductoAdmin(id: number, activo: "S" | "N") {
  return comprobarResultadoProducto(await request<ResultadoProducto>(`/admin/productos/${id}/estado`, {
    method: "PUT", body: JSON.stringify({ activo }),
  }));
}

export async function crearCategoriaProductoAdmin(body: { codigo: string; nombre: string; descripcion: string }): Promise<Categoria> {
  const res = await request<ResultadoProducto & { categoria: Categoria }>("/admin/categorias", {
    method: "POST", body: JSON.stringify(body),
  });
  comprobarResultadoProducto(res);
  return res.categoria;
}

// ─── Modulo Repartidor (entregas + cambios de estado) ───────────────────────

export interface EntregaRepartidor {
  idEntrega: number;
  idPedido: number;
  numeroPedido: string;
  numeroIntento: number;
  codigoEstado: string;
  estadoEntrega: string;
  areaEntrega: string;
  referencia: string | null;
  fechaAsignacion: string | null;
  fechaIntento: string | null;
  fechaEntrega: string | null;
  montoEfectivo: number;
  observaciones: string | null;
  idArchivoEvidencia: number | null;
}

export interface PedidoParaEntrega {
  idPedido: number;
  numeroPedido: string;
  estadoPedido: string;
  areaEntrega: string;
  referencia: string | null;
  total: number;
  fechaPedido: string;
}

export interface RepartidorDisponible {
  idUsuario: number;
  nickname: string;
  correo: string;
  telefono: string;
}

export async function listarMisEntregas(): Promise<EntregaRepartidor[]> {
  const res = await request<ApiResponse>("/repartidor/entregas");
  return (res.entregas as EntregaRepartidor[]) ?? [];
}

export async function listarEntregasDeRepartidor(
  idRepartidor: number,
): Promise<EntregaRepartidor[]> {
  const res = await request<ApiResponse>(`/repartidor/entregas/${idRepartidor}`);
  return (res.entregas as EntregaRepartidor[]) ?? [];
}

export async function listarPedidosParaEntrega(): Promise<PedidoParaEntrega[]> {
  const res = await request<ApiResponse>("/repartidor/pedidos-disponibles");
  return (res.pedidos as PedidoParaEntrega[]) ?? [];
}

export async function listarRepartidoresActivos(): Promise<RepartidorDisponible[]> {
  const res = await request<ApiResponse>("/repartidor/repartidores");
  return (res.repartidores as RepartidorDisponible[]) ?? [];
}

export async function asignarEntrega(
  idPedido: number,
  idRepartidor: number,
): Promise<{ codigoS: number; mensaje: string; idEntrega?: number }> {
  const res = await request<ApiResponse>("/repartidor/asignar", {
    method: "POST",
    body: JSON.stringify({ idPedido, idRepartidor }),
  });
  return {
    codigoS: res.codigoS as number,
    mensaje: (res.mensaje as string) ?? "",
    idEntrega: res.idEntrega as number | undefined,
  };
}

export async function cambiarEstadoPedidoRepartidor(
  idPedido: number,
  codigoEstado: string,
  comentario?: string,
): Promise<{ codigoS: number; mensaje: string }> {
  const res = await request<ApiResponse>("/repartidor/cambiar-estado", {
    method: "POST",
    body: JSON.stringify({ idPedido, codigoEstado, comentario }),
  });
  return {
    codigoS: res.codigoS as number,
    mensaje: (res.mensaje as string) ?? "",
  };
}

export async function registrarResultadoEntrega(
  idEntrega: number,
  codigoEstado: "ENTREGADA" | "NO_ENCONTRADO" | "CANCELADA",
  montoEfectivo = 0,
  observaciones?: string,
  idArchivoEvidencia?: number,
): Promise<{ codigoS: number; mensaje: string }> {
  const res = await request<ApiResponse>("/repartidor/resultado", {
    method: "POST",
    body: JSON.stringify({
      idEntrega, codigoEstado, montoEfectivo, observaciones, idArchivoEvidencia
    }),
  });
  return {
    codigoS: res.codigoS as number,
    mensaje: (res.mensaje as string) ?? "",
  };
}

// ─── Archivos (evidencia de entrega) ─────────────────────────────────────────

export async function subirEvidenciaEntrega(
  archivo: File,
): Promise<{ codigoS: number; mensaje: string; idArchivo?: number; tamanoBytes?: number }> {
  const fd = new FormData();
  fd.append("archivo", archivo);

  const token = getToken();
  const res = await fetch(`${BASE_URL}/repartidor/evidencia`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });

  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("famkon.usuario");
    window.location.href = "/login";
    throw new Error("Sesion expirada. Inicie sesion nuevamente.");
  }

  if (!res.ok) {
    const text = await res.text();
    let mensaje = `Error ${res.status}`;
    try {
      const parsed = JSON.parse(text) as { mensaje?: string };
      mensaje = parsed.mensaje || mensaje;
    } catch {
      mensaje = text || mensaje;
    }
    throw new Error(mensaje);
  }

  const data = (await res.json()) as ApiResponse;
  return {
    codigoS: data.codigoS as number,
    mensaje: (data.mensaje as string) ?? "",
    idArchivo: data.idArchivo as number | undefined,
    tamanoBytes: data.tamanoBytes as number | undefined,
  };
}

export function urlArchivoEvidencia(idArchivo: number): string {
  return `${BASE_URL}/archivos/${idArchivo}`;
}

export async function listarEntregasDeTodosRepartidores(): Promise<EntregaRepartidor[]> {
  const repartidores = await listarRepartidoresActivos();
  const todas: EntregaRepartidor[] = [];
  await Promise.all(
    repartidores.map(async (r) => {
      const lista = await listarEntregasDeRepartidor(r.idUsuario);
      todas.push(...lista);
    }),
  );
  return todas;
}
