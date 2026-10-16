import { useEffect, useState } from 'react';
import { ShieldCheck, Search, CheckCircle2, XCircle, Globe, ListFilter } from 'lucide-react';

import { listarBitacora, type EventoAcceso } from '../api/famkon';

export default function AdminBitacoraPage() {
  const [eventos, setEventos] = useState<EventoAcceso[]>([]);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [resultado, setResultado] = useState('');
  const [metodo, setMetodo] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setCargando(true); setError(''); setEventos([]);
    const timer = window.setTimeout(() => {
      listarBitacora({ pagina, resultado, metodo, busqueda }, controller.signal)
        .then(data => { if (!controller.signal.aborted) { setEventos(data.eventos); setTotal(data.total); } })
        .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo consultar la bitácora.'); })
        .finally(() => { if (!controller.signal.aborted) setCargando(false); });
    }, 300);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [pagina, resultado, metodo, busqueda, version]);
  const visibles = eventos;
  const fallidos = visibles.filter(e => e.resultado === 'N').length;
  const metodos: Record<string, string> = { CONTRASENA: 'Contraseña', QR: 'Código QR', FACIAL: 'Reconocimiento facial' };
  const control = 'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100';
  return <div className="mx-auto max-w-6xl space-y-5">
    <div className="flex items-start gap-3"><span className="rounded-2xl bg-amber-100 p-3 text-amber-700"><ShieldCheck size={24} /></span><div><h1 className="text-2xl font-bold text-slate-900">Historial de accesos</h1><p className="mt-1 text-sm text-slate-500">Revisá quién intentó ingresar, cómo lo hizo y cuál fue el resultado.</p></div></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">Intentos de acceso registrados por la tienda. Fechas en tu hora local.</p><button disabled={cargando} onClick={() => setVersion(v => v + 1)} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">Actualizar</button></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
      { label: 'Registros visibles', valor: visibles.length, Icon: ListFilter, color: 'text-slate-600 bg-slate-50' },
      { label: 'Accesos exitosos', valor: visibles.length - fallidos, Icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50' },
      { label: 'Intentos fallidos', valor: fallidos, Icon: XCircle, color: 'text-red-700 bg-red-50' },
      { label: 'Direcciones IP visibles', valor: new Set(visibles.map(e => e.ip)).size, Icon: Globe, color: 'text-blue-700 bg-blue-50' },
    ].map(({ label, valor, Icon, color }) => <div key={label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"><span className={`rounded-xl p-2 ${color}`}><Icon size={19} /></span><div><p className="text-2xl font-bold text-slate-900">{cargando || error ? '—' : valor}</p><p className="text-xs text-slate-500">{label}</p></div></div>)}</div>
    <section aria-labelledby="accesos-titulo" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="space-y-4 border-b border-slate-100 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 id="accesos-titulo" className="font-bold text-slate-900">Registro de actividad</h2><span className="text-xs text-slate-500">{cargando ? 'Cargando…' : error ? 'Consulta no disponible' : `${total} registros encontrados`}</span></div>
      <div className="flex flex-wrap items-end gap-3"><label className="min-w-48 flex-1 text-xs font-semibold text-slate-600">Buscar usuario, IP o motivo<div className="relative mt-1"><Search size={17} className="absolute left-3 top-3 text-slate-400" /><input value={busqueda} onChange={e => { setPagina(1); setBusqueda(e.target.value); }} placeholder="Ej. supervisor o dirección IP" className={`${control} w-full pl-9`} /></div></label><label className="text-xs font-semibold text-slate-600">Resultado<select value={resultado} onChange={e => { setPagina(1); setResultado(e.target.value); }} className={`${control} mt-1 block`}><option value="">Todos</option><option value="S">Exitosos</option><option value="N">Fallidos</option></select></label><label className="text-xs font-semibold text-slate-600">Método<select value={metodo} onChange={e => { setPagina(1); setMetodo(e.target.value); }} className={`${control} mt-1 block`}><option value="">Todos</option>{Object.entries(metodos).map(([codigo, nombre]) => <option key={codigo} value={codigo}>{nombre}</option>)}</select></label>{(busqueda || resultado || metodo) && <button type="button" onClick={() => { setPagina(1); setBusqueda(''); setResultado(''); setMetodo(''); }} className="px-2 py-3 text-sm font-semibold text-amber-700">Limpiar filtros</button>}</div></div>
      {cargando ? <p role="status" className="p-8 text-center text-sm text-slate-500">Consultando accesos…</p> : error ? null : visibles.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Registro de intentos de inicio de sesión filtrados</caption><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Usuario / fecha', 'Método', 'Resultado', 'Dirección IP', 'Detalle'].map(t => <th key={t} scope="col" className="whitespace-nowrap px-5 py-3 font-semibold">{t}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visibles.map((e, i) => <tr key={`${e.fecha}-${i}`} className="hover:bg-slate-50/70"><td className="px-5 py-4"><p className="font-semibold text-slate-800">{e.usuario}</p><p className="mt-1 whitespace-nowrap text-xs text-slate-500">{new Date(e.fecha).toLocaleString('es-GT')}</p></td><td className="whitespace-nowrap px-5 py-4 text-slate-600">{metodos[e.metodo] || e.metodo}</td><td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${e.resultado === 'S' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{e.resultado === 'S' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}{e.resultado === 'S' ? 'Exitoso' : 'Fallido'}</span></td><td className="px-5 py-4 font-mono text-xs text-slate-500">{e.ip}</td><td className="px-5 py-4 text-slate-600">{e.motivo}</td></tr>)}</tbody></table></div> : <div role="status" className="p-10 text-center"><Search size={26} className="mx-auto text-slate-300" /><p className="mt-3 font-semibold text-slate-700">No hay registros para estos filtros</p><p className="mt-1 text-sm text-slate-500">Probá con otro usuario o cambiá los filtros.</p></div>}
    </section>
    <div className="flex items-center justify-between gap-3 text-sm"><button disabled={cargando || !!error || pagina === 1} onClick={() => setPagina(p => p - 1)} className="rounded-xl border bg-white px-4 py-2 disabled:opacity-40">Anterior</button><span>Página {pagina}</span><button disabled={cargando || !!error || pagina * 25 >= total} onClick={() => setPagina(p => p + 1)} className="rounded-xl border bg-white px-4 py-2 disabled:opacity-40">Siguiente</button></div>
    <p className="text-xs text-slate-500">Los indicadores resumen los registros de la página actual, no todo el historial.</p>
  </div>;
}
