import { useEffect, useState, type FormEvent } from "react";
import {
  Plus,
  Search,
  Pencil,
  Power,
  PowerOff,
  UserCheck,
  X,
  Loader2,
  Mail,
  Phone,
  Calendar,
  Shield,
  AlertCircle,
  CheckCircle2,
  Lock,
  Unlock,
  Ban,
  Clock,
  Activity,
} from "lucide-react";
import {
  type UsuarioGestor,
  type RolDisponible,
  listarUsuariosAdmin,
  listarRolesAdmin,
  crearUsuarioAdmin,
  actualizarUsuarioAdmin,
  cambiarEstadoUsuarioAdmin,
  asignarRolUsuarioAdmin,
} from "../api/famkon";
import { useAuth } from "../context/AuthContext";

type ModoForm = "crear" | "editar" | null;
type EstadoOpcion = "A" | "D" | "B" | "L";

interface FormState {
  idUsuario?: number;
  correo: string;
  nickname: string;
  password: string;
  telefono: string;
  fechaNacimiento: string;
  notificaEmail: string;
  notificaWhatsapp: string;
  codigoRol: string;
}

const FORM_INICIAL: FormState = {
  correo: "",
  nickname: "",
  password: "",
  telefono: "",
  fechaNacimiento: "",
  notificaEmail: "S",
  notificaWhatsapp: "N",
  codigoRol: "COMPRADOR",
};

