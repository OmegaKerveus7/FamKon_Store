import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ScanFace, QrCode, LogIn, Loader2, Eye, EyeOff, Mail, Lock } from "lucide-react";
import { login } from "../api/famkon";
import { useAuth } from "../context/AuthContext";

function rutaInicialPorRol(roles: string): string {
  const superiores = roles.split(",").map((r) => r.trim().toUpperCase());
  const orden = ["ADMIN", "SUPERVISOR", "REPARTIDOR", "COMPRADOR"];
  for (const r of orden) {
    if (superiores.includes(r)) return "/inicio";
  }
  return "/inicio";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { iniciarSesion, cargarPermisos } = useAuth();
  const [identificador, setIdentificador] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const valor = identificador.trim();
    if (!valor || !contrasena) {
      setError("Ingresa tu correo o usuario y tu contrasena.");
      return;
    }
    setCargando(true);
    setError("");
    try {
      const esCorreo = valor.includes("@");
      const respuesta = await login(
        esCorreo ? valor : undefined,
        esCorreo ? undefined : valor,
        contrasena
      );
      if (!respuesta.usuario || !respuesta.token) {
        throw new Error(respuesta.mensaje || "No se pudo iniciar sesion.");
      }
      iniciarSesion(respuesta.usuario, respuesta.token);
      await cargarPermisos();

      const roles = respuesta.usuario.roles ?? "COMPRADOR";
      const volverA = state?.volverA;
      navigate(typeof volverA === 'string' && /^\/comprador\/tracking\?pedido=\d+$/.test(volverA) ? volverA : rutaInicialPorRol(roles), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesion.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-linear-to-br from-amber-50 via-orange-100 to-slate-100 p-3 sm:p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl sm:rounded-3xl lg:grid-cols-2">
        <div className="hidden min-w-0 flex-col items-center justify-center gap-6 bg-linear-to-br from-white to-amber-50 p-10 lg:flex">
          <img
            src="/images/slogan-famkon.png"
            alt="FamKon"
            className="w-full max-w-sm mix-blend-multiply"
          />
          <p className="text-center text-sm font-medium text-slate-500">
            Bienvenido a la tienda en linea de FamKon
          </p>
        </div>

        <div className="flex min-w-0 flex-col justify-center gap-5 p-5 sm:gap-6 sm:p-8 lg:p-12">
          <div className="flex flex-col items-center gap-2 sm:gap-3 lg:items-start">
            <img src="/images/logo-famkon.png" alt="Logo FamKon" className="h-14 w-14 object-contain sm:h-20 sm:w-20" />
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Iniciar sesion</h1>
            <p className="text-sm text-slate-500">Accede con tu cuenta de FamKon</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {state?.passwordUpdated && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Contraseña actualizada. Ingresa con tu nueva contraseña.</p>}
            <div className="space-y-1">
              <label htmlFor="identificador" className="text-sm font-medium text-slate-700">
                Correo o usuario
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="identificador"
                  value={identificador}
                  onChange={(e) => setIdentificador(e.target.value)}
                  placeholder="correo@ejemplo.com o usuario"
                  autoComplete="username"
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="contrasena" className="text-sm font-medium text-slate-700">
                Contrasena
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="contrasena"
                  type={mostrar ? "text" : "password"}
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  placeholder="********"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                />
                <button
                  type="button"
                  onClick={() => setMostrar((m) => !m)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Mostrar u ocultar contrasena"
                >
                  {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Link to="/recuperar-contrasena" state={{ identificador }} className="block text-right text-sm font-semibold text-amber-700 hover:underline">¿Olvidaste tu contraseña?</Link>

            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={cargando}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {cargando ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
              <p className="text-center text-sm text-slate-500">
                  Aun no tienes una cuenta?{" "}
                 <button
                   type="button"
                    onClick={() => navigate("/registro")}
                    className="font-semibold text-amber-600 hover:text-amber-700 hover:underline"
                  >
                    Crear cuenta
                  </button>
                </p>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">o accede con</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <button
              onClick={() => navigate("/login/facial")}
              className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-slate-200 px-2 py-3 text-center text-xs font-semibold text-slate-700 transition hover:border-amber-400 hover:bg-amber-50 sm:px-4 sm:py-4 sm:text-sm"
            >
              <ScanFace className="h-6 w-6 text-amber-600" />
              Reconocimiento Facial
            </button>
            <button
              onClick={() => navigate("/login/carnet")}
              className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-slate-200 px-2 py-3 text-center text-xs font-semibold text-slate-700 transition hover:border-amber-400 hover:bg-amber-50 sm:px-4 sm:py-4 sm:text-sm"
            >
              <QrCode className="h-6 w-6 text-amber-600" />
              Por Carnet (QR)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
