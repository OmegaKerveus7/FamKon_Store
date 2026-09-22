import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Truck,
  ClipboardList,
  Camera,
  Package,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function RepartidorPage() {
  const { tieneRol, usuario } = useAuth();
  const esAdminOSupervisor = tieneRol("ADMIN") || tieneRol("SUPERVISOR");
  const location = useLocation();

  const tabs: Array<{ path: string; label: string; icon: typeof Truck; visible: boolean }> = [
    {
      path: "/repartidor/asignados",
      label: "Mis Pedidos Asignados",
      icon: ClipboardList,
      visible: true,
    },
    {
      path: "/repartidor/registrar",
      label: "Registrar Entrega",
      icon: Camera,
      visible: true,
    },
    {
      path: "/repartidor/cambiar-estado",
      label: "Cambiar Estado",
      icon: Package,
      visible: true,
    },
  ];

  const tabActiva = tabs.findIndex((t) => location.pathname.startsWith(t.path));
  const indiceActual = tabActiva >= 0 ? tabActiva : 0;

  return (
    <div className="space-y-5">
      <header className="rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 p-6 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
          Modulo repartidor
        </p>
        <h1 className="mt-1 text-2xl font-bold">Entregas y tracking</h1>
        <p className="mt-1 text-sm text-white/90">
          Gestiona los pedidos asignados, registra entregas con foto de
          evidencia y cambia el estado de cada pedido.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
            Hola, {usuario?.nickname}
          </span>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
            Rol: {usuario?.roles}
          </span>
        </div>
        {esAdminOSupervisor && (
          <div className="mt-3 flex gap-2">
            <Link
              to="/entregas/tracking"
              className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-white/25"
            >
              <Truck className="h-3 w-3" />
              Ver tracking general
            </Link>
          </div>
        )}
      </header>

      <nav className="flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {tabs.filter((t) => t.visible).map((t, idx) => {
          const Icon = t.icon;
          const activo = idx === indiceActual;
          return (
            <Link
              key={t.path}
              to={t.path}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition sm:flex-none ${
                activo
                  ? "bg-blue-500 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon size={18} />
              <span className="hidden sm:inline">{t.label}</span>
              <ChevronRight
                size={14}
                className={activo ? "opacity-100" : "opacity-0"}
              />
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
