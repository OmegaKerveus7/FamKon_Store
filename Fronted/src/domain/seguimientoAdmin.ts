export function seguimientoAdmin(estado: string): { titulo: string; descripcion: string } {
  if (['GENERADO', 'PAGO_PENDIENTE', 'PAGO_CONFIRMADO'].includes(estado)) return { titulo: 'Pendiente de aceptación', descripcion: 'Todavía no has aceptado este pedido. Revisá el pago y pulsá «Aceptar e iniciar preparación». Si es con tarjeta, primero debe confirmarse el pago.' };
  if (estado === 'EN_ELABORACION') return { titulo: 'Aceptado · En preparación', descripcion: 'El pedido ya fue aceptado. Cuando esté preparado, marcalo listo para continuar.' };
  if (estado === 'LISTO_ENTREGA') return { titulo: 'Listo para coordinar entrega', descripcion: 'Revisá la asignación al repartidor. Solo una entrega lista y asignada puede iniciar ruta.' };
  if (estado === 'LISTO_RECOGER') return { titulo: 'Listo para recoger', descripcion: 'Este pedido se recoge en tienda; no requiere repartidor.' };
  if (estado === 'COMPRADOR_NO_ENCONTRADO') return { titulo: 'Requiere seguimiento', descripcion: 'Hubo un intento de entrega fallido. Coordiná y reprogramá la entrega.' };
  return { titulo: '', descripcion: '' };
}
