import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  listarProductosAdmin, listarCategoriasProductoAdmin, crearProductoAdmin, crearCategoriaProductoAdmin,
  actualizarProductoAdmin, cambiarEstadoProductoAdmin,
} from "../src/api/famkon";

const originalFetch = globalThis.fetch;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
let calls;
function response(body, status = 200) {
  globalThis.fetch = mock(async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  });
}
beforeEach(() => {
  calls = [];
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "test-token" } });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else delete globalThis.localStorage;
});
const body = { idCategoria: 2, idArchivoImagen: 8, nombre: "Taza", descripcion: "", precioBase: 0, permiteLadoA: "S", permiteLadoB: "N" };

describe("API de administración de productos", () => {
  test("lista también los inactivos mediante el endpoint autenticado", async () => {
    response({ codigoS: 200, productos: [{ idProducto: 5, activo: "N" }] });
    expect((await listarProductosAdmin())[0].activo).toBe("N");
    expect(calls[0].url).toBe("/api/famkon/admin/productos");
    expect(calls[0].init.headers.Authorization).toBe("Bearer test-token");
  });
  test("consulta todas las categorías para conservar la de un producto existente", async () => {
    response({ codigoS: 200, categorias: [] });
    expect(await listarCategoriasProductoAdmin()).toEqual([]);
    expect(calls[0].url).toBe("/api/famkon/categorias?soloActivas=N");
  });
  test("crea con SKU, sitio y precio cero", async () => {
    response({ codigoS: 200, idProducto: 9 });
    expect((await crearProductoAdmin({ ...body, sku: "TAZA-01", idSitio: 1 })).idProducto).toBe(9);
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(calls[0].init.body)).toEqual({ ...body, sku: "TAZA-01", idSitio: 1 });
  });
  test("actualiza conservando la imagen y la personalización", async () => {
    response({ codigoS: 200 });
    await actualizarProductoAdmin(9, body);
    expect(calls[0].url).toBe("/api/famkon/admin/productos/9");
    expect(calls[0].init.method).toBe("PUT");
    expect(JSON.parse(calls[0].init.body)).toEqual(body);
  });
  test.each(["S", "N"])("cambia el estado a %s sin eliminar el producto", async activo => {
    response({ codigoS: 200 });
    await cambiarEstadoProductoAdmin(9, activo);
    expect(calls[0].url).toBe("/api/famkon/admin/productos/9/estado");
    expect(calls[0].init.method).toBe("PUT");
    expect(JSON.parse(calls[0].init.body)).toEqual({ activo });
  });
  test("rechaza errores funcionales aunque HTTP responda 200", async () => {
    response({ codigoS: 400, mensaje: "SKU duplicado" });
    await expect(crearProductoAdmin({ ...body, sku: "TAZA-01", idSitio: 1 })).rejects.toThrow("SKU duplicado");
  });
  test("muestra el conflicto del backend", async () => {
    response({ mensaje: "Ya existe un producto con ese SKU." }, 409);
    await expect(crearProductoAdmin({ ...body, sku: "TAZA-01", idSitio: 1 })).rejects.toThrow("Ya existe un producto con ese SKU.");
  });
  test("no confunde un fallo de carga con un catálogo vacío", async () => {
    response({ codigoS: 500, mensaje: "No se pudo consultar Oracle." });
    await expect(listarProductosAdmin()).rejects.toThrow("No se pudo consultar Oracle.");
  });
});


describe("Alta de categoría antes del producto", () => {
  test("devuelve la categoría creada para seleccionarla sin volver a consultar", async () => {
    const categoria = { idCategoria: 17, codigo: "ANILLOS", nombre: "Anillos", descripcion: "" };
    response({ codigoS: 200, categoria });
    expect(await crearCategoriaProductoAdmin({ codigo: "ANILLOS", nombre: "Anillos", descripcion: "" })).toEqual(categoria);
    expect(calls[0].url).toBe("/api/famkon/admin/categorias");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers.Authorization).toBe("Bearer test-token");
  });
  test("no continúa con el producto si el código de categoría ya existe", async () => {
    response({ mensaje: "Ya existe una categoría con ese código." }, 409);
    await expect(crearCategoriaProductoAdmin({ codigo: "ANILLOS", nombre: "Anillos", descripcion: "" })).rejects.toThrow("Ya existe una categoría con ese código.");
  });
  test("usa la categoría recién creada al registrar el primer producto", async () => {
    response({ codigoS: 200, categoria: { idCategoria: 17, codigo: "ANILLOS", nombre: "Anillos", descripcion: "" } });
    const categoria = await crearCategoriaProductoAdmin({ codigo: "ANILLOS", nombre: "Anillos", descripcion: "" });
    response({ codigoS: 200, idProducto: 24 });
    const producto = await crearProductoAdmin({ ...body, idCategoria: categoria.idCategoria, sku: "AN-01", idSitio: 1 });
    expect(producto.idProducto).toBe(24);
    expect(JSON.parse(calls[1].init.body).idCategoria).toBe(17);
  });
});
