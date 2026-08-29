import { useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ScanFace, Loader2, ArrowLeft, UserRound, Camera, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { loginFacial, stripBase64Prefix, actualizarFoto } from "../api/famkon";
import { useAuth } from "../context/AuthContext";
import CameraCapture, { type CameraCaptureHandle } from "../components/CameraCapture";

export default function FacialLoginPage() {
  const navigate = useNavigate();
  const { iniciarSesion } = useAuth();
  const camaraRef = useRef<CameraCaptureHandle>(null);
  const camaraActualizarRef = useRef<CameraCaptureHandle>(null);
  const [identificacion, setIdentificacion] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const [mostrarActualizar, setMostrarActualizar] = useState(false);
  const [correoActualizar, setCorreoActualizar] = useState("");
  const [contrasenaActualizar, setContrasenaActualizar] = useState("");
  const [cargandoActualizar, setCargandoActualizar] = useState(false);
  const [exitoActualizar, setExitoActualizar] = useState("");
  const [errorActualizar, setErrorActualizar] = useState("");

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

  async function handleActualizarFoto() {
    if (!correoActualizar.trim()) {
      setErrorActualizar("Ingresa tu correo electrónico.");
      return;
    }
    if (!contrasenaActualizar) {
      setErrorActualizar("Ingresa tu contraseña.");
      return;
    }
    const dataUrl = camaraActualizarRef.current?.capturar();
    if (!dataUrl) {
      setErrorActualizar("Activa la cámara y toma una foto para actualizar.");
      return;
    }
    setCargandoActualizar(true);
    setErrorActualizar("");
    setExitoActualizar("");
    try {
      const usuario = await actualizarFoto({
        correo: correoActualizar.trim(),
        contrasena: contrasenaActualizar,
        fotoOriginalBase64: stripBase64Prefix(dataUrl),
      });
      camaraActualizarRef.current?.apagar();
      setExitoActualizar("Foto actualizada correctamente. Ahora intenta el login facial de nuevo.");
      iniciarSesion(usuario);
      setCorreoActualizar("");
      setContrasenaActualizar("");
    } catch (err) {
      setErrorActualizar(err instanceof Error ? err.message : "No se pudo actualizar la foto.");
    } finally {
      setCargandoActualizar(false);
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

          {/* Sección para actualizar foto */}
          <div className="border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => {
                setMostrarActualizar(!mostrarActualizar);
                setErrorActualizar("");
                setExitoActualizar("");
              }}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-amber-300 hover:bg-amber-50"
            >
              <span className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-amber-500" />
                ¿No funciona? Actualiza tu foto
              </span>
              {mostrarActualizar ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {mostrarActualizar && (
              <div className="mt-3 space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <p className="text-xs text-slate-500">
                  Si el reconocimiento facial no te reconoce, puedes actualizar tu foto de perfil ingresando tus credenciales.
                </p>

                <div className="space-y-1">
                  <label htmlFor="correo-actualizar" className="text-sm font-medium text-slate-700">
                    Correo electrónico
                  </label>
                  <input
                    id="correo-actualizar"
                    type="email"
                    value={correoActualizar}
                    onChange={(e) => setCorreoActualizar(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="contrasena-actualizar" className="text-sm font-medium text-slate-700">
                    Contraseña
                  </label>
                  <input
                    id="contrasena-actualizar"
                    type="password"
                    value={contrasenaActualizar}
                    onChange={(e) => setContrasenaActualizar(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                </div>

                <CameraCapture ref={camaraActualizarRef} />

                {errorActualizar && (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{errorActualizar}</p>
                )}

                {exitoActualizar && (
                  <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-600 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {exitoActualizar}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleActualizarFoto}
                  disabled={cargandoActualizar}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cargandoActualizar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  {cargandoActualizar ? "Actualizando..." : "Actualizar foto"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
