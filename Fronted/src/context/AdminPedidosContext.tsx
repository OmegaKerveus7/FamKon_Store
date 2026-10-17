import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, X } from 'lucide-react';
import { comprasRequest } from '../api/compras';
import { useAuth } from './AuthContext';
import { esAdministrador } from '../domain/vistasRol';
type Bandeja = { resumen: { ultimo: number; nuevos: number; sinAceptar: number; enPreparacion: number; sinAsignar: number }; pendientes: { idPedido: number; numeroPedido: string; estado: string; fechaPedido: string }[] };
const Contexto = createContext<{ datos: Bandeja | null; error: string; refrescar: () => Promise<void> }>({ datos: null, error: '', refrescar: async () => {} });
export const useAdminPedidos = () => useContext(Contexto);
export function AdminPedidosProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const admin = esAdministrador(usuario?.roles);
  const [datos, setDatos] = useState<Bandeja | null>(null);
  const [error, setError] = useState('');
  const [nuevos, setNuevos] = useState(0);
  const ultimo = useRef<number | null>(null);
  const activo = useRef(false);
  const ocupado = useRef(false);
  const peticion = useRef<AbortController | null>(null);
  const refrescar = useCallback(async () => {
    if (!admin || !activo.current || ocupado.current) return;
    ocupado.current = true;
    const controller = new AbortController(); peticion.current = controller;
    try {
      const d = await comprasRequest<Bandeja>(`/compras/bandeja-admin?desde=${ultimo.current ?? 0}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (ultimo.current !== null && Number(d.resumen.nuevos) > 0) setNuevos(n => n + Number(d.resumen.nuevos));
      ultimo.current = Number(d.resumen.ultimo); setDatos(d); setError('');
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo actualizar la bandeja.'); }
    finally { if (peticion.current === controller) ocupado.current = false; }
  }, [admin, usuario?.idUsuario]);
  useEffect(() => {
    activo.current = true; ultimo.current = null; ocupado.current = false; setDatos(null); setNuevos(0); setError('');
    void refrescar();
    const actualizar = () => { if (!document.hidden) void refrescar(); };
    const timer = window.setInterval(actualizar, 20000);
    document.addEventListener('visibilitychange', actualizar);
    return () => { activo.current = false; peticion.current?.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', actualizar); };
  }, [refrescar]);
  return <Contexto.Provider value={{ datos, error, refrescar }}>{children}{admin && nuevos > 0 && <div role="alert" className="fixed right-4 bottom-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-amber-300 bg-white p-5 shadow-xl"><div className="flex items-start gap-3"><BellRing className="shrink-0 text-amber-600" /><div><strong className="text-slate-900">{nuevos === 1 ? 'Llegó un nuevo pedido' : `Llegaron ${nuevos} pedidos nuevos`}</strong><p className="mt-1 text-sm text-slate-600">Revisá el pago y aceptá los pedidos para iniciar su preparación.</p><Link to="/admin/pedidos" onClick={() => setNuevos(0)} className="mt-3 inline-block text-sm font-bold text-amber-800">Ir a gestión de pedidos →</Link></div><button type="button" aria-label="Cerrar aviso" onClick={() => setNuevos(0)} className="shrink-0 rounded-lg p-2"><X size={18} /></button></div></div>}</Contexto.Provider>;
}
