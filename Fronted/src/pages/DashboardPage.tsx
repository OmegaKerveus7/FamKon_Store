import { Link } from "react-router-dom";
import {
  Store,
  ShoppingCart,
  Truck,
  History,
  ClipboardList,
  Camera,
  Package,
  BarChart3,
  Users,
  Boxes,
  ShieldCheck,
  Database,
  Tag,
  Settings,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface CardAcceso {
  to: string;
  titulo: string;
  descripcion: string;
  icon: typeof Store;
  color: string;
}

export default function DashboardPage() {
  const { usuario, permisos, tienePermiso } = useAuth();
  const esAdmin = usuario?.roles?.toUpperCase().includes("ADMIN") ?? false;

  const comprasCards: CardAcceso[] = [
    {
      to: "/comprador/catalogo",
      titulo: "Catalogo",
      descripcion: "Explora productos personalizados.",
      icon: Store,
      color: "from-amber-400 to-orange-500",
    },
    {
      to: "/comprador/carrito",
      titulo: "Mi Carrito",
      descripcion: "Productos que vas a comprar.",
      icon: ShoppingCart,
      color: "from-orange-400 to-red-400",
    },
    {
      to: "/comprador/tracking",
      titulo: "Mis Envios",
      descripcion: "Tracking de tus pedidos.",
      icon: Truck,
      color: "from-emerald-400 to-teal-500",
    },
    {
      to: "/comprador/historico",
      titulo: "Historico",
      descripcion: "Compras anteriores.",
      icon: History,
      color: "from-blue-400 to-indigo-500",
    },
  ];

  const entregasCards: CardAcceso[] = [
    {
      to: "/repartidor",
      titulo: "Mis Pedidos",
      descripcion: "Pedidos asignados para entrega.",
      icon: ClipboardList,
      color: "from-blue-400 to-cyan-500",
    },
    {
      to: "/repartidor",
      titulo: "Registrar Entrega",
      descripcion: "Confirma la entrega al comprador.",
      icon: Camera,
      color: "from-emerald-400 to-green-500",
    },
    {
      to: "/repartidor",
      titulo: "Cambiar Estado",
      descripcion: "Entregado o no encontrado.",
      icon: Package,
      color: "from-amber-400 to-yellow-500",
    },
  ];

  const supervisionCards: CardAcceso[] = [
    {
      to: "/supervisor",
      titulo: "Dashboard",
      descripcion: "Ventas y metricas en tiempo real.",
      icon: BarChart3,
      color: "from-blue-500 to-indigo-600",
    },
    {
      to: "/admin/usuarios",
      titulo: "Gestor Usuarios",
      descripcion: "ABM y asignacion de roles.",
      icon: Users,
      color: "from-purple-500 to-fuchsia-500",
    },
    {
      to: "/admin/productos",
      titulo: "Gestor Productos",
      descripcion: "Crear, actualizar y desactivar.",
      icon: Boxes,
      color: "from-amber-500 to-orange-500",
    },
  ];

  const adminCards: CardAcceso[] = [
    {
      to: "/admin",
      titulo: "Dashboard Admin",
      descripcion: "Metricas globales del sistema.",
      icon: BarChart3,
      color: "from-red-500 to-rose-600",
    },
    {
      to: "/admin/usuarios",
      titulo: "Gestor Usuarios",
      descripcion: "ABM completo y roles.",
      icon: Users,
      color: "from-purple-500 to-fuchsia-500",
    },
    {
      to: "/admin/catalogos",
      titulo: "Catalogos",
      descripcion: "Productos, categorias, metodos.",
      icon: Boxes,
      color: "from-amber-500 to-orange-500",
    },
    {
      to: "/admin/roles",
      titulo: "Roles y Permisos",
      descripcion: "Matriz por rol.",
      icon: ShieldCheck,
      color: "from-slate-500 to-slate-700",
    },
    {
      to: "/admin/bitacora",
      titulo: "Bitacora",
      descripcion: "Auditoria de accesos.",
      icon: Database,
      color: "from-cyan-500 to-blue-500",
    },
  ];

  const puede = (codigo: string) => esAdmin || tienePermiso(codigo);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 p-6 text-white shadow-lg sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
          {usuario?.roles}
        </p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
          Hola, {usuario?.nickname} 👋
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/90">
          Bienvenido al panel de FamKon. Desde aqui accedes a todas las acciones que tu rol te permite.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
            {permisos.length} permiso{permisos.length === 1 ? "" : "s"} activos
          </span>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
            Sesion iniciada
          </span>
        </div>
      </div>

      {/* Compras */}
      {puede("VER_CATALOGO") && (
        <Seccion
          id="compras"
          titulo="Compras"
          subtitulo="Tienda, carrito y seguimiento"
          icon={Tag}
          cards={comprasCards.filter((c) => {
            if (c.to === "/comprador/catalogo") return puede("VER_CATALOGO");
            if (c.to === "/comprador/carrito")  return puede("VER_CARRITO");
            if (c.to === "/comprador/tracking") return puede("VER_TRACKING");
            if (c.to === "/comprador/historico") return puede("VER_HISTORICO");
            return false;
          })}
        />
      )}

      {/* Entregas */}
      {puede("VER_PEDIDOS_ASIGNADOS") && (
        <Seccion
          id="entregas"
          titulo="Entregas"
          subtitulo="Pedidos asignados y registro de entrega"
          icon={Truck}
          cards={entregasCards.filter((c) =>
            c.titulo === "Mis Pedidos"
              ? puede("VER_PEDIDOS_ASIGNADOS")
              : c.titulo === "Registrar Entrega"
              ? puede("GESTIONAR_ENTREGAS")
              : puede("GESTIONAR_ESTADO_PEDIDO"),
          )}
        />
      )}

      {/* Supervision */}
      {puede("VER_DASHBOARD") && (
        <Seccion
          id="supervision"
          titulo="Supervision"
          subtitulo="Metricas y gestion de la tienda"
          icon={ShieldCheck}
          cards={supervisionCards.filter((c) =>
            c.titulo === "Dashboard"
              ? puede("VER_DASHBOARD")
              : c.titulo === "Gestor Usuarios"
              ? puede("GESTIONAR_USUARIOS")
              : puede("GESTIONAR_PRODUCTOS"),
          )}
        />
      )}

      {/* Administracion */}
      {esAdmin && (
        <Seccion
          id="administracion"
          titulo="Administracion"
          subtitulo="Parametrizacion global del sistema"
          icon={Settings}
          cards={adminCards}
        />
      )}
    </div>
  );
}

function Seccion({
  id,
  titulo,
  subtitulo,
  icon: Icon,
  cards,
}: {
  id: string;
  titulo: string;
  subtitulo: string;
  icon: typeof Store;
  cards: CardAcceso[];
}) {
  if (cards.length === 0) return null;

  return (
    <section id={id} className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">{titulo}</h2>
          <p className="text-xs text-slate-500">{subtitulo}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((c) => {
          const I = c.icon;
          return (
            <Link
              key={`${id}-${c.to}-${c.titulo}`}
              to={c.to}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div
                className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${c.color} opacity-15 transition group-hover:scale-125`}
              />
              <div
                className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${c.color} text-white shadow-sm`}
              >
                <I size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-900">{c.titulo}</h3>
              <p className="mt-1 text-xs text-slate-500">{c.descripcion}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
