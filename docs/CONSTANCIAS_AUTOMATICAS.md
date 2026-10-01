# Constancias automáticas de compra

## Comportamiento

La API encola en la misma transacción del pedido COD o de la confirmación de tarjeta. Copia correo/teléfono y preferencias de USUARIO en COMPRA_CONSTANCIA. La clave primaria (pedido, canal) impide repetir envíos al consultar o recibir varias veces la confirmación de pago. No se envían compras históricas automáticamente.

Un trabajador cada 30 segundos genera el PDF desde los datos del servidor. Correo recibe un adjunto; WhatsApp utiliza `/send/pdf` de WAWP con un enlace aleatorio de 256 bits válido durante dos días. El enlace permite obtener únicamente ese PDF, no iniciar sesión ni modificar pedidos. No registrar esos enlaces en logs del proxy. El QR del PDF apunta al tracking autenticado del comprador.

En registro y Mi perfil se elige correo, WhatsApp o ambos. Las preferencias se aplican a compras posteriores; no alteran destinos de mensajes ya encolados. Esta implementación no modifica el flujo de recuperación de contraseña.

Estados: PENDIENTE, ENVIANDO, ENVIADO, ERROR, CANCELADO. ENVIADO significa aceptación por SMTP/WAWP, no lectura ni confirmación de recepción. No hay garantía de entrega exactamente una vez: ante una respuesta ambigua del proveedor puede haber duplicados si se reintenta. ERROR admite reintento del comprador después de diez minutos desde el intento. ENVIANDO tras un cierre inesperado requiere revisión administrativa del proveedor antes de reponerlo a PENDIENTE; no se reenvía automáticamente un resultado incierto.

El pedido muestra los estados por canal y ofrece reintentar errores. Una falla de envío posterior a la compra no revierte el pedido ni el pago.

## Instalación

1. Aplicar `BD/01 scrip/pkg/11_CONSTANCIAS.sql` antes de arrancar la versión nueva (aplicado en la base configurada durante esta implementación).
2. Configurar `Constancias:FrontendUrl` y `Constancias:PublicApiUrl` con URL HTTPS pública sin `/api` al final. Localmente ambas quedaron como `https://famkon.site`, confirmado por el usuario. El proxy debe publicar `/api/famkon/constancias/documento/{token}` hacia esta API.
3. Conservar configuración SMTP y WAWP existente; reiniciar backend y publicar ambas aplicaciones para que los enlaces externos funcionen.
4. Crear una nueva compra de prueba en una cuenta propia con la preferencia deseada. Verificar PDF adjunto, QR, login y estado del envío.

No se enviaron mensajes reales durante las comprobaciones. Se probaron generación de PDF COD y tarjeta de múltiples páginas, compilación y encolado Oracle repetido dentro de una transacción revertida.

QuestPDF utiliza licencia Community para este proyecto académico; revisar elegibilidad si se transforma en producto comercial. QRCoder genera el QR en el servidor. La descarga anterior del navegador permanece disponible.

Fuente del contrato WAWP: https://api.wawp.net/en/docs/v2/send/pdf
