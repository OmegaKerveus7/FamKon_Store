export function progresoRastreo(estado: string, modalidad: number) {
  const pasos = modalidad === 1 ? ['Confirmado', 'Preparación', 'Listo', 'Recogido'] : ['Confirmado', 'Preparación', 'Listo', 'En ruta', 'Entregado'];
  const etapa: Record<string, number> = { GENERADO: 0, PAGO_PENDIENTE: 0, PAGO_CONFIRMADO: 0,
    EN_ELABORACION: 1, LISTO_RECOGER: 2, LISTO_ENTREGA: 2, EN_RUTA: 3,
    COMPRADOR_NO_ENCONTRADO: 3, RECOGIDO: 3, ENTREGADO: modalidad === 1 ? 3 : 4 };
  return { pasos, actual: etapa[estado] ?? -1, cancelado: estado === 'CANCELADO' };
}
