import { useRef, useState, type FormEvent } from 'react';
import { Loader2, ScanFace } from 'lucide-react';
import CameraCapture, { type CameraCaptureHandle } from '../../components/CameraCapture';
import { registrarRostro } from './api';

export default function EnrolamientoFacial() {
  const camera = useRef<CameraCaptureHandle>(null);
  const enCurso = useRef(false);
  const [abierto, setAbierto] = useState(false);
  const [contrasena, setContrasena] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [foto, setFoto] = useState('');
  const [mensaje, setMensaje] = useState('');

  async function guardar(event: FormEvent) {
    event.preventDefault();
    if (enCurso.current) return;
    setError(''); setMensaje(''); setFoto('');
    const captura = camera.current?.capturar();
    if (!captura) { setError('Activa la cámara y mira de frente para registrar tu rostro.'); return; }
    enCurso.current = true; setCargando(true);
    try {
      const r = await registrarRostro(contrasena, captura);
      window.dispatchEvent(new CustomEvent('rostro-actualizado', { detail: { foto: r.fotoSegmentada } }));
      setFoto(r.fotoSegmentada); setMensaje(r.mensaje); setContrasena('');
      camera.current?.apagar(); setAbierto(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el rostro.');
    } finally { enCurso.current = false; setCargando(false); }
  }

  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ScanFace className="h-5 w-5 text-amber-600" /> Identidad facial</h2>
    <p className="text-sm text-slate-600">Registra tu rostro para acceder con reconocimiento facial y actualizar tu foto de perfil sin filtros. Si ya tienes una foto registrada, la nueva deberá coincidir con ella.</p>
    {!abierto && <button type="button" onClick={() => { setAbierto(true); setError(''); }} className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold">Registrar o actualizar rostro</button>}
    {abierto && <form onSubmit={guardar} className="space-y-4">
      <div><label htmlFor="clave-biometria" className="text-sm font-medium text-slate-700">Confirma tu contraseña actual</label>
        <input id="clave-biometria" required type="password" autoComplete="current-password" value={contrasena} disabled={cargando} onChange={e => setContrasena(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
      </div>
      <CameraCapture ref={camera} />
      <p className="text-xs text-slate-500">Al guardar, tu captura se enviará al servicio de reconocimiento facial para procesarla.</p>
      <div className="flex gap-3">
        <button type="submit" disabled={cargando} className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold disabled:opacity-60">{cargando && <Loader2 className="h-4 w-4 animate-spin" />}{cargando ? 'Procesando rostro…' : 'Guardar rostro'}</button>
        <button type="button" disabled={cargando} onClick={() => { camera.current?.apagar(); setAbierto(false); setContrasena(''); }} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm">Cancelar</button>
      </div>
    </form>}
    {error && <p role="alert" className="break-words rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {mensaje && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{mensaje}</p>}
    {foto && <img src={foto} alt="Tu fotografía segmentada" className="max-h-64 rounded-xl border border-slate-200 object-contain" />}
  </section>;
}
