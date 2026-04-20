#!/usr/bin/env bash

echo "🗑️  Iniciando desinstalación de Nexus..."
echo "──────────────────────────────────────────"

echo "1) Eliminando el binario global..."
sudo rm -f /usr/local/bin/nexus

echo "2) Limpiando configuraciones locales y estados guardados..."
rm -rf ~/.nexus

echo "3) Removiendo the shell wrapper de tus configuraciones terminales..."
# Usar sed para encontrar la firma de nuestro bloque y eliminarlo (las 8 lineas seguidas)
# Se hace con perl o sed cross-platform.
if [ -f "$HOME/.bashrc" ]; then
    # Esta es una eliminación más manual, es recomendable limpiar el bloque de "Nexus CLI Wrapper"
    # Con perl lo podemos eliminar de manera precisa:
    perl -0777 -pi -e 's/\n# Nexus CLI Wrapper\n# Automates environment variable injections upon switching contexts\nnexus\(\) \{\n    command nexus "\$@"\n    if \[\[ "\$1" == "switch" && -f "\$HOME\/\.nexus\/last_switch\.sh" \]\]; then\n        source "\$HOME\/\.nexus\/last_switch\.sh"\n    fi\n\}\n//g' "$HOME/.bashrc"
    echo "  - Limpio en ~/.bashrc"
fi

if [ -f "$HOME/.zshrc" ]; then
    perl -0777 -pi -e 's/\n# Nexus CLI Wrapper\n# Automates environment variable injections upon switching contexts\nnexus\(\) \{\n    command nexus "\$@"\n    if \[\[ "\$1" == "switch" && -f "\$HOME\/\.nexus\/last_switch\.sh" \]\]; then\n        source "\$HOME\/\.nexus\/last_switch\.sh"\n    fi\n\}\n//g' "$HOME/.zshrc"
    echo "  - Limpio en ~/.zshrc"
fi

echo "──────────────────────────────────────────"
echo "✅ Desinstalación de Nexus Completada."
echo "Ya no existen rastros del CLI ni de su inyector de comandos locales."
