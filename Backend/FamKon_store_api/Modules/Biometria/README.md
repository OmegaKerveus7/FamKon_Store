# Módulo de identidad facial

Integración independiente del registro y de los accesos por contraseña/QR.
Frontend: `Fronted/src/modules/biometria`. Backend: este directorio.

## Configuración

`Biometria:BaseUrl` identifica al proveedor HTTPS, sin `/api/Rostro` al final.
En desarrollo se configuró el host de la colección Postman proporcionada.
La dirección de ngrok puede cambiar: actualizar la configuración, no los controladores.
El cliente envía `RostroA`/`RostroB` y admite respuestas JSON camelCase/PascalCase.
Cada llamada tiene un límite de 30 segundos. No se reintentan automáticamente capturas.

## Flujo

1. Iniciar sesión con contraseña y abrir Mi Perfil → Identidad facial.
2. Confirmar contraseña actual y capturar la foto. `POST /api/famkon/biometria/enrolar`
   requiere JWT; el ID del usuario procede de sus claims, nunca del cuerpo enviado.
3. La API segmenta la captura. Si ya hay referencia, compara contra ella antes de reemplazarla.
   En el primer enrolamiento no existe una referencia facial previa: la identidad de la cuenta
   se autoriza con sesión y contraseña. La segmentación por sí sola no demuestra identidad.
4. Se guardan original y segmentada mediante `PKG_ARCHIVO.SP_GUARDAR_ARCHIVO`, y se vinculan
   a `USUARIO.ID_FOTO_ORIGINAL` / `ID_FOTO_MODIFICADA` en la misma transacción.
   La foto segmentada queda disponible para el futuro módulo de carnet; este cambio no emite carnets.
5. Desde `/login/facial`, `POST /api/famkon/biometria/login` recibe únicamente la captura.
   Se segmenta una vez y se compara contra las referencias de las cuentas activas y no bloqueadas.
   Se revisa toda la galería: exactamente una coincidencia permite emitir JWT. Cero coincidencias,
   dos coincidencias o cualquier comparación incompleta impiden el acceso. Antes de emitir el token
   se revisan otra vez el estado de la cuenta y los IDs de sus fotos.
   `/api/famkon/login/facial` es un alias al mismo controlador; no exige ni utiliza correo.
   El proveedor compara pares, por lo que esta identificación usa un máximo de 100 referencias
   y 60 segundos por intento. Si se supera el límite, no se autentica con resultados parciales:
   se solicita acceso por contraseña. Para galerías grandes se requiere un índice facial del proveedor.

Usuarios sin foto: entrar con contraseña y completar el enrolamiento. El registro actual no
persiste sus fotos; este módulo no modifica el flujo de registro ni lo presenta como enrolamiento.
El contrato del proveedor no incluye prueba de vida; no se afirma protección contra fotos o videos.

## Auditoría

Cada respuesta lleva `codigo`, `codigoS`, `mensaje` y `referencia`. Los logs usan la categoría
`FamKon_store_api.Modules.Biometria.BiometriaController` y campos de módulo, operación y referencia.
También se registra en `BITACORA_ACCESO` con `METODO_ACCESO=FACIAL` y
`MOTIVO=BIOMETRIA/{LOGIN|ENROLAMIENTO}/{codigo}; ref={referencia}`.
No se registran fotos, base64, contraseñas ni el cuerpo de las respuestas del proveedor.
Si la bitácora Oracle falla, el log emite `BIO_AUDITORIA_FALLO` con la misma referencia.

Códigos principales: `BIO_SIN_REFERENCIA`, `BIO_ROSTRO_NO_DETECTADO`, `BIO_NO_COINCIDE`,
`BIO_CUENTA_NO_HABILITADA`, `BIO_CREDENCIALES`, `BIO_PROVEEDOR_HTTP`, `BIO_TIMEOUT`,
`BIO_RESPUESTA_INVALIDA`, `BIO_CONEXION`, `BIO_CUENTA_CAMBIO`, `BIO_COINCIDENCIA_AMBIGUA`, `BIO_GALERIA_LIMITE`.

## Pruebas

Desde la raíz: `dotnet run --project tests/BiometriaChecks`.
Estas pruebas usan un proveedor simulado: contrato, coincidencia positiva/negativa,
fallos HTTP/JSON/timeout, imágenes inválidas, cuentas bloqueadas/inactivas, identificación única,
galería vacía, ambigüedad y fallo del proveedor después de una coincidencia.
Prueba manual final: enrolar una cuenta propia, salir y acceder con una captura nueva;
probar un rostro distinto y revisar la bitácora. No se han creado cuentas de prueba ni
reemplazado fotos de usuarios existentes automáticamente.
