import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogIn, UserPlus, X } from "lucide-react";

interface Props {
  /** Ruta a la que se vuelve después de iniciar sesión o crear la cuenta. */
  destino?: string;
  /** Texto principal que explica por qué se pide iniciar sesión. */
  titulo?: string;
  descripcion?: string;
  onCancelar?: () => void;
}

/**
 * Aviso que se muestra cuando el visitante sin sesión intenta pagar.
 * Ofrece las dos opciones: iniciar sesión o crear una cuenta.
 * En ambos casos se conserva el destino para continuar la compra.
 */
export default function AccesoRequerido({
  destino,
  titulo = "Iniciá sesión para completar tu compra",
  descripcion = "Tu carrito quedó guardado en este dispositivo. Al entrar con tu cuenta recuperás todo y continuás con el pago.",
  onCancelar,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const volverA = destino ?? `${location.pathname}${location.search}`;

  return (
    <section
      role="alert"
      className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900">{titulo}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{descripcion}</p>
        </div>
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            aria-label="Cerrar aviso"
            className="rounded-lg p-1 text-slate-400 transition hover:bg-white hover:text-slate-700"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => navigate("/login", { state: { volverA } })}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <LogIn size={18} />
          Iniciar sesión
        </button>
        <button
          type="button"
          onClick={() => navigate("/registro", { state: { volverA } })}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
        >
          <UserPlus size={18} />
          Crear cuenta
        </button>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        ¿Solo querés seguir mirando?{" "}
        <Link to="/catalogo" className="font-semibold text-amber-700 hover:underline">
          Volver al catálogo
        </Link>
      </p>
    </section>
  );
}
