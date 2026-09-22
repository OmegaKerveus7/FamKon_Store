# Compra y tracking de FamKon

## Flujo implementado

- Comprador: carrito → checkout → recogida (Q0) o domicilio (Q25) → efectivo o Recurrente → seguimiento real.
- Administración/supervisión: revisión, notas de llamada internas, corrección de contacto auditada, preparación, listo, asignación, cancelación y recogida.
- Mensajero: solo sus asignaciones; salida en ruta, entrega con foto, receptor y efectivo exacto, o intento fallido con motivo. Cada reprogramación crea otro intento.
- Tienda: Campus central; lunes a domingo, 08:00–17:00.
- Los pagos permanecen separados del estado logístico. Tarjeta requiere APROBADO para preparar. Cancelar una compra pagada deja REEMBOLSO_PENDIENTE, sin fingir una devolución.
- El comprobante es un HTML descargable e imprimible con datos de recepción; no es factura fiscal.

## Instalación Oracle

Ejecutar como TIENDA_APP (no SYSTEM), primero `BD/01 scrip/pkg/07_COMPRA_TRACKING_ESTRUCTURA.sql`, luego `08_COMPRA_TRACKING_PACKAGE.sql`.
Ambos delimitan cada unidad con `/`. La estructura verifica columnas/tablas existentes y agrega catálogos por código. No elimina datos ni reemplaza paquetes previos. Antes de instalar en otro entorno, respaldar su esquema y revisar los códigos de catálogo.

`PKG_COMPRA` coordina los SP existentes de PKG_PEDIDO y PKG_PAGO_ENTREGA, agregando propiedad del carrito, permisos vigentes de roles, estados válidos y atomicidad. No hace COMMIT interno; el servicio C# controla la transacción. Las API antiguas de creación de pedidos y mutaciones de repartidor se retiran para evitar saltarse las reglas nuevas.

Los campos nuevos en pedidos históricos permanecen nulos; no se inventan direcciones ni se altera su estado. Los nuevos pedidos usan siempre la modalidad. Revisar y completar pedidos antiguos antes de operarlos con este flujo.

Desde la raíz:

```sh
dotnet run --project tools/OracleRunner -- apply 'BD/01 scrip/pkg/07_COMPRA_TRACKING_ESTRUCTURA.sql'
dotnet run --project tools/OracleRunner -- apply 'BD/01 scrip/pkg/08_COMPRA_TRACKING_PACKAGE.sql'
```

Los scripts Oracle 07/08 se mantienen como fuente de esta extensión. No ejecutar el antiguo script completo 04 sobre una base operativa para instalar este flujo.

## Configuración de pagos

Variables/configuración del backend (claves solo en archivo local ignorado o secretos del servidor):

- `Recurrente:Environment`: Sandbox/TEST o LIVE.
- `Recurrente:SecretKey`: clave correspondiente al entorno.
- `Recurrente:FrontendUrl`: origen del frontend; HTTPS obligatorio en producción.
- `Recurrente:WebhookSecret`: secreto de firma del endpoint Svix.
- `Tienda:Direccion`: dirección visible de recogida; valor inicial Campus central.

El cliente no puede seleccionar el entorno de pago. Una clave LIVE solo funciona con ASPNETCORE_ENVIRONMENT=Production; la API de datos debe apuntar al esquema Oracle de ese entorno. No compartir pedidos de producción con la base de pruebas.

Registrar en Recurrente un endpoint HTTPS público para:
`POST /api/famkon/compras/recurrente/webhook`.
La firma Svix se verifica sobre bytes originales, con comparación constante y ventana de cinco minutos. Eventos repetidos se deduplican por proveedor/entorno/id. Monto y moneda se cotejan con el pedido. La vuelta del checkout consulta Recurrente en el backend: la URL de éxito no acredita pagos.

Solo se procesan eventos unificados de tarjeta `intent.succeeded` y `intent.failed`. El botón Verificar pago consulta el checkout directamente, útil durante pruebas locales sin URL de webhook pública. La creación conserva y reutiliza la sesión de pago del pedido. No se guardan números de tarjeta ni CVV.

La devolución se gestiona en Recurrente; no se ejecutan reembolsos financieros automáticamente desde Cancelar. El seguimiento debe registrar la confirmación de devolución mediante un evento/conciliación verificado antes de marcar REEMBOLSADO.

Referencias:
- https://docs.recurrente.com/guias-espanol/comenzar/introduccion
- https://docs.recurrente.com/guias-espanol/comenzar/webhooks

## Rutas

- `/comprador/checkout`: confirmar compra.
- `/comprador/tracking`: compras e historial, detalle por `?pedido=ID`.
- `/admin/pedidos`: administración y supervisión.
- `/repartidor/asignados`: mensajero.
- API nueva: `/api/famkon/compras`.

La pantalla actualiza cada 20 segundos mientras es visible. Consultas paginadas de 20 filas. Los botones solo ofrecen las acciones pertinentes; Oracle valida de nuevo permisos y estado bajo bloqueo de fila.

## Verificación

```sh
cd Fronted
bun run build
bun test
cd ..
dotnet build Backend/FamKon_store_api
dotnet run --project tests/CompraChecks
dotnet run --project tools/OracleRunner -- apply tests/sql/compra_tracking.sql
```

La prueba SQL crea sus propios registros, comprueba compra en tienda/domicilio, pago, permisos, reintentos, duplicados y auditoría, y hace ROLLBACK aun si falla. No envía mensajes ni cobra dinero. Las identidades/secuencias pueden avanzar aunque se reviertan los registros.

## Duración de sesión

JWT: `Jwt:ExpirationMinutes = 120` (2 horas). El temporizador del frontend también usa 2 horas, con aviso un minuto antes; la renovación para usuarios activos conserva su intervalo de 8 minutos. Reiniciar la API y volver a iniciar sesión para emitir un token con la nueva duración. Los tokens existentes conservan su expiración original.
