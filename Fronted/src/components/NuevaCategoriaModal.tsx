import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { crearCategoriaProductoAdmin, type Categoria } from "../api/famkon";

export default function NuevaCategoriaModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (categoria: Categoria) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const enCurso = useRef(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current;
    const previo = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => { element?.close(); previo?.focus(); };
  }, []);
  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enCurso.current) return;
    const datos = new FormData(event.currentTarget);
    const codigo = String(datos.get("codigo") || "").trim();
    const nombre = String(datos.get("nombre") || "").trim();
    const descripcion = String(datos.get("descripcion") || "").trim();
    if (!codigo || !nombre) { setError("Completa el código y el nombre de la categoría."); return; }
    enCurso.current = true;
    setGuardando(true);
    setError("");
    try { onCreated(await crearCategoriaProductoAdmin({ codigo, nombre, descripcion })); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo crear la categoría."); }
    finally { enCurso.current = false; setGuardando(false); }
  }
  const campo = "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-amber-500";
  return <dialog ref={dialog} aria-labelledby="categoria-titulo" onCancel={event => { event.preventDefault(); if (!enCurso.current) onClose(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50">
    <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
      <h2 id="categoria-titulo" className="text-xl font-bold">Nueva categoría</h2>
      <button type="button" aria-label="Cerrar categoría" disabled={guardando} onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
    </div>
    <form onSubmit={guardar} className="space-y-4 p-6">
      <p className="text-sm text-slate-500">Crea una categoría para organizar tus productos. Al guardarla quedará seleccionada en el producto.</p>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <fieldset disabled={guardando} className="space-y-4">
        <label className="block text-sm font-medium">Código *<input name="codigo" required maxLength={30} placeholder="Ej. ANILLOS" className={campo} /></label>
        <label className="block text-sm font-medium">Nombre *<input name="nombre" required maxLength={100} placeholder="Ej. Anillos" className={campo} /></label>
        <label className="block text-sm font-medium">Descripción<textarea name="descripcion" maxLength={300} rows={3} className={campo} /></label>
      </fieldset>
      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
        <button type="button" disabled={guardando} onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 disabled:opacity-50">Cancelar</button>
        <button type="submit" disabled={guardando} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50">{guardando ? "Guardando…" : "Crear categoría y continuar"}</button>
      </div>
    </form>
  </dialog>;
}
