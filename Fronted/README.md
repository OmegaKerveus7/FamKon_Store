# FamKon Frontend

Frontend de la tienda en línea FamKon. Desarrollado con **React + TypeScript + Vite + Tailwind CSS**, ejecutado con **Bun**.

## Requisitos previos

- **Bun** (se usa para instalar, compilar y ejecutar todo; no se requiere Node).

Si no tienes Bun, instálalo en PowerShell:

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Verifica la instalación:

```bash
bun --version
```

## Dependencias instaladas

### Dependencias de ejecución

| Paquete | Versión | Propósito |
| ------- | ------- | --------- |
| react | 19.2.8 | Librería de interfaz de usuario |
| react-dom | 19.2.8 | Renderizado de React en el DOM |
| react-router-dom | 7.18.2 | Enrutamiento (login, facial, carnet, 404, inicio) |
| html5-qrcode | 2.3.8 | Escaneo de códigos QR con la cámara |
| lucide-react | 1.31.0 | Iconos de la interfaz |

### Dependencias de desarrollo

| Paquete | Versión | Propósito |
| ------- | ------- | --------- |
| vite | 8.2.1 | Servidor de desarrollo y compilación |
| @vitejs/plugin-react | 6.0.5 | Soporte de React (Fast Refresh) en Vite |
| typescript | 7.0.2 | Tipado estático |
| tailwindcss | 4.3.3 | Estilos utilitarios |
| @tailwindcss/vite | 4.3.3 | Plugin de Tailwind para Vite |
| @types/react | 19.2.18 | Tipos de React |
| @types/react-dom | 19.2.4 | Tipos de React DOM |

## Comandos de instalación manual

Por si se reconstruye el proyecto desde cero:

```bash
# Dependencias de ejecución
bun add react react-dom react-router-dom html5-qrcode lucide-react

# Dependencias de desarrollo
bun add -d typescript vite @vitejs/plugin-react tailwindcss @tailwindcss/vite @types/react @types/react-dom

# Instalar todo lo del package.json (equivalente a "npm install")
bun install
```

## Cómo ejecutar

```bash
# Servidor de desarrollo (http://localhost:5173)
bun run dev

# También funciona con
bun run start

# Compilar para producción
bun run build

# Previsualizar la compilación
bun run preview
```

> El script `dev` ejecuta `dev.mjs`, que levanta Vite **dentro del mismo proceso de Bun** para que `Ctrl+C` lo detenga por completo (sin procesos residuales en el puerto 5173).

## Comunicación con el backend

El backend (API de C#) corre en `http://localhost:5299`. Vite hace un **proxy** en `vite.config.ts`:

```
/api  ->  http://localhost:5299
```

Por eso el frontend llama a rutas relativas como `/api/famkon/login` y no se necesitan configuraciones de CORS en desarrollo.

## Rutas de la aplicación

| Ruta | Descripción |
| ---- | ----------- |
| `/` | Verifica el estado de la API (`/api/famkon/estado`) y redirige a `/login` o muestra el mensaje de servicio no disponible |
| `/login` | Login normal (correo o usuario + contraseña) y botones de Reconocimiento Facial y Por Carnet (QR) |
| `/login/facial` | Login por reconocimiento facial (identificación + cámara) |
| `/login/carnet` | Login por escaneo de QR del carnet o identificación manual |
| `/inicio` | Bienvenida tras iniciar sesión |
| `*` | Página 404 |