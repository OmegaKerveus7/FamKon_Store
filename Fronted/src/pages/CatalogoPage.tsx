import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Store, Package } from "lucide-react";
import {
  type Producto,
  type Categoria,
  listarProductos,
  listarCategorias,
} from "../api/famkon";

export default function CatalogoPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [filtroCategoria, setFiltroCategoria] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargando(true);
    try {
      const [cats, prods] = await Promise.all([
        listarCategorias(),
        listarProductos(),
      ]);
      setCategorias(cats);
      setProductos(prods);
    } catch (err) {
      console.error("Error cargando catalogo:", err);
    } finally {
      setCargando(false);
    }
  }

  const productosFiltrados = productos.filter((p) => {
    const coincideCategoria = filtroCategoria === null || p.idCategoria === filtroCategoria;
    const coincideBusqueda =
      busqueda === "" ||
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.descripcion.toLowerCase().includes(busqueda.toLowerCase());
    return coincideCategoria && coincideBusqueda;
  });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Catalogo</h1>
          <p className="text-sm text-slate-500">
            Explora los productos personalizados disponibles.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {productosFiltrados.length} producto{productosFiltrados.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm sm:px-4 sm:py-3">
        <Search className="h-5 w-5 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar productos..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setFiltroCategoria(null)}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
            filtroCategoria === null
              ? "bg-amber-500 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Todos
        </button>
        {categorias.map((cat) => (
          <button
            key={cat.idCategoria}
            onClick={() => setFiltroCategoria(cat.idCategoria)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
              filtroCategoria === cat.idCategoria
                ? "bg-amber-500 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {cat.nombre}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-20">
          <Package className="h-8 w-8 animate-spin text-amber-500" />
          <span className="ml-3 text-sm text-slate-500">Cargando productos...</span>
        </div>
      ) : productosFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center">
          <Store className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">No se encontraron productos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {productosFiltrados.map((producto) => (
            <Link
              key={producto.idProducto}
              to={`/comprador/producto/${producto.idProducto}`}
              className="group min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-2xl"
            >
              <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100 sm:aspect-[4/3]">
                <Package className="h-11 w-11 text-amber-300 transition group-hover:text-amber-500 sm:h-16 sm:w-16" />
              </div>
              <div className="min-w-0 p-2.5 sm:p-4">
                <p className="truncate text-[10px] font-medium text-amber-600 sm:text-xs">{producto.categoria}</p>
                <h3 className="mt-1 line-clamp-2 text-xs font-bold leading-snug text-slate-900 sm:line-clamp-1 sm:text-sm">
                  {producto.nombre}
                </h3>
                <p className="mt-1 hidden text-xs text-slate-500 sm:line-clamp-2 sm:block">
                  {producto.descripcion}
                </p>
                <div className="mt-2 flex min-w-0 items-center justify-between gap-1 sm:mt-3 sm:gap-2">
                  <span className="shrink-0 text-sm font-bold text-amber-600 sm:text-lg">
                    Q{producto.precioBase.toFixed(2)}
                  </span>
                  <span className="min-w-0 truncate rounded-lg bg-amber-50 px-1.5 py-1 text-[9px] font-semibold text-amber-700 sm:px-2 sm:text-[10px]">
                    {producto.sku}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
