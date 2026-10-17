import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Store, Package, ShoppingCart } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ImagenProducto from "../components/ImagenProducto";
import {
  type Producto,
  type Categoria,
  listarProductos,
  listarCategorias,
} from "../api/famkon";

export default function CatalogoPage() {
  const { tienePermiso } = useAuth();
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">¿Qué querés comprar hoy?</h1>
          <p className="text-sm text-slate-500">
            Elegí tus productos favoritos y personalizalos a tu gusto.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {productosFiltrados.length} producto{productosFiltrados.length === 1 ? "" : "s"}
        </span>
        {tienePermiso('VER_CARRITO') && <Link to="/comprador/carrito" className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"><ShoppingCart size={18} />Ver mi carrito</Link>}
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <Search className="h-5 w-5 text-slate-400" />
        <input
          type="text"
          aria-label="Buscar productos"
          placeholder="Buscar productos..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {productosFiltrados.map((producto) => (
            <Link
              key={producto.idProducto}
              to={`/comprador/producto/${producto.idProducto}`}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100">
                <ImagenProducto key={producto.idArchivoImagen} idProducto={producto.idProducto} idArchivoImagen={producto.idArchivoImagen} nombre={producto.nombre} />
              </div>
              <div className="p-4">
                <p className="text-xs font-medium text-amber-600">{producto.categoria}</p>
                <h3 className="mt-1 text-sm font-bold text-slate-900 line-clamp-1">
                  {producto.nombre}
                </h3>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                  {producto.descripcion}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-lg font-bold text-amber-600">
                    Q{producto.precioBase.toFixed(2)}
                  </span>
                  <span className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
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
