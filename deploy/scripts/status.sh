#!/usr/bin/env bash
# Статус beta-контура: docker-статус + вендорские readiness-эндпоинты.
# healthy по docker ≠ готов к поиску: смотри READY-колонку.
set -uo pipefail

check() { # name url expected
  local name="$1" url="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "ERR")
  printf "%-28s %-8s %s\n" "$name" "$code" "$url"
}

echo "=== Контейнеры ==="
docker ps -a --filter "name=_beta" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | sed 's/127.0.0.1://g'
echo
echo "=== Readiness (вендорские эндпоинты) ==="
check "help        (8103 /ready)"  "http://127.0.0.1:8103/ready"
check "codemeta    (8100 /ready)"  "http://127.0.0.1:8100/ready"
check "ssl         (8108 /ready)"  "http://127.0.0.1:8108/ready"
check "templates   (8104 /ready)"  "http://127.0.0.1:8104/ready"
check "checker     (8107 /health)" "http://127.0.0.1:8107/health"
check "graph       (8106 /readyz)" "http://127.0.0.1:8106/readyz"
check "neo4j       (7574 http)"    "http://127.0.0.1:7574/"
printf "%-28s %-8s %s\n" "syntaxcheck (8102)" "$(docker inspect -f '{{.State.Health.Status}}' 1c_syntaxcheck_mcp_beta 2>/dev/null || echo missing)" "healthcheck внутренний, HTTP нет"
