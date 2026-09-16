import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Trash2,
  Minus,
  Plus,
  ShoppingBag,
  Package,
  AlertCircle,
} from "lucide-react";
import {
  type CarritoItem,
  obtenerCarrito,
  actualizarCantidadCarritoAPI,
  eliminarDelCarritoAPI,
} from "../api/famkon";

export default function CarritoPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CarritoItem[]>([]);
  const [idCarrito, setIdCarrito] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarCarrito();
  }, []);

  async function cargarCarrito() {
    setCargando(true);
    try {
      const carrito = await obtenerCarrito();
      setIdCarrito(carrito.idCarrito);
      setItems(carrito.detalles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar carrito");
    }
    setCargando(false);
  }

  async function handleCantidad(idDetalle: number, nuevaCantidad: number) {
    if (nuevaCantidad < 1) return;
    try {
      await actualizarCantidadCarritoAPI(idDetalle, nuevaCantidad);
      setItems((prev) =>
        prev.map((i) =>
          i.idDetalle === idDetalle
            ? {
                ...i,
                cantidad: nuevaCantidad,
                subtotal:
                  nuevaCantidad * i.precioUnitario + i.precioPersonaliza,
              }
            : i,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al actualizar cantidad",
      );
    }
  }

  async function handleEliminar(idDetalle: number) {
    try {
      await eliminarDelCarritoAPI(idDetalle);
      setItems((prev) => prev.filter((i) => i.idDetalle !== idDetalle));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al eliminar producto",
      );
    }
  }

  function handleProcederPago() {
    if (items.length === 0 || !idCarrito) return;
    navigate(`/comprador/tracking?carrito=${idCarrito}`, { replace: true });
  }

  const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
  const cargoEntrega = items.length > 0 ? 25.0 : 0;
  const total = subtotal + cargoEntrega;

  return (
    <div className="min-h-screen bg-linear-to-br from-amber-50 via-orange-100 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/60 bg-white/70 px-4 py-3 backdrop-blur sm:px-6">
        <button
          onClick={() => navigate(-1)}
          className="rounded-xl border border-slate-300 p-2 text-slate-700 transition hover:bg-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <ShoppingBag className="h-5 w-5 text-amber-600" />
        <span className="text-sm font-semibold text-slate-900">
          Mi Carrito ({items.length})
        </span>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {cargando ? (
          <div className="flex items-center justify-center py-20">
            <Package className="h-8 w-8 animate-spin text-amber-500" />
            <span className="ml-3 text-sm text-slate-500">
              Cargando carrito...
            </span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <AlertCircle className="h-12 w-12 text-red-300" />
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={cargarCarrito}
              className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-amber-400"
            >
              Reintentar
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <Package className="h-16 w-16 text-slate-300" />
            <p className="text-sm text-slate-500">Tu carrito está vacío.</p>
            <Link
              to="/comprador/catalogo"
              className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-amber-400"
            >
              Ver catálogo
            </Link>
          </div>
        ) : (
          <>
            {/* Lista de productos */}
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.idDetalle}
                  className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  {/* Imagen placeholder */}
                  <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100">
                    <Package className="h-8 w-8 text-amber-300" />
                  </div>

                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {item.producto}
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        SKU: {item.sku}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-amber-600">
                        Q{item.precioUnitario.toFixed(2)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      {/* Controles de cantidad */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            handleCantidad(item.idDetalle, item.cantidad - 1)
                          }
                          disabled={item.cantidad <= 1}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-slate-900">
                          {item.cantidad}
                        </span>
                        <button
                          onClick={() =>
                            handleCantidad(item.idDetalle, item.cantidad + 1)
                          }
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-50"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-900">
                          Q{item.subtotal.toFixed(2)}
                        </span>
                        <button
                          onClick={() => handleEliminar(item.idDetalle)}
                          className="rounded-lg p-1.5 text-red-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Resumen */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-bold text-slate-900">
                Resumen del pedido
              </h2>
              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex justify-between">
                  <span>
                    Subtotal ({items.length}{" "}
                    {items.length === 1 ? "producto" : "productos"})
                  </span>
                  <span className="font-semibold text-slate-800">
                    Q{subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Cargo de entrega</span>
                  <span className="font-semibold text-slate-800">
                    Q{cargoEntrega.toFixed(2)}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-2">
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-900">Total</span>
                    <span className="text-lg font-bold text-amber-600">
                      Q{total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={handleProcederPago}
                  className="flex-1 rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white transition hover:bg-amber-400"
                >
                  Proceder al pago
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
