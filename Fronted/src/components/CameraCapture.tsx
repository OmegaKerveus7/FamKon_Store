import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Camera, VideoOff } from "lucide-react";
import {
  evaluarCalidad,
  evaluarIluminacion,
  type DatosImagen,
  type ProblemaFoto,
  type ResultadoCalidad,
} from "../utils/calidadFoto";

export interface CameraCaptureHandle {
  capturar: () => string | null;
  apagar: () => void;
  /** Analiza el cuadro actual de la cámara (luz y nitidez). */
  analizar: () => ResultadoCalidad;
}

interface CameraCaptureProps {
  guiaRostro?: boolean;
  verificando?: boolean;
  /** Muestra el aviso de calidad mientras la cámara está encendida. */
  mostrarCalidad?: boolean;
  onLista?: (lista: boolean) => void;
  onCalidad?: (resultado: ResultadoCalidad) => void;
}

const ICONOS: Record<ProblemaFoto, string> = {
  poco_luz: "🌙",
  mucha_luz: "💡",
  borrosa: "📷",
  sin_rostro: "🙂",
  varias_personas: "👥",
  rostro_pequeno: "🔍",
  rostro_descentrado: "🎯",
  rostro_tapado: "😷",
};

const CameraCapture = forwardRef<CameraCaptureHandle, CameraCaptureProps>(function CameraCapture(
  { guiaRostro = false, verificando = false, mostrarCalidad = true, onLista, onCalidad },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [encendida, setEncendida] = useState(false);
  const [error, setError] = useState("");
  const [calidad, setCalidad] = useState<ResultadoCalidad | null>(null);

  async function encender() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setEncendida(true);
      onLista?.(true);
    } catch {
      setError("No se pudo acceder a la cámara. Asegúrate de permitir el permiso.");
    }
  }

  function apagar() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setEncendida(false);
    setCalidad(null);
    onLista?.(false);
  }

  /** Lee un cuadro del video y devuelve los pixeles para analizarlo. */
  function leerCuadro(): DatosImagen | null {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !encendida || !video.videoWidth) return null;
    const mini = document.createElement("canvas");
    mini.width = 160;
    mini.height = 120;
    const ctx = mini.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    // El video se muestra espejado (es la cámara frontal): se lee igual.
    ctx.drawImage(video, 0, 0, mini.width, mini.height);
    return ctx.getImageData(0, 0, mini.width, mini.height);
  }

  function analizarAhora(): ResultadoCalidad {
    const datos = leerCuadro();
    if (!datos) return { problemas: [], mensaje: "", puntaje: 100, ok: true };
    return evaluarCalidad(evaluarIluminacion(datos));
  }

  // Aviso de calidad en vivo mientras la cámara está encendida.
  useEffect(() => {
    if (!encendida || !mostrarCalidad) return;
    const timer = window.setInterval(() => {
      const resultado = analizarAhora();
      setCalidad(resultado);
      onCalidad?.(resultado);
    }, 1200);
    return () => window.clearInterval(timer);
  });

  useEffect(() => apagar, []);

  useImperativeHandle(
    ref,
    () => ({
      capturar: () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !encendida) return null;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", 0.85);
      },
      apagar,
      analizar: analizarAhora,
    }),
    [encendida],
  );

  return (
    <div className="space-y-3">
      <div className={`relative w-full max-h-[55dvh] overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 ${guiaRostro ? "aspect-[4/3]" : "aspect-video"}`} aria-busy={verificando}>
        <video ref={videoRef} muted playsInline className="h-full w-full object-contain" />
        {guiaRostro && encendida && <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true"><div className={`relative h-[76%] w-[48%] overflow-hidden rounded-[50%] border-2 shadow-[0_0_0_999px_rgba(2,6,23,0.35)] ${verificando ? 'border-amber-400' : 'border-white/80'}`}>{verificando && <div className="face-scan-line absolute left-0 right-0 h-0.5 bg-amber-300 shadow-[0_0_18px_5px_rgba(251,191,36,0.5)]" />}</div><span className="absolute bottom-3 rounded-full bg-slate-950/70 px-3 py-1.5 text-xs font-medium text-white">{verificando ? 'Verificando la captura…' : 'Centrá tu rostro dentro del óvalo'}</span></div>}
        {!encendida && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-200">
            {error ? (
              <>
                <p className="px-6 text-center text-sm text-red-300">{error}</p>
                <button
                  type="button"
                  onClick={encender}
                  className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
                >
                  Reintentar
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={encender}
                className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
              >
                <Camera className="h-4 w-4" /> Activar cámara
              </button>
            )}
          </div>
        )}
        {encendida && !verificando && (
          <div className="absolute right-3 top-3 rounded-full bg-emerald-500/90 px-2.5 py-1 text-xs font-semibold text-white">
            Cámara activa
          </div>
        )}
        {encendida && !verificando && mostrarCalidad && calidad && (
          <div
            role="status"
            className={`absolute left-3 top-3 flex max-w-[70%] items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              calidad.ok ? "bg-emerald-500/90 text-white" : "bg-amber-500/95 text-slate-950"
            }`}
          >
            <span aria-hidden="true">{calidad.ok ? "✓" : ICONOS[calidad.problemas[0]]}</span>
            <span className="truncate">
              {calidad.ok ? "Buena luz, mantené esa posición" : "Ajustá la luz y la nitidez"}
            </span>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      {encendida && !verificando && (
        <button
          type="button"
          onClick={apagar}
          className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          <VideoOff className="h-3.5 w-3.5" /> Apagar cámara
        </button>
      )}
    </div>
  );
});

export default CameraCapture;
