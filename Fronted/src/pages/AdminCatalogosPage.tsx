import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, RefreshCw, Plus, ArrowRight } from 'lucide-react';
import { actualizarTarifaEntrega, listarCategorias, listarAreasEntregaCatalogo, listarMetodosPagoCatalogo, type Categoria, type AreaEntregaCatalogo, type MetodoPagoCatalogo } from '../api/famkon';
import NuevaCategoriaModal from '../components/NuevaCategoriaModal';
import { useAuth } from '../context/AuthContext';
import { moneda } from '../domain/compras';

type Estado<T> = { datos: T[]; cargando: boolean; error: string };
const inicial = { datos: [], cargando: true, error: '' };
export default function AdminCatalogosPage() {
  const { usuario, tienePermiso } = useAuth();
  const puedeProductos = tienePermiso('GESTIONAR_PRODUCTOS') || (usuario?.roles || '').toUpperCase().split(/[,;\s]+/).includes('ADMIN');
  const [categorias, setCategorias] = useState<Estado<Categoria>>(inicial);
  const [areas, setAreas] = useState<Estado<AreaEntregaCatalogo>>(inicial);
  const [metodos, setMetodos] = useState<Estado<MetodoPagoCatalogo>>(inicial);
  const [pestana, setPestana] = useState('categorias');
  const [editando, setEditando] = useState<number | null>(null);
  const [tarifa, setTarifa] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorTarifa, setErrorTarifa] = useState('');
  const puedeTarifas = tienePermiso('GESTIONAR_CATALOGOS');
  const [nueva, setNueva] = useState(false);
  const [aviso, setAviso] = useState('');
  const cargando = categorias.cargando || areas.cargando || metodos.cargando;
  async function cargar() {
    setCategorias(s => ({ ...s, cargando: true, error: '' }));
    setAreas(s => ({ ...s, cargando: true, error: '' }));
    setMetodos(s => ({ ...s, cargando: true, error: '' }));
    const resultados = await Promise.allSettled([listarCategorias(), listarAreasEntregaCatalogo(), listarMetodosPagoCatalogo()]);
    const [c, a, m] = resultados;
    const error = (r: PromiseRejectedResult) => r.reason instanceof Error ? r.reason.message : 'No se pudo consultar la información.';
    setCategorias(c.status === 'fulfilled' ? { datos: c.value, cargando: false, error: '' } : { datos: [], cargando: false, error: error(c) });
    setAreas(a.status === 'fulfilled' ? { datos: a.value, cargando: false, error: '' } : { datos: [], cargando: false, error: error(a) });
    setMetodos(m.status === 'fulfilled' ? { datos: m.value, cargando: false, error: '' } : { datos: [], cargando: false, error: error(m) });
  }
  useEffect(() => { void cargar(); }, []);
  return <div className="mx-auto max-w-6xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><Boxes className="text-amber-600" />Catálogos de la tienda</h1><p className="mt-1 text-sm text-slate-500">Consultá categorías, áreas de entrega y métodos de pago registrados.</p></div><button type="button" disabled={cargando} onClick={() => void cargar()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw size={16} className={cargando ? 'animate-spin' : ''} />Actualizar</button></div>
    {aviso && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{aviso}</p>}
    {puedeProductos && <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5"><div><h2 className="font-bold text-slate-900">Productos e imágenes</h2><p className="mt-1 text-sm text-slate-600">Creá productos y actualizá sus precios, imágenes y disponibilidad desde el gestor.</p></div><Link to="/admin/productos" className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950">Gestionar productos<ArrowRight size={16} /></Link></div>}
    <nav aria-label="Catálogos" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">{[["categorias", "Categorías"], ["entregas", "Envíos y tarifas"], ["pagos", "Métodos de pago"]].map(([id, nombre]) => <button key={id} type="button" aria-pressed={pestana === id} onClick={() => setPestana(id)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${pestana === id ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}>{nombre}</button>)}</nav>
    <div>
      {pestana === "categorias" && <>
      <Panel titulo="Categorías de productos" estado={categorias} accion={puedeProductos && <button type="button" onClick={() => setNueva(true)} className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800"><Plus size={16} />Nueva categoría</button>}>
        {categorias.datos.map(c => <li key={c.idCategoria} className="py-3"><p className="font-semibold text-slate-800">{c.nombre}</p><p className="text-xs text-slate-500">{c.codigo}</p>{c.descripcion && <p className="mt-1 text-sm text-slate-600">{c.descripcion}</p>}</li>)}
      </Panel>
      </>}
      {pestana === "entregas" && <>
      {errorTarifa && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorTarifa}</p>}
      <Panel titulo="Envíos y tarifas" estado={areas} nota="Editá el cargo de cada modalidad. Los cambios aplican a pedidos nuevos; los pedidos existentes conservan su total.">
        {areas.datos.map(a => <li key={a.idAreaEntrega} className="flex justify-between gap-3 py-3"><div><p className="font-semibold text-slate-800">{a.nombre}</p><p className="text-xs text-slate-500">{a.codigo}{a.tipoArea ? ` · ${a.tipoArea}` : ''}</p>{a.referencia && <p className="mt-1 text-sm text-slate-600">{a.referencia}</p>}</div><div className="shrink-0 text-right">{editando === a.idAreaEntrega ? <form onSubmit={async event => { event.preventDefault(); if (guardando) return; setGuardando(true); setErrorTarifa(''); try { await actualizarTarifaEntrega(a.idAreaEntrega, Number(tarifa)); setEditando(null); setAviso('Tarifa actualizada para pedidos nuevos.'); await cargar(); } catch (e) { setErrorTarifa(e instanceof Error ? e.message : 'No se pudo guardar.'); } finally { setGuardando(false); } }} className="flex flex-wrap justify-end gap-2"><label className="text-xs">Tarifa (Q)<input aria-label={`Tarifa de ${a.nombre}`} required type="number" min="0" max="9999999999.99" step="0.01" value={tarifa} disabled={guardando} onChange={e => setTarifa(e.target.value)} className="ml-2 w-24 rounded-lg border p-2" /></label><button disabled={guardando} className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold">{guardando ? 'Guardando…' : 'Guardar'}</button><button type="button" disabled={guardando} onClick={() => setEditando(null)} className="px-2 text-sm">Cancelar</button></form> : <><p className="text-lg font-bold text-slate-800">{moneda(a.cargoEntrega)}</p>{puedeTarifas && <button type="button" onClick={() => { setEditando(a.idAreaEntrega); setTarifa(String(a.cargoEntrega)); setErrorTarifa(''); }} className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold">Editar tarifa</button>}</>}</div></li>)}
      </Panel>
      </>}
      {pestana === "pagos" && <Panel titulo="Métodos de pago" estado={metodos} nota="Que un método esté registrado no garantiza que esté habilitado para cobrar. La disponibilidad se comprueba en el checkout.">
        {metodos.datos.map(m => <li key={m.idMetodoPago} className="py-3"><p className="font-semibold text-slate-800">{m.nombre}</p><p className="mt-1 text-xs text-slate-500">{m.codigo}{m.requiereProveedor === 'S' ? ' · Requiere proveedor de pagos' : ''}</p></li>)}
      </Panel>}
    </div>
    {nueva && <NuevaCategoriaModal desdeProducto={false} onClose={() => setNueva(false)} onCreated={c => { setNueva(false); setAviso(`Categoría «${c.nombre}» creada.`); void cargar(); }} />}
  </div>;
}
function Panel({ titulo, estado, children, nota, accion }: { titulo: string; estado: Estado<unknown>; children: ReactNode; nota?: string; accion?: ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold text-slate-900">{titulo}</h2>{accion}</div>{nota && <p className="mt-2 text-xs leading-relaxed text-slate-500">{nota}</p>}{estado.cargando ? <p role="status" className="py-6 text-sm text-slate-500">Cargando…</p> : estado.error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{estado.error}</p> : estado.datos.length ? <ul className="mt-3 divide-y divide-slate-100">{children}</ul> : <p className="py-6 text-sm text-slate-500">No hay registros activos disponibles.</p>}</section>;
}
