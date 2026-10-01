import { useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { loginCarnet } from "../api/famkon";
import { useAuth } from "../context/AuthContext";
import QrScanner from "../components/QrScanner";

export default function CarnetLoginPage() {
  const enCurso = useRef(false);
  const navigate = useNavigate();
  const { iniciarSesion } = useAuth();
  const [qrDetectado, setQrDetectado] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function handleEntrar(opts: { codigoQr?: string; identificacion?: string }) {
    if(enCurso.current)return;
    if(!/^[a-f0-9]{64}$/i.test(opts.codigoQr?.trim() ?? "")){setError("Usa el QR de acceso de tu carnet vigente. El QR de seguimiento y el número de comprador no permiten iniciar sesión.");return;}
    enCurso.current=true;
    setCargando(true);
    setError("");
    try {
      const respuesta = await loginCarnet(opts);
      if (!respuesta.usuario || !respuesta.token) {
        throw new Error(respuesta.mensaje || "No se pudo reconocer el carnet.");
      }
      iniciarSesion(respuesta.usuario, respuesta.token);
      navigate("/inicio", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reconocer el carnet.");
    } finally {
      enCurso.current=false;
      setCargando(false);
    }
  }

  function handleQr(text: string) {
    setQrDetectado(text);
    void handleEntrar({ codigoQr: text });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-amber-50 via-orange-100 to-slate-100 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <Link
            to="/login"
            className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100"
            aria-label="Volver al login"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <img src="/images/logo-famkon.png" alt="Logo FamKon" className="h-12 w-12 object-contain" />
          <div>
            <h1 className="text-lg font-bold text-slate-900">Por Carnet (QR)</h1>
            <p className="text-sm text-slate-500">Muestra el QR de tu carnet a la cámara para ingresar</p>
          </div>
        </div>

        <div className="space-y-4">
          {qrDetectado ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="truncate">Credencial detectada</span>
              </div>
              <button
                type="button"
                disabled={cargando}
                onClick={() => {setQrDetectado("");setError("");}}
                className="text-xs font-semibold text-emerald-700 underline hover:text-emerald-900"
              >
                Volver a escanear
              </button>
            </div>
          ) : (
            <QrScanner onDetected={handleQr} />
          )}

          {cargando && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Verificando carnet…</p>}
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        </div>
      </div>
    </div>
  );
}