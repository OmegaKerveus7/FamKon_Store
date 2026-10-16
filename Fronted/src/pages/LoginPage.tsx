import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ScanFace, QrCode, Loader2, Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react";
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
    if (cargando) return;
    const valor = identificador.trim();
    if (!valor || !contrasena) {
      setError("Ingresa tu correo o usuario y tu contraseña.");
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
        throw new Error(respuesta.mensaje || "No se pudo iniciar sesión.");
      }
      iniciarSesion(respuesta.usuario, respuesta.token);
      await cargarPermisos();

      const roles = respuesta.usuario.roles ?? "COMPRADOR";
      const volverA = state?.volverA;
      navigate(typeof volverA === 'string' && /^\/comprador\/tracking\?pedido=\d+$/.test(volverA) ? volverA : rutaInicialPorRol(roles), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-6 sm:px-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="hidden flex-col justify-center border-r border-amber-100 bg-amber-50/60 p-10 lg:flex">
          <img src="/images/slogan-famkon.png" alt="FamKon" className="mx-auto w-full max-w-sm object-contain mix-blend-multiply" />
          <div className="mt-8 text-center"><h2 className="text-2xl font-bold tracking-tight text-slate-900">Bienvenido a tu tienda</h2><p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-slate-600">Descubrí nuestros productos y consultá tus compras desde tu cuenta.</p></div>
          <div className="mx-auto mt-7 h-1 w-12 rounded-full bg-amber-500" aria-hidden="true" />
        </aside>
        <div className="flex flex-col justify-center gap-5 p-6 sm:p-9 lg:px-12">
          <div><img src="/images/slogan-famkon.png" alt="FamKon" className="mb-6 h-14 max-w-full object-contain object-left lg:hidden" /><p className="text-xs font-semibold uppercase tracking-widest text-amber-700">Bienvenido de nuevo</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Iniciá sesión</h1><p className="mt-2 text-sm text-slate-500">Ingresá con tu correo o nombre de usuario.</p></div>

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
                  required
                  autoCapitalize="none"
                  spellCheck={false}
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
                Contraseña
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="contrasena"
                  type={mostrar ? "text" : "password"}
                  required
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                />
                <button
                  type="button"
                  onClick={() => setMostrar((m) => !m)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={mostrar ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={mostrar}
                >
                  {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Link to="/recuperar-contrasena" state={{ identificador }} className="block text-right text-sm font-semibold text-amber-700 hover:underline">¿Olvidaste tu contraseña?</Link>

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={cargando}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-semibold text-slate-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {cargando ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
              <p className="text-center text-sm text-slate-500">
                  ¿Es tu primera visita?{" "}
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
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Otras formas de ingresar</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate("/login/facial")}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700 transition hover:border-amber-400 hover:bg-amber-50"
            >
              <ScanFace className="h-6 w-6 text-amber-600" />
              Acceso facial
            </button>
            <button
              onClick={() => navigate("/login/carnet")}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700 transition hover:border-amber-400 hover:bg-amber-50"
            >
              <QrCode className="h-6 w-6 text-amber-600" />
              Carnet QR
            </button>
          </div>
          <p className="-mt-2 text-center text-xs leading-relaxed text-slate-500">El acceso facial y QR requieren registro previo en tu cuenta.</p>
        </div>
      </div>
    </div>
  );
}
