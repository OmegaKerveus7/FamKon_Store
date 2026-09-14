# AGENTS.md — Tienda Online FamKon

## Estructura del Proyecto

Monorepo con 3 componentes principales:

```
Tienda_Online_FamKon/
├── Backend/                    # ASP.NET Core 8 API (C#)
│   └── FamKon_store_api/
│       ├── BD/DBContext.cs     # Singleton Oracle connection
│       ├── Controllers/        # API endpoints
│       ├── Models/             # Entidades y DTOs
│       ├── Services/           # LoginService (PKG_LOGIN), JwtService, BiometricService
│       ├── Program.cs          # Entry point
│       └── appsettings.json    # Config (NO commitear - tiene secretos)
├── Fronted/                    # React 19 + TypeScript + Vite (Bun)
│   └── src/
│       ├── api/famkon.ts       # API client con JWT headers
│       ├── context/AuthContext  # Auth state + token storage
│       ├── pages/              # Componentes de página
│       └── components/         # Componentes reutilizables
└── BD/                         # Scripts SQL Oracle
    └── SCRIPTS BD/bd_completa/ # DDL completo de la BD
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
La conexión a Oracle usa un patrón Singleton (estilo DemoBackend):
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
- Requests incluyen header `Authorization: Bearer <token>`
- 401 → redirigir a `/login`

### PKG_LOGIN (Oracle Package)
Todos los logins se ejecutan vía `PKG_LOGIN.CRUD`:
- `p_opcion = 'C'` → Credenciales (correo/nickname + password) ✅ FUNCIONAL
- `p_opcion = 'N'` → Nickname + password (estructura)
- `p_opcion = 'Q'` → Token QR (estructura, no funcional aún)
- `p_opcion = 'F'` → Facial (estructura, servicio externo inactivo)

El package retorna JSON con: `id_usuario`, `nickname`, `correo`, `telefono`, `fecha_nacimiento`, `activo`, `bloqueado`, `roles`

## Base de Datos Oracle

- **Host**: www.server.daossystem.pro
- **Port**: 5626
- **Service**: XEPDB1
- **User**: TIENDA_APP (NO usar system)
- **Tablas principales**: USUARIO, ROL, USUARIO_ROL, PERMISO, ROL_PERMISO, BITACORA_ACCESO, ARCHIVO, SITIO, TOKEN_RECUPERACION

## Seguridad

- `appsettings.json` está en `.gitignore` (NUNCA commitear credenciales)
- `appsettings.Development.json` también excluido
- `.env` excluido por prevención
- Passwords hasheados con SHA-256 en la BD (via PKG_LOGIN)
- JWT tokens de 10 minutos
- Auditoría en BITACORA_ACCESO via PKG_LOGIN

## Frontend

- **Runtime**: Bun (NO Node.js)
- **Framework**: React 19 + TypeScript + Vite
- **Routing**: react-router-dom v7
- **UI**: Tailwind CSS 4
- **API Base URL**: `/api/famkon` (proxy configurado en vite.config.ts)

### Auth Flow
1. Login → POST `/api/famkon/login` → `{ token, usuario }`
2. Guardar token en `localStorage`
3. Requests futuros incluyen `Authorization: Bearer <token>`
4. 401 → limpiar storage → redirect `/login`

## Servicios Externos (Inactivos)

- **Reconocimiento facial**: `http://www.server.daossystem.pro:3405/Rostro/Segmentar`
- **Verificación facial**: `http://www.server.daossystem.pro:3405/Rostro/Verificar`
- Estos servicios NO están activos. Las estructuras de facial y QR existen pero no funcionan.
- Solo login por **correo/nickname + password** está funcional.

## Archivos Importantes

- `Backend/FamKon_store_api/Program.cs` — Configuración de servicios y middleware
- `Backend/FamKon_store_api/BD/DBContext.cs` — Conexión singleton a Oracle
- `Backend/FamKon_store_api/Services/LoginService.cs` — Lógica de login vía PKG_LOGIN
- `Backend/FamKon_store_api/Services/JwtService.cs` — Generación y validación JWT
- `Backend/FamKon_store_api/Controllers/AuthController.cs` — Endpoints de autenticación
- `Fronted/src/api/famkon.ts` — Cliente API con JWT
- `Fronted/src/context/AuthContext.tsx` — Estado de autenticación
