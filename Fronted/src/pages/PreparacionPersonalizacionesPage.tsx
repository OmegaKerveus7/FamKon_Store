import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  ClipboardList,
  Copy,
  ExternalLink,
  Loader2,
  Nfc,
  Package,
  Printer,
  RefreshCw,
  Search,
  Truck,
} from "lucide-react";
import ImagenArchivo from "../components/ImagenArchivo";
import { fotoCompra } from "../api/compras";
import { useAuth } from "../context/AuthContext";
import {
  listarPreparacionesPersonalizadas,
  marcarPersonalizacionPreparada,
  type PreparacionPersonalizada,
  type PreparacionesResumen,
} from "../api/famkon";
import { ESTADOS_COMPRA } from "../domain/compras";
import { esLlaveroCircular } from "../domain/formaProducto";
import { recorteHtml, empacarEnHojas, ANCHO_HOJA_CM, ALTO_HOJA_CM, SEPARACION_CM } from "../domain/impresion";

type Vista = "supervisor" | "produccion" | "admin";

/** Medidas por defecto cuando el producto no tiene ANCHO_CM/ALTO_CM (migracion 17). */
const ANCHO_POR_DEFECTO_CM = 8.5;
const ALTO_POR_DEFECTO_CM = 5.5;

const RESUMEN_VACIO: PreparacionesResumen = {
  pedidos: 0,
  lineasPendientes: 0,
  productosPendientes: 0,
  lineasPreparadas: 0,
  totalLineas: 0,
};

