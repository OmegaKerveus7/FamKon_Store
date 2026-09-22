import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { accionCompra, verificarPago, repartidoresCompra, subirEvidenciaCompra, type DetalleCompra, type DireccionCompra, type VistaCompra } from '../api/compras';
import { entregaActiva, finalizado, moneda, puedeFinalizar, puedePagar, puedePreparar } from '../domain/compras';
import DireccionCompraFields, { campoCompra } from './DireccionCompraFields';
export const botonCompra = 'rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50';
export const botonSecundario = 'rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
export default function CompraAcciones({ detail, vista, onChanged }: { detail: DetalleCompra; vista: VistaCompra; onChanged: () => Promise<void> }) {
  const p = detail.pedido; const { usuario } = useAuth(); const locked = useRef(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [panel, setPanel] = useState(''); const [comentario, setComentario] = useState('');
  const [repartidores, setRepartidores] = useState<{ idUsuario: number; nickname: string }[]>([]); const [repartidor, setRepartidor] = useState('');
  const [receptor, setReceptor] = useState(''); const [foto, setFoto] = useState<File | null>(null); const [cobrado, setCobrado] = useState(false);
  const [direccion, setDireccion] = useState<DireccionCompra>({ ...p });
  useEffect(() => { if (vista === 'admin') repartidoresCompra().then(setRepartidores).catch(e => setError(e.message)); }, [vista]);
  async function ejecutar(task: () => Promise<unknown>, texto: string) {
    if (locked.current) return; locked.current = true; setBusy(true); setError(''); setNotice('');
    try { await task(); setPanel(''); setComentario(''); setFoto(null); setCobrado(false); setNotice(texto); await onChanged(); }
    catch (e) { setError((e as Error).message); } finally { locked.current = false; setBusy(false); }
  }
  const estado = (value: string) => ejecutar(() => accionCompra(p.idPedido, 'estado', { estado: value, comentario }), 'Seguimiento actualizado.');
  const open = (value: string) => { setPanel(panel === value ? '' : value); setComentario(''); setError(''); setDireccion({ ...p }); };
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (panel === 'asignar') return ejecutar(() => accionCompra(p.idPedido, 'asignar', { idRepartidor: Number(repartidor) }), 'Entrega asignada.');
    if (panel === 'cancelar') return estado('CANCELADO');
    if (panel === 'nota') return estado('NOTA');
    if (panel === 'direccion') return ejecutar(() => accionCompra(p.idPedido, 'direccion', { ...direccion, telefonoAlterno: direccion.telefonoAlterno || null, motivo: comentario }, 'PUT'), 'Datos corregidos y auditados.');
    if (panel === 'fallido') return ejecutar(() => accionCompra(p.idPedido, 'resultado', { resultado: 'COMPRADOR_NO_ENCONTRADO', comentario, montoEfectivo: 0 }), 'Intento registrado. Administración coordinará la siguiente entrega.');
    if (panel === 'entregar') return ejecutar(async () => {
      const evidencia = foto ? await subirEvidenciaCompra(p.idPedido, foto) : null;
      return accionCompra(p.idPedido, 'resultado', { resultado: p.idModalidadEntrega === 1 ? 'RECOGIDO' : 'ENTREGADO', nombreReceptor: receptor, idArchivoEvidencia: evidencia?.idArchivo, montoEfectivo: p.metodoPago === 'EFECTIVO' && cobrado ? p.total : 0, comentario });
    }, 'Recepción registrada correctamente.');
  }
  const activa = entregaActiva(detail, usuario?.idUsuario || 0);
  const puedoFinalizar = puedeFinalizar(detail, vista, usuario?.idUsuario || 0);
  return <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <h2 className="mb-4 font-bold text-slate-900">{vista === 'cliente' ? 'Tu compra' : 'Acciones del pedido'}</h2>
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
    {p.estadoPago === 'REEMBOLSO_PENDIENTE' && <p className="mb-4 rounded-xl bg-orange-50 p-3 text-sm text-orange-800">{vista === 'admin' ? 'Este pedido necesita reembolso en Recurrente. No se devuelve dinero automáticamente al cancelar.' : 'Tu pedido fue cancelado y la devolución del pago está pendiente de gestión.'}</p>}
    {vista === 'cliente' && puedePagar(p) && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-bold text-amber-950">¡Ups! Aún no se ha completado tu pago</h3><p className="mt-1 text-sm text-amber-900">Tu pedido está guardado. Completá el pago de {moneda(p.total)} para que podamos prepararlo{p.idModalidadEntrega === 2 ? ' y enviarlo' : ' para recoger en tienda'}.</p><p className="mt-2 text-xs text-amber-800">Si acabás de pagar, esperá un momento: la confirmación aparecerá automáticamente.</p></div>}
    {vista === 'cliente' && p.metodoPago === 'TARJETA' && p.estadoPago === 'APROBADO' && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"><strong>¡Pago confirmado!</strong> No tenés que hacer nada más para pagar. Aquí verás los avances de tu pedido.</p>}
    <div className="flex flex-wrap gap-2">
      {vista === 'cliente' && puedePagar(p) && <Link className={botonCompra} to={`/comprador/pago/${p.idPedido}`}>Completar pago con tarjeta</Link>}
      {vista === 'admin' && p.metodoPago === 'TARJETA' && p.idCheckoutProveedor && ['PENDIENTE', 'RECHAZADO'].includes(p.estadoPago) && <button disabled={busy} className={botonSecundario} onClick={() => ejecutar(() => verificarPago(p.idPedido), 'Estado consultado directamente con Recurrente.')}>Verificar pago</button>}
      {vista === 'admin' && <>
        {puedePreparar(p) && <button disabled={busy} className={botonCompra} onClick={() => estado('EN_ELABORACION')}>Iniciar preparación</button>}
        {p.estado === 'EN_ELABORACION' && <button disabled={busy} className={botonCompra} onClick={() => estado(p.idModalidadEntrega === 1 ? 'LISTO_RECOGER' : 'LISTO_ENTREGA')}>Marcar listo para {p.idModalidadEntrega === 1 ? 'recoger' : 'entrega'}</button>}
        {p.idModalidadEntrega === 2 && ['LISTO_ENTREGA', 'COMPRADOR_NO_ENCONTRADO'].includes(p.estado) && p.entregasActivas === 0 && <button disabled={busy} className={botonCompra} onClick={() => open('asignar')}>{p.estado === 'COMPRADOR_NO_ENCONTRADO' ? 'Reprogramar entrega' : 'Asignar mensajero'}</button>}
        {!finalizado(p) && <><button disabled={busy} className={botonSecundario} onClick={() => open('nota')}>Registrar llamada / nota</button>{p.estado !== 'EN_RUTA' && <button disabled={busy} className={botonSecundario} onClick={() => open('direccion')}>Corregir contacto</button>}<button disabled={busy} className="rounded-xl px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50" onClick={() => open('cancelar')}>Cancelar pedido</button></>}
      </>}
      {vista === 'repartidor' && activa?.estado === 'ASIGNADA' && p.estado === 'LISTO_ENTREGA' && <button disabled={busy} className={botonCompra} onClick={() => estado('EN_RUTA')}>Iniciar ruta</button>}
      {puedoFinalizar && <><button disabled={busy} className={botonCompra} onClick={() => open('entregar')}>Confirmar {p.idModalidadEntrega === 1 ? 'recogida' : 'entrega'}</button>{vista === 'repartidor' && <button disabled={busy} className={botonSecundario} onClick={() => open('fallido')}>Registrar intento fallido</button>}</>}
    </div>
    {vista === 'cliente' && p.metodoPago === 'EFECTIVO' && !finalizado(p) && <p className="text-sm text-slate-600">Pagás {moneda(p.total)} en efectivo al {p.idModalidadEntrega === 1 ? 'recoger en tienda' : 'recibir tu pedido'}. Podés consultar aquí cada avance.</p>}
    {vista === 'admin' && p.metodoPago === 'TARJETA' && ['GENERADO', 'PAGO_PENDIENTE'].includes(p.estado) && p.estadoPago !== 'APROBADO' && <p className="mt-3 text-sm text-slate-500">La preparación se habilita cuando Recurrente confirma el pago.</p>}
    {panel && <form onSubmit={submit} className="mt-5 border-t border-slate-100 pt-5"><fieldset disabled={busy} className="space-y-4">
      {panel === 'asignar' && <label className="block text-sm font-medium">Mensajero<select required value={repartidor} onChange={e => setRepartidor(e.target.value)} className={campoCompra}><option value="">Seleccionar repartidor</option>{repartidores.map(r => <option key={r.idUsuario} value={r.idUsuario}>{r.nickname}</option>)}</select>{!repartidores.length && <span className="text-xs text-slate-500">No hay repartidores activos disponibles.</span>}</label>}
      {panel === 'direccion' && <DireccionCompraFields domicilio={p.idModalidadEntrega === 2} value={direccion} onChange={setDireccion} />}
      {panel === 'cancelar' && <p className="text-sm text-red-700">Se cancelará el pedido y cualquier entrega activa.{p.estadoPago === 'APROBADO' ? ' El pago quedará pendiente de reembolso.' : ''}</p>}
      {panel === 'entregar' && <>
        <label className="block text-sm font-medium">Nombre de quien recibió *<input required value={receptor} onChange={e => setReceptor(e.target.value)} maxLength={150} className={campoCompra} /></label>
        <label className="block text-sm font-medium">Foto de evidencia {p.idModalidadEntrega === 2 ? '*' : '(opcional)'}<input type="file" accept="image/jpeg,image/png" capture="environment" required={p.idModalidadEntrega === 2} onChange={e => { const f = e.target.files?.[0] || null; if (f && f.size > 5 * 1024 * 1024) { setError('La foto debe pesar hasta 5 MB.'); e.target.value = ''; setFoto(null); } else { setError(''); setFoto(f); } }} className={campoCompra} /><span className="mt-1 block text-xs text-slate-500">JPG o PNG, hasta 5 MB.</span></label>
        {p.metodoPago === 'EFECTIVO' ? <label className="flex items-center gap-3 rounded-xl bg-amber-50 p-4 text-sm font-semibold"><input type="checkbox" required checked={cobrado} onChange={e => setCobrado(e.target.checked)} className="accent-amber-500" />Confirmo haber recibido {moneda(p.total)} en efectivo.</label> : <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">Pagado con tarjeta. No cobrar efectivo.</p>}
      </>}
      {panel !== 'asignar' && <label className="block text-sm font-medium">{panel === 'nota' ? 'Nota interna (solo administración)' : panel === 'entregar' ? 'Observaciones (opcional)' : 'Motivo *'}<textarea required={panel !== 'entregar'} maxLength={500} rows={3} value={comentario} onChange={e => setComentario(e.target.value)} className={campoCompra} /></label>}
      <div className="flex gap-2"><button className={botonCompra} type="submit">{busy ? 'Guardando…' : 'Confirmar'}</button><button type="button" onClick={() => setPanel('')} className={botonSecundario}>Volver</button></div>
    </fieldset></form>}
    {busy && <p role="status" className="mt-3 text-xs text-slate-500">Procesando la operación…</p>}
  </section>;
}
