import { useEffect, useState } from "react";
import {
  Package,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import {
  type PedidoParaEntrega,
  listarPedidosParaEntrega,
  cambiarEstadoPedidoRepartidor,
} from "../api/famkon";
import { useAuth } from "../context/AuthContext";

const ESTADOS = [
  { codigo: "GENERADO", nombre: "Generado", descripcion: "Orden creada al finalizar el checkout." },
  { codigo: "PAGO_PENDIENTE", nombre: "Pago pendiente", descripcion: "Pendiente de confirmar pago o cobrar efectivo." },
  { codigo: "PAGO_CONFIRMADO", nombre: "Pago confirmado", descripcion: "Pago confirmado para iniciar elaboracion." },
  { codigo: "EN_ELABORACION", nombre: "En elaboracion", descripcion: "Producto personalizado en proceso." },
  { codigo: "LISTO_ENTREGA", nombre: "Listo para entrega", descripcion: "Producto terminado y disponible para entregar." },
  { codigo: "ENTREGADO", nombre: "Entregado", descripcion: "Producto entregado al comprador (final)." },
  { codigo: "COMPRADOR_NO_ENCONTRADO", nombre: "Comprador no encontrado", descripcion: "Intento de entrega sin localizar al comprador." },
  { codigo: "CANCELADO", nombre: "Cancelado", descripcion: "Pedido cancelado (final)." },
];

function toast(mensaje: string, tipo: "ok" | "err") {
  const el = document.createElement("div");
  el.className = `fixed top-4 right-4 z-[70] rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg ${
    tipo === "ok" ? "bg-emerald-500" : "bg-red-500"
  }`;
  el.textContent = mensaje;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

export default function RepartidorCambiarEstadoSection() {
  const { tieneRol } = useAuth();
  const esAdminOSupervisor = tieneRol("ADMIN") || tieneRol("SUPERVISOR");

  const [pedidos, setPedidos] = useState<PedidoParaEntrega[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [seleccionado, setSeleccionado] = useState<PedidoParaEntrega | null>(null);
  const [codigoEstado, setCodigoEstado] = useState<string>("LISTO_ENTREGA");
  const [comentario, setComentario] = useState<string>("");

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    setError("");
    try {
      const lista = await listarPedidosParaEntrega();
      setPedidos(lista);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar pedidos.");
    } finally {
      setCargando(false);
    }
  }

  async function handleCambiar() {
    if (!seleccionado) return;
    setProcesando(true);
    try {
      const r = await cambiarEstadoPedidoRepartidor(
        seleccionado.idPedido,
        codigoEstado,
        comentario || undefined,
      );
      if (r.codigoS !== 200) throw new Error(r.mensaje);
      toast(`Pedido ${seleccionado.numeroPedido}: ${r.mensaje}`, "ok");
      setSeleccionado(null);
      setComentario("");
      await cargar();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error.", "err");
    } finally {
      setProcesando(false);
    }
  }

  if (!esAdminOSupervisor) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-700">
              Modulo restringido
            </p>
            <p className="text-xs text-amber-600">
              Solo administradores y supervisores pueden cambiar el estado de los
              pedidos directamente.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (cargando) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-slate-400" />
        <p className="text-sm text-slate-500">Buscando pedidos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      <p className="text-sm text-slate-600">
        Cambia el estado de un pedido usando{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
          PKG_PEDIDO.SP_CAMBIAR_ESTADO
        </code>
        . El repartidor recibe el cambio automaticamente en su tracking.
      </p>

      {pedidos.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <Package className="mx-auto mb-2 h-12 w-12 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">
            No hay pedidos en estado LISTO_ENTREGA.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Aqui apareceran los pedidos que pueden cambiar de estado.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {pedidos.map((p) => (
            <TarjetaSelector
              key={p.idPedido}
              pedido={p}
              seleccionado={seleccionado?.idPedido === p.idPedido}
              onSelect={() => setSeleccionado(p)}
            />
          ))}
        </div>
      )}

      {seleccionado && (
        <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-5 shadow-sm">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-700">
              Cambiando estado del pedido
            </p>
            <h3 className="text-base font-bold text-slate-900">
              {seleccionado.numeroPedido}
            </h3>
            <p className="text-xs text-slate-500">
              {seleccionado.areaEntrega} · Total: Q
              {seleccionado.total.toFixed(2)}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-600">
                Nuevo estado
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {ESTADOS.map((e) => (
                  <button
                    key={e.codigo}
                    onClick={() => setCodigoEstado(e.codigo)}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      codigoEstado === e.codigo
                        ? "border-purple-500 bg-purple-100 ring-2 ring-purple-300"
                        : "border-slate-200 bg-white hover:border-purple-200"
                    }`}
                  >
                    <p
                      className={`text-xs font-bold ${
                        codigoEstado === e.codigo ? "text-purple-700" : "text-slate-800"
                      }`}
                    >
                      {e.nombre}
                    </p>
                    <p className="text-[10px] text-slate-500">{e.descripcion}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Comentario (opcional)
              </label>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={2}
                placeholder="Razon del cambio..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
              />
            </div>

            <div className="flex gap-2 border-t border-purple-200 pt-3">
              <button
                onClick={handleCambiar}
                disabled={procesando}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-purple-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-purple-600 disabled:opacity-50"
              >
                {procesando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Cambiar a {ESTADOS.find((e) => e.codigo === codigoEstado)?.nombre}
              </button>
              <button
                onClick={() => setSeleccionado(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TarjetaSelector({
  pedido,
  seleccionado,
  onSelect,
}: {
  pedido: PedidoParaEntrega;
  seleccionado: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition ${
        seleccionado
          ? "border-purple-500 bg-purple-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-purple-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            seleccionado ? "bg-purple-500 text-white" : "bg-purple-100 text-purple-700"
          }`}
        >
          <Package size={18} />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">{pedido.numeroPedido}</p>
          <p className="text-xs text-slate-500">
            Total: Q{pedido.total.toFixed(2)} · {pedido.areaEntrega}
          </p>
          <p className="flex items-center gap-1 text-[10px] text-slate-400">
            <Calendar className="h-3 w-3" />
            {new Date(pedido.fechaPedido).toLocaleDateString("es-GT")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
          {pedido.estadoPedido}
        </span>
      </div>
    </button>
  );
}