const ESTILOS_IMPRESION = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; background: #fff; color: #0f172a; }
  .ficha {
    display: flex; flex-direction: column; align-items: center; gap: 7mm;
    padding-top: 6mm; page-break-after: always; break-after: page;
  }
  .ficha:last-child { page-break-after: auto; break-after: auto; }
  .pareja {
    display: flex; align-items: center; justify-content: center; gap: 8mm;
    break-inside: avoid;
  }
  .recorte {
    position: relative; display: flex; align-items: center; justify-content: center;
    background: #fff; overflow: hidden;
    border: 0.2mm dashed #94a3b8;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .recorte img { display: block; object-fit: cover; }
  .ticket {
    width: 8.5cm; height: 5.5cm; padding: 4mm 4.5mm;
    display: flex; flex-direction: column; justify-content: center;
    border: 0.25mm dashed #94a3b8; border-radius: 0.5cm; background: #fff;
    overflow: hidden; break-inside: avoid;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .ticket-marca { margin: 0; font-size: 2.4mm; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #b45309; }
  .ticket-numero { margin: 0.6mm 0 1.6mm; font-size: 5.2mm; font-weight: 800; line-height: 1.05; word-break: break-all; }
  .ticket-linea { margin: 0.5mm 0; font-size: 2.9mm; line-height: 1.25; }
  .ticket-linea strong { font-weight: 700; }
  .hoja {
    width: ${ANCHO_HOJA_CM}cm; min-height: ${ALTO_HOJA_CM}cm;
    padding-top: 2mm; page-break-after: always; break-after: page;
  }
  .hoja:last-child { page-break-after: auto; break-after: auto; }
  .rejilla { display: flex; flex-direction: column; gap: ${SEPARACION_CM}cm; align-items: stretch; }
  .fila { display: flex; flex-wrap: nowrap; align-items: flex-start; justify-content: center; gap: ${SEPARACION_CM}cm; break-inside: avoid; }
  .celda { display: flex; flex-direction: column; align-items: center; gap: 1mm; break-inside: avoid; }
  .pie { margin: 0; font-size: 7pt; color: #334155; text-align: center; line-height: 1.2; }
  .tickets { display: grid; grid-template-columns: repeat(2, 8.5cm); gap: ${SEPARACION_CM}cm; align-items: start; }
  .hoja-titulo { margin: 0 0 4mm; font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #b45309; }
`;

function etiquetaEstado(estado: string, nombre: string): string {
  return ESTADOS_COMPRA[estado] ?? (nombre || estado.replaceAll("_", " "));
}

function medidas(item: PreparacionPersonalizada): { ancho: number; alto: number } {
  return {
    ancho: item.anchoCm && item.anchoCm > 0 ? item.anchoCm : ANCHO_POR_DEFECTO_CM,
    alto: item.altoCm && item.altoCm > 0 ? item.altoCm : ALTO_POR_DEFECTO_CM,
  };
}

async function archivoComoDataUrl(id: number | null): Promise<string | null> {
  if (!id) return null;
  let url = "";
  try {
    url = await fotoCompra(id);
    const blob = await (await fetch(url)).blob();
    return await new Promise<string>((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(String(lector.result));
      lector.onerror = () => reject(new Error("No se pudo leer la imagen."));
      lector.readAsDataURL(blob);
    });
  } catch {
    return null;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

function escapar(valor: string | null | undefined): string {
  return (valor ?? "").replace(/[&<>"']/g, (caracter) => {
    switch (caracter) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

function LadoVista({
  titulo,
  idArchivo,
  mensaje,
  ancho,
  alto,
}: {
  titulo: string;
  idArchivo: number | null;
  mensaje: string | null;
  ancho: number;
  alto: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2">
      <div className="mb-1.5 flex items-center justify-between gap-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{titulo}</p>
        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
          {ancho} × {alto} cm
        </span>
      </div>
      <div className="flex h-36 items-center justify-center overflow-hidden rounded-lg bg-white sm:h-44">
        {idArchivo ? (
          <ImagenArchivo id={idArchivo} alt={titulo} className="max-h-36 w-full object-contain sm:max-h-44" />
        ) : (
          <p className="text-xs text-slate-400">Sin imagen</p>
        )}
      </div>
      {mensaje ? (
        <p className="mt-1.5 whitespace-pre-wrap text-xs text-slate-700">{mensaje}</p>
      ) : (
        <p className="mt-1.5 text-xs text-slate-400">Sin texto</p>
      )}
    </div>
  );
}

export default function PreparacionPersonalizacionesPage({ vista = "supervisor" }: { vista?: Vista }) {
  const { tienePermiso } = useAuth();
  // El enlace al pedido solo aplica a quien puede ver el tracking general.
  const puedeVerPedido = vista === "admin" || tienePermiso("VER_DASHBOARD");
  const [items, setItems] = useState<PreparacionPersonalizada[]>([]);
  const [resumen, setResumen] = useState<PreparacionesResumen>(RESUMEN_VACIO);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [filtro, setFiltro] = useState<"pendientes" | "todas">("pendientes");
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState<number | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);
  const [imprimiendo, setImprimiendo] = useState<number | "productos" | "etiquetas" | "todo" | null>(null);

  const cargar = useCallback(async (signal?: AbortSignal, visible = false) => {
    if (visible) setCargando(true);
    try {
      const datos = await listarPreparacionesPersonalizadas(signal);
      setItems(datos.items);
      setResumen(datos.resumen);
      setError("");
    } catch (e) {
      if (!signal?.aborted) setError((e as Error).message);
    } finally {
      if (!signal?.aborted) setCargando(false);
    }
  }, []);

  useEffect(() => {
    const control = new AbortController();
    void cargar(control.signal, true);
    const temporizador = window.setInterval(() => {
      if (!document.hidden) void cargar(control.signal);
    }, 45000);
    return () => {
      control.abort();
      window.clearInterval(temporizador);
    };
  }, [cargar]);

  const visibles = useMemo(() => {
    const consulta = busqueda.trim().toLowerCase();
    return items.filter((item) => {
      if (filtro === "pendientes" && item.preparada) return false;
      if (!consulta) return true;
      return [item.numeroPedido, item.producto, item.sku, item.comprador, item.areaEntrega, item.repartidor]
        .some((valor) => (valor ?? "").toLowerCase().includes(consulta));
    });
  }, [items, filtro, busqueda]);

  const grupos = useMemo(() => {
    const mapa = new Map<number, {
      idPedido: number;
      numeroPedido: string;
      estado: string;
      estadoNombre: string;
      comprador: string | null;
      areaEntrega: string | null;
      direccion: string | null;
      repartidor: string | null;
      items: PreparacionPersonalizada[];
    }>();
    for (const item of visibles) {
      const grupo = mapa.get(item.idPedido) ?? {
        idPedido: item.idPedido,
        numeroPedido: item.numeroPedido,
        estado: item.estado,
        estadoNombre: item.estadoNombre,
        comprador: item.comprador,
        areaEntrega: item.areaEntrega,
        direccion: item.direccion,
        repartidor: item.repartidor,
        items: [],
      };
      grupo.items.push(item);
      mapa.set(item.idPedido, grupo);
    }
    return [...mapa.values()];
  }, [visibles]);

  const pendientesVisibles = visibles.filter((item) => !item.preparada);

  async function alternar(item: PreparacionPersonalizada) {
    setGuardando(item.idPedidoDetalle);
    setError("");
    setAviso("");
    try {
      const resultado = await marcarPersonalizacionPreparada(item.idPedidoDetalle, !item.preparada);
      if (!item.preparada && resultado.avanzado && resultado.estadoPedido) {
        setAviso(
          `Pedido ${item.numeroPedido}: personalización completa, pasó a “${etiquetaEstado(resultado.estadoPedido, "")}” y ya está en el tracking.`,
        );
      } else if (!item.preparada && resultado.motivo) {
        setAviso(`Producto marcado como preparado. ${resultado.motivo}`);
      } else {
        setAviso(item.preparada ? "Se marcó como pendiente de preparar." : "Producto marcado como preparado.");
      }
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(null);
    }
  }

  async function copiar(item: PreparacionPersonalizada) {
    if (!item.urlNfc) return;
    try {
      await navigator.clipboard.writeText(item.urlNfc);
      setCopiado(item.idPedidoDetalle);
      window.setTimeout(() => setCopiado(null), 1800);
    } catch {
      setError("No se pudo copiar la URL. Copiala manualmente desde la ficha.");
    }
  }

  async function fichaHtml(items: PreparacionPersonalizada[]): Promise<string> {
    const parejas: string[] = [];
    for (const item of items) {
      const [ladoA, ladoB] = await Promise.all([
        archivoComoDataUrl(item.idArchivoLadoA),
        archivoComoDataUrl(item.idArchivoLadoB),
      ]);
      const { ancho, alto } = medidas(item);
      const circular = esLlaveroCircular(item.producto, item.sku, null);
      parejas.push(`<div class="pareja">${recorteHtml(ladoA, ancho, alto, circular)}${recorteHtml(ladoB, ancho, alto, circular)}</div>`);
    }
    // Ticket de entrega fuera de la ficha individual: roba espacio de la hoja (las etiquetas se imprimen aparte).
    // return `<article class="ficha">${parejas.join("")}${ticketHtml(items[0])}</article>`;
    return `<article class="ficha">${parejas.join("")}</article>`;
  }

  /** Ticket de entrega: mismo tamaño que la tarjeta, con pedido y destinatario. */
  function ticketHtml(item: PreparacionPersonalizada): string {
    const entrega = [item.areaEntrega, item.direccion].filter(Boolean).join(" · ");
    const { ancho, alto } = medidas(item);
    const anchoTicket = Math.max(ancho, ANCHO_POR_DEFECTO_CM);
    const altoTicket = Math.max(alto, ALTO_POR_DEFECTO_CM);
    return `<section class="ticket" style="width:${anchoTicket}cm;height:${altoTicket}cm">
      <p class="ticket-marca">FamKon · Ticket de entrega</p>
      <p class="ticket-numero">${escapar(item.numeroPedido)}</p>
      <p class="ticket-linea"><strong>Para:</strong> ${escapar(item.comprador) || "—"}</p>
      <p class="ticket-linea"><strong>Tel.:</strong> ${escapar(item.telefono) || "—"}</p>
      <p class="ticket-linea"><strong>Entrega:</strong> ${escapar(entrega) || "—"}</p>
      <p class="ticket-linea"><strong>Producto:</strong> ${escapar(item.producto)} × ${item.cantidad}</p>
    </section>`;
  }

  /**
   * Impresión compacta: los productos (par A/B) y las etiquetas (tickets) se
   * pueden imprimir por separado, para usar impresoras y hojas distintas.
   * `solo` decide que se imprime en esta ventana.
   */
  async function imprimirTodo(
    lista: PreparacionPersonalizada[],
    clave: number | "productos" | "etiquetas" | "todo",
    solo: "productos" | "etiquetas" | "todo" = "todo",
  ) {
    if (!lista.length || imprimiendo !== null) return;
    setImprimiendo(clave);
    setError("");
    const ventana = window.open("", "_blank", "width=900,height=1000");
    if (!ventana) {
      setError("Permití las ventanas emergentes para poder imprimir las fichas.");
      setImprimiendo(null);
      return;
    }
    ventana.document.write("<p style='font-family:sans-serif;padding:24px'>Preparando las imágenes…</p>");
    try {
      const cargados = await Promise.all(
        lista.map(async (item) => {
          const [ladoA, ladoB] = await Promise.all([
            archivoComoDataUrl(item.idArchivoLadoA),
            archivoComoDataUrl(item.idArchivoLadoB),
          ]);
          const { ancho, alto } = medidas(item);
          return { item, ladoA, ladoB, ancho, alto };
        }),
      );

      const paginas: string[] = [];

      if (solo !== "etiquetas") {
        // Productos: repartidos en filas que llenan el ancho de la hoja.
        const porId = new Map(cargados.map((c) => [c.item.idPedidoDetalle, c]));
        const hojas = empacarEnHojas(
          cargados.map((c) => ({ id: c.item.idPedidoDetalle, anchoCm: c.ancho, altoCm: c.alto })),
        );
        for (const hoja of hojas) {
          const filas = hoja.filas.map((contenido) => {
            const celdas = contenido.map((entrada) => {
              const c = porId.get(entrada.id)!;
              const circular = esLlaveroCircular(c.item.producto, c.item.sku, null);
              const par = `<div class="pareja">${recorteHtml(c.ladoA, c.ancho, c.alto, circular)}${recorteHtml(c.ladoB, c.ancho, c.alto, circular)}</div>`;
              const pie = `<p class="pie">${escapar(c.item.numeroPedido)} · ${escapar(c.item.producto)} × ${c.item.cantidad}</p>`;
              return `<div class="celda">${par}${pie}</div>`;
            });
            return `<div class="fila">${celdas.join("")}</div>`;
          });
          paginas.push(`<article class="hoja"><div class="rejilla">${filas.join("")}</div></article>`);
        }
      }

      if (solo !== "productos") {
        // Etiquetas: un ticket por pedido, dos por fila.
        const pedidos = new Map<number, PreparacionPersonalizada>();
        for (const item of lista) if (!pedidos.has(item.idPedido)) pedidos.set(item.idPedido, item);
        if (pedidos.size) {
          const tickets = [...pedidos.values()].map((item) => ticketHtml(item)).join("");
          paginas.push(
            `<article class="hoja"><p class="hoja-titulo">Etiquetas de entrega</p><div class="tickets">${tickets}</div></article>`,
          );
        }
      }

      if (!paginas.length) {
        ventana.close();
        setImprimiendo(null);
        return;
      }

      const titulo = solo === "etiquetas" ? "Etiquetas" : solo === "productos" ? "Productos" : "Personalizaciones";
      ventana.document.open();
      ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>FamKon · ${titulo}</title><style>${ESTILOS_IMPRESION}</style></head><body>${paginas.join("")}<script>window.onload = () => setTimeout(() => window.print(), 300);</script></body></html>`);
      ventana.document.close();
    } catch (e) {
      setError((e as Error).message);
      ventana.close();
    } finally {
      setImprimiendo(null);
    }
  }

  async function imprimir(lista: PreparacionPersonalizada[], clave: number) {
    if (!lista.length || imprimiendo !== null) return;
    setImprimiendo(clave);
    setError("");
    const ventana = window.open("", "_blank", "width=900,height=1000");
    if (!ventana) {
      setError("Permití las ventanas emergentes para poder imprimir las fichas.");
      setImprimiendo(null);
      return;
    }
    ventana.document.write("<p style='font-family:sans-serif;padding:24px'>Preparando las imágenes…</p>");
    try {
      const porPedido = new Map<number, PreparacionPersonalizada[]>();
      for (const item of lista) {
        const grupo = porPedido.get(item.idPedido) ?? [];
        grupo.push(item);
        porPedido.set(item.idPedido, grupo);
      }

      const fichas: string[] = [];
      for (const items of porPedido.values()) fichas.push(await fichaHtml(items));

      ventana.document.open();
      ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>FamKon · Personalizaciones</title><style>${ESTILOS_IMPRESION}</style></head><body>${fichas.join("")}<script>window.onload = () => setTimeout(() => window.print(), 300);</script></body></html>`);
      ventana.document.close();
    } catch (e) {
      setError((e as Error).message);
      ventana.close();
    } finally {
      setImprimiendo(null);
    }
  }

  const rutaPedido = (idPedido: number) =>
    vista === "admin" ? `/admin/pedidos?pedido=${idPedido}` : `/entregas/tracking?pedido=${idPedido}`;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[.18em] text-amber-600">FamKon · Personalizaciones</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Personalizaciones por preparar</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Revisá cuántos productos personalizados faltan, imprimí las imágenes del frente y del reverso al tamaño real y marcá el producto como
            preparado. Al completar todas las líneas, el pedido pasa solo a “Listo para entrega” (o “Listo para recoger”). La impresión incluye un
            ticket por pedido con el número y el destinatario.
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <button
            type="button"
            onClick={() => void cargar(undefined, true)}
            disabled={cargando}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 sm:flex-none"
          >
            <RefreshCw size={16} className={cargando ? "animate-spin" : ""} /> Actualizar
          </button>
          <button
            type="button"
            onClick={() => void imprimirTodo(pendientesVisibles, "productos", "productos")}
            disabled={!pendientesVisibles.length || imprimiendo !== null}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60 sm:flex-none"
          >
            {imprimiendo === "productos" ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />} Imprimir productos
          </button>
          <button
            type="button"
            onClick={() => void imprimirTodo(pendientesVisibles, "etiquetas", "etiquetas")}
            disabled={!pendientesVisibles.length || imprimiendo !== null}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 sm:flex-none"
          >
            {imprimiendo === "etiquetas" ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />} Imprimir etiquetas
          </button>
          <button
            type="button"
            onClick={() => void imprimirTodo(visibles, "todo", "todo")}
            disabled={!visibles.length || imprimiendo !== null}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-60 sm:flex-none"
          >
            {imprimiendo === "todo" ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />} Imprimir todo
          </button>
        </div>
      </header>

      <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Al imprimir, elegí <strong>escala 100 %</strong> (sin “ajustar a la página”) para que las medidas en centímetros salgan exactas.{" "}
        <strong>Imprimir productos</strong> y <strong>Imprimir etiquetas</strong> abren ventanas distintas: así podés usar una impresora y hojas diferentes para cada cosa.
      </p>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><ClipboardList size={13} /> Pedidos</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{resumen.pedidos}</p>
          <p className="text-[11px] text-slate-500">por preparar</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 shadow-sm">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700"><Package size={13} /> Productos</p>
          <p className="mt-1 text-2xl font-bold text-amber-800">{resumen.productosPendientes}</p>
          <p className="text-[11px] text-amber-700/80">unidades pendientes</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><Truck size={13} /> Líneas</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{resumen.lineasPendientes}</p>
          <p className="text-[11px] text-slate-500">pendientes</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700"><Check size={13} /> Preparadas</p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">{resumen.lineasPreparadas}</p>
          <p className="text-[11px] text-emerald-700/80">listas para entregar</p>
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setFiltro("pendientes")}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition sm:flex-none ${filtro === "pendientes" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Pendientes ({resumen.lineasPendientes})
          </button>
          <button
            type="button"
            onClick={() => setFiltro("todas")}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition sm:flex-none ${filtro === "todas" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Todas ({resumen.totalLineas})
          </button>
        </div>
        <label className="relative block w-full sm:w-72">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar pedido, producto o cliente…"
            className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
        </label>
      </section>

      {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {aviso && <p role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">{aviso}</p>}

      {cargando && !items.length ? (
        <p className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-500">
          <Loader2 size={18} className="animate-spin" /> Cargando personalizaciones…
        </p>
      ) : !grupos.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <Package size={36} className="mx-auto text-slate-300" />
          <p className="mt-3 font-semibold text-slate-800">
            {filtro === "pendientes" ? "No hay productos personalizados pendientes" : "No hay productos personalizados"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {busqueda ? "Probá con otra búsqueda." : "Cuando un pedido incluya personalización aparecerá aquí con sus imágenes y la URL del NFC."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {grupos.map((grupo) => (
            <section key={grupo.idPedido} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 bg-slate-50/70 p-3 sm:p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-slate-900">{grupo.numeroPedido}</h2>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                      {etiquetaEstado(grupo.estado, grupo.estadoNombre)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {[grupo.comprador, grupo.areaEntrega, grupo.direccion].filter(Boolean).join(" · ") || "Sin datos de entrega"}
                  </p>
                  {grupo.repartidor && <p className="mt-0.5 text-xs text-slate-400">Repartidor: {grupo.repartidor}</p>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {puedeVerPedido && (
                    <Link
                      to={rutaPedido(grupo.idPedido)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <ExternalLink size={13} /> Ver tracking
                    </Link>
                  )}
                </div>
              </div>

              <ul className="divide-y divide-slate-100">
                {grupo.items.map((item) => {
                  const { ancho, alto } = medidas(item);
                  return (
                    <li key={item.idPedidoDetalle} className={`p-3 sm:p-4 ${item.preparada ? "bg-emerald-50/30" : ""}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{item.producto}</p>
                          <p className="text-xs text-slate-500">
                            {item.sku} · Cantidad {item.cantidad} · Imprime {ancho} × {alto} cm
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${item.preparada ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                            {item.preparada ? "Preparado" : "Pendiente"}
                          </span>
                          <button
                            type="button"
                            onClick={() => void imprimir([item], item.idPedidoDetalle)}
                            disabled={imprimiendo !== null}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                          >
                            {imprimiendo === item.idPedidoDetalle ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />} Imprimir
                          </button>
                          <button
                            type="button"
                            onClick={() => void alternar(item)}
                            disabled={guardando === item.idPedidoDetalle}
                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition disabled:opacity-60 ${item.preparada ? "border border-slate-200 text-slate-600 hover:bg-slate-50" : "bg-emerald-600 text-white hover:bg-emerald-500"}`}
                          >
                            {guardando === item.idPedidoDetalle ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                            {item.preparada ? "Deshacer" : "Marcar preparado"}
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <LadoVista titulo="Lado A" idArchivo={item.idArchivoLadoA} mensaje={item.mensajeLadoA} ancho={ancho} alto={alto} />
                        <LadoVista titulo="Lado B" idArchivo={item.idArchivoLadoB} mensaje={item.mensajeLadoB} ancho={ancho} alto={alto} />
                      </div>

                      {item.urlNfc ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 p-2.5">
                          <Nfc size={16} className="shrink-0 text-sky-600" />
                          <span className="text-[11px] font-bold uppercase tracking-wide text-sky-800">URL NFC</span>
                          <code className="min-w-0 flex-1 truncate text-xs text-slate-800">{item.urlNfc}</code>
                          <button
                            type="button"
                            onClick={() => void copiar(item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-white px-2 py-1 text-[11px] font-semibold text-sky-800 transition hover:bg-sky-100"
                          >
                            {copiado === item.idPedidoDetalle ? <Check size={13} /> : <Copy size={13} />}
                            {copiado === item.idPedidoDetalle ? "Copiada" : "Copiar"}
                          </button>
                        </div>
                      ) : (
                        <p className="mt-2 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-500">Este producto no requiere NFC.</p>
                      )}

                      {item.preparada && item.fechaPreparacion && (
                        <p className="mt-1.5 text-[11px] text-emerald-700">
                          Preparado el {new Date(item.fechaPreparacion).toLocaleString("es-GT")}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
