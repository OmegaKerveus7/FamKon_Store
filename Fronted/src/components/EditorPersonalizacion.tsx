import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  Check,
  ChevronRight,
  ImagePlus,
  Move,
  Nfc,
  Palette,
  RotateCw,
  Sparkles,
  Trash2,
  X,
  ZoomIn,
} from "lucide-react";
import {
  type Producto,
  type PersonalizacionContenido,
  subirImagenPersonalizacionAPI,
} from "../api/famkon";
import { esNfcProducto, formaProducto } from "../domain/formaProducto";

export interface EditorPersonalizacionHandle {
  preparar: () => Promise<PersonalizacionContenido | null>;
}

interface AjusteImagen {
  zoom: number;
  x: number;
  y: number;
  rotacion: number;
}

interface LadoPersonalizacion {
  archivo: File | null;
  ajuste: AjusteImagen;
  mensaje: string;
}

interface Borrador {
  ladoA: LadoPersonalizacion;
  ladoB: LadoPersonalizacion;
  urlNfc: string;
}

interface Destino {
  ancho: number;
  alto: number;
}

interface MedidasImagen {
  ancho: number;
  alto: number;
}

interface ImagenCargada extends MedidasImagen {
  elemento: HTMLImageElement;
}

interface Props {
  producto: Producto;
  /**
   * false para visitantes sin sesión: pueden escribir texto y usar la URL del NFC,
   * pero subir imágenes requiere una cuenta (el archivo se guarda en el servidor).
   */
  permitirImagenes?: boolean;
}

const URL_NFC_POR_DEFECTO = "https://famkon.site";
const MAX_IMAGEN = 15 * 1024 * 1024;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;

/** Medida final que se guarda en la base de datos para cada lado. */
const DESTINO_NFC: Destino = { ancho: 1012, alto: 640 };
const DESTINO_PRODUCTO: Destino = { ancho: 1000, alto: 840 };

/**
 * Tamano de trabajo a partir de las medidas reales del producto (cm).
 * Se usan ~120 px por cm y el lado mayor no pasa de 1400 px.
 */
function destinoDesdeMedidas(anchoCm: number, altoCm: number): Destino {
  const escala = Math.min(120, 1400 / Math.max(anchoCm, altoCm));
  return {
    ancho: Math.round(anchoCm * escala),
    alto: Math.round(altoCm * escala),
  };
}

function ajusteVacio(): AjusteImagen {
  return { zoom: 1, x: 0, y: 0, rotacion: 0 };
}

function ladoVacio(): LadoPersonalizacion {
  return { archivo: null, ajuste: ajusteVacio(), mensaje: "" };
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
    ladoA: { ...borrador.ladoA, ajuste: { ...borrador.ladoA.ajuste } },
    ladoB: { ...borrador.ladoB, ajuste: { ...borrador.ladoB.ajuste } },
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

function esGirada(rotacion: number): boolean {
  return Math.abs(rotacion % 180) === 90;
}

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor));
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

function cargarImagen(archivo: File): Promise<ImagenCargada> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = () => {
      const ancho = imagen.naturalWidth || imagen.width;
      const alto = imagen.naturalHeight || imagen.height;
      URL.revokeObjectURL(url);
      if (!ancho || !alto) {
        reject(new Error("La imagen no es válida."));
        return;
      }
      resolve({ elemento: imagen, ancho, alto });
    };
    imagen.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen."));
    };
    imagen.src = url;
  });
}

function useMedidasImagen(archivo: File | null): MedidasImagen | null {
  const [medidas, setMedidas] = useState<MedidasImagen | null>(null);
  useEffect(() => {
    if (!archivo) {
      setMedidas(null);
      return;
    }
    let vigente = true;
    cargarImagen(archivo)
      .then((resultado) => {
        if (vigente) setMedidas({ ancho: resultado.ancho, alto: resultado.alto });
      })
      .catch(() => {
        if (vigente) setMedidas(null);
      });
    return () => {
      vigente = false;
    };
  }, [archivo]);
  return medidas;
}

