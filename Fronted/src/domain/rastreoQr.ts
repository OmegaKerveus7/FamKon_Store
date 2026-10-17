export function guiaDesdeQr(texto: string): string {
  const valor = texto.trim();
  const formato = /^FK-[A-Z0-9]{20,64}$/;
  if (formato.test(valor.toUpperCase())) return valor.toUpperCase();
  try {
    const url = new URL(valor);
    if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/rastreo') throw new Error();
    const guia = (url.searchParams.get('guia') || '').toUpperCase();
    if (formato.test(guia)) return guia;
  } catch { /* Se informa un error sin abrir la dirección escaneada. */ }
  throw new Error('Este QR no contiene una guía de rastreo válida. Si es un comprobante anterior, ingresá su número de guía FK-… manualmente.');
}

/** Legacy receipts contain a private order link instead of the public tracking guide. */
export function lecturaDesdeQr(texto: string): { guia: string } | { pedido: string } {
  try { return { guia: guiaDesdeQr(texto) }; }
  catch { /* Try the older receipt format without opening the scanned origin. */ }
  try {
    const url = new URL(texto.trim());
    const pedido = url.searchParams.get('pedido') ?? '';
    if (['http:', 'https:'].includes(url.protocol) && url.pathname === '/comprador/tracking'
      && url.searchParams.getAll('pedido').length === 1 && /^[1-9]\d*$/.test(pedido)
      && Number.isSafeInteger(Number(pedido))) return { pedido };
  } catch { /* Invalid QR content is reported below. */ }
  throw new Error('Este QR no corresponde a una guía ni a un comprobante de FamKon. Podés ingresar la guía FK-… manualmente.');
}

/** Shared flow for authenticated scanners; the server checks access for either receipt format. */
export async function pedidoDesdeQr(texto: string, resolver: (lectura: { guia: string } | { pedido: string }) => Promise<{ idPedido: number }>): Promise<number> {
  const resultado = await resolver(lecturaDesdeQr(texto));
  if (!Number.isSafeInteger(resultado.idPedido) || resultado.idPedido <= 0) throw new Error('No se pudo identificar el pedido.');
  return resultado.idPedido;
}
