import { esAdministrador, grupoPermitidoParaAdmin } from '../domain/vistasRol';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, UserCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MENU_GROUPS } from '../components/dashboardMenu';
import CatalogoPage from './CatalogoPage';

const textos: Record<string, { titulo: string; descripcion: string; pasos: string[] }> = {
  compras: { titulo: '¿Qué querés comprar hoy?', descripcion: 'Explorá el catálogo, continuá tu compra o consultá el avance de tus pedidos.', pasos: ['Elegí tus productos', 'Revisá tu carrito', 'Confirmá entrega y pago'] },
  entregas: { titulo: 'Tus entregas, paso a paso', descripcion: 'Abrí una entrega asignada para consultar su destino y las acciones disponibles.', pasos: ['Abrí una entrega asignada', 'Revisá los datos del pedido', 'Registrá el resultado y la evidencia'] },
  administracion: { titulo: 'Organizá el trabajo de la tienda', descripcion: 'Revisá la operación y mantené actualizado el catálogo. Las acciones de cada pedido están en su detalle.', pasos: ['Consultá los pedidos o entregas', 'Revisá su pago y estado', 'Abrí el detalle para continuar'] },
};
const descripciones: Record<string, string> = {
  '/catalogo': 'Encontrá productos y elegí el que más te guste.',
  '/carrito': 'Revisá cantidades y subtotal antes de confirmar.',
  '/comprador/tracking': 'Consultá el pago y el avance de tus compras.',
  '/comprador/historico': 'Volvé a consultar tus compras anteriores.',
  '/repartidor/asignados': 'Consultá tus pedidos y registrá el avance desde cada entrega.',
  '/admin/pedidos': 'Revisá pagos, preparación y avance de los pedidos.',
  '/entregas/tracking': 'Consultá el seguimiento general de las entregas.',
  '/admin/productos': 'Actualizá imágenes, precios y disponibilidad.',
  '/admin/usuarios': 'Consultá usuarios y administrá sus accesos.',
  '/admin': 'Accedé a las herramientas de administración.',
  '/supervisor': 'Accedé a las herramientas de supervisión.',
};
const nombres: Record<string, string> = {
  '/catalogo': 'Explorar catálogo', '/carrito': 'Continuar mi compra',
  '/comprador/tracking': 'Mis compras', '/comprador/historico': 'Historial de compras',
  '/repartidor/asignados': 'Entregas asignadas', '/admin/pedidos': 'Gestionar pedidos',
  '/entregas/tracking': 'Seguimiento de entregas', '/admin/productos': 'Gestionar productos',
  '/admin/usuarios': 'Gestionar usuarios', '/admin': 'Panel de administración', '/supervisor': 'Panel de supervisión',
};

export default function DashboardPage() {
  const { usuario, tienePermiso } = useAuth();
  const [seleccion, setSeleccion] = useState('');
  const roles = (usuario?.roles || '').toUpperCase().split(/[,;\s]+/);
  const esAdmin = esAdministrador(usuario?.roles);
  const grupos = MENU_GROUPS.filter(g => g.id !== 'cuenta' && grupoPermitidoParaAdmin(g.id, esAdmin) && (esAdmin || !g.codigoRol || roles.includes(g.codigoRol)));
  const areas = [
    { id: 'compras', nombre: 'Compras', grupos: ['compras'] },
    { id: 'entregas', nombre: 'Entregas', grupos: ['entregas'] },
    { id: 'administracion', nombre: 'Administración', grupos: ['administracion', 'tracking', 'supervision'] },
  ].map(area => {
    const vistos = new Set<string>();
    const items = grupos.filter(g => area.grupos.includes(g.id)).flatMap(g => g.items).filter(item => {
      if (!descripciones[item.path] || vistos.has(item.path) || (item.codigo && !esAdmin && !tienePermiso(item.codigo))) return false;
      if (item.path === '/supervisor' && !roles.includes('SUPERVISOR')) return false;
      vistos.add(item.path); return true;
    });
    if (area.id === 'administracion') items.sort((a, b) => Number(b.path === '/admin/pedidos') - Number(a.path === '/admin/pedidos'));
    return { ...area, items };
  }).filter(area => area.items.length);
  const inicial = esAdmin || roles.includes('SUPERVISOR') ? 'administracion' : roles.includes('REPARTIDOR') ? 'entregas' : 'compras';
  const activa = areas.find(a => a.id === seleccion) || areas.find(a => a.id === inicial) || areas[0];
  const texto = activa && textos[activa.id];
  const principal = activa?.items[0];
  if (esAdmin) return <Navigate to="/admin/pedidos" replace />;
  return <div className="mx-auto max-w-6xl space-y-6">
    {activa?.id !== 'compras' && <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-amber-700">FamKon · Inicio</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Hola, {usuario?.nickname || 'bienvenido'}</h1><p className="mt-1 text-sm text-slate-500">{esAdmin ? 'Administrá los pedidos, el catálogo y los accesos de la tienda.' : 'Tu espacio para comprar y trabajar en la tienda.'}</p></div>
      <Link to="/perfil" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><UserCircle size={18} />Mi perfil</Link>
    </div>}
    {areas.length > 1 && <nav aria-label="Áreas de trabajo" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">{areas.map(area => <button key={area.id} type="button" aria-pressed={activa?.id === area.id} onClick={() => setSeleccion(area.id)} className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${activa?.id === area.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>{area.nombre}</button>)}</nav>}
    {activa?.id === 'compras' ? <CatalogoPage mostrarCabecera={false} /> : activa && texto && principal ? <section aria-labelledby="area-titulo" className="space-y-5">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6"><h2 id="area-titulo" className="text-xl font-bold text-slate-900">{texto.titulo}</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{texto.descripcion}</p><Link to={principal.path} className="mt-4 inline-flex items-center gap-3 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400">{nombres[principal.path]}<ArrowRight size={17} /></Link></div>
      <div className="grid gap-3 sm:grid-cols-2">{activa.items.map(({ path, icon: Icon }) => <Link key={path} to={path} className="group flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-amber-400 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-amber-500"><span className="rounded-xl bg-slate-50 p-3 text-amber-600"><Icon size={22} /></span><div className="min-w-0 flex-1"><h3 className="font-semibold text-slate-900">{nombres[path]}</h3><p className="mt-1 text-sm leading-relaxed text-slate-500">{descripciones[path]}</p></div><ArrowRight size={18} className="mt-1 shrink-0 text-slate-400 group-hover:text-amber-600" /></Link>)}</div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-semibold text-slate-800">Cómo continuar</h3><ol className="mt-4 grid gap-4 sm:grid-cols-3">{texto.pasos.map((paso, index) => <li key={paso} className="flex items-start gap-3 text-sm text-slate-600"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-50 text-xs font-bold text-amber-700">{index + 1}</span>{paso}</li>)}</ol></div>
    </section> : <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No hay módulos disponibles con tus permisos actuales. Consultá a administración.</div>}
    {activa?.id !== 'compras' && <p className="text-xs text-slate-500">Las demás herramientas están disponibles en el menú lateral según tus permisos.</p>}
  </div>;
}
