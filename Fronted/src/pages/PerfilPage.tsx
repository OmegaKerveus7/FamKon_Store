import MiCredencial from "../components/MiCredencial";
import AvatarCredencial from "../components/AvatarCredencial";
import PreferenciasNotificacion from "../components/PreferenciasNotificacion";
import EnrolamientoFacial from "../modules/biometria/EnrolamientoFacial";
import PasswordForm from "../components/PasswordForm";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { User, Mail, Phone, Calendar, ShieldCheck } from "lucide-react";
import { useState } from "react";

const secciones = [
  { id: 'datos', nombre: 'Mis datos', descripcion: 'Consultá la información de tu cuenta.' },
  { id: 'seguridad', nombre: 'Contraseña', descripcion: 'Cambiá tu contraseña de acceso.' },
  { id: 'facial', nombre: 'Acceso facial', descripcion: 'Registrá tu rostro para iniciar sesión con la cámara.' },
  { id: 'notificaciones', nombre: 'Notificaciones', descripcion: 'Elegí cómo recibir avisos y constancias.' },
  { id: 'credencial', nombre: 'Mi credencial', descripcion: 'Personalizá y descargá tu credencial FamKon.' },
] as const;

export default function PerfilPage() {
  const { usuario, permisos, cerrarSesion } = useAuth();
  const navigate = useNavigate();
  const [seccion, setSeccion] = useState<string>('datos');

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 pb-4">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-amber-700">Mi cuenta</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Mi perfil</h1><p className="mt-1 text-sm text-slate-500">Elegí qué querés consultar o actualizar.</p></div>
      <div className="grid items-start gap-5 lg:grid-cols-[190px_minmax(0,1fr)]">
      <nav aria-label="Opciones de mi perfil" className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 lg:sticky lg:top-4 lg:flex-col">
        {secciones.map(opcion => <button key={opcion.id} type="button" aria-pressed={seccion === opcion.id} onClick={() => setSeccion(opcion.id)} className={`rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${seccion === opcion.id ? 'bg-amber-50 text-amber-800' : 'text-slate-600 hover:bg-slate-50'}`}>{opcion.nombre}<span className="mt-1 hidden text-xs font-normal leading-relaxed text-slate-500 lg:block">{opcion.descripcion}</span></button>)}
      </nav>
      <div className="min-w-0 space-y-5">

      {seccion === 'datos' && <>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-4 text-xl font-bold text-slate-950">Datos de tu cuenta</h2>
        <div className="mb-4 flex items-center gap-4">
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
        <p className="mt-5 text-xs leading-relaxed text-slate-500">Estos datos son de consulta. Si necesitás corregirlos, contactá a administración.</p>
      </section>
      <details className="rounded-2xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer text-sm font-semibold text-slate-700">Roles y permisos de mi cuenta</summary><p className="mt-3 text-sm text-slate-500">Determinan las herramientas que podés usar. Los administra el responsable de la tienda.</p><div className="mt-3 flex flex-wrap gap-2">{permisos.length ? permisos.map(p => <span key={p.codigoPermiso} className="rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-600">{p.permisoNombre}</span>) : <p className="text-sm text-slate-500">Sin permisos cargados.</p>}</div></details>
      </>}

      {seccion === 'seguridad' && <section className="space-y-3">
        <EncabezadoSeccion titulo="Contraseña y seguridad" descripcion="Actualiza tu clave de acceso de forma segura." />
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Al cambiar tu contraseña, se cerrará esta sesión y tendrás que ingresar nuevamente.</p>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <PasswordForm
            perfil
            onFinished={() => {
              cerrarSesion();
              navigate("/login", { replace: true, state: { passwordUpdated: true } });
            }}
          />
        </div>
      </section>}

      {seccion === 'facial' && <section className="space-y-3">
        <EncabezadoSeccion titulo="Identidad facial" descripcion="Registra y administra el acceso mediante reconocimiento facial." />
        <EnrolamientoFacial />
      </section>}

      {seccion === 'notificaciones' && <section className="space-y-3">
        <EncabezadoSeccion titulo="Notificaciones" descripcion="Elige cómo quieres recibir constancias y avisos de tus compras." />
        <PreferenciasNotificacion />
      </section>}

      {seccion === 'credencial' && <section className="space-y-3">
        
        <MiCredencial />
      </section>}


      </div>
      </div>
    </div>
  );
}

function EncabezadoSeccion({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div className="flex items-start gap-3 px-1">
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
