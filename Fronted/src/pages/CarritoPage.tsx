import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Trash2,
  Minus,
  Plus,
  ShoppingBag,
  Package,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCarritoTienda } from "../hooks/useCarritoTienda";
import { urlDeConfig } from "../domain/carritoVisitante";
import ImagenProducto from "../components/ImagenProducto";
import ImagenArchivo from "../components/ImagenArchivo";
import TiendaHeader from "../components/TiendaHeader";
import AccesoRequerido from "../components/AccesoRequerido";

export default function CarritoPage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { items, esVisitante, cargando, error, unidades, subtotal, cambiarCantidad, eliminar } =
    useCarritoTienda();
  const [pidiendoAcceso, setPidiendoAcceso] = useState(false);

  function handleProcederPago() {
    if (items.length === 0) return;
    if (!usuario) {
      setPidiendoAcceso(true);
      return;
    }
    navigate("/comprador/checkout");
  }

  const cargoEntrega = 0;
  const total = subtotal + cargoEntrega;

  return (
    <div className="min-h-dvh bg-slate-50">
      <TiendaHeader />
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <ShoppingBag className="h-6 w-6 text-amber-600" />
            Mi Carrito
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {items.length}
            </span>
          </h1>
          <p className="text-sm text-slate-500">
            {esVisitante
              ? "Estos productos quedan guardados en este dispositivo hasta que inicies sesión."
              : "Productos listos para tu pedido."}
          </p>
        </div>

        {pidiendoAcceso && (
          <AccesoRequerido
            destino="/comprador/checkout"
            onCancelar={() => setPidiendoAcceso(false)}
          />
        )}

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
              onClick={() => window.location.reload()}
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
              to="/catalogo"
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
                  key={item.id}
                  className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <Link to={`/producto/${item.idProducto}`} aria-label={`Ver ${item.nombre}`} className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-amber-50">
                    <ImagenProducto key={`${item.idProducto}-${item.idArchivoImagen}`} idProducto={item.idProducto} idArchivoImagen={item.idArchivoImagen} nombre={item.nombre} />
                  </Link>

                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{item.nombre}</h3>
                      <p className="text-[10px] text-slate-400">SKU: {item.sku}</p>
                      <p className="mt-1 text-sm font-semibold text-amber-600">
                        Q{item.precioUnitario.toFixed(2)}
                      </p>
                      {(item.idArchivoLadoA || item.idArchivoLadoB || item.mensajeLadoA || item.mensajeLadoB || item.configLadoA || item.configLadoB) && (
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
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void cambiarCantidad(item, item.cantidad - 1)}
                          disabled={item.cantidad <= 1}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-slate-900">
                          {item.cantidad}
                        </span>
                        <button
                          onClick={() => void cambiarCantidad(item, item.cantidad + 1)}
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
                          onClick={() => void eliminar(item)}
                          className="rounded-lg p-1.5 text-red-400 transition hover:bg-red-50 hover:text-red-600"
                          aria-label={`Eliminar ${item.nombre} del carrito`}
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
                    Subtotal ({unidades}{" "}
                    {unidades === 1 ? "producto" : "productos"})
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
                  {usuario ? "Continuar compra" : "Iniciar sesión y pagar"}
                </button>
              </div>
              <Link to="/catalogo" className="mt-3 block rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50">Seguir comprando</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
