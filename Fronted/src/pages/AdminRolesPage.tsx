import { ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function AdminRolesPage() {
  const { permisos, tieneRol } = useAuth();

  const roles = [
    { codigo: "ADMIN",      nombre: "Administrador", color: "bg-red-100 text-red-700" },
    { codigo: "SUPERVISOR", nombre: "Supervisor",    color: "bg-purple-100 text-purple-700" },
    { codigo: "REPARTIDOR", nombre: "Repartidor",    color: "bg-blue-100 text-blue-700" },
    { codigo: "COMPRADOR",  nombre: "Comprador",     color: "bg-amber-100 text-amber-700" },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <ShieldCheck className="h-6 w-6 text-red-600" />
          Roles y Permisos
        </h1>
        <p className="text-sm text-slate-500">
          Matriz de permisos por rol del sistema.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Roles activos
        </h3>
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => {
            const activo = tieneRol(r.codigo);
            return (
              <span
                key={r.codigo}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  activo ? `${r.color} ring-2 ring-offset-1 ring-current/30` : "bg-slate-100 text-slate-400"
                }`}
              >
                {r.nombre} ({r.codigo})
                {activo && <span className="ml-1 text-[10px]">&#10003;</span>}
              </span>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Tus permisos ({permisos.length})
        </h3>
        {permisos.length === 0 ? (
          <p className="text-sm text-slate-400">Sin permisos cargados.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {permisos.map((p) => (
              <div
                key={p.codigoPermiso}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <p className="text-xs font-bold text-slate-800">{p.codigoPermiso}</p>
                <p className="text-[11px] text-slate-500">{p.permisoNombre}</p>
                <span className="mt-1 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                  {p.codigoRol}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-slate-400">
        Modulo en construccion - administra la tabla ROL_PERMISO con PKG_USUARIO.SP_LISTAR_ROLES / PKG_SEGURIDAD.SP_ASIGNAR_ROL.
      </p>
    </div>
  );
}
