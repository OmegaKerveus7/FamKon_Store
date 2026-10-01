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

  return <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-amber-50 via-orange-100 to-slate-100 p-4">
    <section className="w-full max-w-lg space-y-5 rounded-3xl bg-white p-8 shadow-2xl">
      <Link to="/login" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft size={16} /> Volver al inicio de sesión</Link>
      <div><h1 className="text-xl font-bold text-slate-900">Reconocimiento facial</h1><p className="mt-1 text-sm text-slate-600">Mira a la cámara para identificar tu cuenta con el rostro registrado.</p></div>
      <form onSubmit={verificar} className="space-y-4">
        <CameraCapture ref={camera} />
        {error && <p role="alert" className="break-words rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={cargando} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 p-3 text-sm font-semibold disabled:opacity-60">
          {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanFace className="h-4 w-4" />}
          {cargando ? 'Verificando identidad…' : 'Verificar y entrar'}
        </button>
      </form>
      <p className="text-sm text-slate-600">Si aún no has registrado tu rostro, <Link to="/login" className="font-medium text-amber-700 underline">entra con tu contraseña</Link> y abre Mi Perfil.</p>
    </section>
  </main>;
}
