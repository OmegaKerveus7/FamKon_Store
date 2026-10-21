import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronRight,
  ImagePlus,
  Nfc,
  Palette,
  RotateCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  type Producto,
  type PersonalizacionContenido,
  subirImagenPersonalizacionAPI,
} from "../api/famkon";

export interface EditorPersonalizacionHandle {
  preparar: () => Promise<PersonalizacionContenido | null>;
}

interface LadoPersonalizacion {
  archivo: File | null;
  mensaje: string;
}

interface Borrador {
  ladoA: LadoPersonalizacion;
  ladoB: LadoPersonalizacion;
  urlNfc: string;
}

interface Props {
  producto: Producto;
}

const URL_NFC_POR_DEFECTO = "https://famkon.site";
const MAX_IMAGEN = 5 * 1024 * 1024;

function ladoVacio(): LadoPersonalizacion {
  return { archivo: null, mensaje: "" };
}

function borradorVacio(esNfc: boolean): Borrador {
  return {
    ladoA: ladoVacio(),
    ladoB: ladoVacio(),
    urlNfc: esNfc ? URL_NFC_POR_DEFECTO : "",
  };
}

function clonarBorrador(borrador: Borrador): Borrador {
  return {
    ladoA: { ...borrador.ladoA },
    ladoB: { ...borrador.ladoB },
    urlNfc: borrador.urlNfc,
  };
}

function tieneLado(lado: LadoPersonalizacion): boolean {
  return Boolean(lado.archivo || lado.mensaje.trim());
}

function tieneContenido(
  borrador: Borrador,
  permiteA: boolean,
  permiteB: boolean,
  esNfc: boolean,
): boolean {
  const hayA = permiteA && tieneLado(borrador.ladoA);
  const hayB = permiteB && tieneLado(borrador.ladoB);
  return hayA || hayB || (esNfc && Boolean(borrador.urlNfc.trim()));
}

function configurarUrl(url: string): string {
  const valor = url.trim();
  if (!valor) throw new Error("Ingresa la URL que abrirá el NFC.");
  try {
    const parsed = new URL(valor);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
    if (valor.length > 500) throw new Error();
  } catch {
    throw new Error("La URL debe comenzar con http:// o https:// y tener máximo 500 caracteres.");
  }
  return JSON.stringify({ url: valor });
}

function useObjectUrl(file: File | null): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url;
}

