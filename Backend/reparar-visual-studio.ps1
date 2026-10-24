# Repara el error de Visual Studio:
#   "An element with the same key but a different value already exists.
#    Key: 'Microsoft.WebTools.ProjectSystem.WebServer.SelfHostWebServer'"
#
# Causa: la carpeta .vs guarda el estado del sistema de proyectos web (perfiles de
# arranque, servidor self-host, IIS Express, .suo). Si queda corrupta o desfasada,
# Visual Studio intenta registrar dos veces el mismo servidor web y falla.
#
# Uso:
#   1. Cerrar Visual Studio por completo.
#   2. powershell -ExecutionPolicy Bypass -File .\reparar-visual-studio.ps1

$ErrorActionPreference = 'Stop'

$backend  = Split-Path -Parent $MyInvocation.MyCommand.Path
$proyecto = Join-Path $backend 'FamKon_store_api'

Write-Host '=== Reparacion de cache de Visual Studio (FamKon Store) ===' -ForegroundColor Cyan

$devenv = Get-Process devenv -ErrorAction SilentlyContinue
if ($devenv) {
    Write-Host 'Visual Studio sigue abierto. Cerralo y volve a ejecutar este script.' -ForegroundColor Red
    exit 1
}

# VBCSCompiler / MSBuild pueden mantener bloqueados archivos de bin y obj.
Get-Process VBCSCompiler, MSBuild -ErrorAction SilentlyContinue |
    ForEach-Object { try { $_.Kill() } catch { } }

$carpetas = @(
    (Join-Path $proyecto '.vs'),
    (Join-Path $backend  '.vs'),
    (Join-Path $proyecto 'bin'),
    (Join-Path $proyecto 'obj')
)

foreach ($carpeta in $carpetas) {
    if (Test-Path $carpeta) {
        Write-Host "Eliminando $carpeta"
        Remove-Item $carpeta -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host 'Restaurando y compilando...' -ForegroundColor Cyan
Push-Location $proyecto
try {
    dotnet restore
    if ($LASTEXITCODE -ne 0) { throw 'Fallo dotnet restore' }
    dotnet build --nologo
    if ($LASTEXITCODE -ne 0) { throw 'Fallo dotnet build' }
}
finally {
    Pop-Location
}

Write-Host ''
Write-Host 'Listo. Abrir Visual Studio con Backend\FamKon_store_api\FamKon_store_api.slnx' -ForegroundColor Green
Write-Host 'y ejecutar el perfil "http" (http://localhost:5299).' -ForegroundColor Green
