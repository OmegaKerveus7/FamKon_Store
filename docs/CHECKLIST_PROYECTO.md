# Checklist de cumplimiento — FamKon

Revisión: 29 de septiembre de 2026. Fuente: «PROYECTO FINAL DESARROLLO WEB 2027.docx», contrastada con el código local. Este archivo organiza trabajo; no acredita pruebas en producción. Una casilla pendiente puede significar implementación parcial o verificación pendiente, según se indica. Marcar únicamente después de cumplir el criterio de cierre.

## Base existente

Hay implementación de registro, login por contraseña, JWT, permisos, biometría, lector QR de login, catálogo, carrito, pedidos, tracking, histórico, acciones de entrega, recuperación/cambio de contraseña y pago mediante Recurrente. No se deben rehacer estos módulos: completar y probar sus flujos. Hay pruebas en Fronted/tests y tests, scripts Oracle y documentación en docs.

## Orden de ejecución

### 1. Cerrar bloqueos y seguridad de compra — parcial

- [ ] Resolver el rechazo de reCAPTCHA con las claves reales emparejadas, en localhost y famkon.site. Cierre: token válido permite crear pedido; token ausente, inválido o reutilizado lo bloquea. Evidencia: RecaptchaService.cs, Recaptcha.tsx, CheckoutPage.tsx. El último intento del usuario sigue fallando.
- [ ] Probar tarjeta de extremo a extremo: crear checkout, abrir formulario, pago TEST, confirmación verificable y tracking; cubrir rechazo, cancelación y reintento sin duplicar cobros. La nueva clave Recurrente respondió HTTP 200 en diagnóstico, lo cual no prueba un pago. Tarjeta otorga puntos extra según el documento.
- [ ] Retirar o restringir de manera efectiva POST /api/famkon/test-token. AuthController.cs permite emitir un JWT con identidad y roles proporcionados por el solicitante y no muestra autorización en ese método. Verificar que no esté expuesto en producción.
- [ ] Pasar la verificación OTP del registro al backend: generación segura, caducidad, intentos y comprobante de un solo uso obligatorio para registrar. Actualmente RegistroPage.tsx genera y valida el código en el navegador.

### 2. Preferencias de notificación — parcial

- [ ] Permitir correo, WhatsApp o ambos como preferencia persistente, separada del canal usado para verificar el registro. RegistroPage.tsx ofrece correo o WhatsApp; RegistroController.cs guarda siempre email=S y WhatsApp=N.
- [ ] Permitir consultar y cambiar la preferencia en el perfil.
- [ ] Respetar la preferencia al recuperar contraseña y enviar constancias. PasswordRecoveryService.cs permite seleccionar un canal, pero no aplica la preferencia guardada ni la opción ambos.
- [ ] Probar recepción real por cada canal, fallos de envío y reintentos sin duplicar registros.

### 3. Fotografía personalizada y credencial — faltante/parcial

- [ ] Integrar filtros y stickers para la foto de registro y perfil.
- [ ] Conservar original biométrico y versión editada por separado; mostrar la editada en la barra de estado. RegistroPage.tsx actualmente envía la misma imagen en fotoOriginalBase64 y fotoEditadaBase64.
- [ ] Generar credencial PDF con diseño propio, fotografía modificada y QR; enviarla automáticamente según preferencia. No se encontró generador/envío de este PDF.
- [ ] Validar login con el QR de la credencial realmente emitida y probar login facial con los originales almacenados. Existen pantallas y servicios; falta acreditar el circuito completo.
- [ ] Probar cambio de foto y de contraseña desde perfil, recuperación desde login y rol COMPRADOR automático.
- [ ] Validar registro unificado con otro sitio del proyecto: una base compartida por sí sola no demuestra interoperabilidad de credenciales y biometría.

### 4. Personalización del producto — faltante

- [ ] Editor de lado A y lado B con fotografía y/o texto, filtros, stickers y vista previa.
- [ ] Guardar cada diseño ligado al detalle del carrito y del pedido; conservar diseños distintos del mismo producto y mostrarlos a elaboración/logística.
- [ ] Mostrar imágenes reales de producto. ProductoDetallePage.tsx usa un icono y solo informa si permite personalización; al carrito envía producto y cantidad.
- [ ] Probar que cambiar cantidades, eliminar y volver a abrir el carrito conserva correctamente los diseños.

### 5. Entrega en el colegio y constancia de compra — parcial/faltante