function fmtFecha(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-GT", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function fmtFechaHora(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-GT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function UsuariosAdminPage() {
  const { tieneRol } = useAuth();
  const esAdmin = tieneRol("ADMIN");

  const [usuarios, setUsuarios] = useState<UsuarioGestor[]>([]);
  const [roles, setRoles] = useState<RolDisponible[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroActivos, setFiltroActivos] = useState<"S" | "N" | "ALL">("ALL");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [modo, setModo] = useState<ModoForm>(null);
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [procesando, setProcesando] = useState(false);
  const [seleccionado, setSeleccionado] = useState<UsuarioGestor | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    setError("");
    try {
      const [lista, listaRoles] = await Promise.all([
        listarUsuariosAdmin("N"),
        listarRolesAdmin(),
      ]);
      setUsuarios(lista);
      setRoles(listaRoles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar usuarios.");
    } finally {
      setCargando(false);
    }
  }

  function abrirCrear() {
    setForm({ ...FORM_INICIAL, codigoRol: esAdmin ? "COMPRADOR" : "REPARTIDOR" });
    setModo("crear");
    setError("");
    setExito("");
  }

  function abrirEditar(u: UsuarioGestor) {
    setForm({
      idUsuario: u.idUsuario,
      correo: u.correo,
      nickname: u.nickname,
      password: "",
      telefono: u.telefono,
      fechaNacimiento: u.fechaNacimiento,
      notificaEmail: u.notificaEmail,
      notificaWhatsapp: u.notificaWhatsapp,
      codigoRol: u.roles || "COMPRADOR",
    });
    setModo("editar");
    setError("");
    setExito("");
  }

  function cerrarForm() {
    setModo(null);
    setForm(FORM_INICIAL);
    setError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setProcesando(true);
    setError("");
    setExito("");
    try {
      if (modo === "crear") {
        const r = await crearUsuarioAdmin({
          correo: form.correo.trim(),
          nickname: form.nickname.trim(),
          password: form.password,
          telefono: form.telefono.trim() || undefined,
          fechaNacimiento: form.fechaNacimiento || undefined,
          notificaEmail: form.notificaEmail,
          notificaWhatsapp: form.notificaWhatsapp,
          codigoRol: form.codigoRol,
        });
        if (r.codigoS !== 200) throw new Error(r.mensaje);
        setExito(`Usuario creado (ID ${r.idUsuario}).`);
      } else if (modo === "editar" && form.idUsuario) {
        const r = await actualizarUsuarioAdmin(form.idUsuario, {
          correo: form.correo.trim(),
          nickname: form.nickname.trim(),
          telefono: form.telefono.trim(),
          fechaNacimiento: form.fechaNacimiento,
          notificaEmail: form.notificaEmail,
          notificaWhatsapp: form.notificaWhatsapp,
        });
        if (r.codigoS !== 200) throw new Error(r.mensaje);

        const actual = usuarios.find((u) => u.idUsuario === form.idUsuario);
        if (form.codigoRol && form.codigoRol !== (actual?.roles || "")) {
          const rolR = await asignarRolUsuarioAdmin(form.idUsuario, form.codigoRol);
          if (rolR.codigoS !== 200) throw new Error(rolR.mensaje);
        }
        setExito(`Usuario #${form.idUsuario} actualizado.`);
      }
      cerrarForm();
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operacion fallida.");
    } finally {
      setProcesando(false);
    }
  }

  async function handleCambiarEstado(
    u: UsuarioGestor,
    opcion: EstadoOpcion,
    etiqueta: string,
  ) {
    if (!window.confirm(`Estas seguro de ${etiqueta} a ${u.nickname}?`)) return;
    setProcesando(true);
    setError("");
    try {
      const r = await cambiarEstadoUsuarioAdmin(u.idUsuario, opcion === "A");
      if (r.codigoS !== 200) throw new Error(r.mensaje);
      setExito(`Usuario ${u.nickname}: ${r.mensaje}`);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error.");
    } finally {
      setProcesando(false);
    }
  }

  const usuariosFiltrados = usuarios.filter((u) => {
    if (filtroActivos !== "ALL" && u.activo !== filtroActivos) return false;
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (
      u.nickname.toLowerCase().includes(q) ||
      u.correo.toLowerCase().includes(q) ||
      u.telefono.toLowerCase().includes(q) ||
      u.roles.toLowerCase().includes(q)
    );
  });

  const totalActivos = usuarios.filter((u) => u.activo === "S").length;
  const totalBloqueados = usuarios.filter((u) => u.bloqueado === "S").length;
  const totalPermisos = usuarios.reduce((acc, u) => acc + u.cantPermisos, 0);

  return (
    <div className="space-y-5">
      <header className="rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-500 p-6 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
          Modulo administrador
        </p>
        <h1 className="mt-1 text-2xl font-bold">Gestor de Usuarios</h1>
        <p className="mt-1 text-sm text-white/90">
          Crear, actualizar, activar y desactivar usuarios del sistema.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
            {usuarios.length} usuarios
          </span>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
            {totalActivos} activos
          </span>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
            {totalBloqueados} bloqueados
          </span>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
            {totalPermisos} permisos asignados
          </span>
        </div>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Listado</h2>
          <p className="text-sm text-slate-500">
            Datos enriquecidos desde la vista VW_GESTOR_USUARIOS.
          </p>
        </div>
        <button
          onClick={abrirCrear}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-400"
        >
          <Plus className="h-4 w-4" /> Nuevo Usuario
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}
      {exito && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {exito}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nickname, correo, telefono o rol..."
            className="w-full rounded-xl border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
        </div>
        <div className="flex gap-1 rounded-xl border border-slate-200 p-1">
          {(["ALL", "S", "N"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFiltroActivos(v)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                filtroActivos === v
                  ? "bg-amber-500 text-slate-900"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {v === "ALL" ? "Todos" : v === "S" ? "Activos" : "Inactivos"}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Contacto</th>
              <th className="px-4 py-3">Edad</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Permisos</th>
              <th className="px-4 py-3">Ultimo acceso</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cargando ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                  Cargando usuarios...
                </td>
              </tr>
            ) : usuariosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                  Sin resultados.
                </td>
              </tr>
            ) : (
              usuariosFiltrados.map((u) => (
                <tr key={u.idUsuario} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">#{u.idUsuario}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{u.nickname}</div>
                    <div className="text-xs text-slate-500">{fmtFecha(u.fechaNacimiento)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-xs text-slate-700">
                      <Mail className="h-3 w-3" /> {u.correo}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Phone className="h-3 w-3" /> {u.telefono}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {u.edad !== null && u.edad !== undefined ? (
                      <span className="font-semibold">{u.edad}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                    <span className="ml-1 text-xs text-slate-500">anos</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                      {u.roles || "—"}
                    </span>
                    <span className="ml-1 text-[10px] text-slate-400">
                      ({u.cantRoles})
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      {u.cantPermisos}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-xs text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      {fmtFechaHora(u.ultimaConexionOk)}
                    </div>
                    {u.ultimaConexionFallida && (
                      <div className="flex items-center gap-1 text-[10px] text-red-600">
                        <X className="h-3 w-3" />
                        Fallo: {fmtFechaHora(u.ultimaConexionFallida)}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                      <Activity className="h-3 w-3" />
                      {u.totalAccesos} evento{u.totalAccesos === 1 ? "" : "s"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.activo === "S" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <UserCheck className="h-3 w-3" /> Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                        <PowerOff className="h-3 w-3" /> Inactivo
                      </span>
                    )}
                    {u.bloqueado === "S" && (
                      <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        <Ban className="h-3 w-3" /> Bloqueado
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setSeleccionado(u)}
                        className="rounded-lg border border-slate-200 p-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                        title="Ver detalle"
                      >
                        <Clock className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => abrirEditar(u)}
                        disabled={procesando}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {u.bloqueado === "S" ? (
                        <button
                          onClick={() => handleCambiarEstado(u, "L", "desbloquear")}
                          disabled={procesando}
                          className="rounded-lg border border-emerald-200 p-1.5 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                          title="Desbloquear"
                        >
                          <Unlock className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCambiarEstado(u, "B", "bloquear")}
                          disabled={procesando}
                          className="rounded-lg border border-red-200 p-1.5 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                          title="Bloquear"
                        >
                          <Lock className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {u.activo === "S" ? (
                        <button
                          onClick={() => handleCambiarEstado(u, "D", "desactivar")}
                          disabled={procesando}
                          className="rounded-lg border border-slate-300 p-1.5 text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                          title="Desactivar"
                        >
                          <PowerOff className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCambiarEstado(u, "A", "activar")}
                          disabled={procesando}
                          className="rounded-lg border border-emerald-300 p-1.5 text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                          title="Activar"
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-center text-xs text-slate-400">
        Datos servidos por PKG_SEGURIDAD.SP_LISTAR_USUARIOS_GESTOR (vista VW_GESTOR_USUARIOS).
      </p>

      {/* Modal de detalle */}
      {seleccionado && (
        <DetalleModal
          usuario={seleccionado}
          onCerrar={() => setSeleccionado(null)}
        />
      )}

      {/* Modal de formulario (crear / editar) */}
      {modo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                {modo === "crear" ? (
                  <>
                    <Plus className="h-5 w-5 text-amber-500" /> Nuevo Usuario
                  </>
                ) : (
                  <>
                    <Pencil className="h-5 w-5 text-blue-500" /> Editar Usuario
                  </>
                )}
              </h2>
              <button
                onClick={cerrarForm}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Correo *</label>
                  <input
                    type="email"
                    required
                    value={form.correo}
                    onChange={(e) => setForm({ ...form, correo: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Nickname *</label>
                  <input
                    required
                    value={form.nickname}
                    onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                </div>
                {modo === "crear" && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Password *</label>
                    <input
                      type="password"
                      required
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Telefono *</label>
                  <input
                    required
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    <Calendar className="mr-1 inline h-3 w-3" /> Fecha de nacimiento
                  </label>
                  <input
                    type="date"
                    value={form.fechaNacimiento}
                    onChange={(e) => setForm({ ...form, fechaNacimiento: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    <Shield className="mr-1 inline h-3 w-3" /> Rol
                  </label>
                  <select
                    value={form.codigoRol}
                    onChange={(e) => setForm({ ...form, codigoRol: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  >
                    {roles.map((r) => (
                      <option key={r.idRol} value={r.codigo}>
                        {r.nombre} ({r.codigo})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Notifica email</label>
                  <select
                    value={form.notificaEmail}
                    onChange={(e) => setForm({ ...form, notificaEmail: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  >
                    <option value="S">Si</option>
                    <option value="N">No</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Notifica WhatsApp</label>
                  <select
                    value={form.notificaWhatsapp}
                    onChange={(e) => setForm({ ...form, notificaWhatsapp: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  >
                    <option value="S">Si</option>
                    <option value="N">No</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={cerrarForm}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesando}
                  className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-400 disabled:opacity-50"
                >
                  {procesando && <Loader2 className="h-4 w-4 animate-spin" />}
                  {modo === "crear" ? "Crear" : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function DetalleModal({
  usuario,
  onCerrar,
}: {
  usuario: UsuarioGestor;
  onCerrar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-br from-purple-500 to-fuchsia-500 px-6 py-4 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
              Detalle del usuario
            </p>
            <h2 className="text-xl font-bold">{usuario.nickname}</h2>
            <p className="text-xs text-white/80">{usuario.correo}</p>
          </div>
          <button
            onClick={onCerrar}
            className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <Campo label="ID" valor={`#${usuario.idUsuario}`} />
          <Campo label="Edad" valor={usuario.edad != null ? `${usuario.edad} anos` : "—"} />
          <Campo label="Telefono" valor={usuario.telefono} />
          <Campo label="Fecha de nacimiento" valor={fmtFecha(usuario.fechaNacimiento)} />
          <Campo label="Roles" valor={`${usuario.roles || "—"} (${usuario.cantRoles})`} />
          <Campo label="Permisos asignados" valor={`${usuario.cantPermisos}`} />
          <Campo label="Intentos fallidos" valor={`${usuario.intentosFallidos}`} />
          <Campo label="Notificaciones" valor={`Email ${usuario.notificaEmail === "S" ? "Si" : "No"} / WA ${usuario.notificaWhatsapp === "S" ? "Si" : "No"}`} />
          <Campo
            label="Ultimo acceso OK"
            valor={fmtFechaHora(usuario.ultimaConexionOk)}
            color="emerald"
          />
          <Campo
            label="Ultimo acceso fallido"
            valor={fmtFechaHora(usuario.ultimaConexionFallida)}
            color="red"
          />
          <Campo label="Total de accesos (BITACORA_ACCESO)" valor={`${usuario.totalAccesos}`} />
          <Campo
            label="Estado"
            valor={`${usuario.activo === "S" ? "Activo" : "Inactivo"}${usuario.bloqueado === "S" ? " / Bloqueado" : ""}`}
          />
        </div>
      </div>
    </div>
  );
}

function Campo({
  label,
  valor,
  color,
}: {
  label: string;
  valor: React.ReactNode;
  color?: "emerald" | "red";
}) {
  const colorClass =
    color === "emerald"
      ? "text-emerald-700"
      : color === "red"
      ? "text-red-700"
      : "text-slate-800";
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1 font-semibold ${colorClass}`}>{valor}</p>
    </div>
  );
}
