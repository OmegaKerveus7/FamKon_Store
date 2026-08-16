import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { QrCode, Loader2, ArrowLeft, Hash, CheckCircle2 } from "lucide-react";
import { loginCarnet } from "../api/famkon";
import { useAuth } from "../context/AuthContext";
import QrScanner from "../components/QrScanner";

export default function CarnetLoginPage() {
  const navigate = useNavigate();
  const { iniciarSesion } = useAuth();
  const [identificacion, setIdentificacion] = useState("");
  const [qrDetectado, setQrDetectado] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function handleEntrar(opts: { codigoQr?: string; identificacion?: string }) {
    setCargando(true);
    setError("");
    try {
      const usuario = await loginCarnet(opts);
      iniciarSesion(usuario);
      navigate("/inicio", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reconocer el carnet.");
    } finally {
      setCargando(false);
    }
  }

  function handleQr(text: string) {
    setQrDetectado(text);
    void handleEntrar({ codigoQr: text });
  }

  function handleManual(e: FormEvent) {
    e.preventDefault();
    if (!identificacion.trim()) {
      setError("Ingresa tu identificación o escanea el QR del carnet.");
      return;
    }
    void handleEntrar({ identificacion: identificacion.trim() });
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
            <p className="text-sm text-slate-500">Escanea el QR de tu carnet o ingresa tu identificación</p>
          </div>
        </div>

        <div className="space-y-4">
          {qrDetectado ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="truncate">QR: {qrDetectado}</span>
              </div>
              <button
                type="button"
                onClick={() => setQrDetectado("")}
                className="text-xs font-semibold text-emerald-700 underline hover:text-emerald-900"
              >
                Volver a escanear
              </button>
            </div>
          ) : (
            <QrScanner onDetected={handleQr} />
          )}

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">o manual</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={handleManual} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="identificacion" className="text-sm font-medium text-slate-700">
                Identificación
              </label>
              <div className="relative">
                <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="identificacion"
                  value={identificacion}
                  onChange={(e) => setIdentificacion(e.target.value)}
                  placeholder="Número de identificación"
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={cargando}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
              {cargando ? "Verificando..." : "Entrar con carnet"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}