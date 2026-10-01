# Cambio y recuperación de contraseña

## Uso

- Login → **¿Olvidaste tu contraseña?** → correo o nickname → correo electrónico o WhatsApp → pegar código de seis dígitos → nueva contraseña y confirmación.
- Perfil → **Contraseña y seguridad** → **Conozco mi contraseña**: introducir la actual, la nueva y su confirmación.
- Perfil → **Olvidé mi contraseña**: elegir canal, verificar código y crear la nueva. La cuenta se obtiene del JWT; el cliente no selecciona otro usuario.
- Después del éxito, **Ir a iniciar sesión** limpia la sesión local y muestra la confirmación en el login.

Solo se envía a los contactos guardados en USUARIO. No se permite indicar un destino alternativo durante la recuperación. El canal escogido para esta operación no cambia la preferencia general de notificaciones. WhatsApp requiere un teléfono internacional válido, con prefijo `+`.

## Instalación

Ejecutar como TIENDA_APP en la base correspondiente a la API, desde la raíz:

```sh
dotnet run --project tools/OracleRunner -- apply 'BD/01 scrip/pkg/10_RECUPERACION_PASSWORD.sql'
```

La migración es repetible y crea solamente RECUPERACION_PASSWORD. No reemplaza paquetes ni modifica cuentas existentes. Requiere las tablas USUARIO y TOKEN_RECUPERACION del esquema base. Usa una fila por usuario, con el identificador de solicitud indexado y el estado JSON en CLOB.

Reiniciar el backend para cargar los endpoints y servicios nuevos. Se reutilizan las configuraciones locales de Email, WhatsApp y Jwt:SecretKey; no hay claves nuevas. Todas las instancias deben compartir base de datos y clave JWT. Cambiar esta clave invalida también recuperaciones pendientes. Las fechas se calculan en UTC; mantener los relojes sincronizados.

## API

Todas las operaciones son POST bajo `/api/famkon/password` y devuelven `mensaje` en sus respuestas funcionales.

| Ruta | Autenticación | Cuerpo | Respuesta correcta |
|---|---|---|---|
| `/solicitar` | Pública | `identificador`, `canal` (`EMAIL` o `WHATSAPP`) | `solicitud`, mensaje genérico |
| `/perfil/solicitar` | JWT | `canal` | `solicitud`, mensaje genérico |
| `/verificar` | Pública | `solicitud`, `codigo` | `permiso`, mensaje |
| `/restablecer` | Pública | `solicitud`, `permiso`, `nuevaContrasena` | mensaje |
| `/cambiar` | JWT | `contrasenaActual`, `nuevaContrasena` | mensaje |

La verificación intercambia el OTP por un permiso aleatorio de 256 bits. El permiso permanece en memoria del formulario, no en localStorage ni en URLs. Recargar la página obliga a comenzar de nuevo. El servidor valida la autorización al guardar; ocultar o mostrar el formulario no constituye autorización.

## Controles

- OTP generado con RandomNumberGenerator en backend; seis dígitos, cinco minutos, cinco intentos.
- HMAC-SHA256 con la clave del servidor para almacenar OTP y permiso, con identificador de solicitud y propósito. Nunca se persisten códigos ni permisos en claro.
- Permiso de cambio válido cinco minutos y consumido en la misma transacción que actualiza el hash.
- Un minuto entre envíos, máximo cinco por hora y cuenta, sumando ambos canales. Reenvíos aceptados invalidan el código anterior; solicitudes limitadas no lo invalidan.
- El cambio con contraseña actual admite cinco fallos por cuenta cada 15 minutos.
- Límite adicional de 30 peticiones cada diez minutos por IP en estos endpoints. Detrás de un proxy, configurar únicamente proxies confiables si se necesita resolver la IP original; no confiar en X-Forwarded-For arbitrarios.
- No permite cambios en cuentas inactivas o bloqueadas. Vuelve a comprobar la cuenta y su hash al verificar y restablecer.
- Bloqueo de la fila USUARIO y transacciones Oracle para evitar consumo concurrente. Límites y estado persisten tras reiniciar la API.
- Respuesta genérica para cuentas inexistentes, medios ausentes, solicitudes limitadas y envíos fallidos. No confirma la existencia de una cuenta; tampoco garantiza que el proveedor haya entregado un mensaje.
- Cambiar la contraseña invalida la recuperación pendiente y los tokens antiguos de TOKEN_RECUPERACION.
- Se conserva SHA-256 para compatibilidad con el login y los paquetes actuales; no es una migración del esquema de hashes.
- Los cambios exitosos se registran en la bitácora existente. Nunca se registra el código ni la contraseña.

Los JWT ya emitidos siguen sujetos al mecanismo existente de expiración: este cambio no implementa revocación global de sesiones. La salida del formulario limpia solo la sesión del navegador actual. El endpoint de prueba `test-token` preexistente debe retirarse o restringirse antes de publicar; está fuera de esta funcionalidad.

## Verificación

```sh
cd Fronted
bun run build
bun test
cd ..
dotnet build Backend/FamKon_store_api --no-restore
dotnet run --project tests/PasswordChecks
```

PasswordChecks usa un repositorio y remitente simulados: no modifica cuentas ni envía mensajes. Comprueba expiración, bloqueo por intentos, no reutilización, reenvío, concurrencia, cambio con contraseña actual, límites por cuenta, errores de envío, cuentas bloqueadas y cambios externos de contraseña.

Prueba integral manual con una cuenta propia: solicitar por cada canal, verificar, guardar, comprobar que la contraseña anterior falla y la nueva permite entrar; repetir desde perfil con ambos métodos. Revisar también la vista móvil y el pegado del OTP. No usar contraseñas ni contactos de usuarios reales para pruebas automatizadas.

### Comprobación realizada (2026-09-29)

- Migración 10 aplicada y tabla confirmada en TIENDA_APP.
- Frontend: compilación correcta; 26 pruebas aprobadas.
- Backend: compilación sin errores ni advertencias; 41 comprobaciones PasswordChecks aprobadas.
- Instancia temporal de API: 401 sin JWT en los endpoints de perfil, 400 para entradas inválidas y autorizaciones inexistentes consultando Oracle, `Cache-Control: no-store` y 429 al exceder el límite HTTP.
- No se enviaron códigos reales ni se cambiaron contraseñas existentes. Pendiente prueba integral con cuenta propia y revisión visual en navegador. La instancia temporal se detuvo; reiniciar la API de desarrollo habitual para cargar estos cambios.
