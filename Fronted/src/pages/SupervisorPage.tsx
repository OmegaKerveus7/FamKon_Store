import { Link } from "react-router-dom";
import {
  BarChart3,
  Package,
  Truck,
  Users,
  Boxes,
  ShieldCheck,
} from "lucide-react";

export default function SupervisorPage() {
  const cards = [
    {
      to: "/supervisor",
      titulo: "Dashboard",
      descripcion: "Ventas y metricas en tiempo real.",
      icon: BarChart3,
      color: "from-blue-500 to-indigo-600",
    },
    {
      to: "/admin/usuarios",
      titulo: "Gestor de Usuarios",
      descripcion: "Alta, baja y asignacion de roles.",
      icon: Users,
      color: "from-purple-500 to-fuchsia-500",
    },
    {
      to: "/admin/productos",
      titulo: "Gestor de Productos",
      descripcion: "Crear, actualizar y desactivar productos.",
      icon: Boxes,
      color: "from-amber-500 to-orange-500",
    },
    {
      to: "/supervisor",
      titulo: "Entregas",
      descripcion: "Monitorear entregas y repartidores.",
      icon: Truck,
      color: "from-emerald-500 to-green-500",
    },
    {
      to: "/supervisor",
      titulo: "Pedidos",
      descripcion: "Listado completo de pedidos.",
      icon: Package,
      color: "from-orange-500 to-red-500",
    },
    {
      to: "/supervisor",
      titulo: "Seguridad",
      descripcion: "Bitacora de accesos y permisos.",
      icon: ShieldCheck,
      color: "from-slate-500 to-slate-700",
    },
  ];

  return (
    <div className="space-y-5">
      <header className="rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 p-6 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
          Panel supervisor
        </p>
        <h1 className="mt-1 text-2xl font-bold">Supervision de FamKon</h1>
        <p className="mt-1 text-sm text-white/90">
          Monitorea ventas, entregas y gestiona usuarios y productos.
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
