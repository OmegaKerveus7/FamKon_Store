import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
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

import ImagenProducto from "../components/ImagenProducto";
import ImagenArchivo from "../components/ImagenArchivo";

function urlDeConfig(config?: string | null): string | null {
  if (!config) return null;
  try {
    const datos = JSON.parse(config) as { url?: unknown };
    return typeof datos.url === "string" ? datos.url : null;
  } catch {
    return null;
  }
}

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
                subtotal: nuevaCantidad * (i.precioUnitario + (i.precioPersonaliza ?? 0)),
              }
            : i,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar cantidad");
    }
  }

  async function handleEliminar(idDetalle: number) {
    try {
      await eliminarDelCarritoAPI(idDetalle);
      setItems((prev) => prev.filter((i) => i.idDetalle !== idDetalle));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar producto");
    }
  }

  function handleProcederPago() {
    if (items.length === 0 || !idCarrito) return;
    navigate("/comprador/checkout");
  }

  const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
  const cargoEntrega = 0;
  const total = subtotal + cargoEntrega;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <ShoppingBag className="h-6 w-6 text-amber-600" />
          Mi Carrito
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {items.length}
          </span>
        </h1>
        <p className="text-sm text-slate-500">Productos listos para tu pedido.</p>
      </div>

      {cargando ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-20">
          <Package className="h-8 w-8 animate-spin text-amber-500" />
          <span className="ml-3 text-sm text-slate-500">Cargando carrito...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white py-20">
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
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white py-20">
          <Package className="h-16 w-16 text-slate-300" />
          <p className="text-sm text-slate-500">Tu carrito esta vacio.</p>
          <Link
            to="/comprador/catalogo"
            className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-amber-400"
          >
            Ver catalogo
          </Link>
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.idDetalle}
                className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <Link to={`/comprador/producto/${item.idProducto}`} aria-label={`Ver ${item.producto}`} className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-amber-50">
                  <ImagenProducto key={`${item.idProducto}-${item.idArchivoImagen}`} idProducto={item.idProducto} idArchivoImagen={item.idArchivoImagen} nombre={item.producto} />
                </Link>

                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{item.producto}</h3>
                    <p className="text-[10px] text-slate-400">SKU: {item.sku}</p>
                    <p className="mt-1 text-sm font-semibold text-amber-600">
                      Q{item.precioUnitario.toFixed(2)}
                    </p>
                    {(item.idArchivoLadoA || item.idArchivoLadoB || item.mensajeLadoA || item.mensajeLadoB || item.configLadoA || item.configLadoB || item.comentario) && (
                      <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                        <p className="font-semibold text-slate-700">Personalización</p>
                        {(item.idArchivoLadoA || item.idArchivoLadoB) && (
                          <div className="flex gap-2 py-1">
                            {item.idArchivoLadoA && (
                              <div>
                                <ImagenArchivo id={item.idArchivoLadoA} alt="Diseño lado A" className="h-14 w-14 rounded-md border border-slate-200 object-cover" />
                                <span className="mt-0.5 block text-center text-[9px] text-slate-400">Lado A</span>
                              </div>
                            )}
                            {item.idArchivoLadoB && (
                              <div>
                                <ImagenArchivo id={item.idArchivoLadoB} alt="Diseño lado B" className="h-14 w-14 rounded-md border border-slate-200 object-cover" />
                                <span className="mt-0.5 block text-center text-[9px] text-slate-400">Lado B</span>
                              </div>
                            )}
                          </div>
                        )}
                        {item.mensajeLadoA && <p><span className="font-semibold">Lado A:</span> {item.mensajeLadoA}</p>}
                        {item.mensajeLadoB && <p><span className="font-semibold">Lado B:</span> {item.mensajeLadoB}</p>}
                        {(() => {
                          const urlA = urlDeConfig(item.configLadoA);
                          const urlB = urlDeConfig(item.configLadoB);
                          if (urlA && urlB && urlA === urlB) {
                            return <p><span className="font-semibold">URL NFC:</span> {urlA}</p>;
                          }
                          return (
                            <>
                              {urlA && <p><span className="font-semibold">URL A:</span> {urlA}</p>}
                              {urlB && <p><span className="font-semibold">URL B:</span> {urlB}</p>}
                            </>
                          );
                        })()}
                        {!item.mensajeLadoA && !item.mensajeLadoB && item.comentario && <p><span className="font-semibold">Indicaciones:</span> {item.comentario}</p>}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCantidad(item.idDetalle, item.cantidad - 1)}
                        disabled={item.cantidad <= 1}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-slate-900">
                        {item.cantidad}
                      </span>
                      <button
                        onClick={() => handleCantidad(item.idDetalle, item.cantidad + 1)}
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

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-4">
            <h2 className="mb-4 text-sm font-bold text-slate-900">Resumen del pedido</h2>
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
                <span>Entrega</span>
                <span className="font-semibold text-slate-800">
                  Se elige al finalizar
                </span>
              </div>
              <div className="border-t border-slate-200 pt-2">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-900">Subtotal</span>
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
                Continuar compra
              </button>
            </div>
            <Link to="/comprador/catalogo" className="mt-3 block rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50">Seguir comprando</Link>
          </div>
        </div>
      )}
    </div>
  );
}
