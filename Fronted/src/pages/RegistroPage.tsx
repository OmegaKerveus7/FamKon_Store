import VistaPreviaCarnet from '../components/VistaPreviaCarnet';
import { comprasRequest } from '../api/compras';
import EditorFotoCredencial from '../components/EditorFotoCredencial';
import { getCountries, getCountryCallingCode, getExampleNumber, type CountryCode } from "libphonenumber-js/max";
import ejemplosTelefono from "libphonenumber-js/mobile/examples";
import { REGLA_PASSWORD, validarPassword, validarTelefono, normalizarTelefono } from "../utils/registroValidacion";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  ChevronDown,
  Loader2,
  UserPlus,
  Mail,
  MessageCircle,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  Phone,
  Smartphone,
} from "lucide-react";
import CameraCapture, {
  type CameraCaptureHandle,
} from "../components/CameraCapture";
import {
  registrarComprador,
  comprobarCorreo,
  enviarCodigoVerificacion,
  stripBase64Prefix,
  type CanalVerificacion,
} from "../api/famkon";

type Paso = "datos" | "verificar";

const MINUTOS_EXPIRACION = 5;
const nombresPaises = new Intl.DisplayNames(["es"], { type: "region" });
const paisesTelefono = getCountries().map((codigo) => ({
  codigo,
  nombre: nombresPaises.of(codigo) ?? codigo,
  prefijo: getCountryCallingCode(codigo),
})).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

function generarCodigoOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── Borrador de registro (sobrevive al reciclado de pestañas en móvil) ───
// En teléfonos el navegador descarta la pestaña al pasar a segundo plano
// (p. ej. al abrir WhatsApp o el correo para leer el código) y, al volver,
// la página recarga desde cero perdiendo todo el estado de React.
// Guardamos un borrador en localStorage para retomar el registro donde quedó.
const CLAVE_BORRADOR_REGISTRO = "famkon.registro.borrador";
const CLAVE_PRUEBA_STORAGE = "famkon.registro.prueba";
const VIGENCIA_BORRADOR_MS = 24 * 60 * 60 * 1000;
// El backend invalida el token del rostro a los 15 minutos, así que refrescamos
// la segmentación si pasó más de este tiempo (sin pedir otra foto).
const VIGENCIA_TOKEN_ROSTRO_MS = 10 * 60 * 1000;

type BorradorRegistro = {
  guardadoEn: number;
  paso: Paso;
  canal: Exclude<CanalVerificacion, "AMBOS">;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string;
  paisTelefono: CountryCode;
  nickname: string;
  fechaNacimiento: string;
  temaCredencial: string;
  foto: string;
  fotoEditada: string;
  solicitudRostro: string;
  rostroCapturadoEn: number | null;
  codigoEsperado: string;
  codigoEnviadoEn: number | null;
  codigoVerificado: boolean;
  codigoIngresado: string;
  registrado: boolean;
  mensaje: string;
  contrasena: string;
  confirmacion: string;
};

function limpiarEstadoCodigoBorrador(datos: Partial<BorradorRegistro>): Partial<BorradorRegistro> {
  return {
    ...datos,
    codigoEsperado: "",
    codigoEnviadoEn: null,
    codigoVerificado: false,
    codigoIngresado: "",
  };
}

function cargarBorradorRegistro(): Partial<BorradorRegistro> {
  try {
    const crudo = localStorage.getItem(CLAVE_BORRADOR_REGISTRO);
    if (!crudo) return {};
    const datos = JSON.parse(crudo) as Partial<BorradorRegistro>;
    if (!datos || typeof datos !== "object" || typeof datos.guardadoEn !== "number") return {};
    if (Date.now() - datos.guardadoEn > VIGENCIA_BORRADOR_MS) {
      localStorage.removeItem(CLAVE_BORRADOR_REGISTRO);
      return {};
    }
    const codigoExpirado =
      typeof datos.codigoEnviadoEn === "number" &&
      datos.codigoEnviadoEn + MINUTOS_EXPIRACION * 60 * 1000 <= Date.now();
    if (codigoExpirado) return limpiarEstadoCodigoBorrador(datos);
    // Si se perdió la fotografía (cuota de storage llena), volvemos al paso 1
    // pero conservando TODO lo demás: contraseña y código ya verificado.
    if (
      datos.paso === "verificar" &&
      !datos.registrado &&
      (!datos.foto || !datos.fotoEditada)
    ) {
      return { ...datos, paso: "datos" };
    }
    return datos;
  } catch {
    return {};
  }
}

