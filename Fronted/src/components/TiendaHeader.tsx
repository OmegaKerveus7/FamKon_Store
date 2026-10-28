import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LogIn, ShoppingCart, UserRound, PackageSearch } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { cantidadCarritoLocal } from "../api/carritoLocal";
import { obtenerCarrito, sesionActiva } from "../api/famkon";
import { EVENTO_CARRITO } from "../domain/carritoVisitante";

/** Cabecera de las páginas públicas (catálogo, detalle y carrito de visitante). */
export default function TiendaHeader() {
  const { usuario } = useAuth();
  const [cantidad, setCantidad] = useState(0);

  const actualizar = useCallback(async () => {
    if (!usuario || !sesionActiva()) {
      setCantidad(cantidadCarritoLocal());
      return;
    }
    try {
      const carrito = await obtenerCarrito();
      setCantidad(carrito.detalles.reduce((total, item) => total + item.cantidad, 0));
    } catch {
      setCantidad(cantidadCarritoLocal());
    }
  }, [usuario]);

  useEffect(() => {
    void actualizar();
    const alCambiar = () => void actualizar();
    window.addEventListener("storage", alCambiar);
    window.addEventListener("carrito-local-cambiado", alCambiar);
    window.addEventListener(EVENTO_CARRITO, alCambiar);
    return () => {
      window.removeEventListener("storage", alCambiar);
      window.removeEventListener("carrito-local-cambiado", alCambiar);
      window.removeEventListener(EVENTO_CARRITO, alCambiar);
    };
  }, [actualizar]);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to="/catalogo" className="flex min-w-0 items-center gap-2">
          <img src="/images/logo-famkon.png" alt="FamKon" className="h-9 w-auto object-contain" />
          <span className="hidden text-sm font-black tracking-wide text-slate-900 sm:inline">FamKon</span>
        </Link>

        <nav className="ml-auto flex items-center gap-2">
          <Link
            to="/rastreo"
            className="hidden h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 md:inline-flex"
          >
            <PackageSearch size={17} />
            Rastrear pedido
          </Link>

          <Link
            to="/carrito"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-amber-400 hover:text-amber-700"
            aria-label={`Ver carrito (${cantidad} productos)`}
          >
            <ShoppingCart size={18} />
            {cantidad > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-950">
                {cantidad > 99 ? "99+" : cantidad}
              </span>
            )}
          </Link>

          {usuario ? (
            <Link
              to="/inicio"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <UserRound size={17} />
              <span className="hidden sm:inline">Mi cuenta</span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-amber-500 px-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
            >
              <LogIn size={17} />
              <span className="hidden sm:inline">Iniciar sesión</span>
              <span className="sm:hidden">Entrar</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
