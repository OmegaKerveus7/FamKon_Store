# AGENTS.md — Tienda Online FamKon

## Estructura del Proyecto

Monorepo con 3 componentes principales:

```
Tienda_Online_FamKon/
├── Backend/                    # ASP.NET Core 8 API (C#)
│   └── FamKon_store_api/
│       ├── BD/DBContext.cs     # Singleton Oracle connection
│       ├── Controllers/        # API endpoints (Auth, Tienda, Repartidor, Admin, etc.)
│       ├── Models/             # Entidades y DTOs
│       ├── Services/           # LoginService, JwtService, BiometricService, RepartidorService, etc.
│       ├── Modules/Biometria/  # Lógica de reconocimiento facial
│       ├── Program.cs          # Entry point
│       └── appsettings.json    # Config (NO commitear - tiene secretos)
├── Fronted/                    # React 19 + TypeScript + Vite (Bun)
│   └── src/
│       ├── api/famkon.ts       # API client con JWT + interfaces de tienda
│       ├── context/AuthContext  # Auth state + token storage + auto-refresh
│       ├── modules/            # Modulos especializados
│       │   └── biometria/     # AccesoFacialPage, EnrolamientoFacial, api
│       ├── pages/              # Componentes de página (30+ páginas)
│       └── components/         # Componentes reutilizables (20+ componentes)
└── BD/                         # Scripts SQL Oracle
    └── 01 scrip/pkg/           # Paquetes PL/SQL (04_PACKAGES_TIENDA_ORACLE.sql)
```

## Comandos de Desarrollo

### Frontend
```bash
cd Fronted
bun install        # Instalar dependencias
bun run dev        # Dev server en http://localhost:5173 (proxy /api → localhost:5299)
bun run build      # Build de producción
```

### Backend
```bash
cd Backend/FamKon_store_api
dotnet restore     # Restaurar paquetes NuGet
dotnet build       # Compilar
dotnet run         # API en http://localhost:5299
```

## Arquitectura Backend

### Patrón de Conexión a BD (Singleton)
La conexión a Oracle usa un patrón Singleton:
```csharp
// BD/DBContext.cs - Singleton
builder.Services.AddSingleton<BD.DBContext>();
// Crear conexión: _dbContext.CreateConnection()
```

**NO usar EF Core para queries** - solo se usa `Oracle.ManagedDataAccess` con ADO.NET raw.

### Autenticación JWT
- Login retorna `{ token, usuario }` (no el objeto Usuario crudo)
- Token expira en **10 minutos**
- Key JWT en `appsettings.json` → `Jwt:SecretKey`
- Frontend almacena token en `localStorage` key `famkon.token`
- Frontend auto-renueva token cada 8 minutos via AuthContext (solo si el usuario esta activo)
- Requests incluyen header `Authorization: Bearer <token>`
- 401 → limpiar storage → redirect `/login`

### Politica de inactividad de sesion
- **10 minutos de inactividad** → `cerrarSesion()` automatico (limpia storage y redirige a `/login`).
- **Aviso a los 9 minutos** → aparece el modal `SessionWarning` con countdown de 60s y dos botones:
  - **Continuar sesion** → llama a `/api/famkon/refresh-token`, reinicia el contador y cierra el modal.
  - **Cerrar sesion** → logout manual inmediato.
- La actividad se rastrea en `DashboardLayout` con listeners de `mousedown / keydown / scroll / touchstart / click / mousemove`. Cada evento actualiza `actividadRef` en `AuthContext`.
- Mientras el usuario esta activo, el JWT se refresca automaticamente cada 8 minutos (siempre que la ultima actividad sea de hace menos de 1 minuto, para no gastar tokens en sesiones abandonadas).
- Constantes en `Fronted/src/context/AuthContext.tsx`:
  - `TIMEOUT_INACTIVIDAD_MS = 10 * 60 * 1000`
  - `AVISO_INACTIVIDAD_MS = 60 * 1000`

### PKG_LOGIN (Oracle Package)
Todos los logins se ejecutan vía `PKG_LOGIN.CRUD`:
- `p_opcion = 'C'` → Credenciales (correo/nickname + password) ✅ FUNCIONAL
- `p_opcion = 'N'` → Nickname + password (estructura)
- `p_opcion = 'Q'` → Token QR (estructura, no funcional aún)
- `p_opcion = 'F'` → Facial (estructura, servicio externo inactivo)

