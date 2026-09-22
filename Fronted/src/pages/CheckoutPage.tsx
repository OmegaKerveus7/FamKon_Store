import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Store, Truck, Banknote, CreditCard, ShieldCheck } from 'lucide-react';
import { obtenerCarrito, type Carrito } from '../api/famkon';
import { configCompra, crearCompra, type ConfigCompra, type DireccionCompra } from '../api/compras';
import { useAuth } from '../context/AuthContext';
import DireccionCompraFields from '../components/DireccionCompraFields';
import { moneda } from '../domain/compras';
export default function CheckoutPage() {
  const { usuario } = useAuth(); const navigate = useNavigate(); const locked = useRef(false);
  const [carrito, setCarrito] = useState<Carrito | null>(null); const [config, setConfig] = useState<ConfigCompra | null>(null);
  const [modalidad, setModalidad] = useState(1); const [metodo, setMetodo] = useState('EFECTIVO');
  const [direccion, setDireccion] = useState<DireccionCompra>({ telefonoContacto: /^\+?[0-9 ()-]{8,25}$/.test(usuario?.telefono || '') ? usuario!.telefono! : '' });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  async function cargar() { setLoading(true); setError(''); try { const [c, cfg] = await Promise.all([obtenerCarrito(), configCompra()]); setCarrito(c); setConfig(cfg); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }
  useEffect(() => { void cargar(); }, []);
  async function confirmar(e: FormEvent) {
    e.preventDefault(); if (locked.current || !carrito || !config) return;
    locked.current = true; setBusy(true); setError('');
    try { const result = await crearCompra({ ...direccion, telefonoAlterno: direccion.telefonoAlterno || null, idCarrito: carrito.idCarrito, idModalidadEntrega: modalidad, metodoPago: metodo }); navigate(metodo === 'TARJETA' ? `/comprador/pago/${result.idPedido}` : `/comprador/tracking?pedido=${result.idPedido}`, { replace: true }); }
    catch (err) { setError((err as Error).message); } finally { locked.current = false; setBusy(false); }
  }
  const subtotal = carrito?.detalles.reduce((s, i) => s + i.subtotal, 0) || 0;
  const envio = config ? modalidad === 1 ? config.cargoTienda : config.cargoDomicilio : 0;
  if (loading) return <p role="status" className="p-8">Preparando tu compra…</p>;
  return <div className="mx-auto max-w-5xl space-y-6">
    <Link to="/comprador/carrito" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft size={16} /> Volver al carrito</Link>
    <div><p className="text-xs font-semibold uppercase tracking-widest text-amber-600">FamKon · Tu compra</p><h1 className="mt-2 text-3xl font-bold text-slate-900">Un paso más y es tuyo</h1><p className="mt-2 text-slate-500">Elegí dónde recibir tu pedido y cómo pagar.</p></div>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}{!carrito && <button onClick={cargar} className="ml-3 underline">Reintentar</button>}</div>}
    {carrito && carrito.detalles.length === 0 ? <p className="rounded-xl bg-white p-8">Tu carrito está vacío. <Link to="/comprador/catalogo" className="text-amber-700 underline">Explorar catálogo</Link></p> : carrito && config && <form onSubmit={confirmar} className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
      <fieldset disabled={busy} className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="mb-4 text-lg font-bold">1. ¿Dónde recibirás tu pedido?</h2><div className="mb-5 grid gap-3 sm:grid-cols-2">
          {[{ id: 1, name: 'Tienda FamKon', text: 'Recogida sin costo', Icon: Store }, { id: 2, name: 'Domicilio', text: `${moneda(config.cargoDomicilio)} de envío`, Icon: Truck }].map(({ id, name, text, Icon }) => <label key={id} className={`flex cursor-pointer gap-3 rounded-xl border-2 p-4 ${modalidad === id ? 'border-amber-500 bg-amber-50' : 'border-slate-100'}`}><input type="radio" name="modalidad" value={id} checked={modalidad === id} onChange={() => setModalidad(id)} className="accent-amber-500" /><div><Icon size={22} className="mb-2 text-amber-600" /><p className="font-semibold">{name}</p><p className="text-xs text-slate-500">{text}</p></div></label>)}
        </div>{modalidad === 1 && <div className="mb-5 rounded-xl bg-slate-50 p-4 text-sm"><p className="font-semibold">{config.direccionTienda}</p><p className="mt-1 text-slate-500">{config.horario}</p></div>}
        <p className="mb-4 text-sm text-slate-500">Compra a nombre de <strong className="text-slate-800">{usuario?.nickname}</strong>. Confirmá un teléfono válido para coordinar la entrega.</p>
        {usuario?.telefono && !/^\+?[0-9 ()-]{8,25}$/.test(usuario.telefono) && <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Tu perfil tiene un teléfono inválido de un registro anterior. Ingresá tu número de WhatsApp para esta entrega y solicitá la corrección de tu perfil a administración.</p>}
        <DireccionCompraFields domicilio={modalidad === 2} value={direccion} onChange={setDireccion} /></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="mb-4 text-lg font-bold">2. ¿Cómo querés pagar?</h2><div className="space-y-3">
          {[{ code: 'EFECTIVO', name: modalidad === 1 ? 'Efectivo al recoger' : 'Efectivo contra entrega', text: 'Pagás cuando recibís tu pedido.', Icon: Banknote }, { code: 'TARJETA', name: 'Tarjeta con Recurrente', text: config.tarjetaDisponible ? 'Al continuar, ingresarás tu tarjeta para pagar.' : 'Temporalmente no disponible.', Icon: CreditCard }].map(({ code, name, text, Icon }) => <label key={code} className={`flex items-center gap-3 rounded-xl border p-4 ${metodo === code ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}><input type="radio" name="metodo" checked={metodo === code} onChange={() => setMetodo(code)} disabled={code === 'TARJETA' && !config.tarjetaDisponible} className="accent-amber-500" /><Icon size={24} className="text-slate-500" /><div><p className="font-semibold">{name}</p><p className="text-xs text-slate-500">{text}</p></div></label>)}
        </div></section>
      </fieldset>
      <aside className="rounded-2xl border border-slate-200 bg-white p-6 lg:sticky lg:top-4"><h2 className="text-lg font-bold">Tu pedido</h2><div className="my-4 divide-y divide-slate-100">{carrito.detalles.map(i => <div key={i.idDetalle} className="flex justify-between gap-3 py-3 text-sm"><span>{i.cantidad} × {i.producto}</span><strong>{moneda(i.subtotal)}</strong></div>)}</div><div className="space-y-3 text-sm"><p className="flex justify-between"><span>Subtotal</span><span>{moneda(subtotal)}</span></p><p className="flex justify-between"><span>{modalidad === 1 ? 'Recogida' : 'Envío'}</span><span>{moneda(envio)}</span></p><p className="flex justify-between border-t pt-4 text-xl font-bold"><span>Total</span><span className="text-amber-600">{moneda(subtotal + envio)}</span></p></div><button disabled={busy} className="mt-6 w-full rounded-xl bg-amber-500 px-4 py-3 font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50">{busy ? 'Preparando tu pedido…' : metodo === 'TARJETA' ? 'Continuar al pago' : 'Confirmar pedido'}</button><p className="mt-3 flex gap-2 text-xs text-slate-500"><ShieldCheck size={16} className="shrink-0" />Podrás seguir cada avance desde Mis pedidos.</p>{metodo === 'TARJETA' && config.entorno === 'TEST' && <p className="mt-3 rounded-lg bg-blue-50 p-2 text-xs text-blue-700">Tarjeta en modo de prueba · sin cobro real.</p>}</aside>
    </form>}
  </div>;
}
