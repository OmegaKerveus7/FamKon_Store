import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import type { Usuario, Permiso } from "../api/famkon";
import { guardarToken, eliminarToken, obtenerToken, renovarSesion, tokenPorVencer, obtenerPermisos } from "../api/famkon";

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
  /** true mientras se renueva la sesión al volver a la pestaña. */
  renovandoSesion: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "famkon.usuario";
const PERMISOS_KEY = "famkon.permisos";
export const ACTIVIDAD_KEY = "famkon.ultima_actividad";

// Una hora de inactividad. Aviso un minuto antes del cierre.
export const TIMEOUT_INACTIVIDAD_MS = 60 * 60 * 1000;
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
  const [renovandoSesion, setRenovandoSesion] = useState(false);

  const cerrarSesion = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PERMISOS_KEY);
    localStorage.removeItem(ACTIVIDAD_KEY);
    eliminarToken();
    setUsuario(null);
    setToken(null);
    setPermisos([]);
    setRenovandoSesion(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const renovarToken = useCallback(async (): Promise<boolean> => {
    const actual = obtenerToken();
    if (!actual) return false;
    const resultado = await renovarSesion();
    if (resultado.invalido) {
      cerrarSesion();
      return false;
    }
    if (resultado.token) {
      setToken(resultado.token);
      return true;
    }
    return false;
  }, [cerrarSesion]);

  const cargarPermisos = useCallback(async () => {
    try {
      const respuesta = await obtenerPermisos();
      if (respuesta.codigoS === 200 && respuesta.permisos) {
        localStorage.setItem(PERMISOS_KEY, JSON.stringify(respuesta.permisos));
        setPermisos(respuesta.permisos);
      } else {
        // Si falla la carga de permisos, limpiar y forzar logout
        console.error("Error cargando permisos:", respuesta.mensaje);
        localStorage.removeItem(PERMISOS_KEY);
        setPermisos([]);
      }
    } catch (err) {
      console.error("Excepción cargando permisos:", err);
      localStorage.removeItem(PERMISOS_KEY);
      setPermisos([]);
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

  // ─── Refresco proactivo del JWT cada 5 minutos ────────────────────────────
  useEffect(() => {
    if (!token) return;

    intervalRef.current = setInterval(() => {
      void renovarToken();
    }, 5 * 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [token, renovarToken]);

  // ─── Al volver a la pestaña (móvil) renovar antes de que expire ───────────
  useEffect(() => {
    if (!token) return;

    const alVolver = () => {
      if (document.visibilityState !== "visible") return;
      const actual = obtenerToken();
      if (!actual) return;
      if (!tokenPorVencer(actual, 10 * 60 * 1000)) return;
      setRenovandoSesion(true);
      void renovarToken().finally(() => setRenovandoSesion(false));
    };

    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    window.addEventListener("online", alVolver);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
      window.removeEventListener("online", alVolver);
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
        renovandoSesion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