El package retorna JSON con: `id_usuario`, `nickname`, `correo`, `telefono`, `fecha_nacimiento`, `activo`, `bloqueado`, `roles`

### PKG_SEGURIDAD — procedimientos usados desde el backend
- `SP_OBTENER_AUTENTICACION(p_identificador, o_datos)` → `LoginService.ObtenerAutenticacionAsync`:
  obtiene `ID_USUARIO, ID_SITIO, CORREO, NICKNAME, PASSWORD_HASH, TOKEN_QR_HASH, ACTIVO,
  BLOQUEADO, INTENTOS_FALLIDOS, ULTIMO_ACCESO`. Lo usa `AuthController.LoginBasico`
  para resolver el hash y validar la contraseña localmente con SHA-256
  (formato `LOWER(STANDARD_HASH(P_PASSWORD,'SHA256'))`, mismo que `SP_CREAR_USUARIO`).
- `SP_REGISTRAR_ACCESO(...)` → `BitacoraService.RegistrarAccesoAsync`: lo invoca
  `AuthController` después de cada intento de login (éxito o fallo) grabando
  en `BITACORA_ACCESO` el método (`CONTRASENA | QR | FACIAL`), resultado (`S | N`),
  IP y User-Agent capturados.
- `SP_LISTAR_PERMISOS(p_id_usuario, o_datos)` → `PermisoService.ListarPermisosAsync`:
  expone los permisos del usuario en `GET /api/famkon/permisos` (autorizado con JWT).
  El frontend lo consume al iniciar sesión para enrutar las vistas según el rol.

### Paquetes Oracle para la Tienda
La base de datos Oracle ya tiene paquetes PL/SQL configurados para la tienda:
- **PKG_LOGIN**: Manejo de autenticación y sesiones
- **PKG_SEGURIDAD**: Crear usuario (SP_CREAR_USUARIO) + actualizar (SP_ACTUALIZAR_USUARIO) + cambiar estado (SP_ACTIVAR_USUARIO / SP_DESACTIVAR_USUARIO / SP_BLOQUEAR_USUARIO / SP_DESBLOQUEAR_USUARIO) + auditoría (SP_REGISTRAR_ACCESO) + permisos (SP_LISTAR_PERMISOS) + gestor (SP_LISTAR_USUARIOS_GESTOR / SP_OBTENER_USUARIO_GESTOR)
- **PKG_USUARIO**: CRUD de usuarios (leer, actualizar, password, imágenes, roles) + `SP_LISTAR_USUARIOS` + `SP_LISTAR_ROLES`
- **PKG_CATALOGO**: Productos, categorías, áreas de entrega, métodos de pago
- **PKG_CARRITO**: Carrito de compras, personalización, detalles
- **PKG_PEDIDO**: Crear pedidos desde carrito, cambio de estado, tracking
- **PKG_PAGO_ENTREGA**: Pagos y entregas
- **PKG_ARCHIVO**: Gestión de archivos (imágenes)

## Base de Datos Oracle

- **Host**: www.server.daossystem.pro
- **Port**: 5626
- **Service**: XEPDB1
- **User**: TIENDA_APP (NO usar system)
- **Tablas principales**: USUARIO, ROL, USUARIO_ROL, PERMISO, ROL_PERMISO, BITACORA_ACCESO, ARCHIVO, SITIO, TOKEN_RECUPERACION, PRODUCTO, CATEGORIA_PRODUCTO, CARRITO, CARRITO_DETALLE, PEDIDO, PEDIDO_DETALLE, PAGO, ENTREGA

## Seguridad

- `appsettings.json` está en `.gitignore` (NUNCA commitear credenciales)
- `appsettings.Development.json` también excluido
- `.env` excluido por prevención
- Passwords hasheados con SHA-256 en la BD (via PKG_SEGURIDAD o PKG_LOGIN)
- JWT tokens de 10 minutos con auto-refresh cada 8 minutos
- Auditoría en BITACORA_ACCESO via PKG_SEGURIDAD
- reCAPTCHA v2 de Google integrado para protección contra bots

