# Credencial de comprador

La credencial PDF incluye logo, foto personalizada, nickname, número interno, fecha, rol comprador e instrucciones. Su QR contiene un secreto aleatorio de 256 bits para iniciar sesión; no es el QR de tracking.

Registro permite filtros Natural/Blanco y negro/Sepia/Cálido y stickers predefinidos. El editor genera JPEG de 512 px. Se valida formato y tamaño en backend. La versión personalizada se guarda en CREDENCIAL.FOTO, separada del módulo biométrico, y aparece en Topbar. La fotografía original se asocia a USUARIO.ID_FOTO_ORIGINAL si aún no existe; cambiar el diseño no sobrescribe un enrolamiento facial existente. El enrolamiento/segmentación facial continúa en su módulo.

Mi perfil permite crear (cuentas anteriores), ver, descargar, reenviar o reemplazar. Crear otro diseño también invalida el QR anterior. El reemplazo rota el hash y la credencial en una transacción. No cierra JWT ya emitidos. El login QR comprueba usuario activo/no bloqueado y roles activos; audita sin guardar el secreto. Ingresar un número de comprador por sí solo no permite iniciar sesión.

## Almacenamiento y envío

Aplicar `12_CREDENCIAL.sql` antes de iniciar la nueva API (ya aplicado en la base configurada). Configurar `Credencial:EncryptionKey` con 32 bytes aleatorios en Base64: se generó una clave solo en appsettings.json local, excluido de Git. Copiarla de forma segura al servidor y respaldarla: perderla impide descifrar PDFs anteriores. La API usa AES-GCM para cifrar el PDF, que contiene el QR. TOKEN_QR_HASH conserva SHA-256 del secreto para interoperabilidad.

El trabajador de envíos procesa registros nuevos cada 30 segundos según NOTIFICA_EMAIL/NOTIFICA_WHATSAPP. Correo recibe adjunto; WAWP recibe enlace aleatorio de diez minutos, válido solo para la versión vigente. Nunca registrar rutas /credencial/documento/* completas en logs del proxy. `Constancias:PublicApiUrl` debe apuntar a la API pública con estas rutas publicadas.

Estados PENDIENTE/ENVIANDO/ENVIADO/ERROR. ENVIADO es aceptación del proveedor, no confirmación de lectura. Reenvío explícito tiene espera mínima de diez minutos; ENVIANDO bloqueado requiere revisar al proveedor antes de reintentar. Una respuesta incierta puede producir duplicado si se reenvía. No se emitieron ni enviaron credenciales para cuentas existentes durante el desarrollo.

Si la generación falla después de crear la cuenta, registro informa que la cuenta existe y permite completar la credencial desde perfil; no invita a registrar de nuevo.

## Verificación

`dotnet run --project tests/CredencialChecks`: PDF ficticio, imagen, cifrado reversible, rechazo de manipulación y rechazo de foto inválida. Frontend build verifica TypeScript. Se revisó visualmente el PDF generado. Pendiente de prueba real: registro, recepción SMTP/WAWP y escaneo con cámara tras reiniciar/publicar. No se acredita registro completo en menos de 30 segundos sin medirlo.

## Registro con rostro segmentado y diseño (actualización)

Antes de registrar, POST /registro/rostro invoca IBiometriaClient y conserva original y segmentada durante 15 minutos en una caché limitada de 64 MB. Devuelve un identificador aleatorio ligado a la captura. Registro comprueba esa referencia: nunca usa una imagen enviada por el navegador como referencia facial confiable. Reiniciar el backend invalida estas preparaciones; hay que volver a segmentar. En despliegues con múltiples réplicas se necesita afinidad de sesión o sustituir la caché por un almacén compartido.

El editor del registro usa la segmentada y presenta el carnet completo con temas AZUL, NARANJA y MORADO. El PDF reproduce el tema seleccionado. Aplicar 13_CREDENCIAL_TEMA.sql (aplicado en la base configurada). En emisión inicial se guardan original en ID_FOTO_ORIGINAL y segmentada sin filtros en ID_FOTO_MODIFICADA; la imagen con stickers permanece en CREDENCIAL.FOTO. No se sobrescribe un enrolamiento previo al cambiar el carnet.

Después del registro se muestra confirmación de cuenta creada y enlaces a login QR o contraseña. El envío permanece en la cola existente. No se afirma recepción de correo hasta probar un registro real y revisar el buzón.

### Segmentación del proveedor y filtros del carnet

Registro y perfil envían la captura a `/api/famkon/registro/rostro`. El backend
llama a `{Biometria:BaseUrl}/api/Rostro/Segmentar` con `RostroA` y `RostroB`,
y devuelve la imagen segmentada recibida del proveedor. En registro se vinculan
captura e imagen segmentada mediante un ticket temporal. La referencia guardada
para reconocimiento facial permanece sin filtros.

El navegador encuadra la imagen para el carnet y usa únicamente Face Landmarker
(MediaPipe Tasks Vision 0.10.32) para colocar perrito, gatito, conejito y payasito.
Se retiró Selfie Segmenter y su modelo; no se vuelve a segmentar en el navegador.
El fondo blanco viene del proveedor. Incluir `public/vision` en el despliegue.

La comparación del proveedor usa `/api/Rostro/Verificar`; `/api/Rostro/Validar`
devolvió 404 en la comprobación del 1 de octubre de 2026. La URL del proveedor se
configura en `Biometria:BaseUrl`, incluyendo la configuración de Development.
