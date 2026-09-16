import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ShoppingCart, Package, Minus, Plus, Check } from "lucide-react";
import {
  type Producto,
  obtenerProducto,
  agregarAlCarritoAPI,
} from "../api/famkon";

export default function ProductoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [producto, setProducto] = useState<Producto | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [agregando, setAgregando] = useState(false);
  const [agregado, setAgregado] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      if (!id) return;
      try {
        const prod = await obtenerProducto(Number(id));
        setProducto(prod);
      } catch (err) {
        console.error("Error cargando producto:", err);
      }
      setCargando(false);
    }
    cargar();
  }, [id]);

  async function handleAgregar() {
    if (!producto || agregando) return;
    setAgregando(true);
    try {
      await agregarAlCarritoAPI({
        idProducto: producto.idProducto,
        cantidad,
      });
      setAgregado(true);
      setTimeout(() => setAgregado(false), 2000);
    } catch (err) {
      console.error("Error agregando al carrito:", err);
    }
    setAgregando(false);
  }

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-amber-50 via-orange-100 to-slate-100">
        <Package className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!producto) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-amber-50 via-orange-100 to-slate-100 gap-4">
        <Package className="h-12 w-12 text-slate-300" />
        <p className="text-sm text-slate-500">Producto no encontrado.</p>
        <Link to="/comprador/catalogo" className="text-sm font-semibold text-amber-600 hover:underline">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-amber-50 via-orange-100 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/60 bg-white/70 px-4 py-3 backdrop-blur sm:px-6">
        <button onClick={() => navigate(-1)} className="rounded-xl border border-slate-300 p-2 text-slate-700 transition hover:bg-white">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold text-slate-900">Detalle del producto</span>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {/* Imagen */}
        <div className="mb-6 flex aspect-[16/9] items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 shadow-sm">
          <Package className="h-24 w-24 text-amber-300" />
        </div>

        {/* Info */}
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-amber-600">{producto.categoria}</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{producto.nombre}</h1>
            <span className="mt-1 inline-block rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              SKU: {producto.sku}
            </span>
          </div>

          <p className="text-sm leading-relaxed text-slate-600">{producto.descripcion}</p>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-amber-600">Q{producto.precioBase.toFixed(2)}</span>
            <span className="text-xs text-slate-400">precio base</span>
          </div>

          {/* Personalización */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">Personalización</p>
            <p className="mt-1">
              {producto.permiteLadoA === "S" && producto.permiteLadoB === "S"
                ? "Este producto permite personalizar ambos lados (A y B)."
                : producto.permiteLadoA === "S"
                  ? "Este producto permite personalizar el lado A."
                  : "Este producto no admite personalización."}
            </p>
          </div>

          {/* Cantidad */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-slate-700">Cantidad:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-50"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center text-lg font-bold text-slate-900">{cantidad}</span>
              <button
                onClick={() => setCantidad(cantidad + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Subtotal */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Subtotal ({cantidad} {cantidad === 1 ? "unidad" : "unidades"})</span>
              <span className="text-xl font-bold text-amber-700">
                Q{(producto.precioBase * cantidad).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            <Link
              to="/comprador/catalogo"
              className="flex-1 rounded-xl border border-slate-300 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              Seguir comprando
            </Link>
            <button
              onClick={handleAgregar}
              disabled={agregado}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition ${
                agregado
                  ? "bg-green-500 text-white"
                  : "bg-amber-500 text-white hover:bg-amber-400"
              }`}
            >
              {agregado ? (
                <>
                  <Check className="h-4 w-4" /> Agregado
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4" /> Agregar al carrito
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
