import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Camera, VideoOff } from "lucide-react";

export interface CameraCaptureHandle {
  capturar: () => string | null;
  apagar: () => void;
}

const CameraCapture = forwardRef<CameraCaptureHandle>(function CameraCapture(_props, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [encendida, setEncendida] = useState(false);
  const [error, setError] = useState("");

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
    } catch {
      setError("No se pudo acceder a la cámara. Asegúrate de permitir el permiso.");
    }
  }

  function apagar() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setEncendida(false);
  }

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
    }),
    [encendida],
  );

  return (
    <div className="space-y-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border-2 border-dashed border-amber-300 bg-slate-950">
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
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
        {encendida && (
          <div className="absolute right-3 top-3 rounded-full bg-emerald-500/90 px-2.5 py-1 text-xs font-semibold text-white">
            Cámara activa
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      {encendida && (
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