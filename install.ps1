$ErrorActionPreference = "Stop"

Write-Host "🚀 Bienvenido a la instalacion de Nexus para Windows" -ForegroundColor Cyan
Write-Host "──────────────────────────────────────────" -ForegroundColor Cyan

# 1. Detectar Arquitectura
$arch = $env:PROCESSOR_ARCHITECTURE.ToLower()
if ($arch -eq "amd64" -or $arch -eq "x86_64") {
    $arch = "amd64"
} elseif ($arch -eq "arm64") {
    $arch = "arm64"
} else {
    Write-Host "❌ Arquitectura no soportada: $arch" -ForegroundColor Red
    exit 1
}

$filename = "nexus-windows-${arch}.zip"
$repo = "Epigibson/Nexus"
$releaseUrl = "https://github.com/${repo}/releases/latest/download/${filename}"

$tempDir = Join-Path $env:TEMP "nexus-install-$(Get-Random)"
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
$zipPath = Join-Path $tempDir $filename

Write-Host "📦 Descargando binario desde GitHub Releases ($filename)..." -ForegroundColor Yellow

# 2. Descargar
try {
    Invoke-WebRequest -Uri $releaseUrl -OutFile $zipPath
} catch {
    Write-Host "❌ Error al descargar el archivo. Asegurate de que hay un Release en GitHub." -ForegroundColor Red
    Remove-Item -Recurse -Force $tempDir
    exit 1
}

# 3. Extraer e Instalar
Write-Host "⚙️  Extrayendo binario..." -ForegroundColor Yellow
Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force

$installDir = Join-Path $env:USERPROFILE ".nexus\bin"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

$exePath = Join-Path $tempDir "nexus.exe"
Move-Item -Path $exePath -Destination (Join-Path $installDir "nexus.exe") -Force

# Limpiar temporal
Remove-Item -Recurse -Force $tempDir

# 4. Agregar al PATH
$currentPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*\.nexus\bin*") {
    Write-Host "🔧 Agregando Nexus al PATH de tu usuario..." -ForegroundColor Yellow
    [System.Environment]::SetEnvironmentVariable("Path", "$currentPath;$installDir", "User")
}

Write-Host "──────────────────────────────────────────" -ForegroundColor Cyan
Write-Host "✅ Instalacion completada con exito." -ForegroundColor Green
Write-Host "💡 Recuerda reiniciar tu terminal de PowerShell para que se recargue el PATH." -ForegroundColor Yellow
Write-Host "⚡ Ejecuta 'nexus login' para conectar con el dashboard." -ForegroundColor Yellow
