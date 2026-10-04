import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import { checkEstado } from "../api/famkon";

export default function IndexPage() {
  const navigate = useNavigate();
  const [mensaje, setMensaje] = useState("Verificando conexión con el servidor...");
  const [error, setError] = useState(false);

  useEffect(() => {
    let activo = true;
    const timeoutId = setTimeout(() => {
      if (activo && !error) {
        navigate("/login", { replace: true });
      }
    }, 8000);

    void (async () => {
      try {
        const { ok } = await checkEstado();
        if (!activo) return;
        clearTimeout(timeoutId);
        if (ok) {
          navigate("/login", { replace: true });
        } else {
          setError(true);
          setMensaje("No se puede comunicar con el servidor. Inténtalo más tarde.");
        }
      } catch {
        if (!activo) return;
        clearTimeout(timeoutId);
        navigate("/login", { replace: true });
      }
    })();
    return () => {
      activo = false;
      clearTimeout(timeoutId);
    };
  }, [navigate, error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-linear-to-br from-amber-50 via-orange-100 to-slate-100 p-4">
      <img src="/images/logo-famkon.png" alt="Logo FamKon" className="h-24 w-24 object-contain" />
      {error ? (
        <>
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <p className="text-center text-sm font-medium text-red-600">{mensaje}</p>
          <button
            onClick={() => navigate("/login", { replace: true })}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
          >
            Ir al login <ArrowRight className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
          <p className="text-center text-sm font-medium text-slate-600">{mensaje}</p>
        </>
      )}
    </div>
  );
}