- [ ] Adaptar selección de entrega a áreas físicas del colegio (cancha, salón, etc.). El checkout actual pide departamento, municipio y dirección; no acredita el catálogo de puntos requerido.
- [ ] Generar y enviar PDF de compra con detalle y QR para entrega por el medio seleccionado. No se encontró este flujo completo.
- [ ] Integrar lector QR de compra en el flujo vigente del repartidor, además de búsqueda por teclado. El lector de CarnetLoginPage no cubre la entrega de pedidos.
- [ ] Al escanear, verificar pedido, permisos, estado y pago; registrar entrega una sola vez. El QR de entrega debe ser distinto del QR de acceso a la cuenta.
- [ ] Probar foto de evidencia, cobro en efectivo y «Comprador no encontrado». CompraAcciones.tsx ya implementa estas acciones: verificar su persistencia y permisos de extremo a extremo.
- [ ] Revisar obligatoriedad de fotografía también para recogida: actualmente es opcional en esa modalidad, mientras el documento solicita evidencia de entrega.

### 6. Elaboración, tracking e histórico — parcial, requiere prueba

- [ ] Demostrar que la orden llega al módulo de logística con su personalización y permite marcar elaboración y «Listo para entrega».
- [ ] Alinear la etapa «Listo para entrega» solicitada con la visualización actual, manteniendo registro de la entrega final.
- [ ] Validar actualización del tracking sin recarga manual. PedidosPage.tsx consulta cada 20 segundos; medir si satisface la demostración de tiempo real o reducir latencia.
- [ ] Probar histórico y aislamiento: un comprador no puede consultar pedidos ni archivos de otro.

### 7. Dashboard de ventas — faltante

- [ ] Crear consultas y endpoints de ventas con filtros día, semana, total, rango de fechas, estado y tipo de producto.
- [ ] Implementar indicadores y gráficos con datos reales, distinguiendo compras pendientes, ventas pagadas y cancelaciones.
- [ ] Actualizar automáticamente y preparar vista para pantalla de la presentación.
- [ ] Restringir acceso a supervisor y administrador. SupervisorPage.tsx actualmente muestra accesos; no un tablero de métricas.

### 8. Despliegue y comprobaciones no funcionales — verificar/completar

- [ ] Dockerfiles y configuración de ejecución reproducible para frontend/backend. No se encontraron archivos Docker/Compose en la revisión.
- [ ] Verificar despliegue público completo en famkon.site, certificado SSL, API y comunicación HTTPS entre servicios. El usuario informó que el sitio está publicado; esta revisión no certifica el despliegue.
- [ ] Auditar autorización por endpoint, validación, consultas parametrizadas, tratamiento de archivos, errores sin datos sensibles y exclusión de secretos del repositorio e historial.
- [ ] Revisar almacenamiento de contraseñas SHA-256 y plan de fortalecimiento compatible con la base compartida; no cambiar el formato sin coordinar interoperabilidad.
- [ ] Verificar bitácora auditable de login: quién, fecha/hora, IP, método y resultado.
- [ ] Comprobar repositorio privado, acceso del docente y commits por integrante; no se verificó configuración remota.
- [ ] Probar Chrome, Firefox y Edge; escritorio, tablet y móviles Android/iOS; idioma español, legibilidad, navegación y regla visual 60-30-10.
- [ ] Medir y guardar evidencia: registro y personalización <30 s, login <15 s, recuperación ≤30 s, selección/personalización/checkout ≤30 s en caso ideal y elaboración ≤60 s. La entrega externa de OTP requiere medición real.

### 9. Evidencias y entrega académica — no localizadas completas

- [ ] Completar pruebas unitarias, caja blanca y caja negra; conservar casos, resultados y capturas. Hay pruebas automatizadas existentes, no un expediente completo revisado.
- [ ] Diagramas: entidad-relación, arquitectura con servidores/IP/puertos, clases, flujos y casos de uso UML; flujo Bizagi solicitado en primera revisión.
- [ ] Guías reproducibles desde clonar hasta compilar/publicar frontend y backend; versiones, notas y scripts SQL ordenados.
- [ ] Guía de API y colección Postman con GET, POST, PUT y DELETE, sin secretos reales.
- [ ] Manual del comprador, archivo de análisis, metodología y costos de fabricación e implementación.
- [ ] Presentación ejecutiva en inglés con funcionalidades y enlace al video.
- [ ] Video técnico en inglés de máximo 5 minutos con participación de cada integrante y demostración funcional preparada.

## Aclaraciones del documento

- Hay contradicción de integrantes: indica mínimo 5/máximo 8 y después máximo 4. Confirmar con el docente.
- Enumera Nuxt/Vue/Vuetify, pero permite tecnologías equivalentes. React no debe marcarse automáticamente como incumplimiento; confirmar aceptación académica.
- reCAPTCHA está exigido expresamente en checkout. Incorporarlo al registro sería una decisión adicional.
- Este checklist no autoriza cambios de proveedores, pagos reales, invitaciones al repositorio ni publicación; organiza los requisitos y la evidencia pendiente.

## Evidencia para cerrar cada tarea

Registrar fecha, archivos/commit, escenario probado, resultado y evidencia. Primero corregir el checkout actual; después continuar en el orden anterior, manteniendo las tareas de seguridad como prioridad.
