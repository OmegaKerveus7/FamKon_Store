import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  MENU_GROUPS,
  LOGOUT_ITEM,
  ChevronDown,
  ChevronRight,
  type MenuGroup,
} from "./dashboardMenu";

function grupoHabilitado(
  grupo: MenuGroup,
  tieneRol: (rol: string) => boolean,
  esAdmin: boolean,
): boolean {
  if (esAdmin) return true;
  if (!grupo.codigoRol) return true;
  return tieneRol(grupo.codigoRol);
}

export default function Sidebar({
  colapsado,
  onToggle,
}: {
  colapsado: boolean;
  onToggle: () => void;
}) {
  const { usuario, tienePermiso, tieneRol, cerrarSesion } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const esAdmin = tieneRol("ADMIN");

  const gruposVisibles = MENU_GROUPS.filter((g) =>
    grupoHabilitado(g, tieneRol, esAdmin),
  );

  const gruposConItems = gruposVisibles
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => {
        if (esAdmin) return true;
        if (!i.codigo) return true;
        return tienePermiso(i.codigo);
      }),
    }))
    .filter((g) => g.items.length > 0);

  const grupoActivo = gruposConItems.find((g) =>
    g.items.some(
      (i) =>
        i.path !== "/inicio" &&
        location.pathname.startsWith(i.path.split("?")[0]),
    ),
  );

  const [abiertos, setAbiertos] = useState<Record<string, boolean>>(() => {
    const inicial: Record<string, boolean> = {};
    for (const g of gruposConItems) {
      inicial[g.id] = true;
    }
    if (grupoActivo) inicial[grupoActivo.id] = true;
    return inicial;
  });

  function toggleGrupo(id: string) {
    setAbiertos((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleLogout() {
    cerrarSesion();
    navigate("/login", { replace: true });
  }

  // ─── Modo colapsado: solo iconos de GRUPO con tooltip ──────────────────────
  if (colapsado) {
    return (
      <aside className="flex w-16 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-center border-b border-slate-200">
          <button
            onClick={onToggle}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            title="Expandir menu"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          <ul className="flex flex-col items-center gap-1">
            {gruposConItems.map((g) => {
              const GIcon = g.icon;
              const activo = grupoActivo?.id === g.id;
              return (
                <li key={g.id} className="group relative">
                  <button
                    onClick={() => {
                      // Expandir y navegar al primer item del grupo
                      onToggle();
                      setAbiertos((prev) => ({ ...prev, [g.id]: true }));
                      navigate(g.items[0].path);
                    }}
                    className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
                      activo
                        ? "bg-amber-100 text-amber-700"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    }`}
                    title={g.label}
                  >
                    <GIcon size={20} />
                  </button>

                  <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition group-hover:opacity-100">
                    {g.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-slate-200 p-2">
          <button
            onClick={handleLogout}
            className="group relative flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-red-50 hover:text-red-600"
            title="Cerrar sesion"
          >
            <LOGOUT_ITEM.icon size={20} />
            <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition group-hover:opacity-100">
              Cerrar sesion
            </span>
          </button>
        </div>
      </aside>
    );
  }

  // ─── Modo expandido: grupos con subitems colapsables ───────────────────────
  return (
    <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-4">
        <img
          src="/images/logo-famkon.png"
          alt="FamKon"
          className="h-9 w-9 object-contain"
        />
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-900">FamKon</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-400">
            {usuario?.roles || "Tienda"}
          </p>
        </div>
        <button
          onClick={onToggle}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          title="Colapsar menu"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {gruposConItems.map((g) => {
          const GIcon = g.icon;
          const abierto = abiertos[g.id] ?? true;
          return (
            <div key={g.id} className="mb-1">
              <button
                onClick={() => toggleGrupo(g.id)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <GIcon size={14} />
                <span className="flex-1">{g.label}</span>
                <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-500">
                  {g.items.length}
                </span>
              </button>
              {abierto && (
                <ul className="mt-1 space-y-0.5 pl-2">
                  {g.items.map((it) => {
                    const Icon = it.icon;
                    return (
                      <li key={`${g.id}-${it.path}-${it.label}`}>
                        <NavLink
                          to={it.path}
                          end={it.path === "/inicio"}
                          className={({ isActive }) =>
                            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                              isActive
                                ? "bg-amber-500 font-semibold text-slate-900"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            }`
                          }
                        >
                          <Icon size={16} />
                          <span>{it.label}</span>
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600"
        >
          <LOGOUT_ITEM.icon size={16} />
          <span>Cerrar sesion</span>
        </button>
      </div>
    </aside>
  );
}
