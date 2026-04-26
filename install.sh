#!/usr/bin/env bash
set -e

echo "🚀 Bienvenido a la instalación de Nexus"
echo "──────────────────────────────────────────"

# 1. Detectar OS y Arquitectura
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

if [ "$OS" != "linux" ] && [ "$OS" != "darwin" ]; then
    echo "❌ Sistema operativo no soportado por este script: $OS"
    exit 1
fi

if [ "$ARCH" = "x86_64" ]; then
    ARCH="amd64"
elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    ARCH="arm64"
else
    echo "❌ Arquitectura no soportada: $ARCH"
    exit 1
fi

FILENAME="nexus-${OS}-${ARCH}.tar.gz"
REPO="Epigibson/Nexus"
RELEASE_URL="https://github.com/$REPO/releases/latest/download/$FILENAME"

echo "📦 Sistema detectado: $OS ($ARCH)"
echo "⬇️  Descargando binario desde GitHub Releases..."

TMP_DIR=$(mktemp -d -t nexus-install-XXXXXX)
trap 'rm -rf "$TMP_DIR"' EXIT

# 2. Descargar
if command -v curl &> /dev/null; then
    curl -sSL -f "$RELEASE_URL" -o "$TMP_DIR/$FILENAME" || {
        echo "❌ Error al descargar el archivo. Comprueba que hay un Release publicado en GitHub."
        exit 1
    }
elif command -v wget &> /dev/null; then
    wget -qO "$TMP_DIR/$FILENAME" "$RELEASE_URL" || {
        echo "❌ Error al descargar el archivo."
        exit 1
    }
else
    echo "❌ Error: Se requiere 'curl' o 'wget' para descargar el binario."
    exit 1
fi

# 3. Extraer e instalar
echo "⚙️  Extrayendo binario..."
tar -xzf "$TMP_DIR/$FILENAME" -C "$TMP_DIR"

echo "🔑 Instalando en /usr/local/bin (puede requerir tu contraseña)..."
sudo mv "$TMP_DIR/nexus" /usr/local/bin/nexus
sudo chmod +x /usr/local/bin/nexus

echo "🔧 Configurando la inyección de entorno en tu shell..."
# Ejecutamos el comando automático de inyección
nexus setup-shell || true

echo "──────────────────────────────────────────"
echo "✅ Instalación completada con éxito."
echo "💡 Recuerda reiniciar tu terminal o ejecutar 'source ~/.bashrc' (o ~/.zshrc)."
echo "⚡ Ejecuta 'nexus login' para conectar con el dashboard."
