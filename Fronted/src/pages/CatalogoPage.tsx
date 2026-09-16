import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart, Search, Store, LogOut, Package } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  type Producto,
  type Categoria,
  listarProductos,
  listarCategorias,
  obtenerCarrito,
} from "../api/famkon";

export default function CatalogoPage() {
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [filtroCategoria, setFiltroCategoria] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [cantidadCarrito, setCantidadCarrito] = useState(0);

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    cargarCantidadCarrito();
  }, []);

  async function cargarCantidadCarrito() {
    try {
      const carrito = await obtenerCarrito();
      const total = carrito.detalles.reduce((sum, i) => sum + i.cantidad, 0);
      setCantidadCarrito(total);
    } catch {
      setCantidadCarrito(0);
    }
  }

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
      console.error("Error cargando catálogo:", err);
    }
    setCargando(false);
  }

  function handleSalir() {
    cerrarSesion();
    navigate("/login", { replace: true });
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
    <div className="min-h-screen bg-linear-to-br from-amber-50 via-orange-100 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/60 bg-white/70 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <img src="/images/logo-famkon.png" alt="Logo FamKon" className="h-9 w-9 object-contain" />
          <span className="text-lg font-bold text-slate-900">FamKon</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-600 sm:inline">
            Hola, {usuario?.nickname}
          </span>
          <Link
            to="/comprador/carrito"
            className="relative rounded-xl border border-slate-300 p-2 text-slate-700 transition hover:bg-white"
          >
            <ShoppingCart className="h-5 w-5" />
            {cantidadCarrito > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {cantidadCarrito}
              </span>
            )}
          </Link>
          <button
            onClick={handleSalir}
            className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Barra de búsqueda */}
        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-slate-300 bg-white/80 px-4 py-3 shadow-sm">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar productos..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>

        {/* Filtro de categorías */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setFiltroCategoria(null)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
              filtroCategoria === null
                ? "bg-amber-500 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
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
                  ? "bg-amber-500 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {cat.nombre}
            </button>
          ))}
        </div>

        {/* Grid de productos */}
        {cargando ? (
          <div className="flex items-center justify-center py-20">
            <Package className="h-8 w-8 animate-spin text-amber-500" />
            <span className="ml-3 text-sm text-slate-500">Cargando productos...</span>
          </div>
        ) : productosFiltrados.length === 0 ? (
          <div className="py-20 text-center">
            <Store className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">No se encontraron productos.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {productosFiltrados.map((producto) => (
              <Link
                key={producto.idProducto}
                to={`/comprador/producto/${producto.idProducto}`}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              >
                {/* Placeholder de imagen */}
                <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100">
                  <Package className="h-16 w-16 text-amber-300 group-hover:text-amber-400 transition" />
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
    </div>
  );
}
