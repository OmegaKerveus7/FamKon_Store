import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Loader2, UserPlus } from "lucide-react";
import CameraCapture, {
  type CameraCaptureHandle,
} from "../components/CameraCapture";
import {
  registrarComprador,
  stripBase64Prefix,
} from "../api/famkon";

export default function RegistroPage() {
  const navigate = useNavigate();
  const cameraRef = useRef<CameraCaptureHandle>(null);

  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [correo, setCorreo] = useState("");
  const [nickname, setNickname] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [foto, setFoto] = useState("");

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  function capturarFoto() {
    const imagen = cameraRef.current?.capturar();

    if (!imagen) {
      setError("Primero activa la cámara.");
      return;
    }

    setFoto(imagen);
    setError("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMensaje("");

    if (contrasena !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (!foto) {
      setError("Debes tomar una fotografía.");
      return;
    }

    setCargando(true);

    try {
      const fotoBase64 = stripBase64Prefix(foto);

      const resultado = await registrarComprador({
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        correo: correo.trim(),
        contrasena,
        fechaNacimiento,
        nickname: nickname.trim(),
        fotoOriginalBase64: fotoBase64,

        // Temporalmente usamos la misma fotografía.
        fotoEditadaBase64: fotoBase64,
      });

      setMensaje(resultado.mensaje);

      cameraRef.current?.apagar();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible registrar al comprador.",
      );
    } finally {
      setCargando(false);
    }
  }

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
              <h1 className="text-2xl font-bold text-slate-900">
                Crear cuenta
              </h1>

              <p className="text-sm text-slate-500">
                Regístrate como comprador de FamKon
              </p>
            </div>
          </div>
        </header>

        <form
          onSubmit={handleSubmit}
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
            <h2 className="text-lg font-semibold text-slate-800">
              Fotografía
            </h2>

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

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            {mensaje && (
              <div className="space-y-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                <p>{mensaje}</p>

                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="font-semibold underline"
                >
                  Ir a iniciar sesión
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={cargando}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cargando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}

              {cargando ? "Creando cuenta..." : "Crear cuenta"}
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
      <label
        htmlFor={id}
        className="text-sm font-medium text-slate-700"
      >
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