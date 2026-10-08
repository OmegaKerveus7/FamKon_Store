import { IdCard, QrCode, ShieldCheck } from "lucide-react";

const temas = {
  AZUL: { nombre: "Azul noche", fondo: "#0f172a", acento: "#fb923c" },
  NARANJA: { nombre: "Naranja FamKon", fondo: "#9a3412", acento: "#fdba74" },
  MORADO: { nombre: "Morado", fondo: "#581c87", acento: "#d8b4fe" },
} as const;

export default function VistaPreviaCarnet({ foto, nickname, tema, onTema }: { foto: string; nickname: string; tema: string; onTema: (tema: string) => void }) {
  const actual = temas[tema as keyof typeof temas] ?? temas.AZUL;

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-4 sm:p-6">
      <div>
        <p className="text-sm font-bold text-slate-900">Diseño de la credencial</p>
        <p className="mt-1 text-xs text-slate-500">Elige el color que aparecerá en la credencial digital y en el PDF.</p>
      </div>

      <div className="grid grid-cols-3 gap-2" aria-label="Tema de la credencial">
        {Object.entries(temas).map(([codigo, opcion]) => (
          <button
            key={codigo}
            type="button"
            aria-pressed={tema === codigo}
            onClick={() => onTema(codigo)}
            className={`min-w-0 rounded-2xl border p-2 text-left transition sm:p-3 ${tema === codigo ? "border-orange-500 bg-white shadow-sm ring-2 ring-orange-100" : "border-slate-200 bg-white hover:border-orange-300"}`}
          >
            <span className="mb-2 block h-7 rounded-lg" style={{ backgroundColor: opcion.fondo }} />
            <span className="block truncate text-[10px] font-bold text-slate-700 sm:text-xs">{opcion.nombre}</span>
          </button>
        ))}
      </div>

      <div className="mx-auto w-full max-w-xl overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white shadow-xl">
        <div className="relative overflow-hidden p-4 text-white sm:p-5" style={{ backgroundColor: actual.fondo }}>
          <span className="absolute -right-8 -top-12 h-32 w-32 rounded-full border-[22px] opacity-15" style={{ borderColor: actual.acento }} />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/95 p-1 shadow-sm">
                <img src="/images/logo-famkon.png" alt="FamKon" className="h-full w-full object-contain" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold tracking-wide">FamKon</p>
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/65">Credencial digital</p>
              </div>
            </div>
            <IdCard className="h-6 w-6 shrink-0 text-white/70" />
          </div>
        </div>

        <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 p-4 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-6 sm:p-6">
          <div>
            <div className="aspect-[3/4] overflow-hidden rounded-2xl border-4 border-white bg-slate-100 shadow-md ring-1 ring-slate-200">
              {foto ? <img src={foto} alt="Foto personalizada del carnet" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-slate-100" />}
            </div>
            <span className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700 sm:text-[10px]"><ShieldCheck size={12} /> Verificada</span>
          </div>

          <div className="flex min-w-0 flex-col justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Titular</p>
              <p className="mt-1 break-words text-lg font-extrabold leading-tight text-slate-950 sm:text-2xl">{nickname || "Tu nickname"}</p>
              <p className="mt-2 text-xs font-bold" style={{ color: actual.fondo }}>COMPRADOR</p>
              <p className="mt-1 text-[10px] text-slate-400">ID asignado al crear la cuenta</p>
            </div>

            <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Acceso seguro</p>
                <p className="mt-1 text-[10px] leading-4 text-slate-500">El QR se genera al guardar.</p>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 sm:h-16 sm:w-16"><QrCode className="h-7 w-7" /></span>
            </div>
          </div>
        </div>

        <div className="h-1.5" style={{ backgroundColor: actual.acento }} />
      </div>

      <p className="text-center text-xs text-slate-500">Vista previa. La credencial final incluirá tu número de comprador, fecha de emisión y QR de acceso.</p>
    </section>
  );
}
