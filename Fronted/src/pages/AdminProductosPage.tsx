import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import NuevaCategoriaModal from "../components/NuevaCategoriaModal";
import { Boxes, Plus, Pencil, Power, PowerOff, RefreshCw, Search, X } from "lucide-react";
import {
  listarProductosAdmin, listarCategoriasProductoAdmin, crearProductoAdmin,
  actualizarProductoAdmin, cambiarEstadoProductoAdmin,
  type Producto, type Categoria, type ProductoAdminBody,
} from "../api/famkon";

type Modal = { tipo: "crear" } | { tipo: "editar" | "estado"; producto: Producto };
const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100";
const buttonClass = "rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50";
const mensajeError = (error: unknown) => error instanceof Error ? error.message : "No se pudo completar la operación.";

export default function AdminProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("todos");
  const [nuevaCategoria, setNuevaCategoria] = useState(false);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("");
  const [modal, setModal] = useState<Modal | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const operacionEnCurso = useRef(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const [lista, opciones] = await Promise.all([listarProductosAdmin(), listarCategoriasProductoAdmin()]);
      setProductos(lista);
      setCategorias(opciones);
    } catch (err) { setError(mensajeError(err)); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => {
    if (!modal) return;
    const element = dialog.current;
    const previo = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => { element?.close(); previo?.focus(); };
  }, [modal]);

  function abrir(next: Modal) {
    setErrorModal("");
    setAviso("");
    setCategoriaSeleccionada(next.tipo === "editar" ? String(next.producto.idCategoria) : "");
    setModal(next);
  }

  function cerrar() {
    if (!operacionEnCurso.current) setModal(null);
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal || operacionEnCurso.current) return;
    const datos = new FormData(event.currentTarget);
    setErrorModal("");
    operacionEnCurso.current = true;
    setGuardando(true);
    try {
      if (modal.tipo === "estado") {
        await cambiarEstadoProductoAdmin(modal.producto.idProducto, modal.producto.activo === "S" ? "N" : "S");
        setAviso(modal.producto.activo === "S" ? "Producto desactivado." : "Producto activado.");
      } else {
        const nombre = String(datos.get("nombre") || "").trim();
        const sku = String(datos.get("sku") || "").trim();
        const precio = String(datos.get("precio") || "");
        const precioBase = Number(precio);
        const idCategoria = Number(datos.get("categoria"));
        if (!nombre || (modal.tipo === "crear" && !sku)) throw new Error("Completa el nombre y el SKU.");
        if (!precio || !Number.isFinite(precioBase) || precioBase < 0 || precioBase > 9999999999.99)
          throw new Error("Ingresa un precio válido mayor o igual a cero.");
        if (!categorias.some(c => c.idCategoria === idCategoria)) throw new Error("Selecciona una categoría.");
        const body: ProductoAdminBody = {
          idCategoria, nombre, precioBase,
          descripcion: String(datos.get("descripcion") || "").trim(),
          idArchivoImagen: modal.tipo === "editar" ? modal.producto.idArchivoImagen ?? null : null,
          permiteLadoA: datos.has("ladoA") ? "S" : "N",
          permiteLadoB: datos.has("ladoB") ? "S" : "N",
        };
        if (modal.tipo === "crear") await crearProductoAdmin({ ...body, sku, idSitio: 1 });
        else await actualizarProductoAdmin(modal.producto.idProducto, body);
        setAviso(modal.tipo === "crear" ? "Producto creado correctamente." : "Producto actualizado correctamente.");
      }
      setModal(null);
      await cargar();
    } catch (err) { setErrorModal(mensajeError(err)); }
    finally { setGuardando(false); operacionEnCurso.current = false; }
  }

  const visibles = productos.filter(p =>
    (estado === "todos" || p.activo === estado) &&
    `${p.sku} ${p.nombre} ${p.categoria}`.toLocaleLowerCase().includes(busqueda.toLocaleLowerCase().trim()),
  );
  const editado = modal?.tipo === "editar" ? modal.producto : null;
  const titulo = modal?.tipo === "crear" ? "Nuevo producto" : modal?.tipo === "editar" ? "Editar producto" :
    modal?.producto.activo === "S" ? "Desactivar producto" : "Activar producto";

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><Boxes className="h-6 w-6 text-amber-600" />Gestor de Productos</h1>
          <p className="text-sm text-slate-500">Crear, actualizar y desactivar productos del catálogo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
        <button onClick={() => setNuevaCategoria(true)} disabled={cargando || !!error} className="rounded-xl border border-amber-500 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">Nueva categoría</button>
        <button onClick={() => abrir({ tipo: "crear" })} disabled={cargando || !!error} className={`flex items-center gap-2 ${buttonClass}`}>
          <Plus className="h-4 w-4" /> Nuevo producto
        </button>
        </div>
      </header>

      {aviso && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{aviso}</p>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">No se pudo actualizar el listado: {error}</p>}
      {!cargando && !error && !categorias.length && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Empieza creando tu primera categoría. Después podrás registrar el producto. <button onClick={() => setNuevaCategoria(true)} className="font-semibold underline">Crear categoría</button></p>}

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">Buscar productos</span><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por SKU, nombre o categoría" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-amber-500" />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">Estado
          <select value={estado} onChange={e => setEstado(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <option value="todos">Todos</option><option value="S">Activos</option><option value="N">Inactivos</option>
          </select>
        </label>
        <button onClick={() => void cargar()} disabled={cargando} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`} />Actualizar</button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm" aria-busy={cargando}>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>{["SKU", "Nombre", "Categoría", "Precio base", "Estado", "Acciones"].map(t => <th key={t} className={`px-4 py-3 ${t === "Acciones" ? "text-right" : ""}`}>{t}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cargando ? <tr><td colSpan={6} className="p-10 text-center text-slate-500">Cargando productos…</td></tr> : error ?
              <tr><td colSpan={6} className="p-10 text-center text-slate-500">Pulsa Actualizar para reintentar.</td></tr> : visibles.length === 0 ?
              <tr><td colSpan={6} className="p-10 text-center text-slate-500">{productos.length ? "No hay productos que coincidan con los filtros." : categorias.length ? "Todavía no hay productos. Crea el primero con Nuevo producto." : "Todavía no hay productos. Crea una categoría para comenzar."}</td></tr> :
              visibles.map(p => (
                <tr key={p.idProducto} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.sku}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{p.nombre}</td>
                  <td className="px-4 py-3 text-slate-600">{p.categoria}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-amber-600">Q{p.precioBase.toFixed(2)}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.activo === "S" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{p.activo === "S" ? "Activo" : "Inactivo"}</span></td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-2">
                    <button onClick={() => abrir({ tipo: "editar", producto: p })} aria-label={`Editar ${p.nombre}`} title="Editar" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => abrir({ tipo: "estado", producto: p })} aria-label={`${p.activo === "S" ? "Desactivar" : "Activar"} ${p.nombre}`} title={p.activo === "S" ? "Desactivar" : "Activar"} className={`rounded-lg border p-2 ${p.activo === "S" ? "border-red-200 text-red-500 hover:bg-red-50" : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"}`}>
                      {p.activo === "S" ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </button>
                  </div></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!cargando && !error && <p className="text-sm text-slate-500">{visibles.length} de {productos.length} productos</p>}

      {modal && <dialog ref={dialog} aria-labelledby="producto-modal-titulo" onCancel={event => { event.preventDefault(); cerrar(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 id="producto-modal-titulo" className="text-xl font-bold">{titulo}</h2>
          <button type="button" onClick={cerrar} disabled={guardando} aria-label="Cerrar modal" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={guardar} className="space-y-5 p-6">
          {errorModal && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorModal}</p>}
          {modal.tipo === "estado" ? <p className="text-sm text-slate-600">{modal.producto.activo === "S" ? <>¿Desactivar <strong>{modal.producto.nombre}</strong>? Dejará de aparecer en el catálogo de compras. Puedes activarlo de nuevo después.</> : <>¿Activar <strong>{modal.producto.nombre}</strong> para mostrarlo en el catálogo de compras?</>}</p> :
            <fieldset disabled={guardando} className="space-y-4">
              {!categorias.length && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Crea una categoría con «+ Nueva categoría» para continuar. Tus datos del producto se conservarán.</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">SKU <span className="text-red-500">*</span><input name="sku" required maxLength={40} defaultValue={editado?.sku || ""} readOnly={!!editado} className={`${inputClass} ${editado ? "bg-slate-50 text-slate-500" : ""}`} />{editado && <span className="mt-1 block text-xs font-normal text-slate-500">El SKU se conserva al editar.</span>}</label>
                <label className="text-sm font-medium">Categoría <span className="text-red-500">*</span><select name="categoria" required value={categoriaSeleccionada} onChange={e => setCategoriaSeleccionada(e.target.value)} className={inputClass}><option value="" disabled>Selecciona una categoría</option>{categorias.map(c => <option key={c.idCategoria} value={c.idCategoria}>{c.nombre}</option>)}</select><button type="button" onClick={() => setNuevaCategoria(true)} className="mt-2 text-sm font-semibold text-amber-700 underline">+ Nueva categoría</button></label>
              </div>
              <label className="block text-sm font-medium">Nombre <span className="text-red-500">*</span><input name="nombre" required maxLength={150} defaultValue={editado?.nombre || ""} className={inputClass} /></label>
              <label className="block text-sm font-medium">Descripción<textarea name="descripcion" maxLength={1000} rows={3} defaultValue={editado?.descripcion || ""} className={inputClass} /></label>
              <label className="block text-sm font-medium">Precio base (Q) <span className="text-red-500">*</span><input name="precio" type="number" required min="0" max="9999999999.99" step="0.01" defaultValue={editado?.precioBase ?? ""} className={inputClass} /></label>
              <div className="rounded-xl bg-slate-50 p-4"><p className="mb-3 text-sm font-medium">Personalización permitida</p><div className="flex flex-wrap gap-6">{(["A", "B"] as const).map(lado => <label key={lado} className="flex items-center gap-2 text-sm text-slate-600"><input name={`lado${lado}`} type="checkbox" defaultChecked={!editado || editado[lado === "A" ? "permiteLadoA" : "permiteLadoB"] === "S"} className="h-4 w-4 accent-amber-500" />Lado {lado}</label>)}</div></div>
            </fieldset>}
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={cerrar} disabled={guardando} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={guardando || (modal.tipo !== "estado" && !categoriaSeleccionada)} className={buttonClass}>{guardando ? "Guardando…" : modal.tipo === "estado" ? titulo : modal.tipo === "crear" ? "Crear producto" : "Guardar cambios"}</button>
          </div>
        </form>
      </dialog>}
      {nuevaCategoria && <NuevaCategoriaModal onClose={() => setNuevaCategoria(false)} onCreated={categoria => {
        setCategorias(prev => [...prev.filter(c => c.idCategoria !== categoria.idCategoria), categoria]);
        setCategoriaSeleccionada(String(categoria.idCategoria));
        setNuevaCategoria(false);
        setErrorModal("");
        setAviso("Categoría creada. Completa los datos del producto para continuar.");
        if (!modal) setModal({ tipo: "crear" });
      }} />}
    </div>
  );
}
