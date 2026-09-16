import { useNavigate, Link } from "react-router-dom";
import { LogOut, Store, ShoppingCart, Truck, User, Shield, Settings } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { obtenerCarritoLocal } from "../api/famkon";
import { useEffect, useState } from "react";

export default function HomePage() {
  const { usuario, cerrarSesion, permisos, tieneRol } = useAuth();
  const navigate = useNavigate();
  const [cantidadCarrito, setCantidadCarrito] = useState(0);

  const esAdmin = tieneRol("ADMIN");

  useEffect(() => {
    const items = obtenerCarritoLocal();
    setCantidadCarrito(items.reduce((sum, i) => sum + i.cantidad, 0));
  }, []);

  function handleSalir() {
    cerrarSesion();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-linear-to-br from-amber-50 via-orange-100 to-slate-100">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/60 bg-white/70 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <img src="/images/logo-famkon.png" alt="Logo FamKon" className="h-10 w-10 object-contain" />
          <span className="text-lg font-bold text-slate-900">FamKon</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/comprador/carrito"
            className="relative rounded-xl border border-slate-300 p-2 text-slate-700 transition hover:bg-white"
          >
            <ShoppingCart className="h-5 w-5" />
            {cantidadCarrito > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {cantidadCarrito}
              </span>
            )}
          </Link>
          <button
            onClick={handleSalir}
            className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
          >
            <LogOut className="h-4 w-4" /> Salir
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col p-6 sm:p-8">
        {/* Bienvenida */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">
            Hola, {usuario?.nickname} 👋
          </h1>
          <p className="text-sm text-slate-500">
            Bienvenido a la tienda FamKon
          </p>
        </div>

        {/* Cards de navegación - Comprador */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/comprador/catalogo"
            className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600 group-hover:bg-amber-200">
              <Store className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Ver Catálogo</h2>
            <p className="mt-1 text-sm text-slate-500">
              Explora nuestros productos personalizados
            </p>
          </Link>

          <Link
            to="/comprador/carrito"
            className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600 group-hover:bg-orange-200">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Mi Carrito</h2>
            <p className="mt-1 text-sm text-slate-500">
              {cantidadCarrito > 0
                ? `${cantidadCarrito} ${cantidadCarrito === 1 ? "artículo" : "artículos"} en tu carrito`
                : "Tu carrito está vacío"}
            </p>
          </Link>

          <Link
            to="/comprador/tracking"
            className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-600 group-hover:bg-green-200">
              <Truck className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Mis Envíos</h2>
            <p className="mt-1 text-sm text-slate-500">
              Rastrea el estado de tus pedidos
            </p>
          </Link>
        </div>

        {/* Sección Admin (solo si tiene rol ADMIN) */}
        {esAdmin && (
          <div className="mt-8">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
              <Shield className="h-5 w-5 text-red-500" /> Administración
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                to="/admin/productos"
                className="group rounded-2xl border border-red-200 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600 group-hover:bg-red-200">
                  <Settings className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Gestionar Productos</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Crear, editar y administrar productos
                </p>
              </Link>
            </div>
          </div>
        )}

        {/* Info del usuario y permisos */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
              <User className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Mi Cuenta</h3>
              <p className="text-xs text-slate-500">{usuario?.roles || "Comprador"}</p>
            </div>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Correo</p>
              <p className="font-medium text-slate-800">{usuario?.correo ?? "—"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Nickname</p>
              <p className="font-medium text-slate-800">{usuario?.nickname ?? "—"}</p>
            </div>
          </div>

          {/* Permisos (para debug / transparencia) */}
          {permisos.length > 0 && (
            <div className="mt-4 rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500 mb-2">Tus permisos:</p>
              <div className="flex flex-wrap gap-1">
                {permisos.map((p) => (
                  <span
                    key={p.codigoPermiso}
                    className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                  >
                    {p.permisoNombre}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
