import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Mail, MessageCircle } from 'lucide-react';
import { cambiarPassword, restablecerPassword, solicitarCodigoPassword, verificarCodigoPassword, type CanalPassword } from '../api/password';
import { REGLA_PASSWORD, validarPassword } from '../utils/registroValidacion';

const campo = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100';
const boton = 'flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50';

function PasswordInput({ label, value, onChange, actual = false }: { label: string; value: string; onChange: (value: string) => void; actual?: boolean }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return <div><label htmlFor={id} className="text-sm font-medium text-slate-700">{label}</label>
    <div className="relative"><input id={id} required type={visible ? 'text' : 'password'} autoComplete={actual ? 'current-password' : 'new-password'} maxLength={actual ? 1024 : 128} minLength={actual ? undefined : 8} value={value} onChange={e => onChange(e.target.value)} className={`${campo} pr-12`} />
      <button type="button" aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(!visible)} className="absolute right-1 top-1 rounded-lg p-3 text-slate-500 hover:bg-slate-50">{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
    </div></div>;
}

export default function PasswordForm({ perfil = false, onFinished, identificadorInicial = '' }: { perfil?: boolean; onFinished: () => void; identificadorInicial?: string }) {
  const id = useId();
  const [modo, setModo] = useState<'actual' | 'codigo'>(perfil ? 'actual' : 'codigo');
  const [paso, setPaso] = useState<'solicitar' | 'verificar' | 'nueva' | 'exito'>('solicitar');
  const [identificador, setIdentificador] = useState(identificadorInicial);
  const [canal, setCanal] = useState<CanalPassword>('EMAIL');
  const [solicitud, setSolicitud] = useState('');
  const [codigo, setCodigo] = useState('');
  const [permiso, setPermiso] = useState('');
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [reenviarEn, setReenviarEn] = useState(0);
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    const update = () => setSegundos(Math.max(0, Math.ceil((reenviarEn - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [reenviarEn]);

  function reiniciar(next = modo) {
    setModo(next); setPaso('solicitar'); setSolicitud(''); setCodigo(''); setPermiso('');
    setActual(''); setNueva(''); setConfirmacion(''); setError(''); setMensaje('');
  }

  async function ejecutar(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await action(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la operación.'); }
    finally { lock.current = false; setBusy(false); }
  }

  async function enviar() {
    if (segundos > 0) return;
    await ejecutar(async () => {
      const result = await solicitarCodigoPassword(identificador, canal, perfil);
      setSolicitud(result.solicitud); setCodigo(''); setPermiso(''); setPaso('verificar');
      setMensaje(result.mensaje); setReenviarEn(Date.now() + 60000);
    });
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!validarPassword(nueva)) { setError(REGLA_PASSWORD); return; }
    if (nueva !== confirmacion) { setError('Las contraseñas no coinciden.'); return; }
    await ejecutar(async () => {
      const result = modo === 'actual' ? await cambiarPassword(actual, nueva) : await restablecerPassword(solicitud, permiso, nueva);
      setActual(''); setNueva(''); setConfirmacion(''); setPermiso(''); setCodigo(''); setSolicitud('');
      setMensaje(result.mensaje); setPaso('exito');
    });
  }

  if (paso === 'exito') return <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
    <CheckCircle2 size={32} className="text-emerald-600" /><h2 className="text-lg font-bold text-emerald-950">Contraseña actualizada</h2>
    <p role="status" className="text-sm text-emerald-900">{mensaje}</p>
    <button type="button" onClick={onFinished} className={boton}>Ir a iniciar sesión</button>
  </div>;

  return <section className="space-y-5" aria-label="Cambiar o recuperar contraseña">
    {perfil && <><div className="flex items-center gap-2"><KeyRound size={22} className="text-amber-600" /><h2 className="text-lg font-bold text-slate-900">Contraseña y seguridad</h2></div>
      <div className="grid gap-2 sm:grid-cols-2">{([{ value: 'actual', text: 'Conozco mi contraseña' }, { value: 'codigo', text: 'Olvidé mi contraseña' }] as const).map(item => <button key={item.value} type="button" disabled={busy} aria-pressed={modo === item.value} onClick={() => reiniciar(item.value)} className={`rounded-xl border px-3 py-3 text-sm font-semibold disabled:opacity-50 ${modo === item.value ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{item.text}</button>)}</div></>}

    {modo === 'codigo' && <ol aria-label="Pasos de recuperación" className="flex gap-3 text-xs text-slate-500">{['Enviar código', 'Verificar', 'Nueva contraseña'].map((text, i) => <li key={text} aria-current={['solicitar', 'verificar', 'nueva'][i] === paso ? 'step' : undefined} className={['solicitar', 'verificar', 'nueva'][i] === paso ? 'font-bold text-amber-700' : ''}>{i + 1}. {text}</li>)}</ol>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {mensaje && <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{mensaje}</p>}

    {modo === 'codigo' && paso === 'solicitar' && <form onSubmit={e => { e.preventDefault(); void enviar(); }}><fieldset disabled={busy} className="space-y-4">
      {!perfil && <div><label htmlFor={`${id}-cuenta`} className="text-sm font-medium text-slate-700">Correo electrónico o usuario</label><input id={`${id}-cuenta`} autoComplete="username" required maxLength={254} value={identificador} onChange={e => setIdentificador(e.target.value)} className={campo} placeholder="El correo o usuario de tu cuenta" /></div>}
      <div><p className="mb-2 text-sm font-medium text-slate-700">¿Dónde quieres recibir el código?</p><div className="grid gap-3 sm:grid-cols-2">
        {([{ value: 'EMAIL', text: 'Correo electrónico', Icon: Mail }, { value: 'WHATSAPP', text: 'WhatsApp', Icon: MessageCircle }] as const).map(({ value, text, Icon }) => <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${canal === value ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}><input type="radio" name={`${id}-canal`} checked={canal === value} onChange={() => setCanal(value)} className="accent-amber-500" /><Icon size={18} />{text}</label>)}
      </div></div>
      <p className="text-sm text-slate-500">Usaremos el correo o número de WhatsApp que ya está registrado en tu cuenta. El código vence en 5 minutos.</p>
      <button className={boton} disabled={busy || segundos > 0}>{busy ? <><Loader2 size={18} className="animate-spin" />Enviando…</> : segundos > 0 ? `Podrás enviar en ${segundos} s` : 'Enviar código de verificación'}</button>
    </fieldset></form>}

    {modo === 'codigo' && paso === 'verificar' && <form onSubmit={e => { e.preventDefault(); void ejecutar(async () => { const result = await verificarCodigoPassword(solicitud, codigo); setPermiso(result.permiso); setCodigo(''); setPaso('nueva'); setMensaje(result.mensaje); }); }}><fieldset disabled={busy} className="space-y-4">
      <div><label htmlFor={`${id}-codigo`} className="text-sm font-medium text-slate-700">Código de 6 dígitos</label><input id={`${id}-codigo`} autoFocus autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" required maxLength={6} value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} className={`${campo} text-center text-xl tracking-[0.4em]`} placeholder="000000" /></div>
      <p className="text-xs text-slate-500">Pega el código recibido por {canal === 'EMAIL' ? 'correo electrónico' : 'WhatsApp'}. Tienes hasta 5 intentos.</p>
      <button disabled={busy || codigo.length !== 6} className={boton}>{busy ? 'Verificando…' : 'Verificar código'}</button>
      <button type="button" disabled={busy || segundos > 0} onClick={() => void enviar()} className="w-full text-sm font-semibold text-amber-700 disabled:text-slate-400">{segundos > 0 ? `Reenviar en ${segundos} s` : 'Enviar otro código'}</button>
      <button type="button" onClick={() => reiniciar()} className="w-full text-sm text-slate-600">Cambiar {perfil ? 'medio de envío' : 'cuenta o medio de envío'}</button>
    </fieldset></form>}

    {(modo === 'actual' || paso === 'nueva') && <form onSubmit={guardar}><fieldset disabled={busy} className="space-y-4">
      {modo === 'actual' && <PasswordInput label="Contraseña actual" value={actual} onChange={setActual} actual />}
      <PasswordInput label="Nueva contraseña" value={nueva} onChange={setNueva} />
      <p className="text-xs text-slate-500">{REGLA_PASSWORD}{modo === 'codigo' && ' Guarda el cambio en los próximos 5 minutos.'}</p>
      <PasswordInput label="Confirmar nueva contraseña" value={confirmacion} onChange={setConfirmacion} />
      <button className={boton} disabled={busy}>{busy ? <><Loader2 size={18} className="animate-spin" />Guardando…</> : 'Guardar nueva contraseña'}</button>
      {modo === 'codigo' && <button type="button" onClick={() => reiniciar()} className="w-full text-sm text-slate-600">Solicitar otro código</button>}
    </fieldset></form>}
  </section>;
}
