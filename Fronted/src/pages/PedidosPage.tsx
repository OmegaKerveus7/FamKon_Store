import EstadoConstancia from '../components/EstadoConstancia';
import { crearConstancia, puedeDescargarConstancia } from '../domain/constancia';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Clock3, Download, MapPin, Package, Phone, QrCode, RefreshCw, Search, Store, Truck, X } from 'lucide-react';
import { configCompra, descargarCompra, detalleCompra, fotoCompra, listarCompras, verificarPago, type Compra, type ConfigCompra, type DetalleCompra, type VistaCompra } from '../api/compras';
import { ESTADOS_COMPRA, ESTADOS_PAGO, fechaCompra, moneda, puedePagar } from '../domain/compras';
import CompraAcciones, { botonSecundario } from '../components/CompraAcciones';
import { campoCompra } from '../components/DireccionCompraFields';
import QrScanner from '../components/QrScanner';

const PASOS_DOMICILIO = [
  { estados: ['GENERADO', 'PAGO_PENDIENTE', 'PAGO_CONFIRMADO'], etiqueta: 'Confirmado' },
  { estados: ['EN_ELABORACION'], etiqueta: 'Preparación' },
  { estados: ['LISTO_ENTREGA'], etiqueta: 'Listo' },
  { estados: ['EN_RUTA'], etiqueta: 'En ruta' },
  { estados: ['ENTREGADO'], etiqueta: 'Entregado' },
];
const PASOS_TIENDA = [
  { estados: ['GENERADO', 'PAGO_PENDIENTE', 'PAGO_CONFIRMADO'], etiqueta: 'Confirmado' },
  { estados: ['EN_ELABORACION'], etiqueta: 'Preparación' },
  { estados: ['LISTO_RECOGER'], etiqueta: 'Listo' },
  { estados: ['RECOGIDO'], etiqueta: 'Recogido' },
];

