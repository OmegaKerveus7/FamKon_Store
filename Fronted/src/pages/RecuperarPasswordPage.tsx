import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound } from 'lucide-react';
import PasswordForm from '../components/PasswordForm';
import { useAuth } from '../context/AuthContext';

export default function RecuperarPasswordPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { cerrarSesion } = useAuth();
  return <div className="flex min-h-dvh items-center justify-center bg-linear-to-br from-amber-50 via-orange-100 to-slate-100 p-3 sm:p-4">
    <main className="w-full max-w-lg space-y-5 rounded-2xl bg-white p-5 shadow-xl sm:space-y-6 sm:rounded-3xl sm:p-8">
      <Link to="/login" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-amber-700"><ArrowLeft size={16} />Volver al inicio de sesión</Link>
      <div><KeyRound size={28} className="mb-3 text-amber-600" /><h1 className="text-2xl font-bold text-slate-900">Recupera tu contraseña</h1><p className="mt-2 text-sm text-slate-500">Verifica tu cuenta y elige una contraseña nueva.</p></div>
      <PasswordForm identificadorInicial={typeof state?.identificador === 'string' ? state.identificador : ''} onFinished={() => { cerrarSesion(); navigate('/login', { replace: true, state: { passwordUpdated: true } }); }} />
    </main>
  </div>;
}
