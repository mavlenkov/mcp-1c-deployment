#!/usr/bin/env bash
# Установка systemd-юнитов beta-контура. Юниты — СИМЛИНКИ на репозиторий
# (не snapshot-копии, как было в старом контуре): правки подхватываются
# после systemctl daemon-reload, переустановка не нужна.
set -euo pipefail
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for unit in 1c-mcp-beta-core.service 1c-mcp-beta-graph.service; do
  sudo ln -sf "$DEPLOY_DIR/systemd/$unit" "/etc/systemd/system/$unit"
done
sudo systemctl daemon-reload
sudo systemctl enable 1c-mcp-beta-core.service 1c-mcp-beta-graph.service
echo "Установлено. Проверка WorkingDirectory в юнитах: должна быть $DEPLOY_DIR"
