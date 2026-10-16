import { useEffect, useRef } from 'react';

export default function PreviewCredencial({ url, onClose }: { url: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} onCancel={onClose} aria-labelledby="preview-credencial-titulo" className="fixed inset-0 m-auto h-[90dvh] max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/50">
    <div className="flex h-full flex-col"><div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3"><h2 id="preview-credencial-titulo" className="font-bold text-slate-900">Vista previa de tu credencial</h2><button autoFocus type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Cerrar</button></div><iframe title="Tu credencial PDF" src={`${url}#view=Fit&toolbar=0`} className="min-h-0 w-full flex-1 border-0" /></div>
  </dialog>;
}
