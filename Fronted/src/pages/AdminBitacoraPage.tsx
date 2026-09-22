import { Database, Clock, User, Globe, Monitor } from "lucide-react";

export default function AdminBitacoraPage() {
  const eventos = [
    {
      fecha: "2026-09-21 17:45:12",
      usuario: "tobiasgusito",
      metodo: "CONTRASENA",
      resultado: "S",
      ip: "190.148.50.10",
      motivo: "Login exitoso",
    },
    {
      fecha: "2026-09-21 17:30:01",
      usuario: "supervisor01",
      metodo: "CONTRASENA",
      resultado: "S",
      ip: "190.148.50.22",
      motivo: "Login exitoso",
    },
    {
      fecha: "2026-09-21 17:12:48",
      usuario: "desconocido",
      metodo: "CONTRASENA",
      resultado: "N",
      ip: "45.231.10.5",
      motivo: "Contrasena incorrecta",
    },
    {
      fecha: "2026-09-21 16:58:00",
      usuario: "repartidor01",
      metodo: "QR",
      resultado: "S",
      ip: "190.148.50.18",
      motivo: "Login QR exitoso",
    },
    {
      fecha: "2026-09-21 16:32:15",
      usuario: "tobiasgusito",
      metodo: "CONTRASENA",
      resultado: "S",
      ip: "190.148.50.10",
      motivo: "Login exitoso",
    },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Database className="h-6 w-6 text-orange-600" />
          Bitacora de Accesos
        </h1>
        <p className="text-sm text-slate-500">
          Auditoria de intentos de inicio de sesion (PKG_SEGURIDAD.SP_REGISTRAR_ACCESO).
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat icon={<User className="h-4 w-4" />} label="Total eventos" value="1,247" />
        <Stat icon={<Globe className="h-4 w-4" />} label="Hoy" value="38" />
        <Stat icon={<Clock className="h-4 w-4" />} label="Fallidos" value="4" />
        <Stat icon={<Monitor className="h-4 w-4" />} label="IPs unicas" value="12" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Metodo</th>
              <th className="px-4 py-3">Resultado</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">Motivo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {eventos.map((e, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.fecha}</td>
                <td className="px-4 py-3 font-semibold text-slate-800">{e.usuario}</td>
                <td className="px-4 py-3 text-slate-600">{e.metodo}</td>
                <td className="px-4 py-3">
                  {e.resultado === "S" ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      OK
                    </span>
                  ) : (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      Fallo
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.ip}</td>
                <td className="px-4 py-3 text-slate-600">{e.motivo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-center text-xs text-slate-400">
        Modulo en construccion - consultar BITACORA_ACCESO con PKG_SEGURIDAD.SP_REGISTRAR_ACCESO.
      </p>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
