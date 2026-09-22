import { useCallback, useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import SessionWarning from "./SessionWarning";
import { useAuth } from "../context/AuthContext";
import {
  TIMEOUT_INACTIVIDAD_MS,
  AVISO_INACTIVIDAD_MS,
} from "../context/AuthContext";

export default function DashboardLayout() {
  const [colapsado, setColapsado] = useState(false);
  const [mostrarAviso, setMostrarAviso] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(
    Math.ceil(AVISO_INACTIVIDAD_MS / 1000),
  );

  const { usuario, token, registrarActividad, renovarToken, cerrarSesion, refrescarPermisos } = useAuth();
  const navigate = useNavigate();

  // ─── Aviso de sesion: aparece 60s antes del logout automatico ────────────────
  const handleExpiro = useCallback(() => {
    setMostrarAviso(false);
    cerrarSesion();
    navigate("/login", { replace: true });
  }, [cerrarSesion, navigate]);

  const handleAviso = useCallback(() => {
    if (!usuario) return;
    setMostrarAviso(true);
    setSegundosRestantes(Math.ceil(AVISO_INACTIVIDAD_MS / 1000));
  }, [usuario]);

  // ─── Track de actividad: cualquier evento del usuario reinicia el contador ──
  useEffect(() => {
    if (!usuario) return;

    const eventos: (keyof WindowEventMap)[] = [
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
      "mousemove",
    ];

    const onActivity = () => {
      // Solo registrar si NO estamos en el modal de aviso
      if (!mostrarAviso) registrarActividad();
    };

    for (const ev of eventos) {
      window.addEventListener(ev, onActivity, { passive: true });
    }

    return () => {
      for (const ev of eventos) {
        window.removeEventListener(ev, onActivity);
      }
    };
  }, [usuario, mostrarAviso, registrarActividad]);

  // ─── Timer principal: dispara aviso + expiracion ────────────────────────────
  useEffect(() => {
    if (!usuario) return;

    let timerAviso: ReturnType<typeof setTimeout> | null = null;
    let timerExpiro: ReturnType<typeof setTimeout> | null = null;

    function reset() {
      if (timerAviso) clearTimeout(timerAviso);
      if (timerExpiro) clearTimeout(timerExpiro);
      // Aviso a los 9 min (10 min - 1 min de aviso)
      timerAviso = setTimeout(handleAviso, TIMEOUT_INACTIVIDAD_MS - AVISO_INACTIVIDAD_MS);
      // Expiracion a los 10 min
      timerExpiro = setTimeout(handleExpiro, TIMEOUT_INACTIVIDAD_MS);
    }

    reset();

    return () => {
      if (timerAviso) clearTimeout(timerAviso);
      if (timerExpiro) clearTimeout(timerExpiro);
    };
  }, [usuario, mostrarAviso, handleAviso, handleExpiro]);

  // ─── Countdown visible mientras el aviso esta activo ─────────────────────────
  useEffect(() => {
    if (!mostrarAviso) return;
    setSegundosRestantes(Math.ceil(AVISO_INACTIVIDAD_MS / 1000));
    const interval = setInterval(() => {
      setSegundosRestantes((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [mostrarAviso]);

  const handleExtender = useCallback(async () => {
    const ok = await renovarToken();
    if (ok) {
      registrarActividad();
      setMostrarAviso(false);
    }
    return ok;
  }, [renovarToken, registrarActividad]);

  const handleCerrarSesion = useCallback(() => {
    setMostrarAviso(false);
    cerrarSesion();
    navigate("/login", { replace: true });
  }, [cerrarSesion, navigate]);

  // ─── Refrescar permisos cada vez que el usuario entra al dashboard ────────
  // Esto resuelve el caso: el usuario cambio de rol en la BD pero sus permisos
  // cacheados en localStorage siguen siendo los antiguos.
  useEffect(() => {
    if (!usuario) return;
    refrescarPermisos();
  }, [usuario, refrescarPermisos]);

  if (!usuario || !token) return null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      <Sidebar colapsado={colapsado} onToggle={() => setColapsado((v) => !v)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onToggleSidebar={() => setColapsado((v) => !v)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      {mostrarAviso && (
        <SessionWarning
          segundosRestantes={segundosRestantes}
          totalSegundos={Math.ceil(AVISO_INACTIVIDAD_MS / 1000)}
          onExtender={handleExtender}
          onCerrarSesion={handleCerrarSesion}
        />
      )}
    </div>
  );
}
