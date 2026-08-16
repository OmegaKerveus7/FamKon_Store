import { useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ScanFace, Loader2, ArrowLeft, UserRound } from "lucide-react";
import { loginFacial, stripBase64Prefix } from "../api/famkon";
import { useAuth } from "../context/AuthContext";
import CameraCapture, { type CameraCaptureHandle } from "../components/CameraCapture";

export default function FacialLoginPage() {
  const navigate = useNavigate();
  const { iniciarSesion } = useAuth();
  const camaraRef = useRef<CameraCaptureHandle>(null);
  const [identificacion, setIdentificacion] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function handleVerificar() {
    if (!identificacion.trim()) {
      setError("Ingresa tu correo o nombre de usuario para identificarte.");
      return;
    }
    const dataUrl = camaraRef.current?.capturar();
    if (!dataUrl) {
      setError("Activa la cámara y asegúrate de estar frente a ella.");
      return;
    }
    setCargando(true);
    setError("");
    try {
      const usuario = await loginFacial({
        identificacion: identificacion.trim(),
        imagenCompararBase64: stripBase64Prefix(dataUrl),
      });
      camaraRef.current?.apagar();
      iniciarSesion(usuario);
      navigate("/inicio", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo verificar el rostro.");
    } finally {
      setCargando(false);
    }
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
            <h1 className="text-lg font-bold text-slate-900">Reconocimiento Facial</h1>
            <p className="text-sm text-slate-500">Verifica tu identidad con tu rostro</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="identificacion" className="text-sm font-medium text-slate-700">
              Correo o usuario
            </label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="identificacion"
                value={identificacion}
                onChange={(e) => setIdentificacion(e.target.value)}
                placeholder="correo@ejemplo.com o usuario"
                autoComplete="username"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              />
            </div>
          </div>

          <CameraCapture ref={camaraRef} />

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>
          )}

          <button
            type="button"
            onClick={handleVerificar}
            disabled={cargando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanFace className="h-4 w-4" />}
            {cargando ? "Verificando..." : "Verificar y entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}