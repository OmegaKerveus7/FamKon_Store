import { describe, expect, test, beforeEach } from "bun:test";

// Bun no implementa localStorage: stub mínimo para probar el carrito local.
const almacen = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (clave: string) => almacen.get(clave) ?? null,
  setItem: (clave: string, valor: string) => void almacen.set(clave, valor),
  removeItem: (clave: string) => void almacen.delete(clave),
  clear: () => almacen.clear(),
  key: (indice: number) => [...almacen.keys()][indice] ?? null,
  get length() {
    return almacen.size;
  },
} as Storage;

import {
  agregarCarritoLocal,
  actualizarCantidadLocal,
  cantidadCarritoLocal,
  eliminarCarritoLocal,
  obtenerCarritoLocal,
  vaciarCarritoLocal,
} from "../src/api/carritoLocal";
import { lineasVisitantes, rutaTrasPago, rutaSeguraInterna } from "../src/domain/carritoVisitante";
import type { Producto } from "../src/api/famkon";

const producto = {
  idProducto: 21,
  idSitio: 1,
  idCategoria: 3,
  categoria: "Tarjetas NFC",
  sku: "TAR-NFC-01",
  nombre: "Tarjeta NFC",
  descripcion: "",
  precioBase: 20,
  permiteLadoA: "S",
  permiteLadoB: "S",
  activo: "S",
  existencia: 12,
} as Producto;

describe("Carrito del visitante sin sesión", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("agrega, acumula y lista productos", () => {
    agregarCarritoLocal(producto, 1);
    agregarCarritoLocal(producto, 2);
    expect(cantidadCarritoLocal()).toBe(3);
    expect(obtenerCarritoLocal()[0].cantidad).toBe(3);
  });

  test("cambia cantidad y elimina", () => {
    agregarCarritoLocal(producto, 2);
    actualizarCantidadLocal(producto.idProducto, 5);
    expect(cantidadCarritoLocal()).toBe(5);
    eliminarCarritoLocal(producto.idProducto);
    expect(obtenerCarritoLocal()).toHaveLength(0);
  });

  test("vaciar deja el carrito vacío", () => {
    agregarCarritoLocal(producto, 1);
    vaciarCarritoLocal();
    expect(cantidadCarritoLocal()).toBe(0);
  });

  test("las líneas del visitante muestran nombre, precio y subtotal", () => {
    agregarCarritoLocal(producto, 3);
    const lineas = lineasVisitantes(obtenerCarritoLocal());
    expect(lineas[0].nombre).toBe("Tarjeta NFC");
    expect(lineas[0].subtotal).toBe(60);
  });
});

describe("Destino tras iniciar sesión", () => {
  test("acepta rutas internas y rechaza externas", () => {
    expect(rutaSeguraInterna("/comprador/checkout")).toBe("/comprador/checkout");
    expect(rutaSeguraInterna("https://sitio.com")).toBeNull();
    expect(rutaSeguraInterna("//sitio.com")).toBeNull();
  });

  test("el comprador vuelve al checkout tras entrar", () => {
    expect(rutaTrasPago("COMPRADOR", "/comprador/checkout")).toBe("/comprador/checkout");
  });

  test("un repartidor sin permisos vuelve al carrito", () => {
    expect(rutaTrasPago("REPARTIDOR", "/comprador/checkout")).toBe("/carrito");
  });
});
