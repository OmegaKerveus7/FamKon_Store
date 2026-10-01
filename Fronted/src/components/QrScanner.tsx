import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

export default function QrScanner({ onDetected }: { onDetected: (text: string) => void }) {
 const id='qr-'+useId().replace(/:/g,'');
 const reader=useRef<Html5Qrcode|null>(null), callback=useRef(onDetected), busy=useRef(false), mounted=useRef(true);
 callback.current=onDetected;
 const [estado,setEstado]=useState<'inactivo'|'cargando'|'camara'>('inactivo');
 const [error,setError]=useState('');
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;const s=reader.current;if(s?.isScanning)void s.stop().then(()=>s.clear()).catch(()=>{});};},[]);
 function obtener(){return reader.current??=new Html5Qrcode(id,{formatsToSupport:[Html5QrcodeSupportedFormats.QR_CODE],verbose:false});}
 async function detener(){const s=reader.current;if(s?.isScanning)await s.stop();}
 async function activar(){
  if(busy.current)return;busy.current=true;setError('');setEstado('cargando');
  let detected=false;
  try{
   const scanner=obtener();
   await scanner.start({facingMode:'environment'},{fps:10,qrbox:(w,h)=>{const size=Math.min(220,Math.floor(Math.min(w,h)*.8));return {width:size,height:size};}},text=>{
    if(detected||!mounted.current)return;detected=true;
    void detener().finally(()=>{if(mounted.current){setEstado('inactivo');callback.current(text);}});
   },()=>{});
   if(!mounted.current){await detener();return;}setEstado('camara');
  }catch(e){if(mounted.current){setEstado('inactivo');setError('No se pudo abrir la cámara. Permite el acceso a la cámara en el navegador y vuelve a intentarlo.');}}
  finally{busy.current=false;}
 }
 return <section className="space-y-3">
  <div id={id} className="min-h-[220px] w-full overflow-hidden rounded-xl bg-slate-50"/>
  <p className="text-sm text-slate-600">Coloca el QR de tu carnet dentro del recuadro.</p>
  <div className="flex flex-wrap gap-3">
   {estado==='camara'?<button type="button" onClick={()=>void detener().then(()=>setEstado('inactivo'))} className="rounded-xl border px-4 py-2">Apagar cámara</button>:<button type="button" disabled={estado==='cargando'} onClick={()=>void activar()} className="rounded-xl bg-amber-500 px-4 py-2 disabled:opacity-50">{estado==='cargando'?'Preparando lector…':'Activar cámara'}</button>}

  </div>
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
 </section>;
}
