import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { checkEstado } from "../api/famkon";

export default function IndexPage() {
  const navigate = useNavigate();
  const [mensaje, setMensaje] = useState("Verificando conexión con la API...");
  const [error, setError] = useState(false);

  useEffect(() => {
    let activo = true;
    void (async () => {
      const { ok } = await checkEstado();
      if (!activo) return;
      if (ok) {
        navigate("/login", { replace: true });
      } else {
        setError(true);
        setMensaje("No se puede comunicar con el servicio. Inténtalo más tarde.");
      }
    })();
    return () => {
      activo = false;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-linear-to-br from-amber-50 via-orange-100 to-slate-100 p-4">
      <img src="/images/logo-famkon.png" alt="Logo FamKon" className="h-24 w-24 object-contain" />
      {error ? (
        <AlertTriangle className="h-8 w-8 text-red-500" />
      ) : (
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      )}
      <p className="text-center text-sm font-medium text-slate-600">{mensaje}</p>
    </div>
  );
}