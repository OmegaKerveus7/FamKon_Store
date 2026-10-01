import { useEffect, useRef, useState } from 'react';

interface RecaptchaApi {
  render(element: HTMLElement, options: {
    sitekey: string; size: 'compact'; callback: (token: string) => void;
    'expired-callback': () => void; 'error-callback': () => void;
  }): number;
  reset(id: number): void;
}
declare global {
  interface Window { grecaptcha?: RecaptchaApi; famkonRecaptchaLoaded?: () => void }
}

let pending: Promise<RecaptchaApi> | null = null;
function loadRecaptcha(): Promise<RecaptchaApi> {
  if (window.grecaptcha?.render) return Promise.resolve(window.grecaptcha);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = window.setTimeout(fail, 15000);
    function fail() {
      clearTimeout(timer); script.remove(); pending = null;
      reject(new Error('No se pudo cargar la verificación. Revisa tu conexión y vuelve a intentar.'));
    }
    window.famkonRecaptchaLoaded = () => {
      clearTimeout(timer);
      if (window.grecaptcha?.render) resolve(window.grecaptcha);
      else fail();
    };
    script.src = 'https://www.google.com/recaptcha/api.js?onload=famkonRecaptchaLoaded&render=explicit&hl=es';
    script.async = true; script.defer = true; script.onerror = fail;
    document.head.appendChild(script);
  });
  return pending;
}

export default function Recaptcha({ siteKey, resetVersion, onToken }: { siteKey: string; resetVersion: number; onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  callback.current = onToken;
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let disposed = false;
    let widget: number | undefined;
    let api: RecaptchaApi | undefined;
    // Un contenedor nuevo evita doble render durante StrictMode y al volver al checkout.
    const element = document.createElement('div');
    container.current?.appendChild(element);
    callback.current(''); setError(''); setLoading(true);
    void loadRecaptcha().then(loaded => {
      if (disposed) return;
      api = loaded;
      widget = api.render(element, {
        sitekey: siteKey, size: 'compact',
        callback: token => { if (!disposed) { callback.current(token); setError(''); } },
        'expired-callback': () => { if (!disposed) { callback.current(''); setError('La verificación venció. Marca nuevamente la casilla.'); } },
        'error-callback': () => { if (!disposed) { callback.current(''); setError('No se pudo verificar. Revisa tu conexión y vuelve a intentar.'); } },
      });
      setLoading(false);
    }).catch(() => {
      if (!disposed) { setLoading(false); setError('No se pudo cargar la verificación. Revisa tu conexión o el bloqueador de contenido.'); }
    });
    return () => {
      disposed = true;
      if (widget !== undefined) api?.reset(widget);
      element.remove();
    };
  }, [siteKey, resetVersion, retry]);

  return <div className="space-y-2">
    {loading && <p role="status" className="text-xs text-slate-500">Cargando verificación…</p>}
    <div ref={container} className="flex justify-center" />
    {error && <div role="alert" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900"><p>{error}</p><button type="button" onClick={() => setRetry(n => n + 1)} className="mt-2 font-semibold underline">Reintentar verificación</button></div>}
  </div>;
}
