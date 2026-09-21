import { Link } from "react-router-dom";
import {
  Boxes,
  Users,
  ShieldCheck,
  Settings,
  Database,
  BarChart3,
} from "lucide-react";

export default function AdminPage() {
  const cards = [
    {
      to: "/admin",
      titulo: "Dashboard",
      descripcion: "Ventas, entregas y metricas globales.",
      icon: BarChart3,
      color: "from-blue-500 to-indigo-600",
    },
    {
      to: "/admin/usuarios",
      titulo: "Usuarios y Roles",
      descripcion: "Crear, asignar roles, activar / bloquear.",
      icon: Users,
      color: "from-purple-500 to-fuchsia-500",
    },
    {
      to: "/admin/catalogos",
      titulo: "Catalogos",
      descripcion: "Productos, categorias, areas de entrega, metodos de pago.",
      icon: Boxes,
      color: "from-amber-500 to-orange-500",
    },
    {
      to: "/admin/roles",
      titulo: "Roles y Permisos",
      descripcion: "Matriz de permisos por rol.",
      icon: ShieldCheck,
      color: "from-red-500 to-rose-600",
    },
    {
      to: "/admin/bitacora",
      titulo: "Bitacora",
      descripcion: "Auditoria de accesos.",
      icon: Database,
      color: "from-orange-500 to-amber-500",
    },
    {
      to: "/admin/configuracion",
      titulo: "Configuracion",
      descripcion: "Parametrizacion general del sistema.",
      icon: Settings,
      color: "from-slate-500 to-slate-700",
    },
  ];

  return (
    <div className="space-y-5">
      <header className="rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 p-6 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
          Administrador
        </p>
        <h1 className="mt-1 text-2xl font-bold">Panel de Administracion</h1>
        <p className="mt-1 text-sm text-white/90">
          Acceso completo al sistema, parametrizacion y gestion global.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.titulo}
              to={c.to}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div
                className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${c.color} opacity-15 transition group-hover:scale-125`}
              />
              <div
                className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${c.color} text-white shadow-sm`}
              >
                <Icon size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-900">{c.titulo}</h3>
              <p className="mt-1 text-xs text-slate-500">{c.descripcion}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
