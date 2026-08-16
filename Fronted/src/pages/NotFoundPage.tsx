import { Link } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-linear-to-br from-amber-50 via-orange-100 to-slate-100 p-4 text-center">
      <p className="text-7xl font-black text-amber-500">404</p>
      <h1 className="text-2xl font-bold text-slate-900">Página no encontrada</h1>
      <p className="max-w-md text-sm text-slate-500">
        La página que buscas no existe o hubo un problema con la conexión al servidor.
      </p>
      <div className="flex gap-3">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-amber-400"
        >
          <Home className="h-4 w-4" /> Ir al inicio
        </Link>
        <Link
          to="/login"
          className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al login
        </Link>
      </div>
    </div>
  );
}