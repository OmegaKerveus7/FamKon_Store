# reCAPTCHA en checkout

Implementación de **reCAPTCHA v2, casilla «No soy un robot»**. Se exige tanto para compras en efectivo como con tarjeta. No requiere cambios en Oracle.

## Activar

1. Registrar la tienda en https://www.google.com/recaptcha/admin/create y seleccionar **v2 → casilla «No soy un robot»**. Estas claves deben ser compatibles con `api.js` y `siteverify`; no usar una clave v3 ni una integración exclusiva de Enterprise.
2. Registrar `localhost` para desarrollo y el dominio real para producción en la consola de Google.
3. Completar la sección siguiente en el `Backend/FamKon_store_api/appsettings.json` local, que está ignorado por Git:

```json
"Recaptcha": {
  "SiteKey": "CLAVE_PUBLICA_DEL_SITIO",
  "SecretKey": "CLAVE_SECRETA",
  "AllowedHostnames": ["localhost", "127.0.0.1", "tienda.ejemplo.com"]
}
```

Usar los hostnames exactos donde se abre el frontend, sin protocolo, ruta ni puerto. Incluir `www` si corresponde; eliminar los dominios de ejemplo. En producción mantener solo los dominios utilizados. La consola de Google también debe permitir esos dominios.

Alternativamente configurar variables del backend `Recaptcha__SiteKey`, `Recaptcha__SecretKey`, `Recaptcha__AllowedHostnames__0`, etc. No colocar la clave secreta en variables VITE, archivos públicos, capturas ni commits.

4. Reiniciar la API y abrir nuevamente el checkout. La API entrega únicamente `recaptchaSiteKey` en la configuración de compra. No es necesario duplicar la clave en el frontend ni recompilarlo al cambiar claves.

Sin claves o sin hostnames permitidos, la verificación no se habilita y **el checkout no permite crear pedidos**. No hay bypass ni claves de prueba activadas automáticamente. Las claves universales de prueba publicadas por Google se rechazan fuera de Development.

## Comportamiento

- El navegador carga el widget en español solo al entrar al checkout, en tamaño compacto para pantallas pequeñas.
- El botón de confirmar permanece deshabilitado hasta resolverlo.
- Se envía `recaptchaToken` junto con el pedido; el backend consulta por HTTPS a Google antes de ejecutar `CompraService.Crear`.
- Comprueba `success` y hostname exacto. Google controla la caducidad y el uso único del token. `challenge_ts` indica cuándo se cargó el desafío; no se usa como fecha de emisión del token para evitar rechazos de usuarios que tardan en completar el formulario.
- Ante vencimiento, error de red o rechazo, no se crea el pedido. El usuario puede reintentar la verificación.
- Tras cada intento de compra se limpia el token y se reinicia el widget, porque el token anterior pudo consumirse incluso cuando la compra falló después.
- Los tokens y el secreto no se registran en logs ni se guardan en la base de datos.
- El endpoint antiguo de creación de pedidos sigue marcado `NonAction`, por lo que no sirve como ruta alternativa.

## Pruebas

```sh
cd Fronted
bun run build
bun test
cd ..
dotnet run --project tests/RecaptchaChecks -p:UseSharedCompilation=false
```

Las pruebas usan un proveedor HTTP simulado; cubren tokens ausentes, rechazados, vencidos, hostnames incorrectos, respuestas incompletas, errores del proveedor, timeout y configuración ausente. También comprueban que el controlador rechaza el pedido antes de acceder a Oracle y que el cliente envía el token.

Prueba manual pendiente con las claves reales: abrir checkout, resolver el widget, comprar en efectivo/tarjeta con una cuenta de prueba y verificar que hay que repetir el desafío si vence o el pedido falla. Para pruebas de pago usar el entorno de pruebas de Recurrente.

Fuentes oficiales:
- Widget y callbacks: https://developers.google.com/recaptcha/docs/display
- Validación en backend, caducidad y uso único: https://developers.google.com/recaptcha/docs/verify
- Claves de prueba: https://developers.google.com/recaptcha/docs/faq

Los rechazos de Google se registran como `reCAPTCHA rechazado por Google. Códigos: ...`, sin claves ni tokens. `invalid-input-secret`/`missing-input-secret` producen HTTP 503 por configuración; `timeout-or-duplicate` produce HTTP 400 y pide repetir el desafío. Si persiste `invalid-input-response`, comprobar que SiteKey y SecretKey se copiaron de la misma configuración de Google y sin errores de transcripción.