function guardarBorradorRegistro(datos: Partial<BorradorRegistro>): boolean {
  const completo = { ...datos, guardadoEn: Date.now() };
  try {
    localStorage.setItem(CLAVE_BORRADOR_REGISTRO, JSON.stringify(completo));
    return true;
  } catch {
    // Sin espacio disponible: reintentar sin las imágenes (base64 muy pesado).
    try {
      const sinFotos: Partial<BorradorRegistro> = { ...completo };
      delete sinFotos.foto;
      delete sinFotos.fotoEditada;
      localStorage.setItem(CLAVE_BORRADOR_REGISTRO, JSON.stringify(sinFotos));
      return true;
    } catch {
      // Modo privado / cuota agotada: no bloquear el registro por esto.
      return false;
    }
  }
}

export default function RegistroPage() {
  const navigate = useNavigate();
  const cameraRef = useRef<CameraCaptureHandle>(null);
  const envioEnCursoRef = useRef(false);
  const [borradorInicial] = useState(cargarBorradorRegistro);

  // ─── Estado del wizard ──────────────────────────────────────────
  const [paso, setPaso] = useState<Paso>(() => borradorInicial.registrado ? "datos" : borradorInicial.paso === "verificar" ? "verificar" : "datos");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState(() => borradorInicial.registrado ? (borradorInicial.mensaje ?? "") : "");
  const [persistenciaOk, setPersistenciaOk] = useState(true);

  // ─── Paso 1: datos del usuario ──────────────────────────────────
  const [nombres, setNombres] = useState(() => borradorInicial.nombres ?? "");
  const [apellidos, setApellidos] = useState(() => borradorInicial.apellidos ?? "");
  const [correo, setCorreo] = useState(() => borradorInicial.correo ?? "");
  const [consultaCorreo, setConsultaCorreo] = useState<{
    correo: string;
    estado: "consultando" | "disponible" | "registrado" | "error";
  } | null>(null);
  const correoNormalizado = correo.trim().toLowerCase();
  const estadoCorreo = consultaCorreo?.correo === correoNormalizado ? consultaCorreo.estado : null;

  useEffect(() => {
    if (correoNormalizado.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoNormalizado)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setConsultaCorreo({ correo: correoNormalizado, estado: "consultando" });
      try {
        const respuesta = await comprobarCorreo(correoNormalizado, controller.signal);
        if (controller.signal.aborted) return;
        setConsultaCorreo({
          correo: correoNormalizado,
          estado: respuesta.codigoS !== 200 || typeof respuesta.existe !== "boolean"
            ? "error" : respuesta.existe ? "registrado" : "disponible",
        });
      } catch {
        if (!controller.signal.aborted) setConsultaCorreo({ correo: correoNormalizado, estado: "error" });
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [correoNormalizado]);
  const [telefono, setTelefono] = useState(() => borradorInicial.telefono ?? "");
  const [paisTelefono, setPaisTelefono] = useState<CountryCode>(() => borradorInicial.paisTelefono ?? "GT");
  const ejemploTelefono = getExampleNumber(paisTelefono, ejemplosTelefono)?.formatNational();
  const telefonoValido = validarTelefono(telefono, paisTelefono);
  const ayudaTelefono = paisTelefono === "GT"
    ? ""
    : `Ingresa tu número nacional, sin +${getCountryCallingCode(paisTelefono)}.${ejemploTelefono ? ` Ejemplo: ${ejemploTelefono}.` : ""}`;
  const [nickname, setNickname] = useState(() => borradorInicial.nickname ?? "");
  const [contrasena, setContrasena] = useState(() => borradorInicial.contrasena ?? "");
  const [confirmacion, setConfirmacion] = useState(() => borradorInicial.confirmacion ?? "");
  const [fechaNacimiento, setFechaNacimiento] = useState(() => borradorInicial.fechaNacimiento ?? "");
  const [rostro, setRostro] = useState("");
  const [solicitudRostro, setSolicitudRostro] = useState(() => borradorInicial.solicitudRostro ?? "");
  const [rostroCapturadoEn, setRostroCapturadoEn] = useState<number | null>(() => borradorInicial.rostroCapturadoEn ?? null);
  const [errorRostro, setErrorRostro] = useState("");
  const [segmentando, setSegmentando] = useState(false);
  const [temaCredencial, setTemaCredencial] = useState(() => borradorInicial.temaCredencial ?? "AZUL");
  const [registrado, setRegistrado] = useState(() => !!borradorInicial.registrado);
  const [fotoEditada, setFotoEditada] = useState(() => borradorInicial.fotoEditada ?? "");
  const [foto, setFoto] = useState(() => borradorInicial.foto ?? "");

  // ─── Paso 2: verificación por código ────────────────────────────
  const [canal, setCanal] = useState<Exclude<CanalVerificacion, "AMBOS">>(() => borradorInicial.canal === "WHATSAPP" ? "WHATSAPP" : "EMAIL");
  const [codigoEsperado, setCodigoEsperado] = useState(() => borradorInicial.codigoEsperado ?? "");
  const [codigoIngresado, setCodigoIngresado] = useState(() => borradorInicial.codigoIngresado ?? "");
  const [codigoEnviadoEn, setCodigoEnviadoEn] = useState<number | null>(() => borradorInicial.codigoEnviadoEn ?? null);
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(() => {
    if (!borradorInicial.codigoEnviadoEn || borradorInicial.codigoVerificado) return 0;
    const restante = Math.floor((borradorInicial.codigoEnviadoEn + MINUTOS_EXPIRACION * 60 * 1000 - Date.now()) / 1000);
    return Math.max(0, restante);
  });
  const [codigoVerificado, setCodigoVerificado] = useState(() => !!borradorInicial.codigoVerificado);

  // ─── Persistencia del borrador (mobile: la pestaña se recicla) ──
  const estadoBorradorRef = useRef<Partial<BorradorRegistro>>({});
  estadoBorradorRef.current = registrado
    ? {
        paso,
        canal,
        nombres,
        apellidos,
        correo,
        telefono,
        paisTelefono,
        nickname,
        fechaNacimiento,
        temaCredencial,
        codigoEsperado: "",
        codigoEnviadoEn: null,
        codigoVerificado: true,
        codigoIngresado: "",
        registrado: true,
        mensaje,
        contrasena: "",
        confirmacion: "",
      }
    : {
        paso,
        canal,
        nombres,
        apellidos,
        correo,
        telefono,
        paisTelefono,
        nickname,
        fechaNacimiento,
        temaCredencial,
        foto,
        fotoEditada,
        solicitudRostro,
        rostroCapturadoEn,
        codigoEsperado,
        codigoEnviadoEn,
        codigoVerificado,
        codigoIngresado,
        registrado: false,
        mensaje: "",
        contrasena,
        confirmacion,
      };

  useEffect(() => {
    const timer = window.setTimeout(() => guardarBorradorRegistro(estadoBorradorRef.current), 250);
    return () => window.clearTimeout(timer);
  });

  useEffect(() => {
    const guardarAhora = () => guardarBorradorRegistro(estadoBorradorRef.current);
    const alOcultar = () => {
      if (document.visibilityState === "hidden") guardarAhora();
    };
    window.addEventListener("pagehide", guardarAhora);
    document.addEventListener("visibilitychange", alOcultar);
    return () => {
      window.removeEventListener("pagehide", guardarAhora);
      document.removeEventListener("visibilitychange", alOcultar);
    };
  }, []);

  // Avisamos si el navegador bloqueó el almacenamiento (modo privado, cuota,
  // navegador interno de otra app): en ese caso no se puede conservar nada.
  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_PRUEBA_STORAGE, "1");
      localStorage.removeItem(CLAVE_PRUEBA_STORAGE);
      setPersistenciaOk(true);
    } catch {
      setPersistenciaOk(false);
    }
  }, []);

  // Al volver del reciclado de pestaña (móvil) se recupera la fotografía
  // guardada: se vuelve a segmentar sin pedir otra captura y así se regeneran
  // el token y la credencial. También refresca el token si está por vencer.
  const recuperacionFotoHechaRef = useRef(false);
  useEffect(() => {
    if (recuperacionFotoHechaRef.current || registrado) return;
    recuperacionFotoHechaRef.current = true;
    const tokenViejo = !rostroCapturadoEn || Date.now() - rostroCapturadoEn > VIGENCIA_TOKEN_ROSTRO_MS;
    if (foto && (tokenViejo || !solicitudRostro || !rostro)) void recuperarRostro();
  }, []);

  // Si cambian los datos a los que se envió el código, el código anterior deja
  // de ser válido (pero no se pierde nada más al volver al paso 1).
  const datosCodigoRef = useRef({ correo: correoNormalizado, telefono, paisTelefono, canal });
  useEffect(() => {
    const previo = datosCodigoRef.current;
    if (
      previo.correo === correoNormalizado &&
      previo.telefono === telefono &&
      previo.paisTelefono === paisTelefono &&
      previo.canal === canal
    ) return;
    datosCodigoRef.current = { correo: correoNormalizado, telefono, paisTelefono, canal };
    if (!codigoEsperado && !codigoVerificado) return;
    setCodigoEsperado("");
    setCodigoEnviadoEn(null);
    setCodigoVerificado(false);
    setCodigoIngresado("");
    setSegundosRestantes(0);
  }, [correoNormalizado, telefono, paisTelefono, canal, codigoEsperado, codigoVerificado]);

  // ─── Cronómetro de expiración del código (5 min) ────────────────
  useEffect(() => {
    if (codigoEnviadoEn === null || codigoVerificado) return;

    const tick = () => {
      const expiracion = codigoEnviadoEn + MINUTOS_EXPIRACION * 60 * 1000;
      const restante = Math.max(0, Math.floor((expiracion - Date.now()) / 1000));
      setSegundosRestantes(restante);
      if (restante === 0) {
        setCodigoEsperado("");
        setCodigoEnviadoEn(null);
        setError((prev) => prev || "El código expiró. Solicita uno nuevo.");
        clearInterval(intervalo);
      }
    };

    tick();
    const intervalo = setInterval(tick, 1000);
    return () => clearInterval(intervalo);
  }, [codigoEnviadoEn, codigoVerificado]);

  // ─── Paso 1: handlers ───────────────────────────────────────────
  async function segmentarRostro(imagen: string): Promise<string> {
    const r = await comprasRequest<{ solicitudRostro: string; rostroBase64: string; mime: string }>('/registro/rostro', {method:'POST',body:JSON.stringify({fotoOriginalBase64:stripBase64Prefix(imagen)}),signal:AbortSignal.timeout(30000)});
    setSolicitudRostro(r.solicitudRostro); setRostro(`data:${r.mime};base64,${r.rostroBase64}`); setRostroCapturadoEn(Date.now());
    return r.solicitudRostro;
  }
  function mensajeErrorSegmentacion(e: unknown): string {
    const detalle = (e as Error).message;
    return (e as Error).name === 'TimeoutError' ? 'No pudimos preparar la foto a tiempo. Toma otra fotografía para volver a intentarlo.'
      : detalle === 'Pedido no disponible.' ? 'El backend no tiene disponible la preparación de fotos. Reinicia el backend actualizado y toma otra fotografía.'
      : `No pudimos preparar tu foto: ${detalle}`;
  }
  // Tras un reinicio de página: recupera la segmentación de la foto guardada
  // sin descartar la credencial ni pedir otra captura.
  async function recuperarRostro() {
    setErrorRostro(""); setSegmentando(true);
    try { await segmentarRostro(foto); }
    catch(e) { setErrorRostro(mensajeErrorSegmentacion(e)); }
    finally { setSegmentando(false); }
  }
  async function prepararRostro(imagen: string) {
    setFoto(imagen); setRostro(""); setFotoEditada(""); setSolicitudRostro(""); setRostroCapturadoEn(null); setError(""); setErrorRostro(""); setSegmentando(true);
    try {
      await segmentarRostro(imagen);
    } catch(e) { setErrorRostro(mensajeErrorSegmentacion(e)); }
    finally { setSegmentando(false); }
  }
  function capturarFoto() {
    if(segmentando)return;
    const imagen = cameraRef.current?.capturar();
    if (!imagen) { setError("Primero activa la cámara."); return; }
    void prepararRostro(imagen);
  }

  function validarPaso1(): string | null {
    if (!nombres.trim() || !apellidos.trim()) return "Nombres y apellidos son obligatorios.";
    if (estadoCorreo === "registrado") return "Este correo ya está registrado. Inicia sesión o utiliza otro correo.";
    if (correo.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) return "Ingresa un correo válido.";
    if (!nickname.trim()) return "El nombre de usuario es obligatorio.";
    if (!validarPassword(contrasena)) return REGLA_PASSWORD;
    if (contrasena !== confirmacion) return "Las contraseñas no coinciden.";
    if (!fechaNacimiento) return "La fecha de nacimiento es obligatoria.";
    if (!foto) return "Debes tomar una fotografía.";
    if (segmentando) return "Estamos preparando tu fotografía automáticamente. Espera un momento.";
    if (!solicitudRostro || !fotoEditada) return errorRostro || "Toma una fotografía para preparar tu carnet automáticamente.";
    if (!telefonoValido) {
      return `Ingresa un teléfono válido para ${nombresPaises.of(paisTelefono)}. ${ayudaTelefono}`;
    }
    return null;
  }

  function irAPaso2(event: FormEvent) {
    event.preventDefault();
    setError("");
    const errorValidacion = validarPaso1();
    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }
    setPaso("verificar");
    // Solo se envía un código nuevo si no hay uno vigente: así, al volver a
    // este paso (por ejemplo tras recuperar la foto), no se invalida el código
    // ya verificado.
    const codigoVigente = codigoVerificado || (!!codigoEsperado && segundosRestantes > 0);
    if (!codigoVigente) void enviarCodigo();
  }

  function volverAPaso1() {
    setPaso("datos");
    setError("");
    setMensaje("");
  }

  // ─── Paso 2: handlers ───────────────────────────────────────────
  async function enviarCodigo() {
    if (envioEnCursoRef.current) return;
    envioEnCursoRef.current = true;
    setError("");
    setMensaje("");
    setCodigoIngresado("");

    const nuevoCodigo = generarCodigoOTP();
    const payload = {
      codigo: nuevoCodigo,
      correo: correo.trim().toLowerCase(),
      telefono: normalizarTelefono(telefono, paisTelefono),
      canal,
    };
    setCodigoEsperado("");
    setCodigoEnviadoEn(null);
    setSegundosRestantes(0);
    setCodigoVerificado(false);

    setEnviandoCodigo(true);
    try {
      const respuesta = await enviarCodigoVerificacion(payload);
      if (!respuesta.emailEnviado && !respuesta.whatsAppEnviado) {
        throw new Error(respuesta.mensaje || `Error ${respuesta.codigoS}`);
      }

      setCodigoEsperado(nuevoCodigo);
      setCodigoEnviadoEn(Date.now());
      setSegundosRestantes(MINUTOS_EXPIRACION * 60);

      const canalesEnviados: string[] = [];
      if (respuesta.emailEnviado) canalesEnviados.push("correo");
      if (respuesta.whatsAppEnviado) canalesEnviados.push("WhatsApp");

      const canalesFallidos: string[] = [];
      if (canal === "EMAIL" && !respuesta.emailEnviado) {
        canalesFallidos.push("correo");
      }
      if (canal === "WHATSAPP" && !respuesta.whatsAppEnviado) {
        canalesFallidos.push("WhatsApp");
      }

      if (canalesEnviados.length > 0) {
        setMensaje(`Código enviado por ${canalesEnviados.join(" y ")}.`);
      }
      if (canalesFallidos.length > 0) {
        setError(`Falló el envío por: ${canalesFallidos.join(", ")}.`);
      }
    } catch (err) {
      console.error("[RegistroPage] enviarCodigo() error:", err);
      setCodigoEsperado("");
      setCodigoEnviadoEn(null);
      setError(err instanceof Error ? err.message : "No se pudo enviar el código.");
    } finally {
      envioEnCursoRef.current = false;
      setEnviandoCodigo(false);
    }
  }

  function verificarCodigoLocal() {
    setError("");
    if (!codigoEsperado) {
      setError("Primero solicita un código.");
      return;
    }
    if (segundosRestantes === 0) {
      setError("El código expiró. Solicita uno nuevo.");
      return;
    }
    if (codigoIngresado.trim() !== codigoEsperado) {
      setError("El código ingresado no coincide.");
      return;
    }
    setCodigoVerificado(true);
    setMensaje("¡Código verificado! Ahora puedes crear tu cuenta.");
  }

  async function handleCrearCuenta() {
    setError("");
    setMensaje("");

    if (!codigoVerificado) {
      setError("Debes verificar el código antes de crear la cuenta.");
      return;
    }

    if (!contrasena || !confirmacion) {
      setPaso("datos");
      setError("Por seguridad no guardamos tu contraseña. Tus demás datos y el código verificado se conservan: reingresa la contraseña para continuar.");
      return;
    }

    setCargando(true);
    try {
      if (!foto) throw new Error("Debes tomar una fotografía para crear la cuenta.");
      const fotoBase64 = stripBase64Prefix(foto);
      const peticion = (solicitud: string) => registrarComprador({
        solicitudRostro: solicitud,
        temaCredencial,
        nombres: nombres.trim(),
        telefono: normalizarTelefono(telefono, paisTelefono),
        apellidos: apellidos.trim(),
        correo: correo.trim().toLowerCase(),
        contrasena,
        fechaNacimiento,
        nickname: nickname.trim(),
        notificaEmail: true,
        notificaWhatsapp: false,
        fotoOriginalBase64: fotoBase64,
        fotoEditadaBase64: stripBase64Prefix(fotoEditada),
      });

      // El backend vence el token del rostro a los 15 min: si pasó más tiempo
      // (o ya se perdió), se regenera con la foto guardada antes de registrar.
      let token = solicitudRostro;
      const tokenVigente = !!token && !!rostroCapturadoEn && Date.now() - rostroCapturadoEn < VIGENCIA_TOKEN_ROSTRO_MS;
      if (!tokenVigente) token = await segmentarRostro(foto);

      let resultado;
      try {
        resultado = await peticion(token);
      } catch (err) {
        const detalle = err instanceof Error ? err.message : "";
        if (!/venci|cambi/i.test(detalle)) throw err;
        token = await segmentarRostro(foto);
        resultado = await peticion(token);
      }

      if (resultado.codigoS !== 200) {
        throw new Error(resultado.mensaje || "No fue posible crear la cuenta.");
      }

      setMensaje(resultado.mensaje);
      setRegistrado(true);
      cameraRef.current?.apagar();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No fue posible registrar al comprador.",
      );
    } finally {
      setCargando(false);
    }
  }

  // ─── Formateo del cronómetro ────────────────────────────────────
  function formatoTiempo(seg: number): string {
    const m = Math.floor(seg / 60).toString().padStart(2, "0");
    const s = (seg % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function reiniciarBorradorYRecargar() {
    try { localStorage.removeItem(CLAVE_BORRADOR_REGISTRO); } catch { /* modo privado */ }
    window.location.assign("/registro");
  }

  if (registrado) return <main className="flex min-h-dvh items-center justify-center bg-slate-100 p-4"><section className="w-full max-w-lg space-y-5 rounded-3xl border border-slate-200 bg-white p-7 shadow-xl"><img src="/images/slogan-famkon.png" alt="FamKon" className="h-16 max-w-full object-contain" /><div className="rounded-xl bg-emerald-50 p-4"><h1 className="text-2xl font-bold text-slate-900">Tu cuenta está creada</h1><p role="status" className="mt-2 text-sm text-emerald-800">{mensaje}</p></div><p className="text-sm leading-relaxed text-slate-600">Revisá el medio de notificación seleccionado para recibir tu credencial. También podrás consultarla en Mi perfil.</p><button onClick={()=>navigate('/login')} className="w-full rounded-xl bg-amber-500 p-3 text-sm font-semibold">Iniciar sesión con contraseña</button><button onClick={()=>navigate('/login/carnet')} className="w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold">Acceder con mi credencial</button><button onClick={reiniciarBorradorYRecargar} className="w-full text-center text-xs font-medium text-slate-400 hover:text-slate-600">Crear otra cuenta</button></section></main>;


  // ─── Render ─────────────────────────────────────────────────────
  return (
    <main className="min-h-dvh bg-slate-100 p-4 py-6">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <header className="border-b border-slate-200 p-5 sm:px-7 sm:py-5">
          <div className="flex items-center gap-4">
            <img
              src="/images/logo-famkon.png"
              alt="FamKon"
              className="h-12 w-12 object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Crear cuenta</h1>
              <p className="text-sm text-slate-500">
                Completá tus datos y prepará tu credencial para comprar en FamKon.
              </p>
            </div>
          </div>

          {!persistenciaOk && (
            <p role="alert" className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
              Tu navegador está bloqueando el guardado automático (modo privado o permisos).
              No cierres esta pestaña ni salgas de la página hasta terminar el registro.
            </p>
          )}

          {/* Stepper */}
          <div className="mt-5 flex items-center gap-3 text-sm">
            <div
              className={`flex items-center gap-2 rounded-full px-3 py-1 ${
                paso === "datos"
                  ? "bg-amber-500 text-slate-900"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              <span className="font-bold">1</span>
              <span className="font-medium">Datos y fotografía</span>
            </div>
            <div className="h-px flex-1 bg-slate-200" />
            <div
              className={`flex items-center gap-2 rounded-full px-3 py-1 ${
                paso === "verificar"
                  ? "bg-amber-500 text-slate-900"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              <span className="font-bold">2</span>
              <span className="font-medium">Verificación</span>
            </div>
          </div>
        </header>

        {paso === "datos" && (
          <form
            onSubmit={irAPaso2}
            className="grid items-start gap-5 bg-slate-50/60 p-4 sm:p-6 lg:grid-cols-[1.1fr_0.9fr]"
          >
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-slate-800">
                Información personal
              </h2>

              <p className="text-xs leading-relaxed text-slate-500">Usá tus datos personales. Todos los campos de esta sección son obligatorios.</p>
              <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                id="nombres"
                label="Nombres"
                value={nombres}
                onChange={setNombres}
                autoComplete="given-name"
              />
              <Campo
                id="apellidos"
                label="Apellidos"
                value={apellidos}
                onChange={setApellidos}
                autoComplete="family-name"
              />
              </div>
              <Campo
                id="correo"
                label="Correo electrónico"
                type="email"
                value={correo}
                onChange={(valor) => {
                  setCorreo(valor);
                  if (valor.trim().toLowerCase() !== correoNormalizado) setConsultaCorreo(null);
                }}
                autoComplete="email"
              />
              {estadoCorreo && (
                <p role="status" className={`text-xs ${estadoCorreo === "registrado" ? "text-red-700" : estadoCorreo === "disponible" ? "text-emerald-700" : "text-slate-600"}`}>
                  {estadoCorreo === "consultando" && "Comprobando correo..."}
                  {estadoCorreo === "registrado" && "Este correo ya está registrado. Inicia sesión o utiliza otro correo."}
                  {estadoCorreo === "disponible" && "Correo disponible para registrarte."}
                  {estadoCorreo === "error" && "No se pudo comprobar el correo. Se revisará al continuar."}
                </p>
              )}
              <div className="space-y-2">
                <label htmlFor="telefono" className="block text-sm font-medium text-slate-700">Teléfono</label>
                <div className="flex overflow-hidden rounded-xl border border-slate-300 focus-within:border-amber-500">
                  <div className="relative flex shrink-0 items-center gap-1 border-r border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 hover:bg-slate-100 focus-within:ring-2 focus-within:ring-inset focus-within:ring-amber-500">
                    <span aria-hidden="true">+{getCountryCallingCode(paisTelefono)}</span>
                    <ChevronDown aria-hidden="true" className="h-4 w-4" />
                    <select
                      id="pais-telefono"
                      aria-label="País y código telefónico"
                      title={`Cambiar país: ${nombresPaises.of(paisTelefono)}`}
                      value={paisTelefono}
                      onChange={(event) => setPaisTelefono(event.target.value as CountryCode)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    >
                      {paisesTelefono.map((pais) => <option key={pais.codigo} value={pais.codigo}>{pais.nombre} (+{pais.prefijo})</option>)}
                    </select>
                  </div>
                  <input
                    id="telefono"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    required
                    value={telefono}
                    onChange={(event) => setTelefono(event.target.value)}
                    placeholder={ejemploTelefono}
                    aria-describedby="telefono-ayuda telefono-estado"
                    aria-invalid={!!telefono && !telefonoValido}
                    className="min-w-0 flex-1 px-3 py-2.5 text-sm outline-none"
                  />
                </div>
                <p id="telefono-ayuda" className="text-xs text-slate-600">{ayudaTelefono}</p>
                <p id="telefono-estado" role="status" className={`text-xs ${telefonoValido ? "text-emerald-700" : "text-red-700"}`}>
                  {telefono && (telefonoValido ? "El número cumple el formato del país seleccionado." : "Revisa la cantidad de dígitos y el formato para el país seleccionado.")}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                id="nickname"
                label="Nombre de usuario"
                value={nickname}
                onChange={setNickname}
                autoComplete="username"
              />
              <Campo
                id="fechaNacimiento"
                label="Fecha de nacimiento"
                type="date"
                value={fechaNacimiento}
                onChange={setFechaNacimiento}
              />
              </div>
              <div className="border-t border-slate-100 pt-4"><h3 className="text-sm font-semibold text-slate-800">Protegé tu cuenta</h3><p className="mt-1 text-xs text-slate-500">Elegí una contraseña que no uses en otros sitios.</p></div>
              <Campo
                id="contrasena"
                label="Contraseña"
                type="password"
                value={contrasena}
                onChange={setContrasena}
                autoComplete="new-password"
                minLength={8}
              />
              <p className="text-xs text-slate-600">{REGLA_PASSWORD}</p>
              {contrasena && (
                <p aria-live="polite" className={`text-xs ${validarPassword(contrasena) ? "text-emerald-700" : "text-amber-700"}`}>
                  {validarPassword(contrasena) ? "La contraseña cumple los requisitos." : "Contraseña débil: revisa los requisitos."}
                </p>
              )}
              <Campo
                id="confirmacion"
                label="Confirmar contraseña"
                type="password"
                value={confirmacion}
                onChange={setConfirmacion}
                autoComplete="new-password"
                minLength={8}
              />
            </section>

            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-slate-800">Tu foto y credencial</h2><p className="text-xs leading-relaxed text-slate-500">Tomá una foto de frente y con buena iluminación. La usaremos para tu credencial y el acceso facial.</p>

              <CameraCapture ref={cameraRef} guiaRostro verificando={segmentando} />

              <button
                type="button"
                onClick={capturarFoto}
                disabled={segmentando}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-50"
              >
                <Camera className="h-4 w-4" />
                {segmentando ? "Preparando fotografía…" : foto ? "Tomar otra fotografía" : "Tomar fotografía"}
              </button>

              {segmentando && <p role="status" className="text-sm">Detectando y segmentando tu rostro…</p>}
              {errorRostro && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorRostro}</p>}
              {rostro && <EditorFotoCredencial segmentada original={rostro} onChange={setFotoEditada} />}
              {fotoEditada && <VistaPreviaCarnet foto={fotoEditada} nickname={nickname} tema={temaCredencial} onTema={setTemaCredencial} />}
              {foto && (
                <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-xs font-semibold text-slate-600">Ver fotografía original</summary><div className="mt-3 space-y-2">
                  <p className="text-sm font-medium text-slate-700">
                    Fotografía capturada
                  </p>
                  <img
                    src={foto}
                    alt="Fotografía capturada"
                    className="max-h-40 w-full rounded-xl object-contain"
                  />
                </div></details>
              )}

              <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">¿Dónde querés recibir el código?</p>
                <p className="mt-1">
                  Te enviaremos un código de 6 dígitos para confirmar tu cuenta. Elige si deseas recibirlo por
                  correo o WhatsApp.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <CanalOpcion
                    icono={<Mail className="h-4 w-4" />}
                    titulo="Correo"
                    activo={canal === "EMAIL"}
                    onClick={() => setCanal("EMAIL")}
                  />
                  <CanalOpcion
                    icono={<MessageCircle className="h-4 w-4" />}
                    titulo="WhatsApp"
                    activo={canal === "WHATSAPP"}
                    onClick={() => setCanal("WHATSAPP")}
                  />
                </div>
              </div>

              {error && (
                <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={segmentando || !solicitudRostro || !fotoEditada}
                className="disabled:opacity-50 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-amber-400"
              >
                {segmentando ? "Preparando tu carnet…" : "Continuar a verificación"}
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                Ya tengo una cuenta
              </button>
            </section>
          </form>
        )}

        {paso === "verificar" && (
          <div className="mx-auto max-w-2xl space-y-5 p-5 sm:p-7">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-base font-semibold text-slate-800">
                Confirma tus datos
              </h2>
              <dl className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Nombre</dt>
                  <dd className="font-medium text-slate-800">
                    {nombres} {apellidos}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Usuario</dt>
                  <dd className="font-medium text-slate-800">{nickname}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Correo</dt>
                  <dd className="font-medium text-slate-800">{correo}</dd>
                </div>
                {telefono && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Teléfono</dt>
                    <dd className="font-medium text-slate-800">{normalizarTelefono(telefono, paisTelefono)}</dd>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Canal</dt>
                  <dd className="font-medium text-slate-800">
                    {canal === "EMAIL" && "Correo electrónico"}
                    {canal === "WHATSAPP" && "WhatsApp"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-amber-200 p-2 text-amber-800">
                  {canal === "WHATSAPP" ? (
                    <MessageCircle className="h-5 w-5" />
                  ) : (
                    <Mail className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-slate-800">
                    Código de verificación
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    El código de 6 dígitos se envía automáticamente al canal seleccionado.
                    Caduca en {MINUTOS_EXPIRACION} minutos.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={enviarCodigo}
                  disabled={enviandoCodigo || (segundosRestantes > 0 && !!codigoEsperado)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {enviandoCodigo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  {enviandoCodigo
                    ? "Enviando..."
                    : codigoEsperado && segundosRestantes > 0
                    ? `Reenviar en ${formatoTiempo(segundosRestantes)}`
                    : "Reenviar código"}
                </button>

                {codigoEsperado && segundosRestantes > 0 && (
                  <p className="text-xs font-medium text-amber-700">
                    ⏱ Expira en {formatoTiempo(segundosRestantes)}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="codigo"
                  className="block text-sm font-medium text-slate-700"
                >
                  Ingresa el código de 6 dígitos
                </label>
                <input
                  id="codigo"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={codigoIngresado}
                  onChange={(e) =>
                    setCodigoIngresado(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  disabled={codigoVerificado || !codigoEsperado || segundosRestantes === 0}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-center font-mono text-2xl tracking-[0.5em] outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>

              {codigoVerificado && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Código verificado correctamente.
                </div>
              )}

              <button
                type="button"
                onClick={verificarCodigoLocal}
                disabled={codigoVerificado || codigoIngresado.length !== 6}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" />
                Verificar código
              </button>
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}
            {mensaje && !error && (
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                {mensaje}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={volverAPaso1}
                disabled={cargando || enviandoCodigo}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver y editar datos
              </button>

              <button
                type="button"
                onClick={handleCrearCuenta}
                disabled={!codigoVerificado || cargando}
                className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cargando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {cargando ? "Creando cuenta..." : "Crear cuenta"}
              </button>
            </div>

            {mensaje && codigoVerificado === false && (
              <p className="text-center text-xs text-slate-400">
                Una vez verificado el código, podrás crear la cuenta.
              </p>
            )}

            {mensaje && codigoVerificado && !error && cargando === false && (
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="block w-full text-center text-sm font-semibold text-amber-700 underline"
              >
                Ir a iniciar sesión
              </button>
            )}

            <div className="border-t border-slate-200 pt-3 text-center text-xs text-slate-400">
              <Phone className="mr-1 inline h-3 w-3" />
              Usaremos tus datos para gestionar tu cuenta y tus compras.
              <Smartphone className="ml-2 mr-1 inline h-3 w-3" />
              No compartás tu contraseña ni tu código de verificación.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

interface CampoProps {
  id: string;
  label: string;
  value: string;
  type?: string;
  autoComplete?: string;
  minLength?: number;
  onChange: (value: string) => void;
}

function Campo({
  id,
  label,
  value,
  type = "text",
  autoComplete,
  minLength,
  onChange,
}: CampoProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
      />
    </div>
  );
}

interface CanalOpcionProps {
  icono: React.ReactNode;
  titulo: string;
  activo: boolean;
  onClick: () => void;
}

function CanalOpcion({ icono, titulo, activo, onClick }: CanalOpcionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${
        activo
          ? "border-amber-500 bg-amber-100 text-amber-800"
          : "border-slate-200 bg-white text-slate-600 hover:border-amber-300"
      }`}
    >
      {icono}
      {titulo}
    </button>
  );
}
