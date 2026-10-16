import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, X, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { listarNotificaciones, leerNotificacion, type NotificacionCompra } from '../api/famkon';

export default function NotificacionesCompras() {
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<NotificacionCompra[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const ocupado = useRef(false);
  const cargar = useCallback(async () => {
    if (ocupado.current) return;
    ocupado.current = true; setCargando(true);
    try { const d = await listarNotificaciones(AbortSignal.timeout(15000)); setItems(d.items); setNoLeidas(d.noLeidas); setError(''); }
    catch { setError('No se pudieron cargar los avisos. Intentá nuevamente.'); }
    finally { ocupado.current = false; setCargando(false); }
  }, []);
  useEffect(() => {
    void cargar();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void cargar(); }, 60000);
    return () => window.clearInterval(timer);
  }, [cargar]);
  useEffect(() => {
    if (!abierto) return;
    function fuera(e: PointerEvent) { if (!contenedor.current?.contains(e.target as Node)) setAbierto(false); }
    function tecla(e: KeyboardEvent) { if (e.key === 'Escape') { setAbierto(false); boton.current?.focus(); } }
    document.addEventListener('pointerdown', fuera); document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto]);
  async function leer(item: NotificacionCompra) {
    if (item.leida) return;
    try { await leerNotificacion(item.id); setItems(actual => actual.map(n => n.id === item.id ? { ...n, leida: true } : n)); void cargar(); }
    catch { setError('No se pudo guardar la lectura del aviso.'); }
  }
  return <div ref={contenedor} className="relative">
    <button ref={boton} type="button" aria-label={error ? 'Notificaciones de compras: no disponibles' : `Notificaciones de compras: ${noLeidas} sin leer`} aria-expanded={abierto} aria-controls="avisos-compras" onClick={() => { setAbierto(v => !v); if (!abierto) void cargar(); }} className="relative rounded-xl p-2.5 text-slate-600 hover:bg-slate-100"><Bell size={20} />{noLeidas > 0 && !error && <span className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-slate-950">{noLeidas > 99 ? '99+' : noLeidas}</span>}</button>
    {abierto && <section id="avisos-compras" aria-label="Notificaciones de tus compras" className="fixed left-3 right-3 top-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-96">
      <div className="flex items-center justify-between border-b border-slate-100 p-4"><div><h2 className="font-bold text-slate-900">Tus compras</h2><p className="text-xs text-slate-500">Últimos 30 avisos · actualización cada minuto</p></div><button aria-label="Cerrar notificaciones" onClick={() => { setAbierto(false); boton.current?.focus(); }} className="rounded-lg p-2 hover:bg-slate-50"><X size={18} /></button></div>
      {error && <div role="alert" className="bg-red-50 p-3 text-sm text-red-700">{error}<button disabled={cargando} onClick={() => void cargar()} className="ml-2 underline">Reintentar</button></div>}
      <div className="max-h-[55dvh] overflow-y-auto">{cargando && !items.length ? <p role="status" className="p-6 text-sm text-slate-500">Cargando avisos…</p> : !error && !items.length ? <p className="p-6 text-sm text-slate-500">Todavía no tenés avisos de compras. Los cambios de tus pedidos aparecerán aquí.</p> : <ul className="divide-y divide-slate-100">{items.map(item => <li key={item.id} className={item.leida ? '' : 'bg-amber-50/60'}><div className="p-4"><Link to={`/comprador/tracking?pedido=${item.idPedido}`} onClick={() => { void leer(item); setAbierto(false); }} className="block rounded-lg focus-visible:outline-amber-500"><p className="flex justify-between gap-2 text-sm font-semibold text-slate-900">{item.numeroPedido}{!item.leida && <span className="text-xs text-amber-700">Nuevo</span>}</p><p className="mt-1 text-sm font-medium text-slate-700">{item.estado}</p>{item.mensaje && <p className="mt-1 text-xs text-slate-600">{item.mensaje}</p>}<p className="mt-2 text-xs text-slate-400">{new Date(item.fecha).toLocaleString('es-GT')}</p></Link>{!item.leida && <button onClick={() => void leer(item)} className="mt-2 text-xs font-semibold text-amber-800 hover:underline">Marcar como leído</button>}</div></li>)}</ul>}</div>
      <Link to="/comprador/tracking" onClick={() => setAbierto(false)} className="flex items-center justify-between border-t border-slate-100 p-4 text-sm font-semibold text-amber-800 hover:bg-amber-50">Ver mis compras<ArrowRight size={16} /></Link>
    </section>}
  </div>;
}
