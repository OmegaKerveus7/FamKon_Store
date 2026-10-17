import { Link } from 'react-router-dom';
import { ArrowRight, Bell, CheckCheck, ChevronDown, ClipboardList, Clock3, PackageCheck, RefreshCw, Truck } from 'lucide-react';
import { useAdminPedidos } from '../context/AdminPedidosContext';
import { seguimientoAdmin } from '../domain/seguimientoAdmin';
export function AdminPedidoBell() {
  const { datos, error } = useAdminPedidos();
  const pendientes = Number(datos?.resumen.sinAceptar ?? 0);
  return <Link to="/admin/pedidos" aria-label={error ? 'Bandeja de pedidos sin actualizar' : `Pedidos por aceptar: ${pendientes}`} className="relative rounded-xl p-2.5 text-slate-600 hover:bg-slate-100"><Bell size={20} />{(pendientes > 0 || error) && <span className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-slate-950">{error ? '!' : pendientes}</span>}</Link>;
}
export default function AdminPedidosPanel() {
  const { datos, error, refrescar } = useAdminPedidos();
  const tarjetas = [
    { titulo: 'Por aceptar', descripcion: 'Pedidos que necesitan tu revisión', valor: datos?.resumen.sinAceptar, Icono: ClipboardList, estilo: 'bg-orange-50 text-orange-700', borde: 'border-orange-100' },
    { titulo: 'En preparación', descripcion: 'Pedidos aceptados en proceso', valor: datos?.resumen.enPreparacion, Icono: PackageCheck, estilo: 'bg-indigo-50 text-indigo-700', borde: 'border-indigo-100' },
    { titulo: 'Por asignar', descripcion: 'Listos para asignar un repartidor', valor: datos?.resumen.sinAsignar, Icono: Truck, estilo: 'bg-emerald-50 text-emerald-700', borde: 'border-emerald-100' },
  ];
  return (
    <section aria-label="Resumen y seguimiento de pedidos" className="space-y-4">
      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => void refrescar()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 font-semibold shadow-sm hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">
            <RefreshCw size={16} aria-hidden="true" /> Reintentar
          </button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {tarjetas.map(({ titulo, descripcion, valor, Icono, estilo, borde }) => (
          <div key={titulo} className={`relative overflow-hidden rounded-2xl border ${borde} bg-white p-5 shadow-sm sm:p-6`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-600">{titulo}</p>
              <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${estilo}`}><Icono size={21} aria-hidden="true" /></span>
            </div>
            <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900 tabular-nums" aria-label={`${titulo}: ${valor ?? 'Sin datos'}`}>{valor ?? '—'}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{descripcion}</p>
          </div>
        ))}
      </div>
      {datos && (
        <details className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-5 py-4 marker:content-none hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-orange-500 [&::-webkit-details-marker]:hidden">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Clock3 size={19} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">Pedidos por atender</span><span className="mt-0.5 block text-xs text-slate-500">Primero los más antiguos</span></span>
            <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          {datos.pendientes.length ? (
            <ul className="divide-y divide-slate-100 border-t border-slate-100 px-3 sm:px-5">
              {datos.pendientes.map(p => (
                <li key={p.idPedido}>
                  <Link to={`/admin/pedidos?pedido=${p.idPedido}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-2 py-4 text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-orange-500">
                    <span className="min-w-0"><strong className="break-all text-slate-900">{p.numeroPedido}</strong><span className="mt-1.5 block text-xs text-slate-500">Recibido {new Date(p.fechaPedido).toLocaleString('es-GT', { timeZone: 'America/Guatemala' })}</span></span>
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-orange-700">{seguimientoAdmin(p.estado).titulo}<ArrowRight size={16} aria-hidden="true" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-3 border-t border-slate-100 px-5 py-5 text-sm text-slate-600"><CheckCheck size={20} className="shrink-0 text-emerald-600" aria-hidden="true" />No hay pedidos pendientes por atender.</div>
          )}
        </details>
      )}
    </section>
  );
}
