import { useEffect, useState, type FormEvent } from "react";
import {
  Plus,
  Search,
  Pencil,
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
  Ban,
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
    // La fecha de nacimiento llega como YYYY-MM-DD: conservar el día sin convertirlo a la zona local.
    timeZone: "UTC",
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
  const [pagina, setPagina] = useState(1);
  const [soloBloqueados, setSoloBloqueados] = useState(false);
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
      const r = await cambiarEstadoUsuarioAdmin(u.idUsuario, opcion);
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
    if (soloBloqueados && u.bloqueado !== "S") return false;
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

  const paginas = Math.max(1, Math.ceil(usuariosFiltrados.length / 10));
  const paginaActual = Math.min(pagina, paginas);
  const paginaUsuarios = usuariosFiltrados.slice((paginaActual - 1) * 10, paginaActual * 10);
  const totalActivos = usuarios.filter((u) => u.activo === "S").length;
  const totalBloqueados = usuarios.filter((u) => u.bloqueado === "S").length;


  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-amber-700">Administración · Cuentas</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Gestor de usuarios</h1><p className="mt-1 text-sm text-slate-500">Buscá una cuenta para consultar sus datos, editarla o administrar su acceso.</p></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        ['Usuarios registrados', usuarios.length], ['Cuentas activas', totalActivos],
        ['Cuentas inactivas', usuarios.length - totalActivos], ['Cuentas bloqueadas', totalBloqueados],
      ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3"><p className="text-2xl font-bold text-slate-900">{cargando || error ? '—' : value}</p><p className="text-xs text-slate-500">{label}</p></div>)}</div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Listado</h2>
          <p className="text-sm text-slate-500">
            Consultá el detalle para ver edad, permisos e historial de acceso.
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
            onChange={(e) => { setPagina(1); setBusqueda(e.target.value); }}
            placeholder="Buscar por nickname, correo, telefono o rol..."
            className="w-full rounded-xl border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
        </div>
        <div className="flex gap-1 rounded-xl border border-slate-200 p-1">
          {(["ALL", "S", "N"] as const).map((v) => (
            <button
              key={v}
              onClick={() => { setPagina(1); setFiltroActivos(v); }}
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

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><p className="text-slate-500">{cargando ? 'Cargando…' : `${usuariosFiltrados.length} usuarios encontrados`}</p><label className="flex items-center gap-2 text-slate-600"><input type="checkbox" checked={soloBloqueados} onChange={e => { setSoloBloqueados(e.target.checked); setPagina(1); }} className="accent-amber-500" />Solo bloqueados</label></div>
      {/* Tabla */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Contacto</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Ultimo acceso</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cargando ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                  Cargando usuarios...
                </td>
              </tr>
            ) : usuariosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  Sin resultados.
                </td>
              </tr>
            ) : (
              paginaUsuarios.map((u) => (
                <tr key={u.idUsuario} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{u.nickname}</div>
                    <div className="text-xs text-slate-500">Cuenta #{u.idUsuario}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-xs text-slate-700">
                      <Mail className="h-3 w-3" /> {u.correo}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Phone className="h-3 w-3" /> {u.telefono}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {u.roles || "Sin rol asignado"}
                    </span>
                    <span className="ml-1 text-[10px] text-slate-400">
                      ({u.cantRoles})
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-xs text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      {fmtFechaHora(u.ultimaConexionOk)}
                    </div>
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
                  <td className="px-4 py-3 text-right text-xs">
                    <button type="button" disabled={procesando} onClick={() => setSeleccionado(u)} aria-label={`Gestionar ${u.nickname}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50">Gestionar</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!cargando && !error && <div className="flex items-center justify-between gap-3 text-sm"><button disabled={paginaActual <= 1} onClick={() => setPagina(paginaActual - 1)} className="rounded-xl border bg-white px-4 py-2 disabled:opacity-40">Anterior</button><span className="text-slate-500">Página {paginaActual} de {paginas} · Hasta 10 usuarios por página</span><button disabled={paginaActual >= paginas} onClick={() => setPagina(paginaActual + 1)} className="rounded-xl border bg-white px-4 py-2 disabled:opacity-40">Siguiente</button></div>}
      <p className="text-center text-xs text-slate-400">
        Bloquear impide el acceso a la cuenta. Desactivar la deja fuera de uso; estas acciones conservan su historial.
      </p>

      {/* Modal de detalle */}
      {seleccionado && (
        <DetalleModal
          usuario={usuarios.find(u => u.idUsuario === seleccionado.idUsuario) || seleccionado}
          procesando={procesando}
          onEditar={() => { const u = usuarios.find(u => u.idUsuario === seleccionado.idUsuario) || seleccionado; setSeleccionado(null); abrirEditar(u); }}
          onEstado={(opcion, etiqueta) => handleCambiarEstado(usuarios.find(u => u.idUsuario === seleccionado.idUsuario) || seleccionado, opcion, etiqueta)}
          onCerrar={() => setSeleccionado(null)}
        />
      )}

      {/* Modal de formulario (crear / editar) */}
      {modo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
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
  onCerrar, onEditar, onEstado, procesando,
}: {
  usuario: UsuarioGestor;
  onCerrar: () => void;
  onEditar: () => void;
  onEstado: (opcion: EstadoOpcion, etiqueta: string) => void;
  procesando: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-br from-purple-500 to-fuchsia-500 px-6 py-4 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
              Gestionar cuenta
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
        <div className="space-y-5 p-5">
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><h3 className="text-sm font-bold text-slate-900">Datos y roles</h3><p className="mt-1 text-xs text-slate-500">Actualizá la información de esta cuenta.</p></div><button type="button" disabled={procesando} onClick={onEditar} className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Editar usuario</button></section>
          <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-700">Información e historial de la cuenta</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo label="ID" valor={`#${usuario.idUsuario}`} />
          <Campo label="Edad" valor={usuario.edad != null ? `${usuario.edad} años` : "—"} />
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
          <Campo label="Total de accesos" valor={`${usuario.totalAccesos}`} />
          <Campo
            label="Estado"
            valor={`${usuario.activo === "S" ? "Activo" : "Inactivo"}${usuario.bloqueado === "S" ? " / Bloqueado" : ""}`}
          />
        </div></details>
        <section className="space-y-4 border-t border-slate-200 pt-5"><h3 className="text-sm font-bold text-slate-900">Administrar acceso</h3><p className="text-xs text-slate-500">Estas acciones requieren confirmación y se aplican a {usuario.nickname}.</p>
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-red-100 bg-red-50/40 p-4 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-slate-800">{usuario.bloqueado === 'S' ? 'Cuenta bloqueada' : 'Bloqueo de acceso'}</p><p className="mt-1 text-xs text-slate-600">{usuario.bloqueado === 'S' ? 'Permití nuevamente el acceso a esta cuenta.' : 'Impide iniciar sesión. Conserva los datos del usuario.'}</p></div><button type="button" disabled={procesando} onClick={() => onEstado(usuario.bloqueado === 'S' ? 'L' : 'B', usuario.bloqueado === 'S' ? 'desbloquear' : 'bloquear')} className="shrink-0 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50">{usuario.bloqueado === 'S' ? 'Desbloquear cuenta' : 'Bloquear cuenta'}</button></div>
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-slate-800">{usuario.activo === 'S' ? 'Desactivar cuenta' : 'Reactivar cuenta'}</p><p className="mt-1 text-xs text-slate-600">{usuario.activo === 'S' ? 'Deja la cuenta inactiva sin eliminar su historial.' : 'Vuelve a habilitar una cuenta inactiva. El bloqueo se administra por separado.'}</p></div><button type="button" disabled={procesando} onClick={() => onEstado(usuario.activo === 'S' ? 'D' : 'A', usuario.activo === 'S' ? 'desactivar' : 'activar')} className="shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">{usuario.activo === 'S' ? 'Desactivar cuenta' : 'Activar cuenta'}</button></div>
        </section></div>
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