## Frontend

- **Runtime**: Bun (NO Node.js)
- **Framework**: React 19 + TypeScript + Vite
- **Routing**: react-router-dom v7
- **UI**: Tailwind CSS 4
- **API Base URL**: `/api/famkon` (proxy configurado en vite.config.ts)

### Dashboard Layout (post-login)

Todas las rutas autenticadas se montan dentro de `<DashboardLayout>` (en `App.tsx`):

- **Sidebar** (`components/Sidebar.tsx`) → menu lateral colapsable con grupos por rol/permiso (Compras, Entregas, Tracking, Supervision, Administracion, Cuenta). Cada item se muestra solo si el usuario tiene el `codigoPermiso` o `codigoRol` correspondiente (definido en `components/dashboardMenu.ts`).
- **Topbar** (`components/Topbar.tsx`) → breadcrumb + boton hamburguesa + avatar con iniciales del nickname, badge con el rol principal y boton de notificaciones.
- **DashboardLayout** (`components/DashboardLayout.tsx`) → arma el shell (`flex h-screen`) + `<Outlet />` para que cada ruta protegida renderice solo su contenido (no su propio header).
- **DashboardPage** (`pages/DashboardPage.tsx`) → welcome del usuario con tarjetas agrupadas por modulo y permisos; los grupos solo aparecen si el usuario tiene los permisos para verlos.

Cualquier nueva pagina del dashboard debe ir dentro de `<DashboardLayout>` en `App.tsx` y NO debe incluir su propio `<header>` (el sidebar + topbar ya proveen la navegacion).

### Verificación de Registro (2 pasos)
- **Frontend genera** código OTP de 6 dígitos localmente (sin BD)
- **Backend lo envía** por Email (Gmail SMTP), WhatsApp (WAWP) o ambos
- **Usuario ingresa** el código recibido → validación **local** en el frontend
- Si el código coincide → recién entonces se llama a `/api/famkon/registro`
- Endpoint: `POST /api/famkon/verificacion/enviar-codigo` (`VerificacionController.cs`)
- Expiración del código: **5 minutos** (validado por timestamp en frontend)

### Auth Flow
1. Login → POST `/api/famkon/login_basic` → `{ token, usuario }`
2. Guardar token y usuario en `localStorage` (keys: `famkon.token`, `famkon.usuario`)
3. AuthContext auto-renueva token cada 8 minutos
4. Requests incluyen `Authorization: Bearer <token>`
5. 401 → limpiar storage → redirect `/login`

### Rutas del Frontend
| Ruta | Página | Auth | Descripción |
|------|--------|------|-------------|
| `/` | IndexPage | No | Health check → redirect a /login |
| `/login` | LoginPage | No | Login principal |
| `/registro` | RegistroPage | No | Registro de comprador |
| `/recuperar-contrasena` | RecuperarPasswordPage | No | Recuperación de contraseña |
| `/login/facial` | FacialLoginPage | No | Login facial (reconocimiento biométrico) |
| `/login/carnet` | CarnetLoginPage | No | Login por QR/carnet |
| `/inicio` | DashboardPage | **Sí** | Dashboard principal |
| `/perfil` | PerfilPage | **Sí** | Mi perfil + enrolamiento facial |
| `/comprador/catalogo` | CatalogoPage | **Sí** | Catálogo de productos |
| `/comprador/producto/:id` | ProductoDetallePage | **Sí** | Detalle de producto |
| `/comprador/carrito` | CarritoPage | **Sí** | Carrito de compras |
| `/comprador/tracking` | TrackingPage | **Sí** | Mis pedidos |
| `/comprador/historico` | TrackingPage | **Sí** | Histórico de pedidos |
| `/comprador/pago/:id` | PagoPage | **Sí** | Formulario de pago |
| `/comprador/checkout` | CheckoutPage | **Sí** | Confirmar pedido |
| `/repartidor/asignados` | PedidosPage (vista=repartidor) | **Sí** | Pedidos asignados al repartidor |
| `/entregas/tracking` | EntregasAdminPage | **Sí** | Tracking general (SUPERVISOR) |
| `/supervisor` | SupervisorPage | **Sí** | Dashboard supervisor |
| `/admin` | AdminPage | **Sí** | Dashboard administrador |
| `/admin/pedidos` | PedidosPage (vista=admin) | **Sí** | Gestión de pedidos |
| `/admin/usuarios` | UsuariosAdminPage | **Sí** | Gestor de usuarios |
| `/admin/productos` | AdminProductosPage | **Sí** | Gestor de productos |
| `/admin/catalogos` | AdminCatalogosPage | **Sí** | Gestión de catálogos |
| `/admin/roles` | AdminRolesPage | **Sí** | Roles y permisos |
| `/admin/bitacora` | AdminBitacoraPage | **Sí** | Bitácora de accesos |
| `/admin/configuracion` | AdminConfiguracionPage | **Sí** | Configuración del sistema |

