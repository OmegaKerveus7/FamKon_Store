import { useNavigate } from "react-router-dom";
import { LogOut, Store } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function HomePage() {
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();

  function handleSalir() {
    cerrarSesion();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-linear-to-br from-amber-50 via-orange-100 to-slate-100">
      <header className="flex items-center justify-between border-b border-white/60 bg-white/70 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <img src="/images/logo-famkon.png" alt="Logo FamKon" className="h-10 w-10 object-contain" />
          <span className="text-lg font-bold text-slate-900">FamKon</span>
        </div>
        <button
          onClick={handleSalir}
          className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
        >
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <Store className="h-12 w-12 text-amber-600" />
        <h1 className="text-3xl font-bold text-slate-900">¡Bienvenido, {usuario?.nombre}!</h1>
        <p className="text-sm text-slate-600">
          Has iniciado sesión correctamente en la tienda FamKon.
        </p>
        <div className="mt-2 w-full max-w-md space-y-2 rounded-2xl bg-white/80 p-6 text-left text-sm text-slate-700 shadow">
          <p>
            <span className="font-semibold">Correo:</span> {usuario?.correo ?? "—"}
          </p>
          <p>
            <span className="font-semibold">Nickname:</span> {usuario?.nickname ?? "—"}
          </p>
          <p>
            <span className="font-semibold">Rol:</span> {usuario?.rol}
          </p>
        </div>
        <p className="text-xs text-slate-400">
          Aquí se construirá el catálogo y la tienda de FamKon.
        </p>
      </main>
    </div>
  );
}