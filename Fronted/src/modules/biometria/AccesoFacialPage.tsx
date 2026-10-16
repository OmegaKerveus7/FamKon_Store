import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, ScanFace } from 'lucide-react';
import CameraCapture, { type CameraCaptureHandle } from '../../components/CameraCapture';
import { useAuth } from '../../context/AuthContext';
import { accederConRostro } from './api';

export default function AccesoFacialPage() {
  const camera = useRef<CameraCaptureHandle>(null);
  const enCurso = useRef(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [camaraLista, setCamaraLista] = useState(false);
  const { iniciarSesion } = useAuth();
  const navigate = useNavigate();

  async function verificar(event: FormEvent) {
    event.preventDefault();
    if (enCurso.current) return;
    setError('');
    const foto = camera.current?.capturar();
    if (!foto) { setError('Activa la cámara y mira de frente con buena iluminación.'); return; }
    enCurso.current = true;
    setCargando(true);
    try {
      const respuesta = await accederConRostro(foto);
      if (!respuesta.token || !respuesta.usuario) throw new Error('No se pudo iniciar la sesión facial.');
      camera.current?.apagar();
      iniciarSesion(respuesta.usuario, respuesta.token);
      navigate('/inicio', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo validar tu rostro.');
    } finally {
      enCurso.current = false;
      setCargando(false);
    }
  }

  return <main className="flex min-h-dvh items-center justify-center bg-slate-100 p-4 sm:py-6">
    <section className="w-full max-w-lg space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-7">
      <Link to="/login" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft size={16} /> Volver al inicio de sesión</Link>
      <div className="flex items-center gap-3"><img src="/images/logo-famkon.png" alt="FamKon" className="h-12 w-12 object-contain" /><div><h1 className="text-xl font-bold text-slate-900">Acceso facial</h1><p className="mt-1 text-sm text-slate-500">Ingresá con tu rostro registrado.</p></div></div>
      <ol className="grid grid-cols-3 gap-2 text-xs text-slate-500"><li>1. Activá la cámara</li><li>2. Centrá tu rostro</li><li>3. Verificá tu identidad</li></ol>
      <form onSubmit={verificar} className="space-y-4">
        <CameraCapture ref={camera} guiaRostro verificando={cargando} onLista={setCamaraLista} />
        <p role="status" className="text-center text-sm text-slate-600">{cargando ? 'Comparando la captura con el rostro registrado. Esperá un momento.' : camaraLista ? 'Mirá de frente, con buena luz y sin cubrir tu rostro. Luego pulsá verificar.' : 'Permití el acceso a la cámara para continuar.'}</p>
        {error && <p role="alert" className="break-words rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={cargando || !camaraLista} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 p-3 text-sm font-semibold disabled:opacity-60">
          {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanFace className="h-4 w-4" />}
          {cargando ? 'Verificando identidad…' : 'Verificar y entrar'}
        </button>
      </form>
      <p className="text-sm text-slate-600">Si aún no has registrado tu rostro, <Link to="/login" className="font-medium text-amber-700 underline">entra con tu contraseña</Link> y abre Mi Perfil.</p>
    </section>
  </main>;
}
