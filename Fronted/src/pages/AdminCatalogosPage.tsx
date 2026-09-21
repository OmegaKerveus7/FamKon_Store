import { Boxes, Tag, MapPin, CreditCard } from "lucide-react";

const catalogos = [
  {
    icon: Boxes,
    titulo: "Productos",
    descripcion: "Gestionar el catalogo de productos.",
    color: "from-amber-400 to-orange-500",
    items: ["Anillos", "Llaveros", "Tazas"],
  },
  {
    icon: Tag,
    titulo: "Categorias",
    descripcion: "Administrar las categorias de producto.",
    color: "from-purple-400 to-fuchsia-500",
    items: ["ANILLOS", "LLAVEROS", "TAZAS"],
  },
  {
    icon: MapPin,
    titulo: "Areas de entrega",
    descripcion: "Zonas geograficas donde se entrega.",
    color: "from-blue-400 to-indigo-500",
    items: ["Centro", "Norte", "Sur", "Oriente", "Occidente"],
  },
  {
    icon: CreditCard,
    titulo: "Metodos de pago",
    descripcion: "Efectivo, tarjeta y otros medios aceptados.",
    color: "from-emerald-400 to-teal-500",
    items: ["EFECTIVO", "TARJETA"],
  },
];

export default function AdminCatalogosPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Boxes className="h-6 w-6 text-amber-600" />
          Catalogos
        </h1>
        <p className="text-sm text-slate-500">
          Productos, categorias, areas de entrega y metodos de pago.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {catalogos.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.titulo}
              className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div
                className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${c.color} opacity-15`}
              />
              <div
                className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${c.color} text-white shadow-sm`}
              >
                <Icon size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-900">{c.titulo}</h3>
              <p className="mt-1 text-xs text-slate-500">{c.descripcion}</p>

              <div className="mt-4 flex flex-wrap gap-1">
                {c.items.map((it) => (
                  <span
                    key={it}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                  >
                    {it}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-slate-400">
        Modulo en construccion - conecta con PKG_CATALOGO (SP_LISTAR_PRODUCTOS, SP_LISTAR_CATEGORIAS, SP_LISTAR_AREAS_ENTREGA, SP_LISTAR_METODOS_PAGO).
      </p>
    </div>
  );
}
