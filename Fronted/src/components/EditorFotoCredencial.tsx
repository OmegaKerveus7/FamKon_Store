import { useEffect, useRef, useState } from 'react';
import { comprasRequest } from '../api/compras';
import { prepararFotoCarnet, dibujarEfecto, type FotoCarnet, type Efecto } from '../utils/fotoCarnet';
export default function EditorFotoCredencial({ original, segmentada = false, onChange, onPreparada }: { original: string; segmentada?: boolean; onPreparada?: (ticket: string) => void; onChange: (foto: string) => void }) {
 const canvas=useRef<HTMLCanvasElement>(null); const callback=useRef(onChange); callback.current=onChange; const preparada=useRef(onPreparada); preparada.current=onPreparada;
 const [foto,setFoto]=useState<FotoCarnet>(); const [efecto,setEfecto]=useState<Efecto>('ninguno'); const fondo='#ffffff'; const [error,setError]=useState(''); const [cargando,setCargando]=useState(true);
 useEffect(()=>{let active=true;setFoto(undefined);setError('');setCargando(true);callback.current('');preparada.current?.('');
 (async()=>{
   if(segmentada)return prepararFotoCarnet(original);
   const r=await comprasRequest<{rostroBase64:string;mime:string;solicitudRostro:string}>('/registro/rostro',{method:'POST',body:JSON.stringify({fotoOriginalBase64:original}),signal:AbortSignal.timeout(30000)});
   if(!active)return undefined;
   const foto=await prepararFotoCarnet(`data:${r.mime};base64,${r.rostroBase64}`);
   if(active)preparada.current?.(r.solicitudRostro);
   return foto;
 })().then(r=>{if(active)setFoto(r);}).catch(e=>{if(active)setError(e instanceof Error ? e.message : 'No se pudo preparar la foto.');}).finally(()=>{if(active)setCargando(false);});
 return()=>{active=false;};},[original,segmentada]);
 useEffect(()=>{if(!foto)return;const c=canvas.current;const ctx=c?.getContext('2d');if(!c||!ctx)return;ctx.clearRect(0,0,384,512);ctx.fillStyle=fondo;ctx.fillRect(0,0,384,512);ctx.drawImage(foto.imagen,0,0);dibujarEfecto(ctx,foto.puntos,efecto);callback.current(c.toDataURL('image/jpeg',.9));},[foto,efecto,fondo]);
 return <div className="space-y-3 rounded-xl bg-amber-50 p-4"><p className="font-semibold">Diseña tu carnet</p>
 {cargando&&<p role="status">Segmentando tu rostro y preparando el carnet… La primera vez puede tardar unos segundos.</p>}
 {error&&<p role="alert" className="text-red-700">{error} Toma otra fotografía para volver a intentarlo.</p>}
 <canvas ref={canvas} width={384} height={512} hidden={!foto} className="mx-auto w-full max-w-80 rounded-xl" aria-label="Vista previa de tu fotografía personalizada"/>
 <fieldset disabled={!foto||cargando} className="flex flex-wrap gap-3 disabled:opacity-50"><label>Filtro facial<select value={efecto} onChange={e=>setEfecto(e.target.value as Efecto)} className="ml-2 rounded border bg-white p-2"><option value="ninguno">Sin filtro</option><option value="perrito">Perrito 🐶</option><option value="gatito">Gatito 🐱</option><option value="conejito">Conejito 🐰</option><option value="payasito">Payasito 🤡</option></select></label></fieldset>
 <p className="text-xs text-slate-600">Tu fotografía original se conserva sin filtros. Los efectos solo se guardan en el carnet.</p></div>;
}