function ProgresoPedido({ pedido }: { pedido: Compra }) {
  const pasos = pedido.idModalidadEntrega === 1 ? PASOS_TIENDA : PASOS_DOMICILIO;
  const actual = pasos.findIndex(paso => paso.estados.includes(pedido.estado));
  const cancelado = pedido.estado === 'CANCELADO';
  return <section aria-label="Progreso del pedido" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
    <div className="mb-5 flex items-center justify-between gap-3">
      <div><h2 className="font-bold text-slate-900">Estado de tu pedido</h2><p className="mt-1 text-xs text-slate-500">Sigue cada etapa hasta recibir tu compra.</p></div>
      <Badge estado={pedido.estado} />
    </div>
    {cancelado ? <p className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">Este pedido fue cancelado.</p> : <ol className="grid grid-cols-1 gap-0 sm:grid-cols-[repeat(var(--steps),minmax(0,1fr))]" style={{ '--steps': pasos.length } as React.CSSProperties}>
      {pasos.map((paso, indice) => {
        const completado = actual >= 0 && indice <= actual;
        const vigente = indice === actual;
        return <li key={paso.etiqueta} className="relative flex gap-3 pb-4 last:pb-0 sm:block sm:pb-0 sm:text-center">
          {indice < pasos.length - 1 && <span className={`absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-0.5 sm:left-1/2 sm:top-4 sm:h-0.5 sm:w-full ${indice < actual ? 'bg-orange-500' : 'bg-slate-200'}`} />}
          <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 sm:mx-auto ${completado ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-200 bg-white text-slate-400'} ${vigente ? 'ring-4 ring-orange-100' : ''}`}>{completado ? <Check size={16} /> : indice + 1}</span>
          <span className={`pt-1 text-sm sm:mt-3 sm:block sm:pt-0 ${vigente ? 'font-bold text-orange-700' : completado ? 'font-medium text-slate-700' : 'text-slate-400'}`}>{paso.etiqueta}</span>
        </li>;
      })}
    </ol>}
  </section>;
}
function Badge({ estado, pago = false }: { estado: string; pago?: boolean }) {
  const good = ['ENTREGADO', 'RECOGIDO', 'APROBADO', 'PAGADO_EFECTIVO'].includes(estado);
  const bad = ['CANCELADO', 'RECHAZADO', 'COMPRADOR_NO_ENCONTRADO', 'REEMBOLSO_PENDIENTE'].includes(estado);
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${good ? 'bg-emerald-50 text-emerald-700' : bad ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{(pago ? ESTADOS_PAGO : ESTADOS_COMPRA)[estado] || estado?.replaceAll('_', ' ') || 'Sin información'}</span>;
}
function FotoEvidencia({ id }: { id: number }) {
  const [url, setUrl] = useState(''); const [error, setError] = useState('');
  useEffect(() => { let active = true; let resource = ''; const controller = new AbortController(); fotoCompra(id, controller.signal).then(u => { resource = u; if (active) setUrl(u); else URL.revokeObjectURL(u); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; controller.abort(); if (resource) URL.revokeObjectURL(resource); }; }, [id]);
  return error ? <p className="text-sm text-red-600">{error}</p> : url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Foto de evidencia de entrega" className="mt-3 max-h-64 rounded-xl object-contain" /></a> : <p className="text-sm text-slate-500">Cargando evidencia…</p>;
}
export default function PedidosPage({ vista = 'cliente' }: { vista?: VistaCompra }) {
  const [params, setParams] = useSearchParams(); const selected = Number(params.get('pedido')) || 0;
  const [pedidos, setPedidos] = useState<Compra[]>([]); const [detail, setDetail] = useState<DetalleCompra | null>(null);
  const [config, setConfig] = useState<ConfigCompra | null>(null); const [pagina, setPagina] = useState(1); const [total, setTotal] = useState(0);
  const [estado, setEstado] = useState(''); const [busqueda, setBusqueda] = useState(''); const [inputSearch, setInputSearch] = useState('');
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [refreshed, setRefreshed] = useState('');
  const [pagoAviso, setPagoAviso] = useState('');
  const [mostrarQr, setMostrarQr] = useState(false); const [errorQr, setErrorQr] = useState('');
  const [foto, setFoto] = useState<number | null>(null); const requestNumber = useRef(0);
  const cargar = useCallback(async (signal?: AbortSignal, visible = false) => {
    const n = ++requestNumber.current; if (visible) setLoading(true);
    try {
      if (selected) {
        let d = await detalleCompra(selected, vista, signal);
        if (vista === 'cliente' && puedePagar(d.pedido) && d.pedido.idCheckoutProveedor && !signal?.aborted) {
          try { await verificarPago(selected); d = await detalleCompra(selected, vista, signal); if (n === requestNumber.current) setPagoAviso(''); }
          catch { if (n === requestNumber.current && !signal?.aborted) setPagoAviso('No pudimos consultar la confirmación del pago. Reintentaremos automáticamente; si ya pagaste, no vuelvas a pagar.'); }
        } else if (n === requestNumber.current) setPagoAviso('');
        if (n === requestNumber.current) setDetail(d);
      }
      else { const list = await listarCompras(vista, pagina, estado, busqueda, signal); if (n === requestNumber.current) { setPedidos(list.pedidos); setTotal(list.total); } }
      if (n === requestNumber.current) { setError(''); setRefreshed(new Date().toLocaleTimeString('es-GT')); }
    } catch (e) { if (!signal?.aborted && n === requestNumber.current) setError((e as Error).message); }
    finally { if (n === requestNumber.current && !signal?.aborted) setLoading(false); }
  }, [selected, vista, pagina, estado, busqueda]);
  useEffect(() => { configCompra().then(setConfig).catch(e => setError(e.message)); }, []);
  useEffect(() => { const c = new AbortController(); setDetail(null); setFoto(null); void cargar(c.signal, true); const interval = setInterval(() => { if (!document.hidden) void cargar(c.signal); }, 20000); return () => { c.abort(); clearInterval(interval); requestNumber.current++; }; }, [cargar]);

  const [generandoPdf, setGenerandoPdf] = useState(false);
  async function descargarPdf() {
    if (!detail || generandoPdf) return;
    setGenerandoPdf(true);
    try { const pdf = await crearConstancia(detail, window.location.origin, config?.direccionTienda || 'Campus central'); pdf.save(`constancia-${detail.pedido.idPedido}.pdf`); }
    catch (e) { setError((e as Error).message); }
    finally { setGenerandoPdf(false); }
  }

  const volver = () => { setParams({}); setDetail(null); };
  function abrirDesdeQr(texto: string) {
    try {
      const url = new URL(texto, window.location.origin);
      const id = Number(url.searchParams.get('pedido'));
      if (url.origin !== window.location.origin || url.pathname !== '/comprador/tracking' || !Number.isSafeInteger(id) || id <= 0) throw new Error();
      setMostrarQr(false); setErrorQr(''); setParams({ pedido: String(id) });
    } catch {
      setErrorQr('Este QR no corresponde al seguimiento de un pedido FamKon.');
    }
  }
  const heading = vista === 'cliente' ? 'Mis pedidos' : vista === 'admin' ? 'Gestión de pedidos' : 'Mis entregas';
  const subtitle = vista === 'cliente' ? 'Tu compra, paso a paso. Consultá aquí cada avance.' : vista === 'admin' ? 'Revisá las compras, coordiná la preparación y supervisá cada entrega.' : 'Tu ruta empieza aquí. Registrá cada entrega y su evidencia.';
  const p = detail?.pedido;
  async function descargar(path: string, name: string) { try { await descargarCompra(path, name); } catch (e) { setError((e as Error).message); } }
  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-amber-600">FamKon · {vista === 'cliente' ? 'Compras' : vista === 'admin' ? 'Operaciones' : 'Entregas'}</p><h1 className="text-3xl font-bold tracking-tight text-slate-900">{heading}</h1><p className="mt-2 text-sm text-slate-500">{subtitle}</p></div><button onClick={() => cargar(undefined, true)} disabled={loading} className={`${botonSecundario} flex items-center gap-2`}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />Actualizar</button></div>
    {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {pagoAviso && <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{pagoAviso}</p>}
    {selected ? <>
      <button onClick={volver} className="flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft size={16} />Volver al listado</button>
      {loading && !p ? <p role="status" className="rounded-2xl bg-white p-10">Cargando pedido…</p> : p && detail && <>
        <section className="rounded-2xl bg-slate-900 p-5 text-white sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-slate-400">Seguimiento de orden</p><h2 className="mt-2 break-all text-xl font-bold sm:text-2xl">{p.numeroPedido}</h2><p className="mt-2 text-sm text-slate-300">{fechaCompra(p.fechaPedido)} · {p.cliente}</p></div></div><div className="mt-6 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-3"><div><p className="text-xs text-slate-400">Modalidad</p><p className="mt-1 flex items-center gap-2 font-semibold">{p.idModalidadEntrega === 1 ? <Store size={17} /> : <Truck size={17} />}{p.idModalidadEntrega === 1 ? 'Recoger en tienda' : 'Domicilio'}</p></div><div><p className="text-xs text-slate-400">Pago · {p.metodoPago === 'EFECTIVO' ? 'Efectivo' : 'Tarjeta'}</p><div className="mt-1"><Badge estado={p.estadoPago} pago /></div></div><div><p className="text-xs text-slate-400">Total del pedido</p><p className="mt-1 text-2xl font-bold text-amber-400">{moneda(p.total)}</p></div></div></section>
        <ProgresoPedido pedido={p} />
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <CompraAcciones key={`${p.idPedido}-${vista}`} detail={detail} vista={vista} onChanged={() => cargar()} />
            <section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="flex items-center gap-2 text-lg font-bold"><Clock3 size={20} className="text-amber-600" />Historial de seguimiento</h2><p className="mb-6 mt-1 text-xs text-slate-500">Eventos reales · el más reciente primero</p>
              {detail.historial.length === 0 ? <p className="text-sm text-slate-500">Todavía no hay movimientos registrados.</p> : <ol className="space-y-0">{detail.historial.map((h, i) => <li key={h.idHistorial} className="relative flex gap-4 pb-7 last:pb-0"><div className="relative flex w-8 shrink-0 justify-center">{i < detail.historial.length - 1 && <span className="absolute bottom-[-4px] top-8 w-px bg-slate-200" />}<span className={`relative flex h-8 w-8 items-center justify-center rounded-full ${i === 0 ? 'bg-amber-500 text-white ring-4 ring-amber-50' : 'bg-emerald-50 text-emerald-600'}`}><Check size={16} /></span></div><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-1"><h3 className="text-sm font-bold text-slate-800">{h.nombre}</h3><time className="text-xs text-slate-400">{fechaCompra(h.fecha)}</time></div>{h.comentario && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-500">{h.comentario}</p>}<p className="mt-1 text-xs text-slate-400">{h.actor || 'Sistema'}</p></div></li>)}</ol>}
            </section>
            {detail.entregas.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-4 font-bold">Entregas e intentos</h2><div className="space-y-3">{detail.entregas.map(e => <div key={e.idEntrega} className="rounded-xl border border-slate-100 p-4"><div className="flex justify-between gap-2 text-sm"><strong>Intento {e.numeroIntento}</strong><span className="text-slate-500">{e.estado.replaceAll('_', ' ')}</span></div><p className="mt-2 text-xs text-slate-500">{e.repartidor || 'Atención en tienda'} · {fechaCompra(e.fechaEntrega || e.fechaIntento || e.fechaAsignacion)}</p>{e.nombreReceptor && <p className="mt-2 text-sm">Recibió: {e.nombreReceptor}</p>}{e.observaciones && <p className="mt-1 text-sm text-slate-500">{e.observaciones}</p>}{e.idArchivoEvidencia && <><button onClick={() => setFoto(foto === e.idArchivoEvidencia ? null : e.idArchivoEvidencia)} className="mt-3 text-sm font-semibold text-amber-700">{foto === e.idArchivoEvidencia ? 'Ocultar foto' : 'Ver prueba de entrega'}</button>{foto === e.idArchivoEvidencia && <FotoEvidencia id={e.idArchivoEvidencia} />}</>}</div>)}</div></section>}
            {vista === 'admin' && detail.auditoria.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-4 font-bold">Notas internas y correcciones</h2>{detail.auditoria.map((a, i) => <div key={i} className="border-b border-slate-100 py-3 text-sm"><p>{a.motivo}</p><p className="mt-1 text-xs text-slate-400">{a.actor} · {fechaCompra(a.fecha)}</p></div>)}</section>}
          </div>
          <aside className="space-y-5">
            {vista === "cliente" && <EstadoConstancia key={p.idPedido} id={p.idPedido} />}
            <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-3 flex items-center gap-2 font-bold"><MapPin size={18} className="text-amber-600" />{p.idModalidadEntrega === 1 ? 'Punto de recogida' : 'Destino'}</h2><p className="text-sm">{p.idModalidadEntrega === 1 ? config?.direccionTienda || 'Campus central' : p.direccionEntrega}</p><p className="mt-2 text-xs text-slate-500">{p.idModalidadEntrega === 1 ? config?.horario || 'Lunes a domingo, 8:00 a. m. a 5:00 p. m.' : [p.municipio, p.departamento].filter(Boolean).join(', ')}</p>{p.referenciaEntrega && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{p.referenciaEntrega}</p>}<div className="mt-4 space-y-2">{[p.telefonoContacto, p.telefonoAlterno].filter(Boolean).map((t, i) => <a key={i} href={`tel:${t!.replace(/[^+\d]/g, '')}`} className="flex items-center gap-2 text-sm text-amber-700"><Phone size={15} />{t}{i === 1 ? ' (alterno)' : ''}</a>)}</div></section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-3 font-bold">Resumen de compra</h2>{detail.productos.map((item, i) => <div key={i} className="flex justify-between gap-3 border-b border-slate-100 py-3 text-sm"><span>{item.cantidad} × {item.nombreProducto}</span><strong className="shrink-0">{moneda(item.subtotal)}</strong></div>)}<p className="mt-4 flex justify-between text-sm text-slate-500"><span>Envío</span><span>{moneda(p.cargoEntrega)}</span></p><p className="mt-3 flex justify-between font-bold"><span>Total</span><span>{moneda(p.total)}</span></p></section>
            {puedeDescargarConstancia(p) && <button disabled={generandoPdf} onClick={descargarPdf} className={`${botonSecundario} flex w-full items-center justify-center gap-2`}><Download size={16} />{generandoPdf ? 'Generando PDF…' : 'Constancia PDF con QR'}</button>}
            {['ENTREGADO', 'RECOGIDO'].includes(p.estado) && <button onClick={() => descargar(`/compras/${p.idPedido}/comprobante?vista=${vista}`, `comprobante-${p.numeroPedido}.html`)} className={`${botonSecundario} flex w-full items-center justify-center gap-2`}><Download size={16} />Comprobante imprimible</button>}
          </aside>
        </div>
      </>}
    </> : <>
      {vista === 'cliente' && <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white shadow-sm sm:p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-orange-300">Rastreo rápido</p><h2 className="mt-2 text-xl font-bold">¿Tienes el QR de tu compra?</h2><p className="mt-1 text-sm text-slate-300">Escanéalo para abrir el seguimiento al instante.</p></div><button type="button" onClick={() => { setErrorQr(''); setMostrarQr(true); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-bold text-white transition hover:bg-orange-400"><QrCode size={20} />Escanear QR</button></div></section>}
      <form onSubmit={e => { e.preventDefault(); setPagina(1); setBusqueda(inputSearch.trim()); }} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><div className="relative min-w-0"><Search size={18} className="absolute left-3 top-3.5 text-slate-400" /><input aria-label="Buscar pedido" placeholder={vista === 'cliente' ? 'Número de compra…' : 'Número de compra o cliente…'} value={inputSearch} onChange={e => setInputSearch(e.target.value)} className={`${campoCompra} !mt-0 pl-10`} /></div><select aria-label="Filtrar por estado" value={estado} onChange={e => { setEstado(e.target.value); setPagina(1); }} className={`${campoCompra} !mt-0 !w-full sm:!w-auto`}><option value="">Todos los estados</option>{Object.entries(ESTADOS_COMPRA).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select><button type="submit" className={`${botonSecundario} min-h-11`}>Buscar</button></form>
      {loading ? <p role="status" className="rounded-2xl bg-white p-12 text-center text-slate-500">Cargando pedidos…</p> : pedidos.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><Package size={40} className="mx-auto mb-4 text-amber-400" /><h2 className="font-bold">{vista === 'repartidor' ? 'Sin entregas asignadas' : 'No hay pedidos para mostrar'}</h2><p className="mt-2 text-sm text-slate-500">{vista === 'cliente' ? 'Tus compras aparecerán aquí con su seguimiento.' : 'Los pedidos aparecerán aquí conforme avance la operación.'}</p>{vista === 'cliente' && <Link to="/comprador/catalogo" className="mt-4 inline-block font-semibold text-amber-700">Explorar catálogo</Link>}</div> : <div className="grid gap-4 md:grid-cols-2">{pedidos.map(order => <button key={order.idPedido} onClick={() => setParams({ pedido: String(order.idPedido) })} className="group rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-amber-400 hover:shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-400">{fechaCompra(order.fechaPedido)}</span><Badge estado={order.estado} /></div><p className="mt-3 break-all text-base font-bold">{order.numeroPedido}</p><p className="mt-1 text-sm text-slate-500">{order.cliente} · {order.idModalidadEntrega === 1 ? 'Tienda FamKon' : 'Domicilio'}</p><div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4"><Badge estado={order.estadoPago} pago /><span className="flex items-center gap-3 font-bold">{moneda(order.total)}<ArrowRight size={16} className="text-amber-600" /></span></div></button>)}</div>}
      <div className="flex items-center justify-between gap-4 text-sm text-slate-500"><span>{total} pedidos · página {pagina}</span><div className="flex gap-2"><button disabled={pagina <= 1 || loading} onClick={() => setPagina(p => p - 1)} className={botonSecundario}>Anterior</button><button disabled={pagina * 20 >= total || loading} onClick={() => setPagina(p => p + 1)} className={botonSecundario}>Siguiente</button></div></div>
    </>}
    {refreshed && <p className="text-right text-xs text-slate-400">Actualizado a las {refreshed} · actualización automática cada 20 s</p>}
    {mostrarQr && <div role="dialog" aria-modal="true" aria-labelledby="titulo-qr" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"><div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-6"><div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-orange-600">Rastreo rápido</p><h2 id="titulo-qr" className="mt-1 text-xl font-bold text-slate-950">Escanear QR del pedido</h2></div><button type="button" aria-label="Cerrar lector QR" onClick={() => setMostrarQr(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600"><X size={20} /></button></div><QrScanner onDetected={abrirDesdeQr} description="Coloca dentro del recuadro el QR incluido en tu comprobante de compra." />{errorQr && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorQr}</p>}</div></div>}
  </div>;
}
