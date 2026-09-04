#!/usr/bin/env bash
# Остановка beta-контура. Намеренно `stop`, а НЕ `down`:
# down удаляет контейнеры (а с -v — и тома). Контейнеры и данные сохраняются.
set -euo pipefail
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$DEPLOY_DIR"
docker compose stop "$@"
docker compose -f graph/docker-compose.yml --env-file graph/.env stop "$@"
