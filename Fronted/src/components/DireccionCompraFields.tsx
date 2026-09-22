import type { DireccionCompra } from '../api/compras';
export const campoCompra = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100';
export default function DireccionCompraFields({ domicilio, value, onChange }: { domicilio: boolean; value: DireccionCompra; onChange: (value: DireccionCompra) => void }) {
  const input = (key: keyof DireccionCompra, label: string, required: boolean, max: number, phone = false) => <label className="block text-sm font-medium text-slate-700">{label}{required ? ' *' : ' (opcional)'}<input name={key} value={value[key] || ''} onChange={e => onChange({ ...value, [key]: e.target.value })} required={required} maxLength={max} type={phone ? 'tel' : 'text'} pattern={phone ? String.raw`\+?[0-9 \(\)\-]{8,25}` : undefined} className={campoCompra} /></label>;
  return <div className="grid gap-4 sm:grid-cols-2">
    {input('telefonoContacto', 'Teléfono de contacto', true, 25, true)}
    {input('telefonoAlterno', 'Teléfono alterno', false, 25, true)}
    {domicilio && <>{input('departamento', 'Departamento', true, 100)}{input('municipio', 'Municipio', true, 100)}<div className="sm:col-span-2">{input('direccionEntrega', 'Dirección exacta', true, 500)}</div></>}
    <label className="block text-sm font-medium text-slate-700 sm:col-span-2">{domicilio ? 'Referencias e indicaciones' : 'Indicaciones para la recogida'} (opcional)<textarea name="referenciaEntrega" value={value.referenciaEntrega || ''} onChange={e => onChange({ ...value, referenciaEntrega: e.target.value })} rows={2} maxLength={300} className={campoCompra} /></label>
  </div>;
}
