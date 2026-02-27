#!/bin/bash
set -e

echo "=== Перезапуск MCP серверов ==="

./scripts/stop.sh
./scripts/start.sh

echo "=== Перезапуск завершён ==="
