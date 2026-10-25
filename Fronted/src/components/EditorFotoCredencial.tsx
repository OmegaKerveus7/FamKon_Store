import { useEffect, useMemo, useRef, useState } from 'react';
import { comprasRequest } from '../api/compras';
import {
  prepararFotoCarnet,
  dibujarEfecto,
  dibujarFiltroEspecial,
  esFiltroEspecial,
  cssFiltroFoto,
  FILTROS_FOTO,
  type FiltroFoto,
  type FotoCarnet,
  type Efecto,
} from '../utils/fotoCarnet';
import { Check, Loader2, Move, RotateCcw, Sparkles, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';

const OBJETOS: { codigo: Efecto; nombre: string; icono: string }[] = [
  { codigo: 'perrito', nombre: 'Perrito', icono: '🐶' },
  { codigo: 'gatito', nombre: 'Gatito', icono: '🐱' },
  { codigo: 'conejito', nombre: 'Conejito', icono: '🐰' },
  { codigo: 'osito', nombre: 'Osito', icono: '🐻' },
  { codigo: 'payasito', nombre: 'Payasito', icono: '🤡' },
  { codigo: 'gafas', nombre: 'Gafas', icono: '👓' },
  { codigo: 'gafas_sol', nombre: 'Gafas de sol', icono: '🕶️' },
  { codigo: 'corona', nombre: 'Corona', icono: '👑' },
  { codigo: 'sombrero', nombre: 'Sombrero', icono: '🎩' },
  { codigo: 'lazo', nombre: 'Lazo', icono: '🎀' },
  { codigo: 'cuerno', nombre: 'Cuerno', icono: '🦄' },
  { codigo: 'llamas', nombre: 'Llamas', icono: '🔥' },
  { codigo: 'estrellas', nombre: 'Estrellas', icono: '⭐' },
];

interface Colocado {
  id: number;
  codigo: Efecto;
  nombre: string;
  icono: string;
  x: number;
  y: number;
  escala: number;
}

const LIMITE_X = 220;
const LIMITE_Y = 260;

function limitarOffset(valor: number, limite: number) {
  return Math.min(limite, Math.max(-limite, valor));
}

export default function EditorFotoCredencial({
  original,
  segmentada = false,
  onChange,
  onPreparada,
}: {
  original: string;
  segmentada?: boolean;
  onPreparada?: (ticket: string) => void;
  onChange: (foto: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const callback = useRef(onChange);
  callback.current = onChange;
  const preparada = useRef(onPreparada);
  preparada.current = onPreparada;
  const arrastre = useRef<{
    id: number;
    objetoId: number;
    clientX: number;
    clientY: number;
    baseX: number;
    baseY: number;
    ancho: number;
    alto: number;
  } | null>(null);
  const siguienteId = useRef(1);

  const [foto, setFoto] = useState<FotoCarnet>();
  const [filtro, setFiltro] = useState<FiltroFoto>('original');
  const [colocados, setColocados] = useState<Colocado[]>([]);
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [preview, setPreview] = useState('');
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    let active = true;
    setFoto(undefined);
    setError('');
    setCargando(true);
    setPreview('');
    setColocados([]);
    setSeleccionadoId(null);
    callback.current('');
    preparada.current?.('');
    (async () => {
      if (segmentada) return prepararFotoCarnet(original);
      const r = await comprasRequest<{ rostroBase64: string; mime: string; solicitudRostro: string }>(
        '/registro/rostro',
        { method: 'POST', body: JSON.stringify({ fotoOriginalBase64: original }), signal: AbortSignal.timeout(30000) },
      );
      if (!active) return undefined;
      const foto = await prepararFotoCarnet(`data:${r.mime};base64,${r.rostroBase64}`);
      if (active) preparada.current?.(r.solicitudRostro);
      return foto;
    })()
      .then((r) => {
        if (active) setFoto(r);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'No se pudo preparar la foto.');
      })
      .finally(() => {
        if (active) setCargando(false);
      });
    return () => {
      active = false;
    };
  }, [original, segmentada]);

  const baseCache = useRef<{ foto: FotoCarnet; filtro: FiltroFoto; canvas: HTMLCanvasElement } | null>(null);

  /** Fondo con el filtro aplicado (se cachea para que arrastrar sea fluido). */
  function baseFiltrada(): HTMLCanvasElement | null {
    if (!foto) return null;
    const cache = baseCache.current;
    if (cache && cache.foto === foto && cache.filtro === filtro) return cache.canvas;
    const c = document.createElement('canvas');
    c.width = 384;
    c.height = 512;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    if (esFiltroEspecial(filtro)) {
      dibujarFiltroEspecial(ctx, foto.imagen, filtro);
    } else {
      ctx.save();
      ctx.filter = cssFiltroFoto(filtro);
      ctx.drawImage(foto.imagen, 0, 0);
      ctx.restore();
    }
    baseCache.current = { foto, filtro, canvas: c };
    return c;
  }

  function pintar(override?: { id: number; x: number; y: number }) {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || !foto) return;
    const base = baseFiltrada();
    if (!base) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(base, 0, 0);
    for (const objeto of colocados) {
      const x = override && override.id === objeto.id ? override.x : objeto.x;
      const y = override && override.id === objeto.id ? override.y : objeto.y;
      dibujarEfecto(ctx, foto.puntos, objeto.codigo, { x, y }, objeto.escala);
    }
  }

  useEffect(() => {
    if (!foto) return;
    pintar();
    const c = canvas.current;
    if (!c) return;
    const data = c.toDataURL('image/jpeg', 0.9);
    setPreview(data);
    callback.current(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foto, filtro, colocados]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (abierto) {
      if (!element.open) element.showModal();
      const previo = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previo;
      };
    }
    if (element.open) element.close();
    return;
  }, [abierto]);

  const seleccionado = colocados.find((o) => o.id === seleccionadoId) ?? null;
  const filtroActual = FILTROS_FOTO.find((f) => f.codigo === filtro)?.nombre ?? 'Original';
  const resumenObjetos =
    colocados.length === 0 ? 'Sin objetos' : colocados.length === 1 ? colocados[0].nombre : `${colocados.length} objetos`;
  const miniatura = useMemo(() => foto?.imagen.toDataURL('image/jpeg', 0.72) ?? '', [foto]);
  const deshabilitado = !foto && !cargando;

  function agregarObjeto(item: { codigo: Efecto; nombre: string; icono: string }) {
    // Si ya hay uno igual, se coloca un poco corrido para que se vea.
    const repetidos = colocados.filter((o) => o.codigo === item.codigo).length;
    const corrido = Math.min(repetidos * 18, 90);
    const nuevo: Colocado = {
      id: siguienteId.current++,
      codigo: item.codigo,
      nombre: item.nombre,
      icono: item.icono,
      x: corrido,
      y: corrido,
      escala: 1,
    };
    setColocados((prev) => [...prev, nuevo]);
    setSeleccionadoId(nuevo.id);
  }

  function quitarObjeto(id: number) {
    setColocados((prev) => prev.filter((o) => o.id !== id));
    if (seleccionadoId === id) setSeleccionadoId(null);
  }

  function centrarSeleccionado() {
    if (!seleccionado) return;
    setColocados((prev) => prev.map((o) => (o.id === seleccionado.id ? { ...o, x: 0, y: 0 } : o)));
  }

  function cambiarEscala(valor: number) {
    if (!seleccionado) return;
    setColocados((prev) => prev.map((o) => (o.id === seleccionado.id ? { ...o, escala: valor } : o)));
  }

  function restablecer() {
    setFiltro('original');
    setColocados([]);
    setSeleccionadoId(null);
  }

  return (
    <>
      {/* Resumen compacto; el canvas vive en el diálogo y genera la imagen final */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative h-28 w-[84px] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            {preview ? (
              <img src={preview} alt="Vista previa de tu fotografía" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-slate-400">
                {cargando ? <Loader2 className="h-5 w-5 animate-spin text-amber-500" /> : <Sparkles className="h-5 w-5" />}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-950">Personaliza tu fotografía</p>
            <p className="mt-0.5 text-sm text-slate-500">
              Elegí un acabado y agregá todos los objetos que quieras.
            </p>
            <p className="mt-1 text-xs font-semibold text-amber-700">
              {cargando ? 'Preparando la foto…' : `${filtroActual} · ${resumenObjetos}`}
            </p>
            {error && (
              <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                {error} Tomá otra fotografía para volver a intentarlo.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setAbierto(true)}
            disabled={!foto}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles size={16} /> Personalizar
          </button>
        </div>
      </div>

      <dialog
        ref={dialog}
        aria-labelledby="editor-foto-titulo"
        onCancel={(event) => {
          event.preventDefault();
          setAbierto(false);
        }}
        onClick={(event) => {
          if (event.target === dialog.current) setAbierto(false);
        }}
        className="fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60"
      >
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                <Sparkles size={19} />
              </span>
              <div className="min-w-0">
                <h2 id="editor-foto-titulo" className="text-base font-bold text-slate-950 sm:text-lg">
                  Personaliza tu fotografía
                </h2>
                <p className="mt-0.5 text-xs leading-5 text-slate-500 sm:text-sm">
                  Elegí un acabado y agregá uno o varios objetos. Movelos y cambiales el tamaño.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar personalización"
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:items-start lg:gap-8">
              <div className="mx-auto w-full max-w-[210px] sm:max-w-[250px] lg:sticky lg:top-0 lg:mx-0 lg:max-w-none">
                <div className="relative rounded-2xl border border-slate-200 bg-slate-100 p-2 shadow-sm">
                  <canvas
                    ref={canvas}
                    width={384}
                    height={512}
                    aria-label="Vista previa de tu fotografía personalizada"
                    className={`mx-auto aspect-[3/4] w-full touch-none rounded-xl bg-white ${
                      seleccionado ? 'cursor-grab active:cursor-grabbing' : ''
                    } ${foto ? '' : 'opacity-0'}`}
                    onPointerDown={(evento) => {
                      if (!seleccionado) return;
                      const rect = evento.currentTarget.getBoundingClientRect();
                      if (!rect.width || !rect.height) return;
                      evento.currentTarget.setPointerCapture(evento.pointerId);
                      arrastre.current = {
                        id: evento.pointerId,
                        objetoId: seleccionado.id,
                        clientX: evento.clientX,
                        clientY: evento.clientY,
                        baseX: seleccionado.x,
                        baseY: seleccionado.y,
                        ancho: rect.width,
                        alto: rect.height,
                      };
                      evento.preventDefault();
                    }}
                    onPointerMove={(evento) => {
                      const actual = arrastre.current;
                      if (!actual || actual.id !== evento.pointerId) return;
                      const dx = ((evento.clientX - actual.clientX) / actual.ancho) * 384;
                      const dy = ((evento.clientY - actual.clientY) / actual.alto) * 512;
                      const x = limitarOffset(actual.baseX + dx, LIMITE_X);
                      const y = limitarOffset(actual.baseY + dy, LIMITE_Y);
                      pintar({ id: actual.objetoId, x, y });
                      evento.preventDefault();
                    }}
                    onPointerUp={(evento) => {
                      const actual = arrastre.current;
                      if (!actual || actual.id !== evento.pointerId) return;
                      arrastre.current = null;
                      try {
                        evento.currentTarget.releasePointerCapture(evento.pointerId);
                      } catch {
                        /* el puntero ya no está capturado */
                      }
                      const rect = evento.currentTarget.getBoundingClientRect();
                      const dx = rect.width ? ((evento.clientX - actual.clientX) / rect.width) * 384 : 0;
                      const dy = rect.height ? ((evento.clientY - actual.clientY) / rect.height) * 512 : 0;
                      const x = limitarOffset(actual.baseX + dx, LIMITE_X);
                      const y = limitarOffset(actual.baseY + dy, LIMITE_Y);
                      setColocados((prev) => prev.map((o) => (o.id === actual.objetoId ? { ...o, x, y } : o)));
                    }}
                    onPointerCancel={() => {
                      arrastre.current = null;
                    }}
                  />
                  {!foto && (
                    <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-xl bg-white">
                      {cargando ? (
                        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                      ) : (
                        <span className="text-xs text-slate-400">Sin vista previa</span>
                      )}
                    </div>
                  )}
                </div>
                <p className="mt-2 text-center text-xs font-medium text-slate-500">Así se guardará tu fotografía</p>
                <p className="mt-1 text-center text-[11px] text-slate-400">{filtroActual} · {resumenObjetos}</p>

                {colocados.length > 0 && (
                  <div className="mt-2 flex flex-wrap justify-center gap-1.5" aria-label="Objetos en la foto">
                    {colocados.map((objeto) => {
                      const activo = objeto.id === seleccionadoId;
                      return (
                        <span
                          key={objeto.id}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition ${
                            activo ? 'border-orange-400 bg-orange-50 text-orange-800' : 'border-slate-200 bg-white text-slate-600'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSeleccionadoId(objeto.id)}
                            className="inline-flex items-center gap-1"
                            aria-pressed={activo}
                          >
                            <span aria-hidden="true">{objeto.icono}</span>
                            <span className="truncate">{objeto.nombre}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => quitarObjeto(objeto.id)}
                            aria-label={`Quitar ${objeto.nombre}`}
                            className="rounded-full p-0.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {seleccionado ? (
                  <div className="mt-2 space-y-2 text-[11px] text-slate-500">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <span className="inline-flex items-center gap-1">
                        <Move size={13} /> Arrastrá el objeto seleccionado
                      </span>
                      <button
                        type="button"
                        onClick={centrarSeleccionado}
                        disabled={seleccionado.x === 0 && seleccionado.y === 0}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-600 transition hover:border-orange-300 hover:text-orange-700 disabled:opacity-40"
                      >
                        Centrar
                      </button>
                      <button
                        type="button"
                        onClick={() => quitarObjeto(seleccionado.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-600 transition hover:border-red-300 hover:text-red-600"
                      >
                        <Trash2 size={12} /> Quitar
                      </button>
                    </div>
                    <div className="flex items-center gap-2 font-semibold">
                      <ZoomOut size={13} className="shrink-0" />
                      <input
                        type="range"
                        min={0.5}
                        max={2}
                        step={0.05}
                        value={seleccionado.escala}
                        onChange={(evento) => cambiarEscala(Number(evento.target.value))}
                        className="min-w-0 flex-1 accent-orange-500"
                        aria-label="Tamaño del objeto seleccionado"
                      />
                      <ZoomIn size={13} className="shrink-0" />
                      <span className="w-9 shrink-0 text-right tabular-nums">{Math.round(seleccionado.escala * 100)}%</span>
                    </div>
                  </div>
                ) : (
                  colocados.length > 0 && (
                    <p className="mt-2 text-center text-[11px] text-slate-500">
                      Elegí un objeto de la lista para moverlo o cambiarle el tamaño.
                    </p>
                  )
                )}
              </div>

              <fieldset disabled={deshabilitado} className="min-w-0 space-y-7 disabled:opacity-60">
                <section aria-labelledby="cred-filtros">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <h3 id="cred-filtros" className="text-sm font-bold text-slate-800">
                        Acabado de la fotografía
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">Elegí cómo se verán los colores.</p>
                    </div>
                    <button
                      type="button"
                      onClick={restablecer}
                      disabled={filtro === 'original' && colocados.length === 0}
                      className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-orange-300 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <RotateCcw size={13} /> Restablecer
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
                    {FILTROS_FOTO.map((item) => {
                      const activo = filtro === item.codigo;
                      return (
                        <button
                          key={item.codigo}
                          type="button"
                          aria-pressed={activo}
                          onClick={() => setFiltro(item.codigo)}
                          className={`group flex min-w-0 flex-col rounded-2xl border bg-white p-1.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${
                            activo ? 'border-orange-500 ring-2 ring-orange-100' : 'border-slate-200 hover:border-orange-300'
                          }`}
                        >
                          <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-100">
                            {miniatura && (
                              <img
                                src={miniatura}
                                alt=""
                                style={{ filter: item.css }}
                                className="h-full w-full object-cover object-top"
                              />
                            )}
                            {activo && (
                              <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white shadow">
                                <Check size={14} />
                              </span>
                            )}
                          </span>
                          <span className="mt-2 block truncate px-1 text-sm font-bold text-slate-900">{item.nombre}</span>
                          <span className="block truncate px-1 pb-1 text-[11px] text-slate-500">{item.descripcion}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section aria-labelledby="cred-objetos">
                  <h3 id="cred-objetos" className="text-sm font-bold text-slate-800">
                    Objetos divertidos <span className="font-normal text-slate-400">(podés poner varios)</span>
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Tocá un objeto para agregarlo. Cada uno se mueve y se agranda por separado.
                  </p>

                  <div role="group" aria-label="Objetos divertidos" className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
                    {OBJETOS.map((item) => {
                      const cantidad = colocados.filter((o) => o.codigo === item.codigo).length;
                      const activo = seleccionado?.codigo === item.codigo;
                      return (
                        <button
                          key={item.codigo}
                          type="button"
                          onClick={() => agregarObjeto(item)}
                          className={`relative flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${
                            activo
                              ? 'border-orange-500 bg-orange-50 text-orange-800 ring-2 ring-orange-100'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-orange-300'
                          }`}
                        >
                          <span className="text-lg leading-none" aria-hidden="true">{item.icono}</span>
                          <span className="truncate">{item.nombre}</span>
                          {cantidad > 0 && (
                            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white shadow">
                              {cantidad}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  Tu fotografía original se conserva sin filtros. El acabado y los objetos solamente se aplican a la credencial.
                </p>
              </fieldset>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:px-6">
            <p className="hidden text-xs text-slate-500 sm:block">Los cambios se aplican al instante.</p>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="ml-auto inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-bold text-white transition hover:bg-slate-800 sm:w-auto"
            >
              Listo
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
