import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import type { Usuario, Permiso } from "../api/famkon";
import { guardarToken, eliminarToken, obtenerToken, refreshToken, obtenerPermisos } from "../api/famkon";

interface AuthContextValue {
  usuario: Usuario | null;
  token: string | null;
  permisos: Permiso[];
  iniciarSesion: (usuario: Usuario, token: string) => void;
  cerrarSesion: () => void;
  renovarToken: () => Promise<boolean>;
  cargarPermisos: () => Promise<void>;
  refrescarPermisos: () => Promise<void>;
  tienePermiso: (codigoPermiso: string) => boolean;
  tieneRol: (codigoRol: string) => boolean;
  registrarActividad: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "famkon.usuario";
const PERMISOS_KEY = "famkon.permisos";
export const ACTIVIDAD_KEY = "famkon.ultima_actividad";

// 10 minutos totales. Aviso al minuto 9 (60s antes del logout).
export const TIMEOUT_INACTIVIDAD_MS = 10 * 60 * 1000;
export const AVISO_INACTIVIDAD_MS = 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Usuario;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(obtenerToken);
  const [permisos, setPermisos] = useState<Permiso[]>(() => {
    const raw = localStorage.getItem(PERMISOS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as Permiso[];
    } catch {
      return [];
    }
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const actividadRef = useRef<number>(Date.now());
  const avisoActivoRef = useRef<boolean>(false);

  const cerrarSesion = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PERMISOS_KEY);
    localStorage.removeItem(ACTIVIDAD_KEY);
    eliminarToken();
    setUsuario(null);
    setToken(null);
    setPermisos([]);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const renovarToken = useCallback(async (): Promise<boolean> => {
    const currentToken = obtenerToken();
    if (!currentToken) return false;

    try {
      const respuesta = await refreshToken(currentToken);
      if (respuesta.codigoS === 200 && respuesta.token) {
        guardarToken(respuesta.token);
        setToken(respuesta.token);
        actividadRef.current = Date.now();
        localStorage.setItem(ACTIVIDAD_KEY, String(actividadRef.current));
        return true;
      }
      cerrarSesion();
      return false;
    } catch {
      cerrarSesion();
      return false;
    }
  }, [cerrarSesion]);

  const cargarPermisos = useCallback(async () => {
    try {
      const respuesta = await obtenerPermisos();
      if (respuesta.codigoS === 200 && respuesta.permisos) {
        localStorage.setItem(PERMISOS_KEY, JSON.stringify(respuesta.permisos));
        setPermisos(respuesta.permisos);
      }
    } catch {
      // Silenciar errores de permisos
    }
  }, []);

  const refrescarPermisos = useCallback(async () => {
    await cargarPermisos();
  }, [cargarPermisos]);

  const registrarActividad = useCallback(() => {
    actividadRef.current = Date.now();
    localStorage.setItem(ACTIVIDAD_KEY, String(actividadRef.current));
  }, []);

  const tienePermiso = useCallback(
    (codigoPermiso: string): boolean => {
      return permisos.some((p) => p.codigoPermiso === codigoPermiso);
    },
    [permisos],
  );

  const tieneRol = useCallback(
    (codigoRol: string): boolean => {
      return permisos.some((p) => p.codigoRol === codigoRol);
    },
    [permisos],
  );

  function iniciarSesion(u: Usuario, t: string) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    guardarToken(t);
    setUsuario(u);
    setToken(t);
    actividadRef.current = Date.now();
    localStorage.setItem(ACTIVIDAD_KEY, String(actividadRef.current));
    avisoActivoRef.current = false;
  }

  // ─── Timers: auto-refresh cada 8 min + inactividad cada 10 min ─────────────
  useEffect(() => {
    if (!token) return;

    // Auto-refresh cada 8 minutos mientras el usuario este activo.
    // Solo refrescamos si la ultima actividad fue hace menos de 1 min
    // (asi no gastamos tokens en sesiones abandonadas).
    intervalRef.current = setInterval(async () => {
      const inactivoPor = Date.now() - actividadRef.current;
      if (inactivoPor < 60 * 1000) {
        await renovarToken();
      }
    }, 8 * 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [token, renovarToken]);

  // Cargar permisos automaticamente tras login
  useEffect(() => {
    if (token && permisos.length === 0) {
      cargarPermisos();
    }
  }, [token, permisos.length, cargarPermisos]);

  return (
    <AuthContext.Provider
      value={{
        usuario,
        token,
        permisos,
        iniciarSesion,
        cerrarSesion,
        renovarToken,
        cargarPermisos,
        refrescarPermisos,
        tienePermiso,
        tieneRol,
        registrarActividad,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

import { createContext, useContext } from "react";

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
