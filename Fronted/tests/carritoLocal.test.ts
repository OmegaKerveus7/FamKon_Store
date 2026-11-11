import { afterAll, beforeEach, describe, expect, test } from 'bun:test';

class AlmacenFalso {
  private datos = new Map<string, string>();
  getItem(clave: string): string | null {
    return this.datos.has(clave) ? (this.datos.get(clave) as string) : null;
  }
  setItem(clave: string, valor: string): void {
    this.datos.set(clave, String(valor));
  }
  removeItem(clave: string): void {
    this.datos.delete(clave);
  }
  clear(): void {
    this.datos.clear();
  }
  key(indice: number): string | null {
    return Array.from(this.datos.keys())[indice] ?? null;
  }
  get length(): number {
    return this.datos.size;
  }
}

const CLAVE = "famkon.carrito.local";

// Bun corre los archivos de test en el mismo proceso: los stubs se restauran
// al terminar para no afectar a los demás archivos.
const originalWindow = (globalThis as any).window;
const originalLocalStorage = (globalThis as any).localStorage;
const originalFetch = (globalThis as any).fetch;

beforeEach(() => {
  (globalThis as any).localStorage = new AlmacenFalso();
  (globalThis as any).window = { dispatchEvent: () => {} };
});

afterAll(() => {
  if (originalWindow === undefined) delete (globalThis as any).window;
  else (globalThis as any).window = originalWindow;
  if (originalLocalStorage === undefined) delete (globalThis as any).localStorage;
  else (globalThis as any).localStorage = originalLocalStorage;
  (globalThis as any).fetch = originalFetch;
});

async function escenario() {
  const modulo = await import('../src/api/carritoLocal');
  const llamadas: { url: string; cuerpo: any }[] = [];
  (globalThis as any).fetch = async (url: string, init: any) => {
    const cuerpo = init?.body ? JSON.parse(init.body) : null;
    llamadas.push({ url: String(url), cuerpo });
    // El segundo producto no tiene existencias: el backend responde 400.
    if (cuerpo?.idProducto === 2) {
      return {
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ mensaje: 'Solo hay 0 disponibles.' }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ codigoS: 200, idDetalle: llamadas.length }),
    };
  };
  return { ...modulo, llamadas };
}

describe('Carrito local del visitante', () => {
  test('guarda los productos agregados sin sesión', async () => {
    const { agregarCarritoLocal, obtenerCarritoLocal } = await escenario();
    agregarCarritoLocal(
      { idProducto: 1, nombre: 'Tarjeta NFC', sku: 'TAR', precioBase: 20 } as any,
      2,
    );
    agregarCarritoLocal(
      { idProducto: 1, nombre: 'Tarjeta NFC', sku: 'TAR', precioBase: 20 } as any,
      1,
    );
    const items = obtenerCarritoLocal();
    expect(items.length).toBe(1);
    expect(items[0].cantidad).toBe(3);
  });

  test('al iniciar sesión sube el carrito al servidor y conserva lo que falla', async () => {
    const { agregarCarritoLocal, fusionarCarritoLocal, obtenerCarritoLocal } = await escenario();
    agregarCarritoLocal(
      { idProducto: 1, nombre: 'Tarjeta NFC', sku: 'TAR', precioBase: 20 } as any,
      2,
      { mensajeLadoA: 'Para Sofía' } as any,
    );
    agregarCarritoLocal(
      { idProducto: 2, nombre: 'Llavero', sku: 'LLA', precioBase: 20 } as any,
      1,
    );

    const resultado = await fusionarCarritoLocal();
    expect(resultado.subidos).toBe(1);
    expect(resultado.pendientes).toBe(1);

    // La línea que sí se subió sale del carrito local.
    const restantes = obtenerCarritoLocal();
    expect(restantes.length).toBe(1);
    expect(restantes[0].idProducto).toBe(2);
  });

  test('envía la personalización de texto al carrito del servidor', async () => {
    const { agregarCarritoLocal, fusionarCarritoLocal, llamadas } = await escenario();
    agregarCarritoLocal(
      { idProducto: 1, nombre: 'Tarjeta NFC', sku: 'TAR', precioBase: 20 } as any,
      2,
      { mensajeLadoA: 'Para Sofía', configLadoA: JSON.stringify({ url: 'https://famkon.site' }) } as any,
    );

    await fusionarCarritoLocal();
    expect(llamadas.length).toBe(1);
    expect(llamadas[0].url).toContain("/carrito/productos");
    expect(llamadas[0].cuerpo.idProducto).toBe(1);
    expect(llamadas[0].cuerpo.cantidad).toBe(2);
    expect(llamadas[0].cuerpo.personalizacion.mensajeLadoA).toBe('Para Sofía');
    expect(llamadas[0].cuerpo.personalizacion.configLadoA).toContain('famkon.site');
  });

  test('sin carrito local no hace nada', async () => {
    const { fusionarCarritoLocal, llamadas } = await escenario();
    const resultado = await fusionarCarritoLocal();
    expect(resultado.subidos).toBe(0);
    expect(llamadas.length).toBe(0);
    expect(localStorage.getItem(CLAVE)).toBeNull();
  });
});
