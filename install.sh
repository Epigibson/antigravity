#!/usr/bin/env bash
set -e

echo "🚀 Bienvenido a la instalación de Nexus"
echo "──────────────────────────────────────────"

# 1. Comprobación de requisitos
if ! command -v go &> /dev/null; then
    echo "❌ Error: 'go' no está instalado. Nexus necesita Go para compilarse en tu sistema."
    echo "   Por favor instala Go (https://go.dev/doc/install) y vuelve a intentarlo."
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo "❌ Error: 'git' no está instalado."
    exit 1
fi

# 2. Preparar el entorno de trabajo
TMP_DIR=$(mktemp -d -t nexus-install-XXXXXX)
trap 'rm -rf "$TMP_DIR"' EXIT

echo "📦 Descargando el código fuente más reciente..."
# Clonando el proyecto oficial
git clone -q https://github.com/Epigibson/antigravity.git "$TMP_DIR" || {
    echo "⚠️  Nota: No se pudo clonar el repositorio, compilando desde el directorio local."
    cp -r core "$TMP_DIR/"
}

echo "⚙️  Compilando el binario (esto puede tomar unos segundos)..."
cd "$TMP_DIR/core"
go build -o nexus-cli ./cmd/nexus

echo "🔑 Solicitando permisos para instalar globalmente en /usr/local/bin..."
sudo mv nexus-cli /usr/local/bin/nexus

echo "🔧 Configurando la inyección de entorno en tu shell..."
# Ejecutamos el comando automático de inyección
nexus setup-shell

echo "──────────────────────────────────────────"
echo "✅ Instalación completada con éxito."
echo "💡 Recuerda reiniciar tu terminal o ejecutar 'source ~/.bashrc' (o ~/.zshrc) antes de tu primer uso."
echo "⚡ Empieza ejecutando: 'nexus init' en tu siguiente proyecto."