function useMedidasContenedor() {
  const ref = useRef<HTMLDivElement>(null);
  const [medidas, setMedidas] = useState({ ancho: 0, alto: 0 });
  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;
    const observador = new ResizeObserver((entradas) => {
      const caja = entradas[0]?.contentRect;
      if (caja) setMedidas({ ancho: caja.width, alto: caja.height });
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);
  return { ref, medidas };
}

/** Escala mínima para que la imagen cubra todo el marco sin dejar bordes. */
function escalaParaCubrir(imagen: MedidasImagen, ajuste: AjusteImagen, marco: MedidasImagen): number {
  if (!marco.ancho || !marco.alto) return 0;
  const girada = esGirada(ajuste.rotacion);
  const anchoVisual = girada ? imagen.alto : imagen.ancho;
  const altoVisual = girada ? imagen.ancho : imagen.alto;
  return Math.max(marco.ancho / anchoVisual, marco.alto / altoVisual) * ajuste.zoom;
}

/** Evita que al mover o hacer zoom queden espacios vacíos dentro del marco. */
function limitarAjuste(imagen: MedidasImagen, ajuste: AjusteImagen, destino: Destino): AjusteImagen {
  const girada = esGirada(ajuste.rotacion);
  const anchoVisual = girada ? imagen.alto : imagen.ancho;
  const altoVisual = girada ? imagen.ancho : imagen.alto;
  const escala = Math.max(destino.ancho / anchoVisual, destino.alto / altoVisual) * ajuste.zoom;
  const maxX = Math.max(0, (anchoVisual * escala - destino.ancho) / 2) / destino.ancho;
  const maxY = Math.max(0, (altoVisual * escala - destino.alto) / 2) / destino.alto;
  return {
    ...ajuste,
    x: limitar(ajuste.x, -maxX, maxX),
    y: limitar(ajuste.y, -maxY, maxY),
  };
}

/**
 * Dibuja el texto del usuario sobre la imagen final para que quede impreso
 * en la tarjeta (no solo como dato aparte).
 */
function envolverTexto(ctx: CanvasRenderingContext2D, texto: string, maxAncho: number, fuente: string): string[] {
  ctx.font = fuente;
  const lineas: string[] = [];
  for (const parrafo of texto.split(/\r?\n/)) {
    const palabras = parrafo.trim().split(/\s+/).filter(Boolean);
    let linea = "";
    for (const palabra of palabras) {
      const prueba = linea ? `${linea} ${palabra}` : palabra;
      if (!linea || ctx.measureText(prueba).width <= maxAncho) linea = prueba;
      else {
        lineas.push(linea);
        linea = palabra;
      }
    }
    if (linea) lineas.push(linea);
  }
  return lineas;
}

function dibujarMensajeSobreImagen(
  ctx: CanvasRenderingContext2D,
  mensaje: string,
  ancho: number,
  alto: number,
): void {
  const texto = mensaje.trim();
  if (!texto) return;

  const margen = Math.round(ancho * 0.06);
  const maxAncho = ancho - margen * 2;
  const fuente = (tamano: number) => `700 ${tamano}px "Segoe UI", Arial, sans-serif`;

  let tamano = Math.max(16, Math.round(alto * 0.065));
  let lineas = envolverTexto(ctx, texto, maxAncho, fuente(tamano));
  while (lineas.length > 4 && tamano > 12) {
    tamano = Math.round(tamano * 0.86);
    lineas = envolverTexto(ctx, texto, maxAncho, fuente(tamano));
  }

  const visibles = lineas.slice(0, 4);
  if (lineas.length > 4) visibles[3] = `${visibles[3]}…`;

  const altoLinea = Math.round(tamano * 1.22);
  const altoTexto = visibles.length * altoLinea;
  const altoBanda = altoTexto + margen * 2;
  const inicio = alto - altoBanda;

  const degradado = ctx.createLinearGradient(0, inicio, 0, alto);
  degradado.addColorStop(0, "rgba(2,6,23,0)");
  degradado.addColorStop(0.45, "rgba(2,6,23,0.55)");
  degradado.addColorStop(1, "rgba(2,6,23,0.82)");
  ctx.fillStyle = degradado;
  ctx.fillRect(0, inicio, ancho, altoBanda);

  ctx.font = fuente(tamano);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = Math.max(2, Math.round(tamano * 0.16));
  ctx.shadowOffsetY = 1;
  visibles.forEach((linea, i) => {
    ctx.fillText(linea, margen, alto - margen + (i + 1 - visibles.length) * altoLinea);
  });
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/**
 * Genera la imagen ya encuadrada y con el tamaño final, lista para guardarse
 * en la base de datos (ARCHIVO) sin depender de librerías del servidor.
 */
async function generarImagenAjustada(
  archivo: File,
  ajuste: AjusteImagen,
  destino: Destino,
  mensaje = "",
): Promise<File> {
  const imagen = await cargarImagen(archivo);
  const fijo = limitarAjuste(imagen, ajuste, destino);
  const marco = { ancho: destino.ancho, alto: destino.alto };
  const escala = escalaParaCubrir(imagen, fijo, marco);

  const lienzo = document.createElement("canvas");
  lienzo.width = destino.ancho;
  lienzo.height = destino.alto;
  const contexto = lienzo.getContext("2d");
  if (!contexto) throw new Error("No se pudo procesar la imagen.");

  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, destino.ancho, destino.alto);
  contexto.imageSmoothingEnabled = true;
  contexto.imageSmoothingQuality = "high";
  contexto.save();
  contexto.translate(
    destino.ancho / 2 + fijo.x * destino.ancho,
    destino.alto / 2 + fijo.y * destino.alto,
  );
  contexto.rotate((fijo.rotacion * Math.PI) / 180);
  contexto.scale(escala, escala);
  contexto.drawImage(imagen.elemento, -imagen.ancho / 2, -imagen.alto / 2, imagen.ancho, imagen.alto);
  contexto.restore();

  dibujarMensajeSobreImagen(contexto, mensaje, destino.ancho, destino.alto);

  const blob = await new Promise<Blob | null>((resolve) => lienzo.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("No se pudo procesar la imagen.");
  return new File([blob], `personalizacion_${Date.now()}.jpg`, { type: "image/jpeg" });
}

const EditorPersonalizacion = forwardRef<EditorPersonalizacionHandle, Props>(
  function EditorPersonalizacion({ producto, permitirImagenes = true }, ref) {
    const permiteA = producto.permiteLadoA === "S";
    const permiteB = producto.permiteLadoB === "S";
    const esNfc = esNfcProducto(producto.nombre, producto.sku, producto.categoria);
    const forma = formaProducto(producto.nombre, producto.sku, producto.categoria);
    const esTarjeta = forma === "tarjeta";
    const esLlavero = forma === "llavero" || forma === "llaveroCircular";
    const esCircular = forma === "llaveroCircular";
    const esAnillo = forma === "anillo";
    const tipo: "tarjeta" | "anillo" | "llavero" | "llaveroCircular" | "producto" = esTarjeta
      ? "tarjeta"
      : esAnillo
        ? "anillo"
        : esCircular
          ? "llaveroCircular"
          : esLlavero
            ? "llavero"
            : "producto";
    const nombrePieza = {
      tarjeta: "la tarjeta",
      anillo: "el anillo",
      llavero: "el llavero",
      llaveroCircular: "el llavero circular",
      producto: "el producto",
    }[tipo];
    const destino = producto.anchoCm && producto.altoCm && producto.anchoCm > 0 && producto.altoCm > 0
      ? destinoDesdeMedidas(producto.anchoCm, producto.altoCm)
      : esNfc ? DESTINO_NFC : DESTINO_PRODUCTO;

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
        actualizarLado(lado, { archivo: null, ajuste: ajusteVacio() });
        return;
      }
      actualizarLado(lado, { archivo, ajuste: ajusteVacio() });
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

      async function subirLado(lado: "A" | "B"): Promise<number | null> {
        const datos = lado === "A" ? aplicado!.ladoA : aplicado!.ladoB;
        if (!datos.archivo) return null;
        const ajustada = await generarImagenAjustada(datos.archivo, datos.ajuste, destino, datos.mensaje);
        return subirImagenPersonalizacionAPI(ajustada, lado);
      }

      const [idA, idB] = await Promise.all([
        permiteA ? subirLado("A") : Promise.resolve(null),
        permiteB ? subirLado("B") : Promise.resolve(null),
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

    const titulo = {
      tarjeta: "¿Quieres personalizar tu tarjeta NFC?",
      anillo: "¿Quieres personalizar este anillo?",
      llavero: "¿Quieres personalizar tu llavero NFC?",
      llaveroCircular: "¿Quieres personalizar tu llavero circular?",
      producto: "¿Quieres personalizar este producto?",
    }[tipo];
    const etiquetaBoton = {
      tarjeta: "Personalizar tarjeta NFC",
      anillo: "Personalizar anillo",
      llavero: "Personalizar llavero NFC",
      llaveroCircular: "Personalizar llavero circular",
      producto: "Personalizar producto",
    }[tipo];

    return (
      <>
        <section className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 text-xs font-bold leading-snug text-slate-900 sm:text-sm">{titulo}</p>
            <button
              type="button"
              onClick={abrirModal}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-slate-800 sm:text-xs"
            >
              {aplicado ? "Editar" : "Personalizar"}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>

        {abierto && createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center sm:p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setAbierto(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="personalizacion-titulo"
              className="flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
            >
              <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5 sm:px-5 sm:py-3">
                <div className="rounded-lg bg-amber-100 p-1.5 text-amber-700">
                  {esNfc ? <Nfc className="h-4 w-4" /> : <Palette className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id="personalizacion-titulo" className="truncate text-sm font-bold text-slate-900 sm:text-lg">
                    {etiquetaBoton}
                  </h2>
                  <p className="hidden text-xs text-slate-500 sm:block">
                    Ajusta la imagen y revisa la vista previa.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-auto overscroll-contain p-3 sm:gap-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                <div className="space-y-3 sm:space-y-4">
                  {esNfc && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 sm:p-3">
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
                      <p className="mt-1 text-[10px] text-slate-500 sm:text-[11px]">
                        Se usará la misma URL en ambos lados de {nombrePieza}.
                      </p>
                    </div>
                  )}

                  <div className="flex rounded-xl bg-slate-100 p-1">
                    {permiteA && (
                      <button
                        type="button"
                        onClick={() => setLadoActivo("A")}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition sm:py-2 sm:text-xs ${
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
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition sm:py-2 sm:text-xs ${
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
                      destino={destino}
                      permitirImagenes={permitirImagenes}
                      onImagen={(archivo) => elegirImagen("A", archivo)}
                      onAjuste={(ajuste) => actualizarLado("A", { ajuste })}
                      onMensaje={(mensaje) => actualizarLado("A", { mensaje })}
                      onQuitarImagen={() => actualizarLado("A", { archivo: null, ajuste: ajusteVacio() })}
                      onError={setError}
                    />
                  )}
                  {ladoActivo === "B" && permiteB && (
                    <EditorLado
                      lado="B"
                      valor={borrador.ladoB}
                      destino={destino}
                      permitirImagenes={permitirImagenes}
                      onImagen={(archivo) => elegirImagen("B", archivo)}
                      onAjuste={(ajuste) => actualizarLado("B", { ajuste })}
                      onMensaje={(mensaje) => actualizarLado("B", { mensaje })}
                      onQuitarImagen={() => actualizarLado("B", { archivo: null, ajuste: ajusteVacio() })}
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
                  {esTarjeta ? (
                    <Vista3dNfc
                      ladoA={borrador.ladoA}
                      ladoB={borrador.ladoB}
                      url={borrador.urlNfc}
                      rotacion={rotacion}
                      onRotacion={setRotacion}
                      destino={destino}
                    />
                  ) : esLlavero ? (
                    <Vista3dLlavero
                      ladoA={borrador.ladoA}
                      ladoB={borrador.ladoB}
                      rotacion={rotacion}
                      onRotacion={setRotacion}
                      destino={destino}
                      circular={esCircular}
                    />
                  ) : (
                    <VistaLados
                      ladoA={borrador.ladoA}
                      ladoB={borrador.ladoB}
                      permiteA={permiteA}
                      permiteB={permiteB}
                      destino={destino}
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-slate-200 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3">
                <div className="order-2 sm:order-1">
                  {aplicado && (
                    <button
                      type="button"
                      onClick={quitar}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-50 sm:px-3 sm:py-2 sm:text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Quitar personalización
                    </button>
                  )}
                </div>
                <div className="order-1 flex gap-2 sm:order-2">
                  <button
                    type="button"
                    onClick={() => setAbierto(false)}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:flex-none sm:px-4 sm:py-2.5 sm:text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={aplicar}
                    className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-400 sm:flex-none sm:px-4 sm:py-2.5 sm:text-sm"
                  >
                    Aplicar
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

interface EditorLadoProps {
  lado: "A" | "B";
  valor: LadoPersonalizacion;
  destino: Destino;
  permitirImagenes: boolean;
  onImagen: (archivo: File) => void;
  onAjuste: (ajuste: AjusteImagen) => void;
  onMensaje: (mensaje: string) => void;
  onQuitarImagen: () => void;
  onError: (mensaje: string) => void;
}

function EditorLado({
  lado,
  valor,
  destino,
  permitirImagenes,
  onImagen,
  onAjuste,
  onMensaje,
  onQuitarImagen,
  onError,
}: EditorLadoProps) {
  return (
    <div className="space-y-2.5 sm:space-y-3">
      <div>
        <p className="text-xs font-bold text-slate-800">Imagen del lado {lado}</p>
        <p className="text-[10px] text-slate-500 sm:text-[11px]">
          JPG, PNG o WEBP. Se guarda recortada a {destino.ancho}×{destino.alto} px.
        </p>
      </div>

      <EditorImagen
        lado={lado}
        archivo={valor.archivo}
        ajuste={valor.ajuste}
        destino={destino}
        permitirImagenes={permitirImagenes}
        onArchivo={onImagen}
        onAjuste={onAjuste}
        onQuitar={onQuitarImagen}
        onError={onError}
      />

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
          rows={2}
          placeholder={`Escribe un texto para el lado ${lado}…`}
          className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 p-2.5 text-sm text-slate-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100 sm:p-3"
        />
        <p className="mt-1 text-right text-[10px] text-slate-400">{valor.mensaje.length}/500</p>
      </div>
    </div>
  );
}

interface EditorImagenProps {
  lado: "A" | "B";
  archivo: File | null;
  ajuste: AjusteImagen;
  destino: Destino;
  permitirImagenes: boolean;
  onArchivo: (archivo: File) => void;
  onAjuste: (ajuste: AjusteImagen) => void;
  onQuitar: () => void;
  onError: (mensaje: string) => void;
}

function EditorImagen({
  lado,
  archivo,
  ajuste,
  destino,
  permitirImagenes,
  onArchivo,
  onAjuste,
  onQuitar,
  onError,
}: EditorImagenProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const marcoRef = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ id: number; x: number; y: number; base: AjusteImagen } | null>(null);
  const medidas = useMedidasImagen(archivo);

  function seleccionar(evento: ChangeEvent<HTMLInputElement>) {
    const archivoElegido = evento.target.files?.[0] ?? null;
    evento.target.value = "";
    if (!archivoElegido) return;
    if (!/^image\/(jpeg|png|webp)$/.test(archivoElegido.type)) {
      onError("Formato no válido. Usa JPG, PNG o WEBP.");
      return;
    }
    if (archivoElegido.size > MAX_IMAGEN) {
      onError(`La imagen del lado ${lado} debe pesar menos de 15 MB.`);
      return;
    }
    onError("");
    onArchivo(archivoElegido);
  }

  function cambiarAjuste(cambios: Partial<AjusteImagen>) {
    const siguiente = { ...ajuste, ...cambios };
    onAjuste(medidas ? limitarAjuste(medidas, siguiente, destino) : siguiente);
  }

  function onPointerDown(evento: ReactPointerEvent<HTMLDivElement>) {
    if (!archivo || !medidas) return;
    evento.currentTarget.setPointerCapture(evento.pointerId);
    arrastre.current = {
      id: evento.pointerId,
      x: evento.clientX,
      y: evento.clientY,
      base: ajuste,
    };
  }

  function onPointerMove(evento: ReactPointerEvent<HTMLDivElement>) {
    const inicio = arrastre.current;
    const marco = marcoRef.current;
    if (!inicio || !marco || !medidas || inicio.id !== evento.pointerId) return;
    const caja = marco.getBoundingClientRect();
    if (!caja.width || !caja.height) return;
    const siguiente: AjusteImagen = {
      ...inicio.base,
      x: inicio.base.x + (evento.clientX - inicio.x) / caja.width,
      y: inicio.base.y + (evento.clientY - inicio.y) / caja.height,
    };
    onAjuste(limitarAjuste(medidas, siguiente, destino));
  }

  function onPointerUp(evento: ReactPointerEvent<HTMLDivElement>) {
    if (arrastre.current?.id !== evento.pointerId) return;
    arrastre.current = null;
    if (evento.currentTarget.hasPointerCapture(evento.pointerId)) {
      evento.currentTarget.releasePointerCapture(evento.pointerId);
    }
  }

  return (
    <div className="space-y-2">
      <div
        ref={marcoRef}
        className="relative mx-auto w-full max-w-[260px] touch-none select-none overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:max-w-[300px]"
        style={{ aspectRatio: `${destino.ancho} / ${destino.alto}` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {archivo ? (
          <ImagenEncuadrada archivo={archivo} ajuste={ajuste} medidas={medidas} className="absolute inset-0" />
        ) : permitirImagenes ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-400 transition hover:bg-slate-200/60"
          >
            <ImagePlus className="h-6 w-6" />
            <span className="text-[11px] font-semibold">Subir imagen</span>
          </button>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 text-center">
            <ImagePlus className="h-6 w-6 text-slate-300" />
            <span className="text-[11px] font-semibold text-slate-500">Subir tu diseño</span>
            <Link
              to="/login"
              className="text-[11px] font-bold text-amber-700 hover:underline"
            >
              Iniciá sesión para usarlo
            </Link>
          </div>
        )}
        {archivo && (
          <span className="pointer-events-none absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-0.5 text-[9px] font-semibold text-white">
            <Move className="h-2.5 w-2.5" /> Arrastra para encuadrar
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={seleccionar}
      />

      {archivo ? (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
            <ZoomIn className="h-3.5 w-3.5" /> Tamaño
            <input
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={0.01}
              value={ajuste.zoom}
              onChange={(evento) => cambiarAjuste({ zoom: Number(evento.target.value) })}
              className="flex-1 accent-amber-500"
              aria-label={`Tamaño de la imagen del lado ${lado}`}
            />
            <span className="w-9 text-right tabular-nums">{Math.round(ajuste.zoom * 100)}%</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => cambiarAjuste({ rotacion: (ajuste.rotacion + 90) % 360 })}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <RotateCw className="h-3 w-3" /> Girar
            </button>
            <button
              type="button"
              onClick={() => cambiarAjuste({ x: 0, y: 0 })}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Centrar
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cambiar
            </button>
            <button
              type="button"
              onClick={() => {
                onQuitar();
                onError("");
              }}
              className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:bg-red-50 hover:text-red-600"
            >
              Quitar
            </button>
          </div>
        </div>
      ) : (
        <p className="text-center text-[10px] text-slate-400">
          Se recortará automáticamente al tamaño real de la pieza.
        </p>
      )}
    </div>
  );
}

interface ImagenEncuadradaProps {
  archivo: File | null;
  ajuste: AjusteImagen;
  medidas?: MedidasImagen | null;
  className?: string;
}

function ImagenEncuadrada({ archivo, ajuste, medidas, className }: ImagenEncuadradaProps) {
  const url = useObjectUrl(archivo);
  const propias = useMedidasImagen(medidas ? null : archivo);
  const dimensiones = medidas ?? propias;
  const { ref, medidas: marco } = useMedidasContenedor();
  const escala = dimensiones ? escalaParaCubrir(dimensiones, ajuste, marco) : 0;

  return (
    <div ref={ref} className={`overflow-hidden ${className ?? "relative"}`}>
      {url && dimensiones && escala > 0 && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2"
          style={{
            width: dimensiones.ancho * escala,
            height: dimensiones.alto * escala,
            transform: `translate(-50%, -50%) translate(${ajuste.x * marco.ancho}px, ${ajuste.y * marco.alto}px)`,
          }}
        >
          <img
            src={url}
            alt=""
            draggable={false}
            className="h-full w-full"
            style={{ transform: `rotate(${ajuste.rotacion}deg)` }}
          />
        </div>
      )}
    </div>
  );
}

interface Vista3dNfcProps {
  ladoA: LadoPersonalizacion;
  ladoB: LadoPersonalizacion;
  url: string;
  rotacion: number;
  onRotacion: (valor: number) => void;
  destino: Destino;
}

function Vista3dNfc({ ladoA, ladoB, url, rotacion, onRotacion, destino }: Vista3dNfcProps) {
  const enLadoA = Math.abs(rotacion) < 90;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Vista previa 3D
        </p>
        <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
          NFC
        </span>
      </div>

      <div className="flex h-44 items-center justify-center sm:h-64" style={{ perspective: "1200px" }}>
        <div
          className="relative w-full max-w-[230px] transition-transform duration-500 sm:max-w-[290px]"
          style={{
            aspectRatio: `${destino.ancho} / ${destino.alto}`,
            transformStyle: "preserve-3d",
            transform: `rotateY(${rotacion}deg)`,
          }}
        >
          <CaraNfc lado="A" datos={ladoA} url={url} style={{ transform: "rotateY(0deg)" }} />
          <CaraNfc lado="B" datos={ladoB} url={url} style={{ transform: "rotateY(180deg)" }} />
        </div>
      </div>

      <div className="mt-2.5 space-y-2 sm:mt-3">
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={rotacion}
          onChange={(event) => onRotacion(Number(event.target.value))}
          className="w-full accent-amber-500"
          aria-label="Girar vista 3D"
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
            aria-label="Girar vista 3D"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface CaraNfcProps {
  lado: "A" | "B";
  datos: LadoPersonalizacion;
  url: string;
  style: CSSProperties;
}

function CaraNfc({ lado, datos, url, style }: CaraNfcProps) {
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-2xl border border-white/20 bg-slate-900 shadow-2xl shadow-slate-900/30"
      style={{ ...style, backfaceVisibility: "hidden" }}
    >
      <ImagenEncuadrada
        archivo={datos.archivo}
        ajuste={datos.ajuste}
        className={`absolute inset-0 ${datos.archivo ? "bg-white" : "bg-gradient-to-br from-slate-800 via-slate-900 to-black"}`}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
      <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur sm:left-3 sm:top-3 sm:py-1">
        <Nfc className="h-3 w-3" /> Lado {lado}
      </div>
      <div className="pointer-events-none absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3">
        {datos.mensaje.trim() ? (
          <p className="line-clamp-2 text-[11px] font-semibold text-white sm:text-xs">{datos.mensaje}</p>
        ) : (
          <p className="text-[11px] font-medium text-white/60 sm:text-xs">Sin texto en este lado</p>
        )}
        <p className="mt-1 truncate rounded-full bg-white/15 px-2 py-0.5 text-[9px] text-white/90 backdrop-blur sm:py-1">
          {url.trim() || "Sin URL"}
        </p>
      </div>
    </div>
  );
}

interface Vista3dLlaveroProps {
  ladoA: LadoPersonalizacion;
  ladoB: LadoPersonalizacion;
  rotacion: number;
  onRotacion: (valor: number) => void;
  destino: Destino;
  /** true para el llavero circular (ficha redonda). */
  circular: boolean;
}

/**
 * Llavero de acrilico: rectangulo con los lados izquierdo, derecho e inferior
 * curveados y el anillo metalico arriba. Gira en 3D como la tarjeta NFC.
 * En version circular la pieza es un disco con el anillo metalico arriba.
 */
function Vista3dLlavero({ ladoA, ladoB, rotacion, onRotacion, destino, circular }: Vista3dLlaveroProps) {
  const enLadoA = Math.abs(rotacion) < 90;
  const proporcion = circular ? "1 / 1" : `${destino.ancho} / ${destino.alto}`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3">
      <svg aria-hidden="true" width="0" height="0" className="absolute">
        <defs>
          <clipPath id="famkon-llavero" clipPathUnits="objectBoundingBox">
            <path d="M0.10,0 L0.90,0 C0.955,0 0.98,0.03 0.98,0.08 C0.996,0.34 0.996,0.66 0.945,0.88 C0.905,0.965 0.72,1 0.5,1 C0.28,1 0.095,0.965 0.055,0.88 C0.004,0.66 0.004,0.34 0.02,0.08 C0.02,0.03 0.045,0 0.10,0 Z" />
          </clipPath>
          <clipPath id="famkon-llavero-circular" clipPathUnits="objectBoundingBox">
            <circle cx="0.5" cy="0.5" r="0.5" />
          </clipPath>
        </defs>
      </svg>

      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Vista previa 3D
        </p>
        <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
          {circular ? "Llavero circular" : "Llavero"}
        </span>
      </div>

      <div className="flex h-64 items-center justify-center sm:h-80" style={{ perspective: "1200px" }}>
        <div
          className="relative h-44 transition-transform duration-500 sm:h-60"
          style={{ aspectRatio: proporcion, transformStyle: "preserve-3d", transform: `rotateY(${rotacion}deg)` }}
        >
          {/* anillo metalico */}
          <div className="pointer-events-none absolute -top-[14%] left-1/2 z-10 h-8 w-8 -translate-x-1/2 rounded-full border-[3px] border-slate-300 bg-gradient-to-br from-white via-slate-100 to-slate-300 shadow-md sm:h-9 sm:w-9" />
          <div className="pointer-events-none absolute -top-[3%] left-1/2 z-10 h-3.5 w-[18px] -translate-x-1/2 rounded-sm bg-gradient-to-b from-slate-200 to-slate-400" />

          <CaraLlavero lado="A" datos={ladoA} circular={circular} style={{ transform: "rotateY(0deg)" }} />
          <CaraLlavero lado="B" datos={ladoB} circular={circular} style={{ transform: "rotateY(180deg)" }} />
        </div>
      </div>

      <div className="mt-2.5 space-y-2 sm:mt-3">
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={rotacion}
          onChange={(event) => onRotacion(Number(event.target.value))}
          className="w-full accent-amber-500"
          aria-label="Girar llavero"
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
            aria-label="Girar llavero"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CaraLlavero({ lado, datos, circular, style }: { lado: "A" | "B"; datos: LadoPersonalizacion; circular: boolean; style: CSSProperties }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden bg-white shadow-2xl shadow-slate-900/30"
      style={{ ...style, backfaceVisibility: "hidden", clipPath: circular ? "url(#famkon-llavero-circular)" : "url(#famkon-llavero)" }}
    >
      <ImagenEncuadrada archivo={datos.archivo} ajuste={datos.ajuste} className={`absolute inset-0 ${datos.archivo ? "bg-white" : "bg-slate-100"}`} />
      {/* brillo del acrilico */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-transparent" />
      <div className={`pointer-events-none absolute flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-700 backdrop-blur ${
        circular ? "left-1/2 top-[10%] -translate-x-1/2" : "left-2 top-2"
      }`}>
        Lado {lado}
      </div>
      {datos.mensaje.trim() && (
        <p className="pointer-events-none absolute bottom-2 left-2 right-2 line-clamp-2 text-[11px] font-semibold text-white drop-shadow">
          {datos.mensaje}
        </p>
      )}
    </div>
  );
}

function VistaLados({
  ladoA,
  ladoB,
  permiteA,
  permiteB,
  destino,
}: {
  ladoA: LadoPersonalizacion;
  ladoB: LadoPersonalizacion;
  permiteA: boolean;
  permiteB: boolean;
  destino: Destino;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-800">
        <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Vista previa
      </p>
      <div className={`grid gap-3 ${permiteA && permiteB ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
        {permiteA && <PanelLado etiqueta="Lado A" lado={ladoA} destino={destino} />}
        {permiteB && <PanelLado etiqueta="Lado B" lado={ladoB} destino={destino} />}
      </div>
      <p className="mt-3 text-center text-[10px] text-slate-400">
        Vista referencial. El resultado final puede variar.
      </p>
    </div>
  );
}

function PanelLado({ etiqueta, lado, destino }: { etiqueta: string; lado: LadoPersonalizacion; destino: Destino }) {
  const mensaje = lado.mensaje.trim();
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="relative w-full bg-white" style={{ aspectRatio: `${destino.ancho} / ${destino.alto}` }}>
        {lado.archivo ? (
          <ImagenEncuadrada archivo={lado.archivo} ajuste={lado.ajuste} className="absolute inset-0" />
        ) : (
          <ImagePlus className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-slate-400" />
        )}
        {mensaje && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent p-2 pt-6">
            <p className="line-clamp-3 text-[10px] font-semibold leading-snug text-white drop-shadow">{mensaje}</p>
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{etiqueta}</p>
      </div>
    </div>
  );
}

export default EditorPersonalizacion;
