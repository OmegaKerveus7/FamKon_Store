import { Boxes, Plus, Pencil, PowerOff } from "lucide-react";

export default function AdminProductosPage() {
  const productos = [
    { id: 1, sku: "AN-001", nombre: "Anillo clasico", categoria: "Anillos", precio: 120, activo: "S" },
    { id: 2, sku: "LL-002", nombre: "Llavero personalizado", categoria: "Llaveros", precio: 65, activo: "S" },
    { id: 3, sku: "TZ-003", nombre: "Taza ceramica", categoria: "Tazas", precio: 85, activo: "S" },
    { id: 4, sku: "AN-004", nombre: "Anillo vintage", categoria: "Anillos", precio: 150, activo: "N" },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Boxes className="h-6 w-6 text-amber-600" />
            Gestor de Productos
          </h1>
          <p className="text-sm text-slate-500">
            Crear, actualizar y desactivar productos del catalogo.
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-400">
          <Plus className="h-4 w-4" /> Nuevo producto
        </button>
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Precio base</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {productos.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.sku}</td>
                <td className="px-4 py-3 font-semibold text-slate-800">{p.nombre}</td>
                <td className="px-4 py-3 text-slate-600">{p.categoria}</td>
                <td className="px-4 py-3 font-semibold text-amber-600">
                  Q{p.precio.toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  {p.activo === "S" ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Activo
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                      Inactivo
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      className="rounded-lg border border-red-200 p-2 text-red-500 transition hover:bg-red-50"
                      title="Desactivar"
                    >
                      <PowerOff className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-center text-xs text-slate-400">
        Modulo en construccion - conecta con PKG_CATALOGO.SP_CREAR_PRODUCTO / SP_ACTUALIZAR_PRODUCTO / SP_CAMBIAR_ESTADO_PRODUCTO.
      </p>
    </div>
  );
}
