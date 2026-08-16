# FamKon Store API

Backend de la tienda en línea FamKon. Desarrollado con **ASP.NET Core Web API (.NET 8)**.

## Requisitos previos

- .NET SDK 8
- Oracle Database (se usará para la base de datos)
- Visual Studio 2022 / VS Code

## Paquetes NuGet instalados

| Paquete | Versión | Propósito |
| ------- | ------- | --------- |
| Microsoft.EntityFrameworkCore.Design | 9.0.0 | Soporte de diseño de EF Core (migraciones) |
| Oracle.EntityFrameworkCore | 9.23.26300 | ORM de EF Core para la base de datos Oracle |
| Swashbuckle.AspNetCore | 10.2.3 | Documentación e interfaz Swagger de los endpoints |

### Comandos de instalación manual (por si se reconstruye el proyecto)

```bash
dotnet add package Microsoft.EntityFrameworkCore.Design --version 9.0.0
dotnet add package Oracle.EntityFrameworkCore --version 9.23.26300
dotnet add package Swashbuckle.AspNetCore --version 10.2.3
```

> Nota: no se pudo usar la última versión de Oracle.EntityFrameworkCore (10.x) porque requiere .NET 10. Para .NET 8 se usa la versión 9.x.

## Configuración del backend

### `appsettings.json`

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "Biometric": {
    "SegmentarUrl": "http://www.server.daossystem.pro:3405/Rostro/Segmentar",
    "VerificarUrl": "http://www.server.daossystem.pro:3405/Rostro/Verificar"
  }
}
```

- **Logging**: nivel de registro de la aplicación (`Information` por defecto, `Warning` para ASP.NET Core).
- **AllowedHosts**: hosts permitidos para la API (`*` permite todos).
- **Biometric**: URLs de las dos APIs de reconocimiento facial (segmentar y verificar).

### `appsettings.Development.json`

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  }
}
```

Configuración de logging exclusiva del entorno de desarrollo.

### Conexión Oracle

La cadena de conexión está en `appsettings.json`:

```json
{
  "ConnectionStrings": {
    "Oracle": "User Id=system;Password=...;Data Source=www.server.daossystem.pro:5626/XEPDB1;"
  }
}
```

> **Importante:** `appsettings.json` contiene la contraseña de la base de datos y **no se sube al repositorio** (está en `.gitignore`). Al clonar el proyecto, crea este archivo localmente con tu contraseña.

## Endpoints de la API

Todas las rutas usan el prefijo base `/api/famkon`.

### Estado de la API (`EstadoController`)

| Método | Ruta | Código | Descripción |
| ------ | ---- | ------ | ----------- |
| GET | `/api/famkon/estado` | 200 | Todo correcto: API y base de datos responden |
| GET | `/api/famkon/estado` | 401 | La base de datos no responde |
| GET | `/api/famkon/estado` | 402 | Fallo de carga o error general |

### Autenticación (`AuthController`)

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| POST | `/api/famkon/login` | Login normal (correo o nombre de usuario + contraseña) |
| POST | `/api/famkon/login/facial` | Login por reconocimiento facial (imagen original vs imagen a comparar) |
| POST | `/api/famkon/login/carnet` | Login por reconocimiento de carnet (imagen, código QR o identificación) |

### Swagger

Al ejecutar la API en entorno de desarrollo, Swagger queda disponible en:

- `http://localhost:5299/swagger` — interfaz visual para probar los endpoints
- `http://localhost:5299/swagger/v1/swagger.json` — documento JSON de OpenAPI

## Modelos actuales

### Login normal (`Models/DTOs/LoginRequest.cs`)

- `Correo` (opcional)
- `NombreUsuario` (opcional)
- `Contrasena`

### Login facial (`Models/DTOs/FacialLoginRequest.cs`)

- `ImagenOriginalBase64`
- `ImagenCompararBase64`

### Login por carnet (`Models/DTOs/CarnetLoginRequest.cs`)

- `CarnetImagenBase64`
- `CodigoQr` (opcional)
- `Identificacion` (opcional)

### Usuario (`Models/Usuario.cs`)

- `Id`
- `Nombre`
- `Correo`
- `NombreUsuario`
- `Contrasena`
- `ImagenOriginalBase64`
- `CodigoQr`
- `Rol`

### Servicio biométrico (`Models/`)

- `RequestBiometrico` — `RostroA`, `RostroB`
- `ResponseSegmentar` — `Resultado`, `Segmentado`, `Rostro`, `Error`
- `ResponseVerificar` — `Resultado`, `Coincide`, `Score`, `Status`, `Error`

## Servicios

| Servicio | Descripción |
| -------- | ----------- |
| `Services/BiometricService.cs` | Consume las APIs de segmentación y verificación facial |
| `UsuarioRepositoryMock` | Repositorio de usuarios en memoria (temporal, sin BD) |

## Cómo ejecutar

```bash
dotnet restore
dotnet run
```