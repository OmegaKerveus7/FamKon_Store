import { useEffect, useState } from 'react';
import { comprasRequest } from '../api/compras';
export default function PreferenciasNotificacion() {
 const [valor,setValor]=useState('');const [busy,setBusy]=useState(false);const [mensaje,setMensaje]=useState('');
 useEffect(()=>{comprasRequest<{email:boolean;whatsapp:boolean}>('/constancias/preferencias').then(p=>setValor(p.email&&p.whatsapp?'AMBOS':p.whatsapp?'WHATSAPP':'EMAIL')).catch(e=>setMensaje(e.message));},[]);
 async function guardar(){setBusy(true);try{await comprasRequest('/constancias/preferencias',{method:'PUT',body:JSON.stringify({email:valor!=='WHATSAPP',whatsapp:valor!=='EMAIL'})});setMensaje('Guardado. Recibirás las constancias de próximas compras por el medio seleccionado.');}catch(e){setMensaje((e as Error).message);}finally{setBusy(false);}}
 return <section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">Notificaciones de compra</h2><label className="mt-3 block text-sm">Enviar constancia PDF con QR por<select disabled={!valor||busy} value={valor} onChange={e=>setValor(e.target.value)} className="my-3 block w-full rounded-lg border p-3"><option value="">Cargando…</option><option value="EMAIL">Correo electrónico</option><option value="WHATSAPP">WhatsApp</option><option value="AMBOS">Ambos</option></select></label><button disabled={!valor||busy} onClick={guardar} className="rounded-lg bg-amber-500 px-4 py-2 disabled:opacity-50">{busy?'Guardando…':'Guardar preferencia'}</button>{mensaje&&<p role="status" className="mt-3 text-sm">{mensaje}</p>}</section>;
}