const EditorPersonalizacion = forwardRef<EditorPersonalizacionHandle, Props>(
  function EditorPersonalizacion({ producto }, ref) {
    const permiteA = producto.permiteLadoA === "S";
    const permiteB = producto.permiteLadoB === "S";
    const esNfc = /nfc/i.test(`${producto.nombre} ${producto.sku}`);
    const [aplicado, setAplicado] = useState<Borrador | null>(null);
    const [borrador, setBorrador] = useState<Borrador>(() => borradorVacio(esNfc));
    const [abierto, setAbierto] = useState(false);
    const [ladoActivo, setLadoActivo] = useState<"A" | "B">(permiteA ? "A" : "B");
    const [error, setError] = useState("");
    const [rotacion, setRotacion] = useState(0);

    useEffect(() => {
      if (!abierto) return;
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }, [abierto]);

    useEffect(() => {
      if (!abierto) return;
      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") setAbierto(false);
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [abierto]);

    function abrirModal() {
      setBorrador(aplicado ? clonarBorrador(aplicado) : borradorVacio(esNfc));
      setLadoActivo(permiteA ? "A" : "B");
      setError("");
      setRotacion(0);
      setAbierto(true);
    }

    function actualizarLado(lado: "A" | "B", cambios: Partial<LadoPersonalizacion>) {
      setBorrador((actual) => {
        const clave = lado === "A" ? "ladoA" : "ladoB";
        return { ...actual, [clave]: { ...actual[clave], ...cambios } };
      });
    }

    function elegirImagen(lado: "A" | "B", archivo: File | null) {
      setError("");
      if (!archivo) {
        actualizarLado(lado, { archivo: null });
        return;
      }
      if (archivo.size > MAX_IMAGEN) {
        setError(`La imagen del lado ${lado} debe pesar menos de 5 MB.`);
        return;
      }
      actualizarLado(lado, { archivo });
    }

    function aplicar() {
      setError("");
      if (!tieneContenido(borrador, permiteA, permiteB, esNfc)) {
        setError("Agrega una imagen, un texto o la URL del NFC.");
        return;
      }
      if (esNfc) {
        try {
          configurarUrl(borrador.urlNfc);
        } catch (err) {
          setError(err instanceof Error ? err.message : "La URL del NFC no es válida.");
          return;
        }
      }
      setAplicado(clonarBorrador(borrador));
      setAbierto(false);
    }

    function quitar() {
      setAplicado(null);
      setBorrador(borradorVacio(esNfc));
      setAbierto(false);
    }

    async function preparar(): Promise<PersonalizacionContenido | null> {
      if (!aplicado) return null;
      const contenido: PersonalizacionContenido = {};

      const archivoA = permiteA ? aplicado.ladoA.archivo : null;
      const archivoB = permiteB ? aplicado.ladoB.archivo : null;
      const [idA, idB] = await Promise.all([
        archivoA ? subirImagenPersonalizacionAPI(archivoA, "A") : Promise.resolve(null),
        archivoB ? subirImagenPersonalizacionAPI(archivoB, "B") : Promise.resolve(null),
      ]);
      if (idA != null) contenido.idArchivoLadoA = idA;
      if (idB != null) contenido.idArchivoLadoB = idB;

      if (permiteA && aplicado.ladoA.mensaje.trim()) contenido.mensajeLadoA = aplicado.ladoA.mensaje.trim();
      if (permiteB && aplicado.ladoB.mensaje.trim()) contenido.mensajeLadoB = aplicado.ladoB.mensaje.trim();
      if (esNfc) {
        const config = configurarUrl(aplicado.urlNfc);
        if (permiteA) contenido.configLadoA = config;
        if (permiteB) contenido.configLadoB = config;
      }

      const hayContenido = contenido.idArchivoLadoA != null
        || contenido.idArchivoLadoB != null
        || Boolean(contenido.mensajeLadoA)
        || Boolean(contenido.mensajeLadoB)
        || Boolean(contenido.configLadoA)
        || Boolean(contenido.configLadoB);
      return hayContenido ? contenido : null;
    }

    useImperativeHandle(ref, () => ({ preparar }), [aplicado, permiteA, permiteB, esNfc]);

    if (!permiteA && !permiteB) return null;

    const titulo = esNfc ? "Personaliza tu tarjeta NFC" : "Personaliza tu producto";
    const descripcion = esNfc
      ? "Puedes subir una imagen para cada lado y definir la URL que abrirá el NFC. Incluye vista previa 3D."
      : "Agrega una imagen y/o un texto para cada lado.";

    return (
      <>
        <section className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-3.5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
              {esNfc ? <Nfc className="h-5 w-5" /> : <Palette className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-slate-900">{titulo}</p>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  Sin costo extra
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-600">{descripcion}</p>

              {aplicado ? (
                <div className="mt-2.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <Check className="h-3.5 w-3.5" /> Personalización aplicada
                  </div>
                  {((permiteA && tieneLado(aplicado.ladoA)) || (permiteB && tieneLado(aplicado.ladoB))) && (
                    <div className="flex flex-wrap gap-2">
                      {permiteA && tieneLado(aplicado.ladoA) && <MiniaturaLado etiqueta="Lado A" lado={aplicado.ladoA} />}
                      {permiteB && tieneLado(aplicado.ladoB) && <MiniaturaLado etiqueta="Lado B" lado={aplicado.ladoB} />}
                    </div>
                  )}
                  {esNfc && aplicado.urlNfc.trim() && (
                    <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-slate-600">
                      <Nfc className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                      <span className="min-w-0 truncate">{aplicado.urlNfc}</span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Aún no has personalizado este producto.
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={abrirModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
            >
              {aplicado ? "Editar personalización" : "Personalizar"}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            {aplicado && (
              <button
                type="button"
                onClick={quitar}
                className="rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-500 transition hover:bg-red-50 hover:text-red-600"
              >
                Quitar
              </button>
            )}
          </div>
        </section>

        {abierto && createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setAbierto(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="personalizacion-titulo"
              className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
                <div>
                  <h2 id="personalizacion-titulo" className="text-base font-bold text-slate-900 sm:text-lg">
                    {esNfc ? "Personalizar tarjeta NFC" : "Personalizar producto"}
                  </h2>
                  <p className="text-xs text-slate-500">Vista previa y edición de la personalización.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                <div className="space-y-4">
                  {esNfc && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                      <label htmlFor="nfc-url" className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <Nfc className="h-4 w-4 text-amber-600" /> URL del NFC
                      </label>
                      <input
                        id="nfc-url"
                        type="url"
                        value={borrador.urlNfc}
                        onChange={(event) => {
                          const urlNfc = event.target.value.slice(0, 500);
                          setBorrador((actual) => ({ ...actual, urlNfc }));
                        }}
                        placeholder="https://famkon.site"
                        className="mt-1.5 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        Se usará la misma URL en ambos lados de la tarjeta.
                      </p>
                    </div>
                  )}

                  <div className="flex rounded-xl bg-slate-100 p-1">
                    {permiteA && (
                      <button
                        type="button"
                        onClick={() => setLadoActivo("A")}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
                          ladoActivo === "A" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        Lado A
                        {tieneLado(borrador.ladoA) && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                      </button>
                    )}
                    {permiteB && (
                      <button
                        type="button"
                        onClick={() => setLadoActivo("B")}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
                          ladoActivo === "B" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        Lado B
                        {tieneLado(borrador.ladoB) && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                      </button>
                    )}
                  </div>

                  {ladoActivo === "A" && permiteA && (
                    <EditorLado
                      lado="A"
                      valor={borrador.ladoA}
                      onImagen={(archivo) => elegirImagen("A", archivo)}
                      onMensaje={(mensaje) => actualizarLado("A", { mensaje })}
                      onQuitarImagen={() => actualizarLado("A", { archivo: null })}
                      onError={setError}
                    />
                  )}
                  {ladoActivo === "B" && permiteB && (
                    <EditorLado
                      lado="B"
                      valor={borrador.ladoB}
                      onImagen={(archivo) => elegirImagen("B", archivo)}
                      onMensaje={(mensaje) => actualizarLado("B", { mensaje })}
                      onQuitarImagen={() => actualizarLado("B", { archivo: null })}
                      onError={setError}
                    />
                  )}

                  {error && (
                    <p role="alert" className="rounded-lg bg-red-50 p-2.5 text-xs font-medium text-red-700">
                      {error}
                    </p>
                  )}
                </div>

                <div className="md:sticky md:top-0 md:self-start">
                  {esNfc ? (
                    <Vista3dNfc
                      ladoA={borrador.ladoA}
                      ladoB={borrador.ladoB}
                      url={borrador.urlNfc}
                      rotacion={rotacion}
                      onRotacion={setRotacion}
                    />
                  ) : (
                    <VistaLados
                      ladoA={borrador.ladoA}
                      ladoB={borrador.ladoB}
                      permiteA={permiteA}
                      permiteB={permiteB}
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  {aplicado && (
                    <button
                      type="button"
                      onClick={quitar}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Quitar personalización
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAbierto(false)}
                    className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:flex-none"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={aplicar}
                    className="flex-1 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-amber-400 sm:flex-none"
                  >
                    Aplicar personalización
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
      </>
    );
  },
);

function MiniaturaLado({ lado, etiqueta }: { lado: LadoPersonalizacion; etiqueta: string }) {
  const url = useObjectUrl(lado.archivo);
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
      {url ? (
        <img src={url} alt={etiqueta} className="h-8 w-8 rounded-md object-cover" />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-500">
          {etiqueta.replace("Lado ", "")}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{etiqueta}</p>
        <p className="max-w-[110px] truncate text-[11px] font-medium text-slate-700">
          {lado.mensaje.trim() || (url ? "Imagen cargada" : "Sin contenido")}
        </p>
      </div>
    </div>
  );
}

interface EditorLadoProps {
  lado: "A" | "B";
  valor: LadoPersonalizacion;
  onImagen: (archivo: File) => void;
  onMensaje: (mensaje: string) => void;
  onQuitarImagen: () => void;
  onError: (mensaje: string) => void;
}

function EditorLado({ lado, valor, onImagen, onMensaje, onQuitarImagen, onError }: EditorLadoProps) {
  const preview = useObjectUrl(valor.archivo);
  const inputRef = useRef<HTMLInputElement>(null);

  function seleccionar(archivo: File | null) {
    if (!archivo) return;
    if (archivo.size > MAX_IMAGEN) {
      onError(`La imagen del lado ${lado} debe pesar menos de 5 MB.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    onError("");
    onImagen(archivo);
  }

  function quitar() {
    if (inputRef.current) inputRef.current.value = "";
    onQuitarImagen();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
          {preview ? (
            <img src={preview} alt={`Lado ${lado}`} className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6 text-slate-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-800">Imagen del lado {lado}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">JPG, PNG o WEBP · máximo 5 MB</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (inputRef.current) inputRef.current.value = "";
                inputRef.current?.click();
              }}
              className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-slate-800"
            >
              {preview ? "Cambiar imagen" : "Subir imagen"}
            </button>
            {preview && (
              <button
                type="button"
                onClick={quitar}
                className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:bg-red-50 hover:text-red-600"
              >
                Quitar
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => seleccionar(event.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      <div>
        <label htmlFor={`mensaje-${lado}`} className="flex items-center justify-between text-xs font-bold text-slate-800">
          <span>Texto del lado {lado}</span>
          <span className="text-[10px] font-medium text-slate-400">Opcional</span>
        </label>
        <textarea
          id={`mensaje-${lado}`}
          value={valor.mensaje}
          onChange={(event) => onMensaje(event.target.value.slice(0, 500))}
          maxLength={500}
          rows={3}
          placeholder={`Escribe un texto para el lado ${lado}…`}
          className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 p-3 text-sm text-slate-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
        />
        <p className="mt-1 text-right text-[10px] text-slate-400">{valor.mensaje.length}/500</p>
      </div>
    </div>
  );
}

interface Vista3dNfcProps {
  ladoA: LadoPersonalizacion;
  ladoB: LadoPersonalizacion;
  url: string;
  rotacion: number;
  onRotacion: (valor: number) => void;
}

function Vista3dNfc({ ladoA, ladoB, url, rotacion, onRotacion }: Vista3dNfcProps) {
  const imagenA = useObjectUrl(ladoA.archivo);
  const imagenB = useObjectUrl(ladoB.archivo);
  const enLadoA = Math.abs(rotacion) < 90;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Vista previa 3D
        </p>
        <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
          NFC
        </span>
      </div>

      <div className="flex h-64 items-center justify-center" style={{ perspective: "1200px" }}>
        <div
          className="relative aspect-[1.58/1] w-full max-w-[290px] transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateY(${rotacion}deg)`,
          }}
        >
          <CaraNfc
            lado="A"
            imagen={imagenA}
            mensaje={ladoA.mensaje}
            url={url}
            style={{ transform: "rotateY(0deg)" }}
          />
          <CaraNfc
            lado="B"
            imagen={imagenB}
            mensaje={ladoB.mensaje}
            url={url}
            style={{ transform: "rotateY(180deg)" }}
          />
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={rotacion}
          onChange={(event) => onRotacion(Number(event.target.value))}
          className="w-full accent-amber-500"
          aria-label="Girar tarjeta NFC"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onRotacion(0)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition ${
              enLadoA ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            Lado A
          </button>
          <button
            type="button"
            onClick={() => onRotacion(180)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition ${
              !enLadoA ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            Lado B
          </button>
          <button
            type="button"
            onClick={() => onRotacion(enLadoA ? 180 : 0)}
            className="rounded-lg bg-white p-1.5 text-slate-600 transition hover:bg-slate-100"
            aria-label="Girar tarjeta"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-400">
          Gira la tarjeta para revisar ambos lados.
        </p>
      </div>
    </div>
  );
}

interface CaraNfcProps {
  lado: "A" | "B";
  imagen: string;
  mensaje: string;
  url: string;
  style: CSSProperties;
}

function CaraNfc({ lado, imagen, mensaje, url, style }: CaraNfcProps) {
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-2xl border border-white/20 bg-slate-900 shadow-2xl shadow-slate-900/30"
      style={{ ...style, backfaceVisibility: "hidden" }}
    >
      {imagen ? (
        <img src={imagen} alt={`Lado ${lado}`} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur">
        <Nfc className="h-3 w-3" /> Lado {lado}
      </div>
      <div className="absolute bottom-3 left-3 right-3">
        {mensaje.trim() ? (
          <p className="line-clamp-2 text-xs font-semibold text-white">{mensaje}</p>
        ) : (
          <p className="text-xs font-medium text-white/60">Sin texto en este lado</p>
        )}
        <p className="mt-1 truncate rounded-full bg-white/15 px-2 py-1 text-[9px] text-white/90 backdrop-blur">
          {url.trim() || "Sin URL"}
        </p>
      </div>
    </div>
  );
}

function VistaLados({
  ladoA,
  ladoB,
  permiteA,
  permiteB,
}: {
  ladoA: LadoPersonalizacion;
  ladoB: LadoPersonalizacion;
  permiteA: boolean;
  permiteB: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-800">
        <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Vista previa
      </p>
      <div className={`grid gap-3 ${permiteA && permiteB ? "grid-cols-2" : "grid-cols-1"}`}>
        {permiteA && <PanelLado etiqueta="Lado A" lado={ladoA} />}
        {permiteB && <PanelLado etiqueta="Lado B" lado={ladoB} />}
      </div>
      <p className="mt-3 text-center text-[10px] text-slate-400">
        Vista referencial. El resultado final puede variar.
      </p>
    </div>
  );
}

function PanelLado({ etiqueta, lado }: { etiqueta: string; lado: LadoPersonalizacion }) {
  const imagen = useObjectUrl(lado.archivo);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex aspect-[1.2/1] items-center justify-center bg-slate-100">
        {imagen ? (
          <img src={imagen} alt={etiqueta} className="h-full w-full object-cover" />
        ) : (
          <ImagePlus className="h-6 w-6 text-slate-400" />
        )}
      </div>
      <div className="p-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{etiqueta}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-700">
          {lado.mensaje.trim() || "Sin texto"}
        </p>
      </div>
    </div>
  );
}

export default EditorPersonalizacion;
