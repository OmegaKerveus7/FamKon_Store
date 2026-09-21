import { Link } from "react-router-dom";
import { Package, Truck, ClipboardList, Camera, Search } from "lucide-react";

export default function RepartidorPage() {
  const cards = [
    {
      to: "/repartidor",
      titulo: "Buscar Pedido",
      descripcion: "Por teclado o escaneando el codigo QR del comprador.",
      icon: Search,
      color: "from-blue-500 to-cyan-500",
    },
    {
      to: "/repartidor",
      titulo: "Mis Pedidos Asignados",
      descripcion: "Lista de pedidos que debes entregar hoy.",
      icon: ClipboardList,
      color: "from-orange-500 to-amber-500",
    },
    {
      to: "/repartidor",
      titulo: "Registrar Entrega",
      descripcion: "Confirma la entrega (efectivo / foto evidencia).",
      icon: Truck,
      color: "from-emerald-500 to-green-500",
    },
    {
      to: "/repartidor",
      titulo: "Cambiar Estado",
      descripcion: "Marcar entregado o comprador no encontrado.",
      icon: Package,
      color: "from-amber-500 to-yellow-500",
    },
    {
      to: "/repartidor",
      titulo: "Foto Evidencia",
      descripcion: "Captura la foto del articulo entregado.",
      icon: Camera,
      color: "from-purple-500 to-fuchsia-500",
    },
  ];

  return (
    <div className="space-y-5">
      <header className="rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 p-6 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
          Modulo repartidor
        </p>
        <h1 className="mt-1 text-2xl font-bold">Entregas asignadas</h1>
        <p className="mt-1 text-sm text-white/90">
          Gestiona tus pedidos, registra entregas y cambia el estado.
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
