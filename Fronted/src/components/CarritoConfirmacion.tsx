import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Package, Trash2 } from 'lucide-react';
import { eliminarDelCarritoAPI, type Carrito } from '../api/famkon';
import { moneda } from '../domain/compras';

export default function CarritoConfirmacion({ carrito, onClose }: { carrito: Carrito; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState(carrito.detalles);
  const [eliminando, setEliminando] = useState<number | null>(null);
  const bloqueado = useRef(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('Producto agregado al carrito');
  async function eliminar(idDetalle: number) {
    if (bloqueado.current) return;
    bloqueado.current = true;
    setEliminando(idDetalle);
    setError('');
    try {
      await eliminarDelCarritoAPI(idDetalle);
      setItems(actuales => actuales.filter(item => item.idDetalle !== idDetalle));
      setMensaje('Producto eliminado del carrito');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el producto. Intentá nuevamente.');
    } finally {
      bloqueado.current = false;
      setEliminando(null);
    }
  }
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  const unidades = items.reduce((sum, item) => sum + item.cantidad, 0);
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  return <dialog ref={dialog} aria-labelledby="carrito-confirmacion-titulo" onCancel={onClose}
    onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}
    className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-full max-w-md border-0 bg-slate-50 p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/40">
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white p-5">
        <button autoFocus onClick={onClose} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold hover:bg-slate-100"><ArrowLeft size={18} />Seguir comprando</button>
        <h2 id="carrito-confirmacion-titulo" className="mt-4 text-xl font-bold">Tu carrito</h2>
        <p role="status" className="mt-3 flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800"><Check size={18} />{mensaje}</p>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {items.length === 0 && <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500">Tu carrito está vacío. Podés seguir comprando.</p>}
        {items.map(item => <div key={item.idDetalle} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-amber-50"><Package size={26} className="text-amber-500" /></div>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.producto}</p><p className="mt-1 text-xs text-slate-500">Cantidad: {item.cantidad}</p><p className="mt-2 text-sm font-bold text-amber-700">{moneda(item.subtotal)}</p></div>
          <button type="button" onClick={() => void eliminar(item.idDetalle)} disabled={eliminando !== null} aria-label={`Eliminar ${item.producto} del carrito`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 disabled:opacity-40"><Trash2 size={18} className={eliminando === item.idDetalle ? 'animate-pulse' : ''} /></button>
        </div>)}
      </div>
      <div className="space-y-3 border-t border-slate-200 bg-white p-5">
        <p className="flex items-center justify-between font-bold"><span>Subtotal del carrito</span><span className="text-xl text-amber-700">{moneda(subtotal)}</span></p>
        <p className="text-xs text-slate-500">La entrega se elige al finalizar la compra.</p>
        <Link to="/comprador/carrito" onClick={onClose} className="block rounded-xl bg-amber-500 px-4 py-3 text-center text-sm font-semibold hover:bg-amber-400">Ver mi carrito ({unidades})</Link>
        <button onClick={onClose} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50">Seguir comprando</button>
      </div>
    </div>
  </dialog>;
}
