# Despliegue en VPS - FamKon

## Resumen del problema
El frontend mostraba pantalla en blanco tras login porque:
1. **vite.config.ts** no tenía proxy para `/api` en producción
2. **famkon.ts** usaba URL relativa `/api/famkon` que solo funciona con proxy de Vite
3. **Nginx** no estaba proxyando `/api` al backend en puerto 5299
4. **cargarPermisos()** fallaba silenciosamente dejando la UI en "Cargando..."

---

## Archivos modificados

### 1. Fronted/vite.config.ts
- Proxy solo en desarrollo (`mode === "development"`)
- En producción usa `import.meta.env.VITE_API_BASE_URL`

### 2. Fronted/src/api/famkon.ts
- `BASE_URL` ahora usa `import.meta.env.VITE_API_BASE_URL || "/api/famkon"`

### 3. Fronted/src/context/AuthContext.tsx
- `cargarPermisos()` ahora loggea errores y limpia estado en caso de fallo

### 4. Fronted/src/components/RequirePermiso.tsx
- Muestra botón "Reintentar" si falla la carga de permisos

### 5. nginx-famkon.conf (nuevo)
- Configuración Nginx con proxy `/api` → `localhost:5299`

---

## Despliegue actual en la VPS (build estático) — 2026-10-31

El frontend ya **no** corre con el servidor de desarrollo de Vite (abrir la home bajaba ~17 MB y tardaba 24 s o más). Ahora nginx sirve el build compilado desde `/var/www/famkon.site/current`.

- Desplegar el frontend: `./deploy-frontend-vps.sh` (compila, sube a `/var/www/famkon.site/releases/<fecha>` y cambia el enlace `current`; define `SSHPASS` si se usa contraseña). Ya **no** hay que copiar archivos de `src/` a `/root/Frontend_Store`.
- Volver atrás: apuntar `current` a un release anterior, por ejemplo
  `ln -sfn /var/www/famkon.site/releases/<release-anterior> /var/www/famkon.site/current.tmp && mv -Tf /var/www/famkon.site/current.tmp /var/www/famkon.site/current`
  (se conservan los 5 últimos). Los cambios en nginx se revierten con `/root/famkon.nginx.bak-20261031` (`nginx -t && nginx -s reload`).
- `/etc/nginx/sites-enabled/famkon`: `location /api/` sigue yendo al API (`127.0.0.1:5299`); `location /` sirve `root /var/www/famkon.site/current` con `try_files $uri $uri/ /index.html` y `Cache-Control: no-cache`; `/assets/` lleva caché de 1 año (los archivos tienen hash); `gzip_types` incluye JS, CSS, JSON, SVG y wasm.
- El contenedor `cont-famkon-store-frontend` (Vite dev, puerto 5147) sigue arriba pero ya no recibe tráfico; se puede detener cuando se confirme que todo va bien.
- El archivo `nginx-famkon.conf` de este repo trae límites anti-DDoS (`limit_req`/`limit_conn` por IP) que **no** están aplicados en la VPS: no copiarlo completo sin revisar, porque muchos usuarios de la universidad comparten IP.

---

## Pasos de despliegue en VPS

### 1. Build del frontend
```bash
cd Fronted
# Para producción: define la URL base de la API
VITE_API_BASE_URL=https://famkon.site/api/famkon bun run build
# Esto genera la carpeta dist/
```

### 2. Copiar build al servidor web
```bash
sudo mkdir -p /var/www/famkon.site
sudo cp -r dist/* /var/www/famkon.site/
sudo chown -R www-data:www-data /var/www/famkon.site
```

### 3. Configurar Nginx
```bash
# Copiar configuración
sudo cp nginx-famkon.conf /etc/nginx/sites-available/famkon.site
sudo ln -s /etc/nginx/sites-available/famkon.site /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Backend (ya debería estar corriendo en puerto 5299)
```bash
cd Backend/FamKon_store_api
# Verificar appsettings.json tiene la configuración correcta
# ConnectionStrings:Oracle, Jwt:SecretKey, etc.
dotnet run --urls "http://localhost:5299"
# O usar systemd para servicio permanente
```

### 5. Verificar SSL con Certbot (si no está hecho)
```bash
sudo certbot --nginx -d famkon.site -d www.famkon.site
```

---

## Variables de entorno importantes

### Frontend (build time)
```bash
VITE_API_BASE_URL=https://famkon.site/api/famkon
```
> **Nota**: Como Nginx hace proxy en el mismo dominio, también funciona `VITE_API_BASE_URL=/api/famkon`

### Backend (appsettings.json)
```json
{
  "ConnectionStrings": {
    "Oracle": "User Id=TIENDA_APP;Password=tu_password;Data Source=www.server.daossystem.pro:5626/XEPDB1;"
  },
  "Jwt": {
    "SecretKey": "tu_clave_secreta_muy_larga_y_segura",
    "Issuer": "FamKon",
    "Audience": "FamKonApp",
    "ExpirationMinutes": 10
  },
  "Recurrente": {
    "FrontendUrl": "https://famkon.site"
  }
}
```

---

## Flujo de verificación

1. **Accede a https://famkon.site** → Debe redirigir a `/login`
2. **Login** → Debe ir a `/inicio` (dashboard) sin pantalla en blanco
3. **Navegar a catálogo/carrito** → Debe cargar datos del backend
4. **F5 (refresh)** → Debe mantener la sesión y cargar permisos

---

## Troubleshooting

### Si sigue en blanco tras login:
1. Abre DevTools (F12) → Console/Network
2. Busca llamadas a `/api/famkon/permisos` → ¿Devuelven 200?
3. Si 404/502 → Revisa Nginx `proxy_pass http://localhost:5299/;` (con slash final)
4. Si CORS → Backend tiene `AllowAnyOrigin()` pero verifica headers

### Logs útiles
```bash
# Nginx
sudo tail -f /var/log/nginx/famkon.site.error.log
sudo tail -f /var/log/nginx/famkon.site.access.log

# Backend (si usa systemd)
sudo journalctl -u famkon-api -f
```

### Probar API directamente
```bash
curl -X POST https://famkon.site/api/famkon/login_basic \
  -H "Content-Type: application/json" \
  -d '{"correo":"test@test.com","contrasena":"123456"}'
```

---

## Estructura de puertos en VPS

| Servicio | Puerto | Acceso |
|----------|--------|--------|
| Nginx (HTTP) | 80 | Público → Redirige a 443 |
| Nginx (HTTPS) | 443 | Público → Sirve frontend + proxy `/api` |
| Backend API | 5299 | Solo localhost (interno) |
| Oracle DB | 5626 | Externo (server.daossystem.pro) |