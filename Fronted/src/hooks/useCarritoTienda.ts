import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  agregarAlCarritoAPI,
  actualizarCantidadCarritoAPI,
  eliminarDelCarritoAPI,
  obtenerCarrito,
  sesionActiva,
  type PersonalizacionContenido,
  type Producto,
} from "../api/famkon";
import {
  agregarCarritoLocal,
  actualizarCantidadLocal,
  eliminarCarritoLocal,
  obtenerCarritoLocal,
} from "../api/carritoLocal";
import {
  EVENTO_CARRITO,
  type LineaCarrito,
  lineasServidor,
  lineasVisitantes,
  subtotalCarrito,
  unidadesCarrito,
} from "../domain/carritoVisitante";

export interface CarritoTienda {
  /** Líneas del carrito (del servidor si hay sesión, del visitante si no). */
  items: LineaCarrito[];
  /** true cuando el carrito es el de un visitante sin sesión. */
  esVisitante: boolean;
  cargando: boolean;
  error: string;
  unidades: number;
  subtotal: number;
  agregar: (
    producto: Producto,
    cantidad: number,
    personalizacion?: PersonalizacionContenido | null,
  ) => Promise<void>;
  cambiarCantidad: (linea: LineaCarrito, cantidad: number) => Promise<void>;
  eliminar: (linea: LineaCarrito) => Promise<void>;
  recargar: () => Promise<void>;
}

/**
 * Carrito unificado: si hay sesión usa el carrito del servidor (PKG_CARRITO);
 * si no, usa el carrito local del visitante que se sube al iniciar sesión.
 */
export function useCarritoTienda(): CarritoTienda {
  const { usuario } = useAuth();
  const esVisitante = !usuario;
  const [items, setItems] = useState<LineaCarrito[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const recargar = useCallback(async () => {
    setError("");
    if (esVisitante) {
      setItems(lineasVisitantes(obtenerCarritoLocal()));
      setCargando(false);
      return;
    }
    // Token vencido o ausente: se trata como visitante y no se fuerza el logout.
    if (!sesionActiva()) {
      setItems(lineasVisitantes(obtenerCarritoLocal()));
      setCargando(false);
      return;
    }
    setCargando(true);
    try {
      const carrito = await obtenerCarrito();
      setItems(lineasServidor(carrito.detalles));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el carrito.");
      setItems([]);
    } finally {
      setCargando(false);
    }
  }, [esVisitante]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  // Avisa al resto de la app (cabecera, contadores) que el carrito cambió.
  const avisarCambio = useCallback(() => {
    window.dispatchEvent(new Event(EVENTO_CARRITO));
  }, []);

  const agregar = useCallback(
    async (
      producto: Producto,
      cantidad: number,
      personalizacion?: PersonalizacionContenido | null,
    ) => {
      setError("");
      if (esVisitante) {
        agregarCarritoLocal(producto, cantidad, personalizacion);
        setItems(lineasVisitantes(obtenerCarritoLocal()));
        avisarCambio();
        return;
      }
      await agregarAlCarritoAPI({
        idProducto: producto.idProducto,
        cantidad,
        personalizacion: personalizacion ?? null,
      });
      await recargar();
      avisarCambio();
    },
    [esVisitante, recargar, avisarCambio],
  );

  const cambiarCantidad = useCallback(
    async (linea: LineaCarrito, cantidad: number) => {
      if (cantidad < 1) return;
      setError("");
      try {
        if (esVisitante) {
          actualizarCantidadLocal(linea.idProducto, cantidad);
          setItems(lineasVisitantes(obtenerCarritoLocal()));
        } else {
          await actualizarCantidadCarritoAPI(linea.id, cantidad);
          await recargar();
        }
        avisarCambio();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo actualizar la cantidad.");
      }
    },
    [esVisitante, recargar, avisarCambio],
  );

  const eliminar = useCallback(
    async (linea: LineaCarrito) => {
      setError("");
      try {
        if (esVisitante) {
          eliminarCarritoLocal(linea.idProducto);
          setItems(lineasVisitantes(obtenerCarritoLocal()));
        } else {
          await eliminarDelCarritoAPI(linea.id);
          await recargar();
        }
        avisarCambio();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo eliminar el producto.");
      }
    },
    [esVisitante, recargar, avisarCambio],
  );

  const unidades = useMemo(() => unidadesCarrito(items), [items]);
  const subtotal = useMemo(() => subtotalCarrito(items), [items]);

  return {
    items,
    esVisitante,
    cargando,
    error,
    unidades,
    subtotal,
    agregar,
    cambiarCantidad,
    eliminar,
    recargar,
  };
}
