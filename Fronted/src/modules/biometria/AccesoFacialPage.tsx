import { useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, ScanFace, UserRound, RefreshCw, Check } from 'lucide-react';
import CameraCapture, { type CameraCaptureHandle } from '../../components/CameraCapture';
import { useAuth } from '../../context/AuthContext';
import { fusionarCarritoLocal } from '../../api/carritoLocal';
import { rutaTrasIngreso } from '../../domain/carritoVisitante';
import { type ResultadoCalidad } from '../../utils/calidadFoto';
import { ErrorFacial, accederConRostro } from './api';

export default function AccesoFacialPage() {
  const camera = useRef<CameraCaptureHandle>(null);
  const enCurso = useRef(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [camaraLista, setCamaraLista] = useState(false);
  const { iniciarSesion } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  // La pista acota la búsqueda: nickname o correo (viene del login si el
  // usuario ya lo escribió).
  const [pista, setPista] = useState(typeof state?.pista === 'string' ? state.pista : '');
  // Referencias ya comparadas: si se reintenta no se vuelven a comparar.
  const descartados = useRef<number[]>([]);
  // Última captura: se muestra en pantalla para que el usuario pueda repetirla.
  const [captura, setCaptura] = useState<string | null>(null);
  const [calidad, setCalidad] = useState<ResultadoCalidad | null>(null);

  function descartarCaptura() {
    setCaptura(null);
    setCalidad(null);
    setError('');
  }

  async function enviar(foto: string) {
    enCurso.current = true;
    setCargando(true);
    try {
      const respuesta = await accederConRostro(foto, {
        pista,
        descartados: descartados.current,
      });
      if (!respuesta.token || !respuesta.usuario) throw new Error('No se pudo iniciar la sesión facial.');
      camera.current?.apagar();
      iniciarSesion(respuesta.usuario, respuesta.token);
      await fusionarCarritoLocal().catch(() => undefined);
      navigate(rutaTrasIngreso(respuesta.usuario.roles, state?.volverA), { replace: true });
    } catch (err) {
      if (err instanceof ErrorFacial) {
        // Se guardan las referencias comparadas: el siguiente intento sigue
        // donde quedó, sin repetir el trabajo.
        if (err.comparados.length) descartados.current = err.comparados;
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo validar tu rostro.');
      }
    } finally {
      enCurso.current = false;
      setCargando(false);
    }
  }

  async function verificar(event: FormEvent) {
    event.preventDefault();
    if (enCurso.current) return;
    setError('');
    const foto = camera.current?.capturar();
    if (!foto) { setError('Activa la cámara y mira de frente con buena iluminación.'); return; }
    // Revisión local de luz y nitidez: si la foto no sirve, se avisa sin
    // gastar un intento del servicio de rostros.
    const analisis = camera.current?.analizar() ?? null;
    if (analisis && !analisis.ok) {
      setCaptura(foto);
      setCalidad(analisis);
      setError(analisis.mensaje);
      return;
    }
    await enviar(foto);
  }

  return <main className="flex min-h-dvh items-start justify-center overflow-x-auto overflow-y-auto sm:items-center bg-slate-100 p-4 sm:py-6">
    <section className="w-full max-w-lg space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-7">
      <Link to="/login" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft size={16} /> Volver al inicio de sesión</Link>
      <div className="flex items-center gap-3"><img src="/images/logo-famkon.png" alt="FamKon" className="h-12 w-12 object-contain" /><div><h1 className="text-xl font-bold text-slate-900">Acceso facial</h1><p className="text-sm text-slate-500">Ingresá con tu rostro registrado.</p></div></div>
      <ol className="grid grid-cols-3 gap-2 text-xs text-slate-500"><li>1. Escribí tu nombre</li><li>2. Activá la cámara</li><li>3. Verificá tu identidad</li></ol>
      <form onSubmit={verificar} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="pista" className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <UserRound size={15} className="text-amber-600" /> Tu nombre o correo <span className="text-xs font-normal text-slate-400">(opcional)</span>
          </label>
          <input
            id="pista"
            type="text"
            autoCapitalize="none"
            spellCheck={false}
            value={pista}
            onChange={(e) => setPista(e.target.value)}
            placeholder="Ej.: Gustavo"
            maxLength={100}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
          <p className="text-xs text-slate-500">
            Sirve para buscar tu cuenta primero. Si lo dejás vacío se usará el dispositivo desde el que entrás.
          </p>
        </div>

        {captura ? (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-3">
              <img src={captura} alt="Captura de tu rostro" className="h-24 w-24 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">Tu captura</p>
                {calidad?.ok ? (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-700"><Check size={13} /> La foto se ve bien.</p>
                ) : (
                  <p className="mt-1 text-xs font-medium text-amber-800">{calidad?.mensaje}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={descartarCaptura}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCw size={16} /> Tomar otra foto
              </button>
              {calidad && !calidad.ok && (
                <button
                  type="button"
                  onClick={() => void enviar(captura)}
                  disabled={cargando}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {cargando ? <Loader2 size={16} className="animate-spin" /> : <ScanFace size={16} />}
                  Verificar igual
                </button>
              )}
            </div>
          </div>
        ) : (
          <CameraCapture ref={camera} guiaRostro verificando={cargando} onLista={setCamaraLista} />
        )}

        <p role="status" className="text-center text-sm text-slate-600">
          {cargando
            ? 'Buscando tu rostro entre las cuentas registradas. Esperá un momento.'
            : captura
              ? 'Si la foto no te convence, tomá otra.'
              : camaraLista
                ? 'Mirá de frente, con buena luz y sin cubrir tu rostro. Luego pulsá verificar.'
                : 'Permití el acceso a la cámara para continuar.'}
        </p>
        {error && <p role="alert" className="break-words rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!captura && (
          <button disabled={cargando || !camaraLista} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 p-3 text-sm font-semibold disabled:opacity-60">
            {cargando ? <Loader2 size={16} className="animate-spin" /> : <ScanFace size={16} className="text-amber-700" />}
            {cargando ? 'Verificando identidad…' : 'Verificar y entrar'}
          </button>
        )}
      </form>
      <p className="text-sm text-slate-600">Si aún no has registrado tu rostro, <Link to="/login" className="font-medium text-amber-700 underline">entra con tu contraseña</Link> y abre Mi Perfil.</p>
    </section>
  </main>;
}
