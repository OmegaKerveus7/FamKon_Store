import { Menu, Bell, ChevronRight, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

function rolColor(roles: string | null | undefined): string {
  const r = (roles ?? "").toUpperCase();
  if (r.includes("ADMIN"))      return "bg-red-100 text-red-700";
  if (r.includes("SUPERVISOR")) return "bg-purple-100 text-purple-700";
  if (r.includes("REPARTIDOR")) return "bg-blue-100 text-blue-700";
  if (r.includes("COMPRADOR"))  return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function colorAvatar(roles: string | null | undefined): string {
  const r = (roles ?? "").toUpperCase();
  if (r.includes("ADMIN"))      return "from-red-500 to-orange-500";
  if (r.includes("SUPERVISOR")) return "from-purple-500 to-indigo-500";
  if (r.includes("REPARTIDOR")) return "from-blue-500 to-cyan-500";
  if (r.includes("COMPRADOR"))  return "from-amber-500 to-orange-500";
  return "from-slate-500 to-slate-700";
}

function iniciales(nickname: string | null | undefined, correo: string | null | undefined): string {
  const src = (nickname ?? correo ?? "?").trim();
  if (!src) return "?";
  const partes = src.split(/[\s._-]+/).filter(Boolean);
  if (partes.length >= 2) {
    return (partes[0][0] + partes[1][0]).toUpperCase();
  }
  return src.substring(0, 2).toUpperCase();
}

export default function Topbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { usuario, permisos, refrescarPermisos } = useAuth();
  const location = useLocation();
  const [refrescando, setRefrescando] = useState(false);

  const rolPrincipal = (usuario?.roles ?? "").split(",")[0]?.trim() || "USUARIO";
  const seg = location.pathname.split("/").filter(Boolean);
  const breadcrumb = seg.length === 0
    ? "Inicio"
    : seg.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" / ");

  async function handleRefreshPermisos() {
    setRefrescando(true);
    try {
      await refrescarPermisos();
    } finally {
      setTimeout(() => setRefrescando(false), 400);
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-6">
      <button
        onClick={onToggleSidebar}
        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        title="Alternar menu"
      >
        <Menu size={20} />
      </button>

      <div className="hidden flex-1 items-center gap-2 text-sm text-slate-500 sm:flex">
        <Link to="/inicio" className="hover:text-slate-800">Inicio</Link>
        {breadcrumb !== "Inicio" && (
          <>
            <ChevronRight size={14} className="text-slate-300" />
            <span className="font-medium text-slate-700">{breadcrumb}</span>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={handleRefreshPermisos}
          disabled={refrescando}
          className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:flex"
          title="Refrescar mis permisos desde la base de datos"
        >
          <RefreshCw
            size={14}
            className={refrescando ? "animate-spin" : ""}
          />
          <span>{permisos.length} permiso{permisos.length === 1 ? "" : "s"}</span>
        </button>

        <button
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          title="Notificaciones"
        >
          <Bell size={18} />
        </button>

        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-1.5">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${colorAvatar(usuario?.roles)} text-sm font-bold text-white shadow-sm`}
          >
            {iniciales(usuario?.nickname, usuario?.correo)}
          </div>
          <div className="hidden text-left leading-tight sm:block">
            <p className="text-sm font-semibold text-slate-900">
              {usuario?.nickname ?? "Invitado"}
            </p>
            <p className="text-[10px] text-slate-500">{usuario?.correo ?? ""}</p>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${rolColor(rolPrincipal)}`}
          >
            {rolPrincipal}
          </span>
        </div>
      </div>
    </header>
  );
}
