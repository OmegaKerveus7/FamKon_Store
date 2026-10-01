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