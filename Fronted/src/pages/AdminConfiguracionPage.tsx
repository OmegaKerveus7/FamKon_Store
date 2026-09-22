import { Settings, Globe, Bell, Lock } from "lucide-react";

export default function AdminConfiguracionPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Settings className="h-6 w-6 text-slate-700" />
          Configuracion General
        </h1>
        <p className="text-sm text-slate-500">
          Parametros globales del sistema y conexiones externas.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card
          icon={<Globe className="h-5 w-5" />}
          titulo="Datos del sitio"
          descripcion="Identificadores y claves publicas del sitio."
          campos={["Codigo del sitio", "Nombre comercial", "Dominio"]}
        />
        <Card
          icon={<Bell className="h-5 w-5" />}
          titulo="Notificaciones"
          descripcion="Plantillas de email y WhatsApp."
          campos={["Plantilla OTP", "Plantilla de pedido", "Recordatorio"]}
        />
        <Card
          icon={<Lock className="h-5 w-5" />}
          titulo="Seguridad"
          descripcion="Politicas de password y JWT."
          campos={["Duracion del JWT", "Intentos max. fallidos", "Bloqueo automatico"]}
        />
        <Card
          icon={<Settings className="h-5 w-5" />}
          titulo="Integraciones"
          descripcion="Servicios externos (Biosys, SMTP, WAWP)."
          campos={["Biosys endpoint", "SMTP (Gmail)", "WhatsApp Business"]}
        />
      </div>

      <p className="text-center text-xs text-slate-400">
        Modulo en construccion - lee/escribe la tabla SITIO y parametros generales.
      </p>
    </div>
  );
}

function Card({
  icon,
  titulo,
  descripcion,
  campos,
}: {
  icon: React.ReactNode;
  titulo: string;
  descripcion: string;
  campos: string[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        {icon}
      </div>
      <h3 className="text-base font-bold text-slate-900">{titulo}</h3>
      <p className="mt-1 text-xs text-slate-500">{descripcion}</p>
      <ul className="mt-3 space-y-1 text-xs text-slate-600">
        {campos.map((c) => (
          <li key={c} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}