### Estado del Carrito
- Conectado a `PKG_CARRITO` via `CarritoService.cs` + `TiendaController.cs`
- Frontend usa `obtenerCarrito()`, `agregarAlCarritoAPI()`, `actualizarCantidadCarritoAPI()`, `eliminarDelCarritoAPI()`
- Compatibilidad con localStorage: `obtenerCarritoLocal()`, `guardarCarritoLocal()`, `vaciarCarrito()`

## Módulos Implementados

### Módulo de Reconocimiento Facial (Biometría)
- **Backend**: `BiometricService` + `RegistroRostroService` + `RegistroRostroController`
- **Frontend**: `modules/biometria/AccesoFacialPage` + `EnrolamientoFacial`
- **Servicios externos**:
  - Segmentación: `https://biosys.daossystem.pro/Rostro/Segmentar`
  - Verificación: `https://biosys.daossystem.pro/Rostro/Verificar`
- El servicio de segmentación recibe el rostro A (base64) y devuelve la imagen ya segmentada.
- El servicio de verificación compara la imagen segmentada almacenada en la BD con la nueva imagen segmentada del escaneo.
- Flujo de registro facial: captura foto → segmenta → guarda token de solicitud → verificación en backend.

### Módulo de Repartidor (Entregas)
- **Backend**: `RepartidorController` + `RepartidorService`
- **Endpoints**:
  - `GET /api/famkon/repartidor/entregas` → Entregas asignadas
  - `GET /api/famkon/repartidor/pedidos-disponibles` → Pedidos para asignar
  - `POST /api/famkon/repartidor/asignar` → Asignar entrega
  - `POST /api/famkon/repartidor/cambiar-estado` → Cambiar estado pedido
  - `POST /api/famkon/repartidor/resultado` → Resultado entrega
  - `POST /api/famkon/repartidor/evidencia` → Subir evidencia (foto)
  - `GET /api/famkon/archivos/{id}` → Descargar archivo/evidencia

### Módulo de Compras/Pedidos
- **Backend**: `ComprasController` + `CompraService`
- **Frontend**: `PagoPage`, `CheckoutPage`, `TrackingPage`
- Estados de pedido: PENDIENTE → PAGO_CONFIRMADO → LISTO_ENTREGA → ENVIADO → ENTREGADO
- Soporte para pago en efectivo (monto recibido del repartidor)

### Módulo de Credenciales
- **Backend**: `CredencialController` + `CredencialService` + `CredencialPdf`
- **Frontend**: `MiCredencial`, `VistaPreviaCarnet`, `AvatarCredencial`, `EditorFotoCredencial`
- Generación de credencial PDF con QR y foto del usuario

### Módulo de Constancias
- **Backend**: `ConstanciasController` + `ConstanciaPdf` + `ConstanciaEnvio`
- **Frontend**: `EstadoConstancia`
- Generación de constancias de envío en PDF

### Módulo de Recuperación de Contraseña
- **Backend**: `PasswordController` + `PasswordRecoveryService` + `PasswordRecoveryStore`
- **Frontend**: `RecuperarPasswordPage`
- Flujo: solicita correo → genera token → envía link por email → redefine contraseña

### Módulo de Notificaciones
- **Backend**: `EmailService` (Gmail SMTP) + `WhatsAppService` (WAWP API)
- **Frontend**: `PreferenciasNotificacion` component
- Soporta notificación por email y/o WhatsApp

