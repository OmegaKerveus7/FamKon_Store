import { rutaPersonalBloqueada } from '../domain/vistasRol';
import { useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
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
  const { usuario, permisos, tienePermiso, tieneRol, cargarPermisos } = useAuth();
  const [reintentando, setReintentando] = useState(false);
  const location = useLocation();

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (rutaPersonalBloqueada(usuario.roles, location.pathname)) return <Navigate to="/inicio" replace />;

  // Si no hay permisos cargados, intentar cargarlos una vez
  if (permisos.length === 0) {
    return (
      <div className="flex min-h-screen items-start justify-center overflow-x-auto overflow-y-auto sm:items-center bg-slate-50">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <p className="text-sm font-medium text-slate-600 mb-4">Cargando permisos...</p>
          <button
            onClick={async () => {
              setReintentando(true);
              await cargarPermisos();
              setReintentando(false);
            }}
            disabled={reintentando}
            className="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-medium hover:bg-amber-400 disabled:opacity-60"
          >
            {reintentando ? "Reintentando…" : "Reintentar"}
          </button>
        </div>
      </div>
    );
  }

  if (codigoRol && !tieneRol(codigoRol)) {
    return <Navigate to="/inicio" replace />;
  }

  if (codigoPermiso && !tienePermiso(codigoPermiso)) {
    return <Navigate to="/inicio" replace />;
  }

  return <>{children}</>;
}
