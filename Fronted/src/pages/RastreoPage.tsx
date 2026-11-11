import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CircleCheck, Package, Search, QrCode, RefreshCw, ArrowRight, ArrowLeft } from 'lucide-react';
import { comprasRequest } from '../api/compras';
import { progresoRastreo } from '../domain/progresoRastreo';

import QrScanner from '../components/QrScanner';
import { lecturaDesdeQr } from '../domain/rastreoQr';

type Rastreo = { numeroPedido: string | null; estado: string; nombre: string; historial: { estado: string; nombre: string; fecha: string }[]; idModalidadEntrega: number };
export default function RastreoPage() {
  const [params, setParams] = useSearchParams();
  const guia = params.get('guia') || '';
  const pedidoAnterior = params.get('pedido') || '';
  const verDetalle = params.get('detalle') === '1';
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [mostrarQr, setMostrarQr] = useState(false);
  const [errorQr, setErrorQr] = useState('');
  const [entrada, setEntrada] = useState(guia);
  const [datos, setDatos] = useState<Rastreo | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    setEntrada(guia); setDatos(null); setError('');
    if (!guia && !pedidoAnterior) { setCargando(false); return; }
    const controller = new AbortController(); setCargando(true);
    comprasRequest<Rastreo>(`/rastreo?${new URLSearchParams(guia ? { guia } : { pedido: pedidoAnterior })}`, { signal: controller.signal })
      .then(d => { if (!controller.signal.aborted) { setDatos(d); } })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setCargando(false); });
    return () => controller.abort();
  }, [guia, pedidoAnterior, intento]);
  useEffect(() => {
    if (!verDetalle || !usuario || (!guia && !pedidoAnterior)) return;
    const controller = new AbortController();
    comprasRequest<{ idPedido: number }>(`/rastreo/detalle?${new URLSearchParams(guia ? { guia } : { pedido: pedidoAnterior })}`, { signal: controller.signal })
      .then(d => { if (!controller.signal.aborted) navigate(`/comprador/tracking?pedido=${d.idPedido}`, { replace: true }); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [verDetalle, usuario, guia, pedidoAnterior, navigate]);
  function consultar(e: FormEvent) { e.preventDefault(); setParams({ guia: entrada.trim().toUpperCase() }); setIntento(n => n + 1); }
  function escanear(texto: string) {
    try {
      const lectura = lecturaDesdeQr(texto);
      setErrorQr(''); setMostrarQr(false);
      if ('pedido' in lectura) {
        // Legacy receipts stay in the anonymous status-only view.
        setParams({ pedido: lectura.pedido }); setIntento(n => n + 1);
        return;
      }
      setEntrada(lectura.guia);
      setParams({ guia: lectura.guia }); setIntento(n => n + 1);
    } catch (e) { setErrorQr((e as Error).message); }
  }
  const rutaDetalle = `/rastreo?${new URLSearchParams(guia ? { guia, detalle: '1' } : { pedido: pedidoAnterior, detalle: '1' })}`;
  const progreso = datos ? progresoRastreo(datos.estado, Number(datos.idModalidadEntrega)) : null;
  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to="/login" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-amber-400 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"><ArrowLeft size={18} aria-hidden="true" />Volver al login</Link>
      <div className="flex items-center justify-between"><Link to="/login" className="text-2xl font-bold text-slate-900">FamKon<span className="text-amber-500">.</span></Link><span className="text-xs font-semibold text-slate-500">Rastreo sin iniciar sesión</span></div>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <span className="inline-flex rounded-2xl bg-amber-50 p-3 text-amber-600"><Package size={28} /></span>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">¿Dónde está tu paquete?</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">Consultá el avance de tu pedido con el número de guía de tu comprobante.</p>
        <form onSubmit={consultar} className="mt-6 space-y-3"><label htmlFor="guia" className="block text-sm font-semibold text-slate-700">Número de guía</label><div className="flex flex-col gap-3 sm:flex-row"><input id="guia" required maxLength={67} value={entrada} onChange={e => setEntrada(e.target.value)} placeholder="FK-…" autoCapitalize="characters" spellCheck={false} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm uppercase outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" /><button disabled={cargando} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"><Search size={18} />{cargando ? 'Consultando…' : 'Rastrear paquete'}</button></div></form>
        <button type="button" aria-expanded={mostrarQr} aria-controls="lector-rastreo" onClick={() => { setMostrarQr(v => !v); setErrorQr(''); }} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-amber-400 hover:bg-amber-50"><QrCode size={20} />{mostrarQr ? 'Cerrar lector QR' : 'Escanear QR del comprobante'}</button>
        {mostrarQr && <div id="lector-rastreo" className="mt-4 rounded-2xl border border-slate-200 p-4"><QrScanner onDetected={escanear} description="Activá la cámara y apuntá al QR de tu comprobante para rastrear el paquete." />{errorQr && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorQr}</p>}</div>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      </section>
      {datos && <section aria-label="Estado del paquete" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4"><div>{datos.numeroPedido && <p className="break-all text-xs font-semibold text-slate-500">Guía {datos.numeroPedido}</p>}<h2 className="mt-2 text-xl font-bold text-slate-900">Estado de tu pedido</h2><p className="mt-1 text-sm text-slate-500">Seguí cada etapa hasta recibir tu compra.</p></div><button type="button" disabled={cargando} onClick={() => setIntento(n => n + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50"><RefreshCw size={16} />Actualizar</button></div>
        <span className="mt-5 inline-block rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">{datos.nombre}</span>
        {progreso && !progreso.cancelado && progreso.actual >= 0 && <ol aria-label="Progreso del pedido" className="mt-7 grid gap-5 sm:flex sm:gap-0">{progreso.pasos.map((paso, index) => <li key={paso} aria-current={index === progreso.actual ? 'step' : undefined} className="relative flex items-center gap-3 sm:flex-1 sm:flex-col sm:text-center">{index < progreso.pasos.length - 1 && <span aria-hidden="true" className={`absolute left-4 top-8 h-5 w-0.5 sm:left-1/2 sm:top-4 sm:h-0.5 sm:w-full ${index < progreso.actual ? 'bg-orange-500' : 'bg-slate-200'}`} />}<span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm ${index <= progreso.actual ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-200 bg-white text-slate-400'}`}>{index <= progreso.actual ? <CircleCheck size={20} /> : index + 1}</span><strong className={`text-sm ${index <= progreso.actual ? 'text-orange-700' : 'text-slate-400'}`}>{paso}</strong></li>)}</ol>}
        <h3 className="mt-9 border-t border-slate-100 pt-6 text-lg font-bold text-slate-900">Historial de seguimiento</h3><p className="mt-1 text-xs text-slate-500">Movimientos reales · El más reciente primero</p>
        <ol className="mt-7">{datos.historial.map((h, index) => <li key={`${h.fecha}-${index}`} className="relative flex gap-4 pb-7 last:pb-0">{index < datos.historial.length - 1 && <span aria-hidden="true" className="absolute left-[15px] top-8 h-full w-0.5 bg-amber-200" />}<span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CircleCheck size={23} /></span><div><p className="font-semibold text-slate-800">{h.nombre}{index === 0 && <span className="ml-2 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase text-amber-800">Actual</span>}</p><time className="mt-1 block text-xs text-slate-500" dateTime={h.fecha}>{new Date(h.fecha).toLocaleString('es-GT', { timeZone: 'America/Guatemala', dateStyle: 'medium', timeStyle: 'short' })}</time></div></li>)}</ol>
        {!datos.historial.length && <p className="mt-4 text-sm text-slate-500">Todavía no hay movimientos registrados.</p>}

        <div className="mt-8 border-t border-slate-100 pt-5"><p className="text-sm leading-relaxed text-slate-500">Para ver productos, pago y datos de entrega, usá la cuenta con la que realizaste la compra.</p><Link to={usuario ? rutaDetalle : '/login'} state={usuario ? undefined : { volverA: rutaDetalle }} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950">Ver mi pedido completo<ArrowRight size={16} /></Link></div>
      </section>}
      <p className="text-center text-xs leading-relaxed text-slate-500">La consulta pública muestra únicamente estados y fechas. Tus datos personales y de compra permanecen protegidos.</p>
    </div>
  </main>;
}