### Módulo de Archivos
- **Backend**: `ArchivoService`
- **Tabla**: `ARCHIVO` en Oracle
- Tipos: EVIDENCIA_ENTREGA, FOTO_USUARIO, CREDENCIAL_PDF, etc.

## Estado Actual del Proyecto

### Backend (FUNCIONAL ✅)
- **Login con JWT** funciona (correo/nickname + password)
- **Login facial** implementado via `RegistroRostroController` + `BiometricService`
- **Login QR/Carnet** estructurado via `CarnetLoginPage`
- **Registro de usuarios** funciona vía `PKG_SEGURIDAD.SP_CREAR_USUARIO`
- **Reconocimiento facial**: segmentación y verificación funcionando
- **AuthController** genera y valida tokens JWT correctamente
- Refresh token funciona en `/api/famkon/refresh-token`
- Endpoints protegidos retornan 401 cuando el token es inválido/expirado
- **TiendaController** con endpoints completos para catálogo, carrito, pedidos y tracking
- **RepartidorController** con gestión completa de entregas y evidencias
- **UsuariosAdminController** para gestión de usuarios (CRUD completo)
- **CatalogoService** conectado a `PKG_CATALOGO`
- **CarritoService** conectado a `PKG_CARRITO`
- **PedidoService** conectado a `PKG_PEDIDO`
- **RepartidorService** conectado a `PKG_PEDIDO` + `PKG_PAGO_ENTREGA`
- **UsuarioAdminService** conectado a `PKG_USUARIO` + `PKG_SEGURIDAD`
- **ArchivoService** conectado a `PKG_ARCHIVO` para subir/descargar archivos
- **CredencialPdf** + **ConstanciaPdf** para generación de documentos
- **reCAPTCHA v2** integrado para protección

### Frontend (FUNCIONAL ✅)
- ✅ Login con JWT integrado en AuthContext
- ✅ Auto-refresh de token cada 8 minutos
- ✅ Manejo de 401 → redirect a /login
- ✅ Dashboard del comprador (HomePage)
- ✅ Catálogo de productos con filtros y búsqueda
- ✅ Detalle de producto con agregar al carrito
- ✅ Carrito de compras
- ✅ Checkout y formulario de pago
- ✅ Tracking de envío con timeline
- ✅ Login facial con captura de cámara y segmentación
- ✅ Enrolamiento facial para registro
- ✅ Login por QR/carnet
- ✅ Recuperación de contraseña
- ✅ Perfil de usuario con enrolamiento facial
- ✅ Módulo repartidor (pedidos asignados, cambiar estado, resultado entrega)
- ✅ Tracking general para supervisores
- ✅ Dashboard admin con gestión de pedidos
- ✅ Gestor de usuarios admin
- ✅ Gestor de productos admin
- ✅ Gestión de catálogos admin
- ✅ Roles y permisos admin
- ✅ Bitácora de accesos admin
- ✅ Configuración del sistema admin
- ⏳ Métricas y estadísticas del dashboard (en desarrollo)

### Servicios Externos (Funcionales ✅)
- **Reconocimiento facial**: `https://biosys.daossystem.pro/Rostro/Segmentar` y `/Verificar`
- **WhatsApp**: WAWP API
- **Email**: Gmail SMTP
- **reCAPTCHA**: Google reCAPTCHA v2

## Archivos Importantes

### Backend Controllers (`Backend/FamKon_store_api/Controllers/`)
- `AuthController.cs` — Login básico, refresh token, logout
- `RegistroController.cs` — Registro de usuarios
- `VerificacionController.cs` — Envío de códigos OTP
- `RegistroRostroController.cs` — Segmentación y registro de rostro
- `PasswordController.cs` — Recuperación de contraseña
- `TiendaController.cs` — Catálogo, carrito, productos
- `RepartidorController.cs` — Gestión de entregas y evidencias
- `ComprasController.cs` — Pedidos y pagos
- `CredencialController.cs` — Generación de credenciales PDF
- `ConstanciasController.cs` — Generación de constancias PDF
- `EstadoController.cs` — Estados del sistema
- `UsuariosAdminController.cs` — Gestor de usuarios (`/api/famkon/admin/usuarios`)
- `TestController.cs` — Endpoints de prueba

