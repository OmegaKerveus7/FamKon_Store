import { useEffect, useState } from "react";
import {
  Truck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  MapPin,
  Calendar,
  Camera,
  Image as ImageIcon,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import {
  type EntregaRepartidor,
  listarMisEntregas,
  registrarResultadoEntrega,
  subirEvidenciaEntrega,
  urlArchivoEvidencia,
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

export default function RepartidorAsignadosSection() {
  const [entregas, setEntregas] = useState<EntregaRepartidor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<"TODOS" | "ACTIVOS" | "FINALIZADOS">("ACTIVOS");
  const [seleccionada, setSeleccionada] = useState<EntregaRepartidor | null>(null);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    setError("");
    try {
      const mis = await listarMisEntregas();
      setEntregas(mis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar entregas.");
    } finally {
      setCargando(false);
    }
  }

  const entregasFiltradas = entregas.filter((e) => {
    if (
      filtro === "ACTIVOS" &&
      (e.codigoEstado === "ENTREGADA" || e.codigoEstado === "CANCELADA")
    )
      return false;
    if (
      filtro === "FINALIZADOS" &&
      e.codigoEstado !== "ENTREGADA" &&
      e.codigoEstado !== "CANCELADA"
    )
      return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      if (
        !e.numeroPedido.toLowerCase().includes(q) &&
        !e.areaEntrega.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const totalActivos = entregas.filter(
    (e) => e.codigoEstado !== "ENTREGADA" && e.codigoEstado !== "CANCELADA",
  ).length;
  const totalEntregados = entregas.filter((e) => e.codigoEstado === "ENTREGADA").length;
  const totalNoEncontrados = entregas.filter(
    (e) => e.codigoEstado === "NO_ENCONTRADO",
  ).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Activos"
          value={totalActivos}
          color="from-blue-500 to-cyan-500"
        />
        <Stat
          label="Entregados"
          value={totalEntregados}
          color="from-emerald-500 to-green-500"
        />
        <Stat
          label="No encontrado"
          value={totalNoEncontrados}
          color="from-red-500 to-rose-500"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por pedido o area..."
            className="w-full rounded-xl border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div className="flex gap-1 rounded-xl border border-slate-200 p-1">
          {(["TODOS", "ACTIVOS", "FINALIZADOS"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFiltro(v)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                filtro === v
                  ? "bg-blue-500 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {v === "TODOS"
                ? "Todos"
                : v === "ACTIVOS"
                ? "Activos"
                : "Finalizados"}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">Cargando entregas...</p>
        </div>
      ) : entregasFiltradas.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <Truck className="mx-auto mb-2 h-12 w-12 text-slate-300" />
          <p className="text-sm text-slate-500">
            No tienes entregas {filtro === "ACTIVOS" ? "activas" : filtro === "FINALIZADOS" ? "finalizadas" : ""}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entregasFiltradas.map((e) => (
            <Tarjeta key={e.idEntrega} entrega={e} onAccionar={() => setSeleccionada(e)} />
          ))}
        </div>
      )}

      {seleccionada && (
        <DetalleModal
          entrega={seleccionada}
          procesando={procesando}
          setProcesando={setProcesando}
          onCerrar={() => setSeleccionada(null)}
          onResultado={async (codigo, archivo, obs) => {
            setProcesando(true);
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
              await cargar();
            } catch (err) {
              toast(err instanceof Error ? err.message : "Error.", "err");
            } finally {
              setProcesando(false);
            }
          }}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${color} p-4 text-white shadow-sm`}>
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/15" />
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
        {label}
      </p>
    </div>
  );
}

function Tarjeta({
  entrega,
  onAccionar,
}: {
  entrega: EntregaRepartidor;
  onAccionar: () => void;
}) {
  const finalizada =
    entrega.codigoEstado === "ENTREGADA" || entrega.codigoEstado === "CANCELADA";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        finalizada ? "border-slate-200 opacity-80" : "border-blue-200"
      }`}
    >
      <div className="absolute right-0 top-0">
        {entrega.codigoEstado === "ENTREGADA" ? (
          <span className="inline-flex items-center gap-1 rounded-bl-xl rounded-tr-xl bg-emerald-500 px-3 py-1 text-xs font-bold text-white">
            <CheckCircle2 className="h-3 w-3" /> ENTREGADO
          </span>
        ) : entrega.codigoEstado === "NO_ENCONTRADO" ? (
          <span className="inline-flex items-center gap-1 rounded-bl-xl rounded-tr-xl bg-red-500 px-3 py-1 text-xs font-bold text-white">
            <XCircle className="h-3 w-3" /> NO ENCONTRADO
          </span>
        ) : entrega.codigoEstado === "CANCELADA" ? (
          <span className="inline-flex items-center gap-1 rounded-bl-xl rounded-tr-xl bg-slate-500 px-3 py-1 text-xs font-bold text-white">
            CANCELADA
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-bl-xl rounded-tr-xl bg-blue-500 px-3 py-1 text-xs font-bold text-white">
            <Truck className="h-3 w-3" /> {entrega.estadoEntrega}
          </span>
        )}
      </div>

      <div className="pr-32">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-400">#{entrega.idEntrega}</span>
          <h3 className="text-base font-bold text-slate-900">{entrega.numeroPedido}</h3>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <MapPin className="h-3 w-3" />
            <span className="font-semibold">{entrega.areaEntrega}</span>
            {entrega.referencia && (
              <span className="text-slate-400">- {entrega.referencia}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Calendar className="h-3 w-3" />
            Asignado: {fmt(entrega.fechaAsignacion)}
          </div>
          {entrega.fechaIntento && (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Camera className="h-3 w-3" />
              Ultimo intento: {fmt(entrega.fechaIntento)}
            </div>
          )}
          {entrega.fechaEntrega && (
            <div className="flex items-center gap-2 text-xs text-emerald-700">
              <CheckCircle2 className="h-3 w-3" />
              Entregado: {fmt(entrega.fechaEntrega)}
            </div>
          )}
        </div>

        <div className="mt-3 text-[10px] text-slate-400">
          Intento #{entrega.numeroIntento}
          {entrega.observaciones && ` - ${entrega.observaciones}`}
          {entrega.idArchivoEvidencia && (
            <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
              <ImageIcon className="h-3 w-3" /> Evidencia adjunta
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
        <button
          onClick={onAccionar}
          className="flex-1 rounded-xl bg-blue-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-600"
        >
          {finalizada ? "Ver detalle" : "Registrar resultado"}
        </button>
      </div>
    </div>
  );
}

function DetalleModal({
  entrega,
  procesando,
  setProcesando,
  onCerrar,
  onResultado,
}: {
  entrega: EntregaRepartidor;
  procesando: boolean;
  setProcesando: (v: boolean) => void;
  onCerrar: () => void;
  onResultado: (
    codigo: "ENTREGADA" | "NO_ENCONTRADO" | "CANCELADA",
    archivo: File | null,
    obs: string,
  ) => Promise<void>;
}) {
  const [obs, setObs] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [errorLocal, setErrorLocal] = useState("");
  const finalizada =
    entrega.codigoEstado === "ENTREGADA" || entrega.codigoEstado === "CANCELADA";

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setArchivo(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
  }

  function limpiarArchivo() {
    setArchivo(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  }

  async function handleAccion(
    codigo: "ENTREGADA" | "NO_ENCONTRADO" | "CANCELADA",
  ) {
    setProcesando(true);
    setSubiendo(!!archivo);
    setErrorLocal("");
    try {
      await onResultado(codigo, archivo, obs);
      limpiarArchivo();
      setObs("");
    } catch (err) {
      setErrorLocal(err instanceof Error ? err.message : "Error.");
    } finally {
      setProcesando(false);
      setSubiendo(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-br from-blue-500 to-cyan-500 px-6 py-4 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
              Detalle de la entrega
            </p>
            <h2 className="text-lg font-bold">{entrega.numeroPedido}</h2>
            <p className="text-xs text-white/80">
              Intento #{entrega.numeroIntento} - {entrega.areaEntrega}
            </p>
          </div>
          <button
            onClick={onCerrar}
            className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {errorLocal && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {errorLocal}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Estado" valor={entrega.estadoEntrega} />
            <Campo label="Asignado" valor={fmt(entrega.fechaAsignacion)} />
            <Campo label="Ultimo intento" valor={fmt(entrega.fechaIntento)} />
            <Campo label="Entregado" valor={fmt(entrega.fechaEntrega)} />
            <Campo label="Referencia" valor={entrega.referencia ?? "—"} />
            <Campo
              label="Efectivo"
              valor={entrega.montoEfectivo > 0 ? `Q${entrega.montoEfectivo.toFixed(2)}` : "—"}
            />
          </div>

          {entrega.idArchivoEvidencia && !finalizada && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-semibold text-emerald-700">
                Evidencia ya registrada
              </p>
              <a
                href={urlArchivoEvidencia(entrega.idArchivoEvidencia)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                <ImageIcon className="h-3 w-3" /> Ver imagen #{entrega.idArchivoEvidencia}
              </a>
            </div>
          )}

          {!finalizada && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Foto de evidencia (opcional)
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
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
                      onClick={limpiarArchivo}
                      className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {preview && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
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
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div className="space-y-2 border-t border-slate-200 pt-3">
                <p className="text-xs font-semibold text-slate-600">
                  Resultado de la entrega
                </p>
                <button
                  onClick={() => handleAccion("ENTREGADA")}
                  disabled={procesando}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:opacity-50"
                >
                  {subiendo ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Subiendo foto...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Confirmar entrega exitosa
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleAccion("NO_ENCONTRADO")}
                  disabled={procesando}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  Comprador no encontrado
                </button>
                <button
                  onClick={() => handleAccion("CANCELADA")}
                  disabled={procesando}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar entrega
                </button>
              </div>
            </>
          )}

          {finalizada && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              Esta entrega ya fue marcada como{" "}
              <strong>{entrega.codigoEstado}</strong> y no se puede modificar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Campo({
  label,
  valor,
}: {
  label: string;
  valor: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-semibold text-slate-800">{valor}</p>
    </div>
  );
}

function fmt(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-GT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
