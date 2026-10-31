#!/usr/bin/env bash
# Despliega el frontend compilado (Fronted/dist) en la VPS sin tocar el contenedor.
# Sube el build a una carpeta nueva en /var/www/famkon.site/releases y cambia el enlace
# "current" (nginx sirve /var/www/famkon.site/current). Volver atras = apuntar "current"
# a un release anterior.
#
# Uso:   ./deploy-frontend-vps.sh
# Vars:  VPS_HOST (por defecto root@24.144.102.159)
#        SSHPASS  (opcional: si esta definida se usa sshpass; si no, la clave SSH)
set -euo pipefail

VPS_HOST="${VPS_HOST:-root@24.144.102.159}"
BASE="/var/www/famkon.site"
RELEASE="$(date +%Y%m%d-%H%M%S)"
RAIZ="$(cd "$(dirname "$0")" && pwd)"

if [ -n "${SSHPASS:-}" ]; then SSH=(sshpass -e ssh); else SSH=(ssh); fi

echo "==> Compilando"
# La API se llama por ruta relativa (/api/famkon): no se define VITE_API_BASE_URL.
(cd "$RAIZ/Fronted" && env -u VITE_API_BASE_URL npm run build)

echo "==> Subiendo a $VPS_HOST:$BASE/releases/$RELEASE"
"${SSH[@]}" "$VPS_HOST" "mkdir -p $BASE/releases/$RELEASE"
rsync -rt --delete --no-owner --no-group -e "${SSH[*]}" "$RAIZ/Fronted/dist/" "$VPS_HOST:$BASE/releases/$RELEASE/"

echo "==> Activando el release (cambio atomico del enlace current)"
"${SSH[@]}" "$VPS_HOST" "chown -R www-data:www-data $BASE/releases/$RELEASE \
  && ln -sfn $BASE/releases/$RELEASE $BASE/current.tmp \
  && mv -Tf $BASE/current.tmp $BASE/current \
  && ls -1dt $BASE/releases/* | tail -n +6 | xargs -r rm -rf"

echo "==> Listo: $RELEASE (anteriores en $BASE/releases)"