### Backend Services (`Backend/FamKon_store_api/Services/`)
- `LoginService.cs` — Lógica de login vía PKG_LOGIN
- `JwtService.cs` — Generación y validación JWT
- `BitacoraService.cs` — Bitácora de accesos vía PKG_SEGURIDAD.SP_REGISTRAR_ACCESO
- `PermisoService.cs` — Permisos vía PKG_SEGURIDAD
- `UsuarioService.cs` — CRUD usuarios vía PKG_SEGURIDAD
- `UsuarioAdminService.cs` — Gestor de usuarios (PKG_USUARIO + PKG_SEGURIDAD)
- `BiometricService.cs` — Cliente para servicio de reconocimiento facial
- `RegistroRostroService.cs` — Guardado de rostro segmentado
- `RepartidorService.cs` — Gestión de entregas
- `CatalogoService.cs` — Productos, categorías, áreas de entrega, métodos de pago
- `CarritoService.cs` — Carrito de compras vía PKG_CARRITO
- `PedidoService.cs` — Pedidos y tracking vía PKG_PEDIDO
- `CompraService.cs` — Lógica de compra/pago
- `ArchivoService.cs` — Gestión de archivos/imágenes
- `CredencialService.cs` — Generación de credenciales
- `CredencialPdf.cs` — PDF de credencial
- `ConstanciaPdf.cs` — PDF de constancia
- `ConstanciaEnvio.cs` — Envío de constancias
- `EmailService.cs` — Envío de emails (Gmail SMTP)
- `WhatsAppService.cs` — Envío de mensajes WhatsApp (WAWP)
- `RecaptchaService.cs` — Verificación reCAPTCHA v2
- `PasswordRecoveryService.cs` — Recuperación de contraseña
- `PasswordRecoveryStore.cs` — Almacenamiento de tokens de recuperación
- `RecurrenteService.cs` — Servicios recurrentes

### Frontend Pages (`Fronted/src/pages/`)
- `IndexPage.tsx` — Health check
- `LoginPage.tsx` — Login principal
- `RegistroPage.tsx` — Registro de comprador
- `RecuperarPasswordPage.tsx` — Recuperación de contraseña
- `FacialLoginPage.tsx` — Login facial (redirige a modules/biometria)
- `CarnetLoginPage.tsx` — Login por QR/carnet
- `DashboardPage.tsx` — Dashboard principal
- `PerfilPage.tsx` — Mi perfil + enrolamiento facial
- `CatalogoPage.tsx` — Catálogo de productos
- `ProductoDetallePage.tsx` — Detalle de producto
- `CarritoPage.tsx` — Carrito de compras
- `TrackingPage.tsx` — Tracking de envío
- `PagoPage.tsx` — Formulario de pago
- `CheckoutPage.tsx` — Confirmar pedido
- `PedidosPage.tsx` — Pedidos (repartidor/admin)
- `EntregasAdminPage.tsx` — Tracking general
- `SupervisorPage.tsx` — Dashboard supervisor
- `AdminPage.tsx` — Dashboard admin
- `UsuariosAdminPage.tsx` — Gestor de usuarios
- `AdminProductosPage.tsx` — Gestor de productos
- `AdminCatalogosPage.tsx` — Gestión de catálogos
- `AdminRolesPage.tsx` — Roles y permisos
- `AdminBitacoraPage.tsx` — Bitácora de accesos
- `AdminConfiguracionPage.tsx` — Configuración del sistema
- `NotFoundPage.tsx` — Página 404

### Frontend Components (`Fronted/src/components/`)
- `Sidebar.tsx` — Menú lateral colapsable
- `Topbar.tsx` — Barra superior con breadcrumb
- `DashboardLayout.tsx` — Layout del dashboard
- `RequirePermiso.tsx` — HOC para protección por permisos
- `SessionWarning.tsx` — Modal de advertencia de inactividad
- `Recaptcha.tsx` — Componente reCAPTCHA v2
- `QrScanner.tsx` — Lector de código QR
- `CameraCapture.tsx` — Captura de foto desde cámara
- `PasswordForm.tsx` — Formulario de contraseña
- `PreferenciasNotificacion.tsx` — Preferencias de notificación
- `MiCredencial.tsx` — Vista de credencial
- `VistaPreviaCarnet.tsx` — Vista previa del carnet
- `AvatarCredencial.tsx` — Avatar para credencial
- `EditorFotoCredencial.tsx` — Editor de foto para credencial
- `DireccionCompraFields.tsx` — Campos de dirección
- `CompraAcciones.tsx` — Acciones de compra
- `EstadoConstancia.tsx` — Estado de constancia
- `NuevaCategoriaModal.tsx` — Modal para nueva categoría

