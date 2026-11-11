import { useState } from 'react';
import { Package } from 'lucide-react';
import { urlImagenProducto } from '../api/famkon';

export default function ImagenProducto({ idProducto, idArchivoImagen, nombre }: { idProducto: number; idArchivoImagen?: number | null; nombre: string }) {
  const [estado, setEstado] = useState<'cargando' | 'lista' | 'error'>('cargando');
  const [intento, setIntento] = useState(0);
  if (!idArchivoImagen) return <Package className="h-16 w-16 text-amber-300" />;
  return <div className="relative flex h-full w-full items-center justify-center">
    {estado !== 'error' && <img src={`${urlImagenProducto(idProducto)}?archivo=${idArchivoImagen}${intento ? `&reintento=${intento}` : ''}`} alt={nombre} onLoad={() => setEstado('lista')} onError={() => setEstado('error')} decoding="async" className={`h-full w-full object-contain p-4 ${estado === 'lista' ? '' : 'invisible'}`} />}
    {estado === 'cargando' && <span role="status" className="absolute text-xs text-amber-800">Cargando imagen…</span>}
    {estado === 'error' && <button type="button" onClick={event => { event.preventDefault(); event.stopPropagation(); setEstado('cargando'); setIntento(n => n + 1); }} className="rounded-lg bg-white/80 px-3 py-2 text-xs text-slate-700">Reintentar imagen</button>}
  </div>;
}
