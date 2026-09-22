import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, LockKeyhole } from 'lucide-react';
import { detalleCompra, iniciarPago, verificarPago, type DetalleCompra } from '../api/compras';
import { moneda, puedePagar } from '../domain/compras';

// Protocolo embed del SDK oficial recurrente-checkout 0.0.5.
// El wrapper controla su propio ciclo de vida y valida origen + ventana emisora.
export default function PagoPage() {
  const id = Number(useParams().id);
  const [detail, setDetail] = useState<DetalleCompra | null>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const checking = useRef(false);
  const pago = useRef<Promise<{ url: string }> | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    async function load() {
      try {
        if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Pedido inválido.');
        const d = await detalleCompra(id, 'cliente');
        if (!active) return;
        setDetail(d);
        if (!puedePagar(d.pedido)) { setNotice('Este pedido ya no tiene un pago por completar.'); return; }
        pago.current ??= iniciarPago(id).catch(e => { pago.current = null; throw e; });
        const result = await pago.current;
        const target = new URL(result.url);
        if (target.origin !== 'https://app.recurrente.com') throw new Error('Dirección de pago no válida.');
        target.searchParams.set('embed', 'true');
        if (active) setUrl(target.toString());
      } catch (e) { if (active) setError((e as Error).message); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [id, attempt]);
  useEffect(() => { pago.current = null; setUrl(''); }, [id]);
  async function comprobar(silencioso = false) {
    if (checking.current) return;
    checking.current = true; setVerifying(true); setError('');
    try {
      const result = await verificarPago(id);
      const d = await detalleCompra(id, 'cliente'); setDetail(d);
      if (result.estado === 'APROBADO') { setUrl(''); setNotice('Pago confirmado. Podés consultar el avance de tu pedido.'); }
      else if (!silencioso) setNotice('Estamos esperando la confirmación de tu pago. Esta pantalla se actualizará automáticamente; no vuelvas a pagar.');
    } catch { setError('No pudimos consultar la confirmación. Reintentaremos automáticamente; si ya pagaste, no vuelvas a pagar.'); }
    finally { checking.current = false; setVerifying(false); }
  }
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== 'https://app.recurrente.com' || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'recurrente-plugin:payment-success') void comprobar();
      else if (event.data?.type === 'recurrente-plugin:payment-failed') setError('No se completó el pago. Revisá los datos de la tarjeta e intentá nuevamente.');
      else if (event.data?.type === 'recurrente-plugin:payment-in-progress') setNotice('Pago en proceso de confirmación.');
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [id]);
  useEffect(() => {
    if (!url) return;
    const timer = setInterval(() => { if (!document.hidden) void comprobar(true); }, 10000);
    const visible = () => { if (!document.hidden) void comprobar(true); };
    window.addEventListener('focus', visible);
    return () => { clearInterval(timer); window.removeEventListener('focus', visible); };
  }, [url, id]);
  const p = detail?.pedido;
  return <div className="mx-auto max-w-5xl">
    <Link to={`/comprador/tracking?pedido=${id}`} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft size={16} />Volver a mi pedido</Link>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {p?.entorno === 'TEST' && <p className="bg-amber-50 px-5 py-2 text-center text-xs text-amber-800">Modo de prueba · sin cobro real</p>}
      <div className="grid md:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3"><h1 className="flex items-center gap-2 text-lg font-bold text-slate-900"><CreditCard size={20} className="text-amber-600" />Pago con tarjeta</h1><span className="flex items-center gap-1 text-xs text-slate-500"><LockKeyhole size={13} />Recurrente</span></div>
          {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {detail?.pedido.estadoPago === 'APROBADO' && <Link to={`/comprador/tracking?pedido=${id}`} className="mb-4 inline-block rounded-lg bg-amber-500 px-4 py-3 font-semibold">Ver mi pedido</Link>}
          {notice && <p role="status" className="mb-3 rounded-lg bg-sky-50 p-3 text-sm text-sky-800">{notice}</p>}
          {loading && <p role="status" className="py-20 text-center text-sm text-slate-500">Preparando el pago seguro…</p>}
          {url && <iframe ref={frame} src={url} title="Formulario seguro de tarjeta de Recurrente" allow="payment" className="h-[620px] w-full border-0" />}
          {error && !url && <button onClick={() => setAttempt(a => a + 1)} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold">Reintentar</button>}
          {url && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs"><span role="status" className="text-slate-500">{verifying ? 'Consultando confirmación…' : 'El pago se confirma automáticamente.'}</span><a href={url.replace(/([?&])embed=true&?/, '$1').replace(/[?&]$/, '')} className="text-slate-500 underline">Abrir en Recurrente</a></div>}
        </section>
        <aside className="order-first border-b border-slate-200 bg-slate-50 p-5 md:order-last md:border-b-0 md:border-l md:p-6">
          <p className="text-sm text-slate-500">Total a pagar</p><p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{p ? moneda(p.total) : '—'}</p>
          <p className="mt-2 break-all text-xs text-slate-500">{p?.numeroPedido}</p>
          <details open className="mt-5 border-t border-slate-200 pt-4"><summary className="cursor-pointer text-sm font-semibold">Detalle del pedido</summary><div className="mt-3 space-y-3 text-sm">{detail?.productos.map((i, n) => <p key={n} className="flex justify-between gap-3"><span>{i.cantidad} × {i.nombreProducto}</span><span className="shrink-0">{moneda(i.subtotal)}</span></p>)}<p className="flex justify-between border-t border-slate-200 pt-3 text-slate-500"><span>{p?.idModalidadEntrega === 1 ? 'Recogida en tienda' : 'Envío a domicilio'}</span><span>{moneda(p?.cargoEntrega || 0)}</span></p></div></details>
          <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-slate-500"><LockKeyhole size={16} className="shrink-0" />Tu tarjeta se ingresa directamente en Recurrente. FamKon no guarda sus datos.</p>
        </aside>
      </div>
    </div>
  </div>;
}
