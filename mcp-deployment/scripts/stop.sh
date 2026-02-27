#!/bin/bash
set -e

echo "=== Остановка MCP серверов ==="

docker compose down
docker compose -f docker-compose.graph.yml down
docker compose -f docker-compose.forms.yml down

if [ -f docker-compose.cloud.yml ]; then
    docker compose -f docker-compose.cloud.yml down
fi

echo ""
echo "=== Все MCP серверы остановлены ==="
