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
  const qr = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 420 });
  const doc = new jsPDF();
  const money = (n: number) => `Q ${n.toFixed(2)}`;
  const paid = ['APROBADO', 'PAGADO_EFECTIVO'].includes(p.estadoPago);
  const entrega = p.idModalidadEntrega === 1 ? tienda : [p.direccionEntrega, p.municipio, p.departamento].filter(Boolean).join(', ');
  const fecha = new Date(p.fechaPedido).toLocaleString('es-GT', { timeZone: 'America/Guatemala', dateStyle: 'long', timeStyle: 'short' });
  let y = 0;

  function encabezado() {
    doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 45, 'F');
    doc.setFillColor(249, 115, 22); doc.rect(0, 45, 210, 2.5, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(25); doc.text('FamKon', 18, 22);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(203, 213, 225); doc.text('TIENDA EN LÍNEA', 18, 30);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(255); doc.text('COMPROBANTE DE COMPRA', 192, 21, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(203, 213, 225); doc.text(`Pedido ${p.numeroPedido}`, 192, 29, { align: 'right' });
    y = 59;
  }
  function asegurar(altura: number) {
    if (y + altura <= 274) return;
    doc.addPage(); encabezado();
  }
  function etiqueta(texto: string, x: number, top: number) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.text(texto.toUpperCase(), x, top);
  }
  function valor(texto: string, x: number, top: number, ancho = 74) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(30, 41, 59);
    const lineas: string[] = doc.splitTextToSize(texto || '—', ancho); doc.text(lineas, x, top); return lineas.length * 5;
  }
  function titulo(texto: string) {
    asegurar(16); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(15, 23, 42); doc.text(texto.toUpperCase(), 18, y);
    doc.setDrawColor(226, 232, 240); doc.line(18, y + 4, 192, y + 4); y += 13;
  }

  encabezado();
  doc.setFillColor(248, 250, 252); doc.roundedRect(18, y, 174, 39, 3, 3, 'F');
  etiqueta('Comprador', 25, y + 10); valor(p.cliente, 25, y + 17, 72);
  etiqueta('Fecha', 108, y + 10); valor(fecha, 108, y + 17, 75);
  etiqueta('Estado del pago', 25, y + 29);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(paid ? 4 : 180, paid ? 120 : 83, paid ? 87 : 9);
  doc.text(paid ? 'PAGADO' : `PENDIENTE · COBRAR ${money(p.total)}`, 56, y + 29);
  y += 50;

  titulo('Entrega y pago');
  etiqueta('Modalidad', 18, y); valor(p.idModalidadEntrega === 1 ? 'Recoger en tienda' : 'Envío a domicilio', 18, y + 7, 76);
  etiqueta('Método de pago', 108, y); valor(p.metodoPago === 'EFECTIVO' ? 'Efectivo contra entrega' : 'Tarjeta', 108, y + 7, 75);
  y += 18; etiqueta('Dirección de entrega', 18, y); y += 7; y += valor(entrega, 18, y, 166) + 5;
  if (p.metodoPago === 'TARJETA' && p.entorno === 'TEST') {
    doc.setFillColor(255, 247, 237); doc.roundedRect(18, y, 174, 10, 2, 2, 'F'); doc.setTextColor(154, 52, 18); doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.text('MODO DE PRUEBA · SIN COBRO REAL', 23, y + 6.5); y += 16;
  }

  titulo('Detalle de productos');
  doc.setFillColor(241, 245, 249); doc.rect(18, y, 174, 10, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(71, 85, 105);
  doc.text('PRODUCTO', 22, y + 6.5); doc.text('CANT.', 130, y + 6.5, { align: 'right' }); doc.text('PRECIO', 158, y + 6.5, { align: 'right' }); doc.text('IMPORTE', 188, y + 6.5, { align: 'right' }); y += 10;
  for (const item of d.productos) {
    const nombre: string[] = doc.splitTextToSize(item.nombreProducto, 90); const alto = Math.max(11, nombre.length * 5 + 4); asegurar(alto);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(30, 41, 59); doc.text(nombre, 22, y + 6);
    doc.text(String(item.cantidad), 130, y + 6, { align: 'right' }); doc.text(money(item.precioUnitario + item.precioPersonaliza), 158, y + 6, { align: 'right' });
    doc.setFont('helvetica', 'bold'); doc.text(money(item.subtotal), 188, y + 6, { align: 'right' });
    doc.setDrawColor(241, 245, 249); doc.line(18, y + alto, 192, y + alto); y += alto;
  }
  asegurar(58); y += 5;
  const bloqueY = y;
  doc.setFillColor(248, 250, 252); doc.roundedRect(18, bloqueY, 88, 50, 3, 3, 'F');
  doc.addImage(qr, 'PNG', 23, bloqueY + 5, 40, 40); doc.link(23, bloqueY + 5, 40, 40, { url });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(15, 23, 42); doc.text('RASTREA TU PEDIDO', 68, bloqueY + 13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(71, 85, 105);
  doc.text(doc.splitTextToSize('Escanea el QR para consultar el estado actualizado de tu compra.', 33), 68, bloqueY + 20);
  doc.setTextColor(194, 65, 12); doc.setFont('helvetica', 'bold'); doc.textWithLink('Abrir tracking', 68, bloqueY + 40, { url });
  const resumenX = 116;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139); doc.text('Subtotal', resumenX, bloqueY + 8); doc.text(money(p.subtotal), 190, bloqueY + 8, { align: 'right' });
  doc.text('Entrega', resumenX, bloqueY + 17); doc.text(money(p.cargoEntrega), 190, bloqueY + 17, { align: 'right' });
  doc.setDrawColor(203, 213, 225); doc.line(resumenX, bloqueY + 23, 192, bloqueY + 23);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(15, 23, 42); doc.text('TOTAL', resumenX, bloqueY + 36); doc.setTextColor(234, 88, 12); doc.text(money(p.total), 190, bloqueY + 36, { align: 'right' }); y = bloqueY + 55;

  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page); doc.setDrawColor(226, 232, 240); doc.line(18, 280, 192, 280); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139);
    doc.text('Comprobante de compra. No sustituye una factura fiscal.', 18, 286);
    doc.text(`${p.numeroPedido}  ·  ${page}/${doc.getNumberOfPages()}`, 192, 286, { align: 'right' });
  }
  return doc;
}
