import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
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
  tienePermiso: (codigoPermiso: string) => boolean;
  tieneRol: (codigoRol: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "famkon.usuario";
const PERMISOS_KEY = "famkon.permisos";
const REFRESH_INTERVAL_MS = 8 * 60 * 1000;

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

  const cerrarSesion = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PERMISOS_KEY);
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
      // Silenciar errores de permisos (puede que el endpoint no exista aún)
    }
  }, []);

  const tienePermiso = useCallback((codigoPermiso: string): boolean => {
    return permisos.some(p => p.codigoPermiso === codigoPermiso);
  }, [permisos]);

  const tieneRol = useCallback((codigoRol: string): boolean => {
    return permisos.some(p => p.codigoRol === codigoRol);
  }, [permisos]);

  useEffect(() => {
    if (!token) return;

    intervalRef.current = setInterval(async () => {
      await renovarToken();
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [token, renovarToken]);

  // Cargar permisos cuando hay token pero no hay permisos guardados
  useEffect(() => {
    if (token && permisos.length === 0) {
      cargarPermisos();
    }
  }, [token, permisos.length, cargarPermisos]);

  function iniciarSesion(u: Usuario, t: string) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    guardarToken(t);
    setUsuario(u);
    setToken(t);
  }

  return (
    <AuthContext.Provider value={{ usuario, token, permisos, iniciarSesion, cerrarSesion, renovarToken, cargarPermisos, tienePermiso, tieneRol }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
