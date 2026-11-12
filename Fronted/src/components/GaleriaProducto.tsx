import { useEffect, useState } from 'react';
import { obtenerGaleriaProducto, urlImagenProducto, type Producto } from '../api/famkon';
import ImagenProducto from './ImagenProducto';

export default function GaleriaProducto({ producto }: { producto: Producto }) {
  const [ids, setIds] = useState<number[]>([]);
  const [seleccionada, setSeleccionada] = useState<number | null>(producto.idArchivoImagen ?? null);
  useEffect(() => {
    let activo = true;
    obtenerGaleriaProducto(producto.idProducto).then(lista => { if (activo) setIds(lista); }).catch(() => {});
    return () => { activo = false; };
  }, [producto.idProducto]);
  return <div className="flex min-w-0 flex-col bg-gradient-to-br from-amber-100 to-orange-100">
    <div className="flex h-52 items-center justify-center sm:h-64 md:h-80">
      <ImagenProducto key={seleccionada} idProducto={producto.idProducto} idArchivoImagen={seleccionada} nombre={producto.nombre} />
    </div>
    {ids.length > 1 && <div className="flex flex-wrap justify-center gap-2 p-3" aria-label="Imágenes del producto">{ids.map((id, index) => <button key={id} type="button" aria-label={`Ver imagen ${index + 1}`} aria-pressed={seleccionada === id} onClick={() => setSeleccionada(id)} className={`h-14 w-14 overflow-hidden rounded-lg border-2 bg-white ${seleccionada === id ? 'border-amber-600' : 'border-transparent'}`}><img src={`${urlImagenProducto(producto.idProducto)}?archivo=${id}`} alt="" className="h-full w-full object-contain p-1" /></button>)}</div>}
  </div>;
}
