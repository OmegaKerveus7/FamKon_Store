import { useEffect, useRef, useState } from 'react';
import { comprasRequest } from '../api/compras';
import { prepararFotoCarnet, dibujarEfecto, cssFiltroFoto, FILTROS_FOTO, type FiltroFoto, type FotoCarnet, type Efecto } from '../utils/fotoCarnet';
import { Check, Sparkles } from 'lucide-react';
export default function EditorFotoCredencial({ original, segmentada = false, onChange, onPreparada }: { original: string; segmentada?: boolean; onPreparada?: (ticket: string) => void; onChange: (foto: string) => void }) {
 const canvas=useRef<HTMLCanvasElement>(null); const callback=useRef(onChange); callback.current=onChange; const preparada=useRef(onPreparada); preparada.current=onPreparada;
 const [foto,setFoto]=useState<FotoCarnet>(); const [efecto,setEfecto]=useState<Efecto>('ninguno'); const [filtro,setFiltro]=useState<FiltroFoto>('original'); const fondo='#ffffff'; const [error,setError]=useState(''); const [cargando,setCargando]=useState(true);
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
 useEffect(()=>{if(!foto)return;const c=canvas.current;const ctx=c?.getContext('2d');if(!c||!ctx)return;ctx.clearRect(0,0,384,512);ctx.fillStyle=fondo;ctx.fillRect(0,0,384,512);ctx.save();ctx.filter=cssFiltroFoto(filtro);ctx.drawImage(foto.imagen,0,0);ctx.restore();dibujarEfecto(ctx,foto.puntos,efecto);callback.current(c.toDataURL('image/jpeg',.9));},[foto,efecto,filtro,fondo]);
 const miniatura=foto?.imagen.toDataURL('image/jpeg',.72)??'';
 const efectos:{codigo:Efecto;nombre:string;icono:string}[]=[{codigo:'ninguno',nombre:'Sin efecto',icono:'✓'},{codigo:'perrito',nombre:'Perrito',icono:'🐶'},{codigo:'gatito',nombre:'Gatito',icono:'🐱'},{codigo:'conejito',nombre:'Conejito',icono:'🐰'},{codigo:'payasito',nombre:'Payasito',icono:'🤡'}];
 return <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-4 py-4 sm:px-6"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700"><Sparkles size={19}/></span><div><p className="font-bold text-slate-950">Personaliza tu fotografía</p><p className="mt-0.5 text-sm text-slate-500">Elige un acabado y revisa el resultado antes de guardar.</p></div></div></div>
 {cargando&&<p role="status">Segmentando tu rostro y preparando el carnet… La primera vez puede tardar unos segundos.</p>}
 {error&&<p role="alert" className="text-red-700">{error} Toma otra fotografía para volver a intentarlo.</p>}
 <div className="grid items-start gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(210px,270px)_minmax(0,1fr)]">
  <div className="mx-auto w-full max-w-[270px]"><div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-2 shadow-sm"><canvas ref={canvas} width={384} height={512} hidden={!foto} className="mx-auto aspect-[3/4] w-full rounded-xl bg-white object-contain" aria-label="Vista previa de tu fotografía personalizada"/>{!foto&&!cargando&&<div className="aspect-[3/4] rounded-xl bg-white"/>}</div><p className="mt-2 text-center text-xs font-medium text-slate-500">Así se guardará tu fotografía</p></div>
  <fieldset disabled={!foto||cargando} className="min-w-0 space-y-6 disabled:opacity-50">
   <div><legend className="mb-3 text-sm font-bold text-slate-800">Acabado de fotografía</legend><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{FILTROS_FOTO.map(item=><button key={item.codigo} type="button" aria-pressed={filtro===item.codigo} onClick={()=>setFiltro(item.codigo)} className={`group relative overflow-hidden rounded-2xl border bg-white p-1.5 text-left transition ${filtro===item.codigo?'border-orange-500 ring-2 ring-orange-100':'border-slate-200 hover:border-orange-300'}`}><span className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">{miniatura&&<img src={miniatura} alt="" style={{filter:item.css}} className="h-full w-full object-cover object-top"/>}{filtro===item.codigo&&<span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white shadow"><Check size={14}/></span>}</span><span className="block px-1.5 pb-1 pt-2 text-sm font-bold text-slate-900">{item.nombre}</span><span className="block px-1.5 pb-1 text-[11px] text-slate-500">{item.descripcion}</span></button>)}</div></div>
   <div><p className="mb-3 text-sm font-bold text-slate-800">Efecto divertido <span className="font-normal text-slate-400">(opcional)</span></p><div className="flex gap-2 overflow-x-auto pb-2">{efectos.map(item=><button key={item.codigo} type="button" aria-pressed={efecto===item.codigo} onClick={()=>setEfecto(item.codigo)} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${efecto===item.codigo?'border-orange-500 bg-orange-50 text-orange-800':'border-slate-200 bg-white text-slate-600 hover:border-orange-300'}`}><span>{item.icono}</span>{item.nombre}</button>)}</div></div>
   <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">Tu fotografía original se conserva sin filtros. El acabado y los efectos solamente se aplican a la credencial.</p>
  </fieldset>
 </div></div>;
}
