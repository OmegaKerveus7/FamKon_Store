import MiCredencial from "../components/MiCredencial";
import AvatarCredencial from "../components/AvatarCredencial";
import PreferenciasNotificacion from "../components/PreferenciasNotificacion";
import EnrolamientoFacial from "../modules/biometria/EnrolamientoFacial";
import PasswordForm from "../components/PasswordForm";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { User, Mail, Phone, Calendar, ShieldCheck, Shield } from "lucide-react";

export default function PerfilPage() {
  const { usuario, permisos, cerrarSesion } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 pb-10 sm:px-6">
      <header className="overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-orange-950 p-6 text-white shadow-lg sm:p-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-orange-300">
          Cuenta FamKon
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">Configuración de usuario</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
          Administra tus datos personales, seguridad, notificaciones, identidad facial y credencial.
        </p>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-600">
          01 · Información personal
        </p>
        <h2 className="mb-6 text-xl font-bold text-slate-950">Datos de tu cuenta</h2>
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-sm">
            <AvatarCredencial key={usuario?.idUsuario} fallback={<User className="h-8 w-8" />} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-950">{usuario?.nickname}</h3>
            <p className="text-sm text-slate-500">{usuario?.roles || "Sin rol asignado"}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo icon={<Mail className="h-4 w-4" />} label="Correo" valor={usuario?.correo} />
          <Campo icon={<Phone className="h-4 w-4" />} label="Teléfono" valor={usuario?.telefono} />
          <Campo icon={<Calendar className="h-4 w-4" />} label="Fecha de nacimiento" valor={usuario?.fechaNacimiento} />
          <Campo
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Estado"
            valor={
              <>
                {usuario?.activo === "S" ? "Activo" : "Inactivo"}
                {usuario?.bloqueado === "S" ? " · Bloqueado" : ""}
              </>
            }
          />
        </div>
      </section>

      <section className="space-y-3">
        <EncabezadoSeccion numero="02" titulo="Contraseña y seguridad" descripcion="Actualiza tu clave de acceso de forma segura." />
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <PasswordForm
            perfil
            onFinished={() => {
              cerrarSesion();
              navigate("/login", { replace: true, state: { passwordUpdated: true } });
            }}
          />
        </div>
      </section>

      <section className="space-y-3">
        <EncabezadoSeccion numero="03" titulo="Identidad facial" descripcion="Registra y administra el acceso mediante reconocimiento facial." />
        <EnrolamientoFacial />
      </section>

      <section className="space-y-3">
        <EncabezadoSeccion numero="04" titulo="Notificaciones" descripcion="Elige cómo quieres recibir constancias y avisos de tus compras." />
        <PreferenciasNotificacion />
      </section>

      <section className="space-y-3">
        <EncabezadoSeccion numero="05" titulo="Mi credencial" descripcion="Personaliza, consulta y descarga tu credencial FamKon." />
        <MiCredencial />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">06</span>
          <Shield className="h-5 w-5 text-orange-600" />
          <h3 className="text-sm font-bold text-slate-900">Permisos asignados ({permisos.length})</h3>
        </div>
        {permisos.length === 0 ? (
          <p className="text-sm text-slate-400">Sin permisos cargados.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {permisos.map((permiso) => (
              <span
                key={permiso.codigoPermiso}
                className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700"
              >
                {permiso.permisoNombre}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EncabezadoSeccion({ numero, titulo, descripcion }: { numero: string; titulo: string; descripcion: string }) {
  return (
    <div className="flex items-start gap-3 px-1">
      <span className="mt-0.5 rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-white">{numero}</span>
      <div>
        <h2 className="text-lg font-bold text-slate-950">{titulo}</h2>
        <p className="text-sm text-slate-500">{descripcion}</p>
      </div>
    </div>
  );
}

function Campo({ icon, label, valor }: { icon: React.ReactNode; label: string; valor: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:border-orange-200 hover:bg-orange-50/40">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-500">
        {icon} {label}
      </div>
      <p className="font-medium text-slate-800">{valor || "—"}</p>
    </div>
  );
}
