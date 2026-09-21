import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Package,
  CheckCircle2,
  Clock,
  Truck,
  MapPin,
  AlertCircle,
} from "lucide-react";
import {
  type PedidoResumen,
  type PedidoDetalle,
  type TrackingPaso,
  listarPedidos,
  obtenerPedido,
} from "../api/famkon";

const ICONOS_ESTADO: Record<string, typeof Clock> = {
  RECIBIDO: CheckCircle2,
  EN_PREPARACION: Package,
  EN_CAMINO: Truck,
  ENTREGADO: MapPin,
  CANCELADO: AlertCircle,
};

export default function TrackingPage() {
  const [pedidos, setPedidos] = useState<PedidoResumen[]>([]);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<PedidoResumen | null>(null);
  const [detalles, setDetalles] = useState<PedidoDetalle[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarPedidos();
  }, []);

  async function cargarPedidos() {
    setCargando(true);
    try {
      const data = await listarPedidos();
      setPedidos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar pedidos");
    }
    setCargando(false);
  }

  async function seleccionarPedido(pedido: PedidoResumen) {
    setPedidoSeleccionado(pedido);
    try {
      const { detalles: det } = await obtenerPedido(pedido.idPedido);
      setDetalles(det);
    } catch (err) {
      console.error("Error cargando detalle:", err);
      setDetalles([]);
    }
  }

  const pasos: TrackingPaso[] = pedidoSeleccionado
    ? [
        {
          estado: "RECIBIDO",
          fechaEstado: pedidoSeleccionado.fechaPedido,
          comentario: "Tu pedido ha sido confirmado.",
          actor: null,
        },
        {
          estado: "EN_PREPARACION",
          fechaEstado: "",
          comentario: "Tu pedido esta siendo preparado.",
          actor: null,
        },
        {
          estado: "EN_CAMINO",
          fechaEstado: "",
          comentario: "El repartidor esta en camino.",
          actor: null,
        },
        {
          estado: "ENTREGADO",
          fechaEstado: "",
          comentario: "Tu pedido ha sido entregado.",
          actor: null,
        },
      ]
    : [];

  function getIndiceActual(estado: string): number {
    const orden = ["RECIBIDO", "EN_PREPARACION", "EN_CAMINO", "ENTREGADO"];
    return orden.indexOf(estado);
  }

  const indiceActual = pedidoSeleccionado
    ? getIndiceActual(pedidoSeleccionado.estado)
    : -1;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex items-center gap-2">
        <Truck className="h-6 w-6 text-amber-600" />
        <h1 className="text-2xl font-bold text-slate-900">Seguimiento de envio</h1>
      </header>

      {cargando ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-20">
          <Package className="h-8 w-8 animate-spin text-amber-500" />
          <span className="ml-3 text-sm text-slate-500">Cargando pedidos...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white py-20">
          <AlertCircle className="h-12 w-12 text-red-300" />
          <p className="text-sm text-red-500">{error}</p>
        </div>
      ) : pedidos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white py-16 text-center">
          <Truck className="h-16 w-16 text-slate-300" />
          <p className="text-sm text-slate-500">No tienes pedidos realizados aun.</p>
          <Link
            to="/comprador/catalogo"
            className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-amber-400"
          >
            Ir al catalogo
          </Link>
        </div>
      ) : (
        <>
          {!pedidoSeleccionado && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-900">Tus pedidos</h2>
              {pedidos.map((pedido) => (
                <button
                  key={pedido.idPedido}
                  onClick={() => seleccionarPedido(pedido)}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {pedido.numeroPedido}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {new Date(pedido.fechaPedido).toLocaleDateString("es-GT", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          pedido.estado === "ENTREGADO"
                            ? "bg-green-100 text-green-700"
                            : pedido.estado === "EN_CAMINO"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {pedido.estado.replace("_", " ")}
                      </span>
                      <p className="mt-1 text-sm font-bold text-amber-600">
                        Q{pedido.total.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {pedidoSeleccionado && (
            <div className="space-y-6">
              <button
                onClick={() => {
                  setPedidoSeleccionado(null);
                  setDetalles([]);
                }}
                className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver a mis pedidos
              </button>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {pedidoSeleccionado.numeroPedido}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {new Date(pedidoSeleccionado.fechaPedido).toLocaleDateString(
                        "es-GT",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    {pedidoSeleccionado.estado.replace("_", " ")}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Productos</p>
                    <p className="font-semibold text-slate-800">
                      {detalles.length}{" "}
                      {detalles.length === 1 ? "articulo" : "articulos"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="font-semibold text-amber-600">
                      Q{pedidoSeleccionado.total.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-bold text-slate-900">
                  Estado del envio
                </h3>
                <div className="space-y-0">
                  {pasos.map((paso, i) => {
                    const esCompletado = i <= indiceActual;
                    const esActual = i === indiceActual;
                    const Icono = ICONOS_ESTADO[paso.estado] ?? Package;
                    const esUltimo = i === pasos.length - 1;
                    return (
                      <div key={i} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-full ${
                              esCompletado
                                ? esActual
                                  ? "bg-amber-100 text-amber-600 ring-2 ring-amber-300"
                                  : "bg-green-100 text-green-600"
                                : "bg-slate-100 text-slate-400"
                            }`}
                          >
                            <Icono className="h-5 w-5" />
                          </div>
                          {!esUltimo && (
                            <div
                              className={`w-0.5 flex-1 ${
                                esCompletado ? "bg-green-200" : "bg-slate-200"
                              }`}
                            />
                          )}
                        </div>

                        <div className={esUltimo ? "pb-0" : "pb-6"}>
                          <p
                            className={`text-sm font-semibold ${
                              esCompletado ? "text-slate-900" : "text-slate-400"
                            }`}
                          >
                            {paso.estado.replace("_", " ")}
                          </p>
                          {paso.fechaEstado && (
                            <p className="text-xs text-slate-400">
                              {new Date(paso.fechaEstado).toLocaleString("es-GT")}
                            </p>
                          )}
                          <p
                            className={`mt-0.5 text-xs ${
                              esCompletado ? "text-slate-600" : "text-slate-400"
                            }`}
                          >
                            {paso.comentario}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {detalles.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-bold text-slate-900">Productos</h3>
                  <div className="space-y-2">
                    {detalles.map((det) => (
                      <div
                        key={det.idDetalle}
                        className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm"
                      >
                        <div>
                          <p className="font-semibold text-slate-800">
                            {det.nombreProducto}
                          </p>
                          <p className="text-xs text-slate-500">
                            {det.cantidad} x Q{det.precioUnitario.toFixed(2)}
                          </p>
                        </div>
                        <span className="font-bold text-slate-900">
                          Q{det.subtotal.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Link
                to="/comprador/catalogo"
                className="block rounded-xl border border-slate-200 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Volver al catalogo
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