### Frontend Modules (`Fronted/src/modules/biometria/`)
- `AccesoFacialPage.tsx` — Página de login facial
- `EnrolamientoFacial.tsx` — Componente de enrolamiento facial
- `api.ts` — Cliente API para biometría

### Frontend API (`Fronted/src/api/famkon.ts`)
- Cliente API completo con JWT + refresh automático
- 865+ líneas con todas las interfaces y funciones para cada módulo

### Base de Datos
- `BD/01 scrip/pkg/04_PACKAGES_TIENDA_ORACLE.sql` — Todos los packages PL/SQL + vista VW_GESTOR_USUARIOS
- `BD/01 scrip/inserts_rol_permiso.sql` — Enrolamiento de permisos por rol

### Vista VW_GESTOR_USUARIOS

Vista enriquecida usada por el modulo "Gestor de Usuario" del admin.
Columnas: `ID_USUARIO, NICKNAME, CORREO, TELEFONO, FECHA_NACIMIENTO, EDAD, ID_SITIO,
ACTIVO, BLOQUEADO, INTENTOS_FALLIDOS, ULTIMO_ACCESO, NOTIFICA_EMAIL, NOTIFICA_WHATSAPP,
ROLES, CANT_ROLES, CANT_PERMISOS, ULTIMA_CONEXION_OK, ULTIMA_CONEXION_FALLIDA, TOTAL_ACCESOS`.

`EDAD` se calcula con `TRUNC(MONTHS_BETWEEN(SYSDATE, FECHA_NACIMIENTO)/12)`.
`CANT_PERMISOS` cuenta los permisos DISTINTOS a traves de `USUARIO_ROL → ROL_PERMISO → PERMISO`.
`ULTIMA_CONEXION_OK/FALLIDA` derivan de `BITACORA_ACCESO.RESULTADO = 'S' / 'N'`.
`TOTAL_ACCESOS` cuenta todas las filas de `BITACORA_ACCESO` para el usuario.

PKG_SEGURIDAD expone `SP_LISTAR_USUARIOS_GESTOR(p_solo_activos, o_datos)` y
`SP_OBTENER_USUARIO_GESTOR(p_id_usuario, o_datos)` para consumirla desde el backend
(`UsuarioAdminService.ListarUsuariosGestorAsync` / `ObtenerUsuarioGestorAsync`).

### Enrolamiento de permisos por rol (matriz vigente)

| Permiso | COMPRADOR | REPARTIDOR | SUPERVISOR | ADMIN |
|---------|:--:|:--:|:--:|:--:|
| VER_CATALOGO | ✓ |   |   | ✓ |
| VER_CARRITO  | ✓ |   |   | ✓ |
| CREAR_PEDIDO | ✓ |   |   | ✓ |
| REALIZAR_PAGO | ✓ |   |   | ✓ |
| VER_TRACKING  | ✓ |   |   | ✓ |
| VER_HISTORICO | ✓ |   |   | ✓ |
| VER_PEDIDOS_ASIGNADOS |   | ✓ |   | ✓ |
| GESTIONAR_ENTREGAS    |   | ✓ | ✓ | ✓ |
| GESTIONAR_ESTADO_PEDIDO |   | ✓ |   | ✓ |
| GESTIONAR_PRODUCTOS   |   |   | ✓ | ✓ |
| GESTIONAR_USUARIOS    |   |   | ✓ | ✓ |
| GESTIONAR_CATALOGOS   |   |   |   | ✓ |
| GESTIONAR_ROLES       |   |   |   | ✓ |
| VER_DASHBOARD         |   |   | ✓ | ✓ |
| GESTIONAR_PERFIL      | ✓ | ✓ | ✓ | ✓ |

El frontend llama `obtenerPermisos()` justo después del login, cachea la lista en
`famkon.permisos` (AuthContext) y HomePage / RequirePermiso enruta según rol.
