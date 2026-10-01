import {useEffect,useState,type ReactNode} from 'react';
import {obtenerToken} from '../api/famkon';
export default function AvatarCredencial({fallback}:{fallback:ReactNode}){
 const [url,setUrl]=useState('');
 useEffect(()=>{
  let active=true;let resource='';let version=0;
  function liberar(){if(resource)URL.revokeObjectURL(resource);resource='';}
  async function load(){
   const current=++version;
   try{
    const r=await fetch('/api/famkon/biometria/foto',{cache:'no-store',headers:{Authorization:`Bearer ${obtenerToken()}`}});
    if(!active||current!==version)return;
    if(r.status===404){liberar();setUrl('');return;}
    if(!r.ok)return;
    const blob=await r.blob();
    if(!active||current!==version)return;
    liberar();resource=URL.createObjectURL(blob);setUrl(resource);
   }catch{/* Un fallo de red conserva la última imagen guardada. */}
  }
  function actualizar(event:Event){
   const foto=(event as CustomEvent<{foto?:string}>).detail?.foto;
   if(foto?.startsWith('data:image/')){
    // El endpoint de enrolamiento responde solo después de confirmar la transacción.
    ++version;liberar();setUrl(foto);
   }else void load();
  }
  void load();
  window.addEventListener('credencial-actualizada',load);
  window.addEventListener('rostro-actualizado',actualizar);
  return()=>{active=false;++version;window.removeEventListener('credencial-actualizada',load);window.removeEventListener('rostro-actualizado',actualizar);liberar();};
 },[]);
 return url?<img src={url} alt="Tu fotografía de perfil sin filtros" className="h-full w-full rounded-full object-cover"/>:fallback;
}
