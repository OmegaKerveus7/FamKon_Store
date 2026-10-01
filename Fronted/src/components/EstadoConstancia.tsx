import { useCallback, useEffect, useState } from 'react';
import { comprasRequest } from '../api/compras';

export default function EstadoConstancia({ id }: { id: number }) {
  const [estados, setEstados] = useState<{ canal: string; estado: string }[] | null>(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [busy, setBusy] = useState(false);
  const [consulta, setConsulta] = useState(0);
  useEffect(() => {
    let active = true;
    async function cargar() {
      try {
        const data = await comprasRequest<{ canal: string; estado: string }[]>(`/constancias/${id}/estado`);
        if (!Array.isArray(data)) throw new Error('Respuesta inválida');
        if (active) { setEstados(data); setError(''); }
      } catch {
        if (active) setError('No pudimos consultar el estado del envío. Esto no confirma si la constancia fue enviada. Intenta actualizar en unos segundos.');
      }
    }
    void cargar();
    const timer = setInterval(cargar, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [id, consulta]);
  const actualizar = useCallback(() => setConsulta(n => n + 1), []);
  async function retry() {
    setBusy(true); setMensaje('');
    try {
      await comprasRequest(`/constancias/${id}/reintentar`, { method: 'POST' });
      setMensaje('Envío programado.'); actualizar();
    } catch (e) { setMensaje((e as Error).message); }
    finally { setBusy(false); }
  }
  const etiquetas: Record<string, string> = { PENDIENTE: 'Pendiente', ENVIANDO: 'En proceso', ENVIADO: 'Aceptado por el servicio de envío', ERROR: 'No se pudo confirmar el envío', CANCELADO: 'Cancelado' };
  return <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
    <h3 className="font-semibold">Envío de tu constancia</h3>
    {error ? <div role="alert" className="mt-2"><p>{error}</p><button onClick={actualizar} className="mt-3 font-semibold text-amber-700">Actualizar estado</button></div> : estados === null ? <p role="status" className="mt-2">Consultando envío…</p> : <>
      {estados.map(e => <p key={e.canal} className="mt-2">{e.canal === 'EMAIL' ? 'Correo' : 'WhatsApp'}: {etiquetas[e.estado] || e.estado}</p>)}
      {estados.length === 0 && <p className="mt-2">Este pedido no tiene envíos registrados. Puedes descargar la constancia PDF cuando esté disponible.</p>}
      {estados.some(e => e.estado === 'ERROR') && <button disabled={busy} onClick={retry} className="mt-3 font-semibold text-amber-700">Reintentar envío</button>}
    </>}
    {mensaje && <p role="status" className="mt-2">{mensaje}</p>}
  </section>;
}
