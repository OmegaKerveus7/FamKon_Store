import { useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Upload,
  Loader2,
  Image as ImageIcon,
  Package,
  X,
  AlertTriangle,
  MapPin,
  Truck,
} from "lucide-react";
import {
  type EntregaRepartidor,
  listarMisEntregas,
  registrarResultadoEntrega,
  subirEvidenciaEntrega,
} from "../api/famkon";

function toast(mensaje: string, tipo: "ok" | "err") {
  const el = document.createElement("div");
  el.className = `fixed top-4 right-4 z-[70] rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg ${
    tipo === "ok" ? "bg-emerald-500" : "bg-red-500"
  }`;
  el.textContent = mensaje;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

export default function RepartidorRegistrarSection() {
  const [entregas, setEntregas] = useState<EntregaRepartidor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [seleccionada, setSeleccionada] = useState<EntregaRepartidor | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [obs, setObs] = useState("");
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    setError("");
    try {
      const mis = await listarMisEntregas();
      setEntregas(
        mis.filter(
          (e) => e.codigoEstado !== "ENTREGADA" && e.codigoEstado !== "CANCELADA",
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar entregas.");
    } finally {
      setCargando(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setArchivo(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
  }

  function limpiar() {
    setArchivo(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  }

  async function handleRegistrar(
    codigo: "ENTREGADA" | "NO_ENCONTRADO" | "CANCELADA",
  ) {
    if (!seleccionada) return;
    setProcesando(true);
    setSubiendo(!!archivo);
    try {
      let idArchivo: number | undefined =
        seleccionada.idArchivoEvidencia ?? undefined;
      if (archivo && !seleccionada.idArchivoEvidencia) {
        const up = await subirEvidenciaEntrega(archivo);
        if (up.codigoS !== 200 || !up.idArchivo)
          throw new Error(up.mensaje || "No se pudo subir la evidencia");
        idArchivo = up.idArchivo;
      }

      const r = await registrarResultadoEntrega(
        seleccionada.idEntrega,
        codigo,
        0,
        obs || undefined,
        idArchivo,
      );
      if (r.codigoS !== 200) throw new Error(r.mensaje);

      toast(r.mensaje, "ok");
      setSeleccionada(null);
      limpiar();
      setObs("");
      await cargar();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error.", "err");
    } finally {
      setProcesando(false);
      setSubiendo(false);
    }
  }

  if (cargando) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-slate-400" />
        <p className="text-sm text-slate-500">Buscando entregas pendientes...</p>
      </div>
    );
  }

  if (entregas.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <CheckCircle2 className="mx-auto mb-2 h-12 w-12 text-emerald-300" />
        <p className="text-sm font-semibold text-slate-700">
          No tienes entregas pendientes de registrar.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Espera a que el supervisor te asigne un pedido.
        </p>
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
        Selecciona una entrega pendiente para registrar el resultado. Puedes
        adjuntar una foto de evidencia.
      </p>

      <div className="space-y-2">
        {entregas.map((e) => (
          <TarjetaSelector
            key={e.idEntrega}
            entrega={e}
            seleccionada={seleccionada?.idEntrega === e.idEntrega}
            onSelect={() => {
              setSeleccionada(e);
              limpiar();
              setObs("");
            }}
          />
        ))}
      </div>

      {seleccionada && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                Registrando entrega
              </p>
              <h3 className="text-base font-bold text-slate-900">
                {seleccionada.numeroPedido}
              </h3>
              <p className="text-xs text-slate-500">
                Intento #{seleccionada.numeroIntento} · {seleccionada.areaEntrega}
              </p>
            </div>
            <button
              onClick={() => setSeleccionada(null)}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Foto de evidencia
              </label>
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                  <Upload className="h-4 w-4" />
                  {archivo ? "Cambiar foto" : "Subir foto"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={onFileChange}
                    className="hidden"
                  />
                </label>
                {archivo && (
                  <button
                    onClick={limpiar}
                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {preview && (
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <img
                    src={preview}
                    alt="Evidencia"
                    className="max-h-64 w-full object-contain"
                  />
                  <div className="bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    {archivo?.name} ({Math.round((archivo?.size ?? 0) / 1024)} KB)
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Observaciones (opcional)
              </label>
              <textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={2}
                placeholder="Notas sobre la entrega..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="space-y-2 border-t border-blue-200 pt-3">
              <p className="text-xs font-semibold text-slate-600">
                Resultado de la entrega
              </p>
              <button
                onClick={() => handleRegistrar("ENTREGADA")}
                disabled={procesando}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:opacity-50"
              >
                {subiendo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Confirmar entrega exitosa
              </button>
              <button
                onClick={() => handleRegistrar("NO_ENCONTRADO")}
                disabled={procesando}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Comprador no encontrado
              </button>
              <button
                onClick={() => handleRegistrar("CANCELADA")}
                disabled={procesando}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar entrega
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TarjetaSelector({
  entrega,
  seleccionada,
  onSelect,
}: {
  entrega: EntregaRepartidor;
  seleccionada: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition ${
        seleccionada
          ? "border-blue-500 bg-blue-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            seleccionada ? "bg-blue-500 text-white" : "bg-blue-100 text-blue-700"
          }`}
        >
          <Truck size={18} />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">{entrega.numeroPedido}</p>
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3 w-3" />
            {entrega.areaEntrega}
            {entrega.referencia && ` · ${entrega.referencia}`}
          </p>
          <p className="text-[10px] text-slate-400">
            Intento #{entrega.numeroIntento}
            {entrega.idArchivoEvidencia && (
              <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
                <ImageIcon className="h-3 w-3" /> Evidencia adjunta
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
          {entrega.estadoEntrega}
        </span>
        {seleccionada && (
          <Package className="h-4 w-4 text-blue-500" />
        )}
      </div>
    </button>
  );
}
