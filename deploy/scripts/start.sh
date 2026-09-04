#!/usr/bin/env bash
# Старт beta-контура: core (6 серверов) + graph (neo4j + mcp-app).
# Идемпотентно: docker compose up -d пересоздаёт только изменившееся.
set -euo pipefail
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$DEPLOY_DIR"
echo "== core =="
docker compose up -d "$@"
echo "== graph =="
docker compose -f graph/docker-compose.yml --env-file graph/.env up -d "$@"
echo "Готово. Статус: $DEPLOY_DIR/scripts/status.sh"
