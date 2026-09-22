import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  Loader2,
  UserPlus,
  Mail,
  MessageCircle,
  Send,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  Phone,
  Smartphone,
} from "lucide-react";
import CameraCapture, {
  type CameraCaptureHandle,
} from "../components/CameraCapture";
import {
  registrarComprador,
  enviarCodigoVerificacion,
  stripBase64Prefix,
  type CanalVerificacion,
} from "../api/famkon";

type Paso = "datos" | "verificar";

const MINUTOS_EXPIRACION = 5;

function generarCodigoOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function RegistroPage() {
  const navigate = useNavigate();
  const cameraRef = useRef<CameraCaptureHandle>(null);

  // ─── Estado del wizard ──────────────────────────────────────────
  const [paso, setPaso] = useState<Paso>("datos");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // ─── Paso 1: datos del usuario ──────────────────────────────────
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [nickname, setNickname] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [foto, setFoto] = useState("");

  // ─── Paso 2: verificación por código ────────────────────────────
  const [canal, setCanal] = useState<CanalVerificacion>("EMAIL");
  const [codigoEsperado, setCodigoEsperado] = useState<string>("");
  const [codigoIngresado, setCodigoIngresado] = useState("");
  const [codigoEnviadoEn, setCodigoEnviadoEn] = useState<number | null>(null);
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(0);
  const [codigoVerificado, setCodigoVerificado] = useState(false);

  // ─── Cronómetro de expiración del código (5 min) ────────────────
  useEffect(() => {
    if (codigoEnviadoEn === null || codigoVerificado) return;

    const intervalo = setInterval(() => {
      const expiracion = codigoEnviadoEn + MINUTOS_EXPIRACION * 60 * 1000;
      const restante = Math.max(0, Math.floor((expiracion - Date.now()) / 1000));
      setSegundosRestantes(restante);
      if (restante === 0) {
        setCodigoEsperado("");
        setCodigoEnviadoEn(null);
        setError("El código expiró. Solicita uno nuevo.");
        clearInterval(intervalo);
      }
    }, 1000);

    return () => clearInterval(intervalo);
  }, [codigoEnviadoEn, codigoVerificado]);

  // ─── Paso 1: handlers ───────────────────────────────────────────
  function capturarFoto() {
    const imagen = cameraRef.current?.capturar();
    if (!imagen) {
      setError("Primero activa la cámara.");
      return;
    }
    setFoto(imagen);
    setError("");
  }

  function validarPaso1(): string | null {
    if (!nombres.trim() || !apellidos.trim()) return "Nombres y apellidos son obligatorios.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return "Ingresa un correo válido.";
    if (!nickname.trim()) return "El nombre de usuario es obligatorio.";
    if (contrasena.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    if (contrasena !== confirmacion) return "Las contraseñas no coinciden.";
    if (!fechaNacimiento) return "La fecha de nacimiento es obligatoria.";
    if (!foto) return "Debes tomar una fotografía.";
    if (!/^\+?[0-9 ()-]{8,25}$/.test(telefono.trim()) || telefono.replace(/\D/g, "").length < 8 || telefono.replace(/\D/g, "").length > 15) {
      return "Ingresa un número de teléfono válido (incluye código de país).";
    }
    return null;
  }

  function irAPaso2(event: FormEvent) {
    event.preventDefault();
    setError("");
    const errorValidacion = validarPaso1();
    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }
    setPaso("verificar");
  }

  function volverAPaso1() {
    setPaso("datos");
    setError("");
    setMensaje("");
    setCodigoIngresado("");
    setCodigoVerificado(false);
  }

  // ─── Paso 2: handlers ───────────────────────────────────────────
  async function enviarCodigo() {
    setError("");
    setMensaje("");
    setCodigoIngresado("");

    const nuevoCodigo = generarCodigoOTP();
    const payload = {
      codigo: nuevoCodigo,
      correo: correo.trim(),
      telefono: telefono.trim() || undefined,
      canal,
    };
    console.log("[RegistroPage] enviarCodigo() → payload:", payload);

    setCodigoEsperado(nuevoCodigo);
    setCodigoEnviadoEn(Date.now());
    setCodigoVerificado(false);

    setEnviandoCodigo(true);
    try {
      const respuesta = await enviarCodigoVerificacion(payload);
      console.log("[RegistroPage] enviarCodigo() ← respuesta:", respuesta);

      if (respuesta.codigoS !== 200 && !respuesta.emailEnviado && !respuesta.whatsAppEnviado) {
        throw new Error(respuesta.mensaje || `Error ${respuesta.codigoS}`);
      }

      const canalesEnviados: string[] = [];
      if (respuesta.emailEnviado) canalesEnviados.push("correo");
      if (respuesta.whatsAppEnviado) canalesEnviados.push("WhatsApp");

      const canalesFallidos: string[] = [];
      if ((canal === "EMAIL" || canal === "AMBOS") && !respuesta.emailEnviado) {
        canalesFallidos.push("correo");
      }
      if ((canal === "WHATSAPP" || canal === "AMBOS") && !respuesta.whatsAppEnviado) {
        canalesFallidos.push("WhatsApp");
      }

      if (canalesEnviados.length > 0) {
        setMensaje(`Código enviado por ${canalesEnviados.join(" y ")}.`);
      }
      if (canalesFallidos.length > 0) {
        setError(`Falló el envío por: ${canalesFallidos.join(", ")}.`);
      }
    } catch (err) {
      console.error("[RegistroPage] enviarCodigo() error:", err);
      setCodigoEsperado("");
      setCodigoEnviadoEn(null);
      setError(err instanceof Error ? err.message : "No se pudo enviar el código.");
    } finally {
      setEnviandoCodigo(false);
    }
  }

  function verificarCodigoLocal() {
    setError("");
    if (!codigoEsperado) {
      setError("Primero solicita un código.");
      return;
    }
    if (segundosRestantes === 0) {
      setError("El código expiró. Solicita uno nuevo.");
      return;
    }
    if (codigoIngresado.trim() !== codigoEsperado) {
      setError("El código ingresado no coincide.");
      return;
    }
    setCodigoVerificado(true);
    setMensaje("¡Código verificado! Ahora puedes crear tu cuenta.");
  }

  async function handleCrearCuenta() {
    setError("");
    setMensaje("");

    if (!codigoVerificado) {
      setError("Debes verificar el código antes de crear la cuenta.");
      return;
    }

    setCargando(true);
    try {
      const fotoBase64 = stripBase64Prefix(foto);
      const resultado = await registrarComprador({
        nombres: nombres.trim(),
        telefono: telefono.trim(),
        apellidos: apellidos.trim(),
        correo: correo.trim(),
        contrasena,
        fechaNacimiento,
        nickname: nickname.trim(),
        fotoOriginalBase64: fotoBase64,
        fotoEditadaBase64: fotoBase64,
      });

      if (resultado.codigoS !== 200) {
        throw new Error(resultado.mensaje || "No fue posible crear la cuenta.");
      }

      setMensaje(resultado.mensaje);
      cameraRef.current?.apagar();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No fue posible registrar al comprador.",
      );
    } finally {
      setCargando(false);
    }
  }

  // ─── Formateo del cronómetro ────────────────────────────────────
  function formatoTiempo(seg: number): string {
    const m = Math.floor(seg / 60).toString().padStart(2, "0");
    const s = (seg % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-linear-to-br from-amber-50 via-orange-100 to-slate-100 p-4 py-10">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="border-b border-slate-200 p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <img
              src="/images/logo-famkon.png"
              alt="FamKon"
              className="h-16 w-16 object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Crear cuenta</h1>
              <p className="text-sm text-slate-500">
                Regístrate como comprador de FamKon
              </p>
            </div>
          </div>

          {/* Stepper */}
          <div className="mt-6 flex items-center gap-3 text-sm">
            <div
              className={`flex items-center gap-2 rounded-full px-3 py-1 ${
                paso === "datos"
                  ? "bg-amber-500 text-slate-900"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              <span className="font-bold">1</span>
              <span className="font-medium">Datos</span>
            </div>
            <div className="h-px flex-1 bg-slate-200" />
            <div
              className={`flex items-center gap-2 rounded-full px-3 py-1 ${
                paso === "verificar"
                  ? "bg-amber-500 text-slate-900"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              <span className="font-bold">2</span>
              <span className="font-medium">Verificación</span>
            </div>
          </div>
        </header>

        {paso === "datos" && (
          <form
            onSubmit={irAPaso2}
            className="grid gap-8 p-6 sm:p-8 md:grid-cols-2"
          >
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">
                Información personal
              </h2>

              <Campo
                id="nombres"
                label="Nombres"
                value={nombres}
                onChange={setNombres}
                autoComplete="given-name"
              />
              <Campo
                id="apellidos"
                label="Apellidos"
                value={apellidos}
                onChange={setApellidos}
                autoComplete="family-name"
              />
              <Campo
                id="correo"
                label="Correo electrónico"
                type="email"
                value={correo}
                onChange={setCorreo}
                autoComplete="email"
              />
              <Campo
                id="telefono"
                label="Teléfono (con código de país, ej. +502 1234 5678)"
                type="tel"
                value={telefono}
                onChange={setTelefono}
                autoComplete="tel"
              />
              <Campo
                id="nickname"
                label="Nombre de usuario"
                value={nickname}
                onChange={setNickname}
                autoComplete="username"
              />
              <Campo
                id="fechaNacimiento"
                label="Fecha de nacimiento"
                type="date"
                value={fechaNacimiento}
                onChange={setFechaNacimiento}
              />
              <Campo
                id="contrasena"
                label="Contraseña"
                type="password"
                value={contrasena}
                onChange={setContrasena}
                autoComplete="new-password"
                minLength={8}
              />
              <Campo
                id="confirmacion"
                label="Confirmar contraseña"
                type="password"
                value={confirmacion}
                onChange={setConfirmacion}
                autoComplete="new-password"
                minLength={8}
              />
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Fotografía</h2>

              <CameraCapture ref={cameraRef} />

              <button
                type="button"
                onClick={capturarFoto}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-50"
              >
                <Camera className="h-4 w-4" />
                Tomar fotografía
              </button>

              {foto && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">
                    Fotografía capturada
                  </p>
                  <img
                    src={foto}
                    alt="Fotografía capturada"
                    className="aspect-video w-full rounded-2xl border border-slate-200 object-cover"
                  />
                </div>
              )}

              <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
                <p className="font-medium text-slate-700">Canal de verificación</p>
                <p className="mt-1">
                  Te enviaremos un código de 6 dígitos para confirmar tu cuenta. Puedes recibirlo por
                  correo, WhatsApp o ambos.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <CanalOpcion
                    icono={<Mail className="h-4 w-4" />}
                    titulo="Correo"
                    activo={canal === "EMAIL"}
                    onClick={() => setCanal("EMAIL")}
                  />
                  <CanalOpcion
                    icono={<MessageCircle className="h-4 w-4" />}
                    titulo="WhatsApp"
                    activo={canal === "WHATSAPP"}
                    onClick={() => setCanal("WHATSAPP")}
                  />
                  <CanalOpcion
                    icono={<ShieldCheck className="h-4 w-4" />}
                    titulo="Ambos"
                    activo={canal === "AMBOS"}
                    onClick={() => setCanal("AMBOS")}
                  />
                </div>
              </div>

              {error && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-amber-400"
              >
                Continuar a verificación
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                Ya tengo una cuenta
              </button>
            </section>
          </form>
        )}

        {paso === "verificar" && (
          <div className="space-y-6 p-6 sm:p-8">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-base font-semibold text-slate-800">
                Confirma tus datos
              </h2>
              <dl className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Nombre</dt>
                  <dd className="font-medium text-slate-800">
                    {nombres} {apellidos}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Usuario</dt>
                  <dd className="font-medium text-slate-800">{nickname}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Correo</dt>
                  <dd className="font-medium text-slate-800">{correo}</dd>
                </div>
                {telefono && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Teléfono</dt>
                    <dd className="font-medium text-slate-800">{telefono}</dd>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Canal</dt>
                  <dd className="font-medium text-slate-800">
                    {canal === "EMAIL" && "Correo electrónico"}
                    {canal === "WHATSAPP" && "WhatsApp"}
                    {canal === "AMBOS" && "Correo electrónico y WhatsApp"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-amber-200 p-2 text-amber-800">
                  {canal === "WHATSAPP" ? (
                    <MessageCircle className="h-5 w-5" />
                  ) : canal === "AMBOS" ? (
                    <ShieldCheck className="h-5 w-5" />
                  ) : (
                    <Mail className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-slate-800">
                    Código de verificación
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Genera un código de 6 dígitos y te lo enviaremos al canal seleccionado.
                    Caduca en {MINUTOS_EXPIRACION} minutos.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={enviarCodigo}
                  disabled={enviandoCodigo || (segundosRestantes > 0 && !!codigoEsperado)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {enviandoCodigo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : codigoEsperado && segundosRestantes > 0 ? (
                    <RotateCcw className="h-4 w-4" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {codigoEsperado && segundosRestantes > 0
                    ? `Reenviar en ${formatoTiempo(segundosRestantes)}`
                    : enviandoCodigo
                    ? "Enviando..."
                    : codigoEsperado
                    ? "Reenviar código"
                    : "Enviar código"}
                </button>

                {codigoEsperado && segundosRestantes > 0 && (
                  <p className="text-xs font-medium text-amber-700">
                    ⏱ Expira en {formatoTiempo(segundosRestantes)}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="codigo"
                  className="block text-sm font-medium text-slate-700"
                >
                  Ingresa el código de 6 dígitos
                </label>
                <input
                  id="codigo"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={codigoIngresado}
                  onChange={(e) =>
                    setCodigoIngresado(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  disabled={codigoVerificado || !codigoEsperado || segundosRestantes === 0}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-center font-mono text-2xl tracking-[0.5em] outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>

              {codigoVerificado && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Código verificado correctamente.
                </div>
              )}

              <button
                type="button"
                onClick={verificarCodigoLocal}
                disabled={codigoVerificado || codigoIngresado.length !== 6}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" />
                Verificar código
              </button>
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}
            {mensaje && !error && (
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                {mensaje}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={volverAPaso1}
                disabled={cargando}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver y editar datos
              </button>

              <button
                type="button"
                onClick={handleCrearCuenta}
                disabled={!codigoVerificado || cargando}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cargando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {cargando ? "Creando cuenta..." : "Crear cuenta"}
              </button>
            </div>

            {mensaje && codigoVerificado === false && (
              <p className="text-center text-xs text-slate-400">
                Una vez verificado el código, podrás crear la cuenta.
              </p>
            )}

            {mensaje && codigoVerificado && !error && cargando === false && (
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="block w-full text-center text-sm font-semibold text-amber-700 underline"
              >
                Ir a iniciar sesión
              </button>
            )}

            <div className="border-t border-slate-200 pt-3 text-center text-xs text-slate-400">
              <Phone className="mr-1 inline h-3 w-3" />
              Tu número se usará solo para verificación.
              <Smartphone className="ml-2 mr-1 inline h-3 w-3" />
              Nunca compartiremos tu información.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

interface CampoProps {
  id: string;
  label: string;
  value: string;
  type?: string;
  autoComplete?: string;
  minLength?: number;
  onChange: (value: string) => void;
}

function Campo({
  id,
  label,
  value,
  type = "text",
  autoComplete,
  minLength,
  onChange,
}: CampoProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
      />
    </div>
  );
}

interface CanalOpcionProps {
  icono: React.ReactNode;
  titulo: string;
  activo: boolean;
  onClick: () => void;
}

function CanalOpcion({ icono, titulo, activo, onClick }: CanalOpcionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${
        activo
          ? "border-amber-500 bg-amber-100 text-amber-800"
          : "border-slate-200 bg-white text-slate-600 hover:border-amber-300"
      }`}
    >
      {icono}
      {titulo}
    </button>
  );
}
