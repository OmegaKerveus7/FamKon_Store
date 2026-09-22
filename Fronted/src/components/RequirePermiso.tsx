import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface RequirePermisoProps {
  codigoPermiso?: string;
  codigoRol?: string;
  children: ReactNode;
}

export default function RequirePermiso({
  codigoPermiso,
  codigoRol,
  children,
}: RequirePermisoProps) {
  const { usuario, permisos, tienePermiso, tieneRol } = useAuth();

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (codigoRol && !tieneRol(codigoRol)) {
    return <Navigate to="/inicio" replace />;
  }

  if (codigoPermiso && !tienePermiso(codigoPermiso)) {
    return <Navigate to="/inicio" replace />;
  }

  if (permisos.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-slate-600">
            Cargando permisos del usuario...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
