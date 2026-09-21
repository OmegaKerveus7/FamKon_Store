import { useAuth } from "../context/AuthContext";
import { User, Mail, Phone, Calendar, ShieldCheck, Shield } from "lucide-react";

export default function PerfilPage() {
  const { usuario, permisos } = useAuth();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Mi Perfil</h1>
        <p className="text-sm text-slate-500">Datos de tu cuenta y permisos asignados.</p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
            <User className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{usuario?.nickname}</h2>
            <p className="text-sm text-slate-500">{usuario?.roles || "Sin rol asignado"}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo icon={<Mail className="h-3 w-3" />} label="Correo" valor={usuario?.correo} />
          <Campo icon={<Phone className="h-3 w-3" />} label="Telefono" valor={usuario?.telefono} />
          <Campo icon={<Calendar className="h-3 w-3" />} label="Fecha de nacimiento" valor={usuario?.fechaNacimiento} />
          <Campo
            icon={<ShieldCheck className="h-3 w-3" />}
            label="Estado"
            valor={
              <>
                {usuario?.activo === "S" ? "Activo" : "Inactivo"}
                {usuario?.bloqueado === "S" ? " · Bloqueado" : ""}
              </>
            }
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Shield className="h-5 w-5 text-amber-600" />
          <h3 className="text-sm font-bold text-slate-900">
            Permisos asignados ({permisos.length})
          </h3>
        </div>
        {permisos.length === 0 ? (
          <p className="text-sm text-slate-400">Sin permisos cargados.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {permisos.map((p) => (
              <span
                key={p.codigoPermiso}
                className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
              >
                {p.permisoNombre}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Campo({
  icon,
  label,
  valor,
}: {
  icon: React.ReactNode;
  label: string;
  valor: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-500">
        {icon} {label}
      </div>
      <p className="font-medium text-slate-800">{valor || "—"}</p>
    </div>
  );
}
