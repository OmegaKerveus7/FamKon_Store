import { createContext, useContext, useState, type ReactNode } from "react";
import type { Usuario } from "../api/famkon";
import { guardarToken, eliminarToken, obtenerToken } from "../api/famkon";

interface AuthContextValue {
  usuario: Usuario | null;
  token: string | null;
  iniciarSesion: (usuario: Usuario, token: string) => void;
  cerrarSesion: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "famkon.usuario";

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

  function iniciarSesion(u: Usuario, t: string) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    guardarToken(t);
    setUsuario(u);
    setToken(t);
  }

  function cerrarSesion() {
    localStorage.removeItem(STORAGE_KEY);
    eliminarToken();
    setUsuario(null);
    setToken(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, token, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
