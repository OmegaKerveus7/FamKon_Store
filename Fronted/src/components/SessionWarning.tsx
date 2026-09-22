import { useEffect, useState } from "react";
import { ShieldAlert, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface Props {
  segundosRestantes: number;
  totalSegundos: number;
  onExtender: () => Promise<boolean> | boolean;
  onCerrarSesion: () => void;
}

export default function SessionWarning({
  segundosRestantes,
  totalSegundos,
  onExtender,
  onCerrarSesion,
}: Props) {
  const { usuario } = useAuth();
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");

  async function handleExtender() {
    setProcesando(true);
    setError("");
    try {
      const ok = await onExtender();
      if (!ok) setError("No se pudo renovar la sesion. Intenta de nuevo.");
    } finally {
      setProcesando(false);
    }
  }

  const minutos = Math.floor(segundosRestantes / 60);
  const segundos = segundosRestantes % 60;
  const progreso = Math.max(0, Math.min(100, (segundosRestantes / totalSegundos) * 100));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
                Sesion por expirar
              </p>
              <h2 className="text-xl font-bold">Sigues aqui, {usuario?.nickname}?</h2>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-sm text-slate-600">
            Detectamos inactividad. Tu sesion se cerrara automaticamente para
            proteger tu cuenta.
          </p>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Tiempo restante
              </span>
              <span className="font-mono text-2xl font-bold text-amber-600">
                {minutos}:{segundos.toString().padStart(2, "0")}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-1000 ease-linear"
                style={{ width: `${progreso}%` }}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onCerrarSesion}
              disabled={procesando}
              className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cerrar sesion
            </button>
            <button
              onClick={handleExtender}
              disabled={procesando}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-amber-400 disabled:opacity-50"
            >
              {procesando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span>Continuar sesion</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function useInactividad({
  inactivoMs,
  avisoMs,
  onAviso,
  onExpiro,
}: {
  inactivoMs: number;
  avisoMs: number;
  onAviso: () => void;
  onExpiro: () => void;
}) {
  const [ultimaActividad, setUltimaActividad] = useState<number>(Date.now());

  useEffect(() => {
    let timerAviso: ReturnType<typeof setTimeout> | null = null;
    let timerExpiro: ReturnType<typeof setTimeout> | null = null;

    function reset() {
      setUltimaActividad(Date.now());
      if (timerAviso) clearTimeout(timerAviso);
      if (timerExpiro) clearTimeout(timerExpiro);
      timerAviso = setTimeout(onAviso, inactivoMs - avisoMs);
      timerExpiro = setTimeout(onExpiro, inactivoMs);
    }

    function onActivity() {
      reset();
    }

    const eventos: (keyof WindowEventMap)[] = [
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
      "mousemove",
    ];

    for (const ev of eventos) {
      window.addEventListener(ev, onActivity, { passive: true });
    }

    reset();

    return () => {
      for (const ev of eventos) {
        window.removeEventListener(ev, onActivity);
      }
      if (timerAviso) clearTimeout(timerAviso);
      if (timerExpiro) clearTimeout(timerExpiro);
    };
  }, [inactivoMs, avisoMs, onAviso, onExpiro]);

  return { ultimaActividad };
}
