import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Truck,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  Calendar,
  Image as ImageIcon,
  Loader2,
  AlertTriangle,
  User,
  ArrowLeft,
  Package,
} from "lucide-react";
import {
  listarEntregasDeRepartidor,
  listarRepartidoresActivos,
  type EntregaRepartidor,
  type RepartidorDisponible,
  urlArchivoEvidencia,
} from "../api/famkon";

type FiltroEstado = "TODOS" | "ASIGNADA" | "ENTREGADA" | "NO_ENCONTRADO" | "CANCELADA";

export default function EntregasAdminPage() {
  const [entregas, setEntregas] = useState<EntregaRepartidor[]>([]);
  const [repartidores, setRepartidores] = useState<RepartidorDisponible[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("TODOS");
  const [filtroRepartidor, setFiltroRepartidor] = useState<number | "TODOS">("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [seleccionada, setSeleccionada] = useState<EntregaRepartidor | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    setError("");
    try {
      const reps = await listarRepartidoresActivos();
      setRepartidores(reps);

      const todas: EntregaRepartidor[] = [];
      for (const r of reps) {
        try {
          const lista = await listarEntregasDeRepartidor(r.idUsuario);
          todas.push(...lista);
        } catch {
          // Ignorar repartidores sin entregas
        }
      }
      setEntregas(todas);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar tracking.");
    } finally {
      setCargando(false);
    }
  }

  const entregasFiltradas = useMemo(() => {
    return entregas.filter((e) => {
      if (filtroEstado !== "TODOS" && e.codigoEstado !== filtroEstado) return false;
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
  }, [entregas, filtroEstado, busqueda]);

  const stats = useMemo(() => {
    const total = entregas.length;
    const activas = entregas.filter(
      (e) => e.codigoEstado === "ASIGNADA" || e.codigoEstado === "PENDIENTE",
    ).length;
    const entregadas = entregas.filter((e) => e.codigoEstado === "ENTREGADA").length;
    const noEncontrados = entregas.filter(
      (e) => e.codigoEstado === "NO_ENCONTRADO",
    ).length;
    return { total, activas, entregadas, noEncontrados };
  }, [entregas]);

  return (
    <div className="space-y-5">
      <header className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-6 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
              Panel de tracking
            </p>
            <h1 className="mt-1 text-2xl font-bold">Entregas en tiempo real</h1>
            <p className="mt-1 text-sm text-white/90">
              Supervisa el estado de cada entrega, evidencia fotografica y repartidor.
            </p>
          </div>
          <Link
            to="/inicio"
            className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur hover:bg-white/20"
          >
            <ArrowLeft className="mr-1 inline h-3 w-3" /> Volver
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Stat label="Total" value={stats.total} color="bg-white/20" />
          <Stat label="Activas" value={stats.activas} color="bg-blue-500/30" />
          <Stat label="Entregadas" value={stats.entregadas} color="bg-emerald-500/30" />
          <Stat label="No encontrado" value={stats.noEncontrados} color="bg-red-500/30" />
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por pedido o area..."
            className="w-full rounded-xl border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="TODOS">Todos los estados</option>
            <option value="ASIGNADA">Asignadas</option>
            <option value="PENDIENTE">Pendientes</option>
            <option value="ENTREGADA">Entregadas</option>
            <option value="NO_ENCONTRADO">No encontrado</option>
            <option value="CANCELADA">Canceladas</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-slate-500" />
          <select
            value={filtroRepartidor}
            onChange={(e) =>
              setFiltroRepartidor(
                e.target.value === "TODOS" ? "TODOS" : Number(e.target.value),
              )
            }
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="TODOS">Todos los repartidores</option>
            {repartidores.map((r) => (
              <option key={r.idUsuario} value={r.idUsuario}>
                {r.nickname}
              </option>
            ))}
          </select>
        </div>
      </div>

      {cargando ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-10">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          <span className="ml-2 text-sm text-slate-500">Cargando entregas...</span>
        </div>
      ) : entregasFiltradas.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-10 text-center">
          <Truck className="mx-auto mb-2 h-12 w-12 text-slate-300" />
          <p className="text-sm text-slate-500">Sin entregas para mostrar.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Entrega</th>
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Repartidor</th>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3">Fechas</th>
                <th className="px-4 py-3 text-right">Evidencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entregasFiltradas.map((e) => (
                <FilaTracking
                  key={e.idEntrega}
                  entrega={e}
                  onVer={() => setSeleccionada(e)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {seleccionada && (
        <DetalleTracking
          entrega={seleccionada}
          onCerrar={() => setSeleccionada(null)}
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
    <div className={`rounded-2xl ${color} px-4 py-3 backdrop-blur`}>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
        {label}
      </p>
    </div>
  );
}

function FilaTracking({
  entrega,
  onVer,
}: {
  entrega: EntregaRepartidor;
  onVer: () => void;
}) {
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <button onClick={onVer} className="text-left">
          <div className="font-mono text-xs text-slate-500">#{entrega.idEntrega}</div>
          <div className="text-xs font-semibold text-blue-600 hover:underline">
            Ver timeline
          </div>
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="font-semibold text-slate-800">{entrega.numeroPedido}</div>
        <div className="text-xs text-slate-500">Intento #{entrega.numeroIntento}</div>
      </td>
      <td className="px-4 py-3">
        <BadgeEstado codigo={entrega.codigoEstado} nombre={entrega.estadoEntrega} />
      </td>
      <td className="px-4 py-3 text-slate-600">—</td>
      <td className="px-4 py-3 text-slate-600">
        {entrega.areaEntrega}
        {entrega.referencia && (
          <div className="text-xs text-slate-400">{entrega.referencia}</div>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-slate-600">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          Asig: {fmt(entrega.fechaAsignacion)}
        </div>
        {entrega.fechaEntrega && (
          <div className="flex items-center gap-1 text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            Ent: {fmt(entrega.fechaEntrega)}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {entrega.idArchivoEvidencia ? (
          <a
            href={urlArchivoEvidencia(entrega.idArchivoEvidencia)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
            title={`Evidencia #${entrega.idArchivoEvidencia}`}
          >
            <ImageIcon className="h-3 w-3" /> Ver foto
          </a>
        ) : (
          <span className="text-xs text-slate-400">Sin foto</span>
        )}
      </td>
    </tr>
  );
}

function BadgeEstado({
  codigo,
  nombre,
}: {
  codigo: string;
  nombre: string;
}) {
  const cls =
    codigo === "ENTREGADA"
      ? "bg-emerald-100 text-emerald-700"
      : codigo === "NO_ENCONTRADO"
      ? "bg-red-100 text-red-700"
      : codigo === "CANCELADA"
      ? "bg-slate-200 text-slate-600"
      : "bg-blue-100 text-blue-700";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {nombre}
    </span>
  );
}

function DetalleTracking({
  entrega,
  onCerrar,
}: {
  entrega: EntregaRepartidor;
  onCerrar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-br from-blue-600 to-indigo-600 px-6 py-4 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
              Timeline de la entrega
            </p>
            <h2 className="text-lg font-bold">{entrega.numeroPedido}</h2>
            <p className="text-xs text-white/80">
              Entrega #{entrega.idEntrega} - Intento #{entrega.numeroIntento}
            </p>
          </div>
          <button
            onClick={onCerrar}
            className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Estado actual" valor={entrega.estadoEntrega} />
            <Campo label="Area de entrega" valor={entrega.areaEntrega} />
            <Campo label="Referencia" valor={entrega.referencia ?? "—"} />
            <Campo label="Efectivo" valor={entrega.montoEfectivo > 0 ? `Q${entrega.montoEfectivo.toFixed(2)}` : "—"} />
          </div>

          {/* Timeline */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="mb-4 text-sm font-bold text-slate-900">
              Historial de la entrega
            </h3>
            <ol className="space-y-4">
              <PasoTimeline
                titulo="Asignada al repartidor"
                fecha={entrega.fechaAsignacion}
                icono={<Calendar className="h-4 w-4" />}
                color="bg-blue-500"
                completado={!!entrega.fechaAsignacion}
              />
              <PasoTimeline
                titulo="Intento de entrega"
                fecha={entrega.fechaIntento}
                icono={<Truck className="h-4 w-4" />}
                color="bg-amber-500"
                completado={!!entrega.fechaIntento}
              />
              {entrega.codigoEstado === "ENTREGADA" ? (
                <PasoTimeline
                  titulo="Entregado al comprador"
                  fecha={entrega.fechaEntrega}
                  icono={<CheckCircle2 className="h-4 w-4" />}
                  color="bg-emerald-500"
                  completado={true}
                />
              ) : entrega.codigoEstado === "NO_ENCONTRADO" ? (
                <PasoTimeline
                  titulo="Comprador no encontrado"
                  fecha={entrega.fechaIntento}
                  icono={<XCircle className="h-4 w-4" />}
                  color="bg-red-500"
                  completado={true}
                />
              ) : entrega.codigoEstado === "CANCELADA" ? (
                <PasoTimeline
                  titulo="Entrega cancelada"
                  fecha={entrega.fechaIntento}
                  icono={<XCircle className="h-4 w-4" />}
                  color="bg-slate-500"
                  completado={true}
                />
              ) : (
                <PasoTimeline
                  titulo="Pendiente de finalizar"
                  fecha={null}
                  icono={<Package className="h-4 w-4" />}
                  color="bg-slate-300"
                  completado={false}
                />
              )}
            </ol>
          </div>

          {/* Evidencia */}
          {entrega.idArchivoEvidencia ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="mb-2 text-sm font-bold text-emerald-700">
                Evidencia fotografica
              </h3>
              <a
                href={urlArchivoEvidencia(entrega.idArchivoEvidencia)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                <ImageIcon className="h-3 w-3" /> Ver imagen #{entrega.idArchivoEvidencia}
              </a>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
              Sin evidencia fotografica registrada.
            </div>
          )}

          {entrega.observaciones && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                Observaciones
              </h3>
              <p className="text-sm text-slate-700">{entrega.observaciones}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PasoTimeline({
  titulo,
  fecha,
  icono,
  color,
  completado,
}: {
  titulo: string;
  fecha: string | null | undefined;
  icono: React.ReactNode;
  color: string;
  completado: boolean;
}) {
  return (
    <li className="flex gap-3">
      <div
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white ${
          completado ? color : "bg-slate-200 text-slate-400"
        }`}
      >
        {icono}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-semibold ${completado ? "text-slate-900" : "text-slate-400"}`}>
          {titulo}
        </p>
        <p className={`text-xs ${completado ? "text-slate-600" : "text-slate-400"}`}>
          {completado ? fmt(fecha) : "Pendiente"}
        </p>
      </div>
    </li>
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
