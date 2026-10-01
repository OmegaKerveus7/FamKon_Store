import type { Compra, DetalleCompra } from '../api/compras';

export function puedeDescargarConstancia(p: Compra) {
  return !['CANCELADO', 'REEMBOLSO_PENDIENTE'].includes(p.estado) &&
    (p.metodoPago === 'EFECTIVO' || p.estadoPago === 'APROBADO');
}
export function trackingUrl(origin: string, id: number) {
  const url = new URL('/comprador/tracking', origin);
  url.searchParams.set('pedido', String(id));
  return url.href;
}
export async function crearConstancia(d: DetalleCompra, origin: string, tienda: string) {
  const [{ jsPDF }, { default: QRCode }] = await Promise.all([import('jspdf'), import('qrcode')]);
  const p = d.pedido;
  if (!puedeDescargarConstancia(p)) throw new Error('La constancia estará disponible cuando el pago esté confirmado.');
  const url = trackingUrl(origin, p.idPedido);
  const qr = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 4, width: 360 });
  const doc = new jsPDF();
  const money = (n: number) => `Q ${n.toFixed(2)}`;
  let y = 20;
  function line(text: string, size = 11) {
    doc.setFontSize(size);
    const lines: string[] = doc.splitTextToSize(text, 168);
    for (const value of lines) {
      if (y > 265) { doc.addPage(); y = 20; }
      doc.text(value, 21, y); y += size * .45 + 2;
    }
  }
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 43, 'F');
  doc.setTextColor(255); line('FamKon', 26); line('CONSTANCIA DE COMPRA', 12);
  doc.setTextColor(30, 41, 59); y = 55;
  line(`Pedido: ${p.numeroPedido}`, 14);
  line(`Fecha: ${new Date(p.fechaPedido).toLocaleString('es-GT')}`);
  line(`Comprador: ${p.cliente}`);
  const paid = ['APROBADO', 'PAGADO_EFECTIVO'].includes(p.estadoPago);
  line(`${p.metodoPago === 'EFECTIVO' ? 'COD - Contra entrega' : 'STA - Tarjeta'}`);
  line(paid ? 'PAGADO - No cobrar al entregar' : `PAGO PENDIENTE - Cobrar ${money(p.total)}`);
  if (p.metodoPago === 'TARJETA' && p.entorno === 'TEST') line('MODO DE PRUEBA - Sin cobro real');
  line(`Entrega: ${p.idModalidadEntrega === 1 ? tienda : [p.direccionEntrega, p.municipio, p.departamento].filter(Boolean).join(', ')}`);
  y += 5; line('DETALLE DE PRODUCTOS', 13);
  for (const item of d.productos) {
    line(`${item.cantidad} x ${item.nombreProducto}`);
    line(`Unidad: ${money(item.precioUnitario + item.precioPersonaliza)}    Importe: ${money(item.subtotal)}`);
    y += 2;
  }
  line(`Subtotal: ${money(p.subtotal)}`);
  line(`Entrega: ${money(p.cargoEntrega)}`);
  line(`TOTAL: ${money(p.total)}`, 16);
  if (y > 185) { doc.addPage(); y = 20; }
  y += 6; line('SEGUIMIENTO DEL PEDIDO', 13);
  doc.addImage(qr, 'PNG', 21, y, 48, 48);
  doc.link(21, y, 48, 48, { url });
  y += 53;
  line('Escanea el QR para consultar los estados actualizados.');
  line('Inicia sesión con la cuenta que realizó la compra.', 10);
  doc.setFontSize(9); doc.textWithLink('Abrir tracking del pedido', 21, y, { url }); y += 10;
  line('Constancia de compra. No sustituye una factura fiscal.', 9);
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page); doc.setFontSize(8); doc.setTextColor(100);
    doc.text(`FamKon | ${p.numeroPedido} | ${page}/${doc.getNumberOfPages()}`, 21, 287);
  }
  return doc;
}
