#!/usr/bin/env bash
# Переиндексация серверов beta-контура.
# Вендорская модель: RESET_DATABASE=true на один прогон, затем ОБЯЗАТЕЛЬНЫЙ
# возврат false (старую ошибку "reindex оставляет true навсегда" исправляем).
#
#   reindex.sh help|codemeta|ssl|templates   — переиндекс одного сервера
#   reindex.sh graph                          — рестарт graph (catalog sync подхватит изменения слоёв)
#   reindex.sh graph --full                   — ПОЛНАЯ перестройка: стоп, снос состояния и Neo4j-дейты, старт (ЧАСЫ!)
#   reindex.sh all                            — все core-серверы по очереди
set -euo pipefail
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DEPLOY_DIR"

wait_ready() { # url timeout_sec
  local url="$1" timeout="${2:-7200}" t=0
  echo "Жду готовности: $url (до ${timeout}s)"
  until [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$url" 2>/dev/null)" = "200" ]; do
    t=$((t+30)); [ "$t" -ge "$timeout" ] && { echo "TIMEOUT ожидания $url"; return 1; }
    sleep 30
  done
  echo "Готов: $url"
}

reindex_core() { # service ready_url port_path
  local svc="$1" url="$2"
  echo "=== reindex $svc: RESET_DATABASE=true ==="
  RESET_DATABASE=true docker compose up -d --force-recreate "$svc"
  wait_ready "$url" || true
  echo "=== reindex $svc: возврат RESET_DATABASE=false ==="
  docker compose up -d --force-recreate "$svc"
}

case "${1:-}" in
  help|codemeta|ssl|templates)
    svc="$1"
    case "$svc" in
      help)       url="http://127.0.0.1:8103/ready" ;;
      codemeta)   url="http://127.0.0.1:8100/ready" ;;
      ssl)        url="http://127.0.0.1:8108/ready" ;;
      templates)  url="http://127.0.0.1:8104/ready" ;;
    esac
    reindex_core "$svc" "$url"
    ;;
  graph)
    if [ "${2:-}" = "--full" ]; then
      echo "!!! ПОЛНАЯ перестройка graph: состояние и Neo4j-данные beta-контура будут УДАЛЕНЫ"
      read -r -p "Подтверди: введи 'WIPE' > " ans; [ "$ans" = "WIPE" ] || exit 1
      set -a; source graph/.env; set +a
      docker compose -f graph/docker-compose.yml --env-file graph/.env down
      sudo rm -rf "${GRAPH_STATE_PATH:?}" "${NEO4J_DATA_PATH:?}"
      docker compose -f graph/docker-compose.yml --env-file graph/.env up -d
      echo "Перестройка запущена; слежение: scripts/logs.sh graph -f"
    else
      docker compose -f graph/docker-compose.yml --env-file graph/.env up -d --force-recreate mcp-app
      echo "Graph перезапущен; extension catalog синхронизирует слои при старте (см. логи: Extension catalog / Layer)."
    fi
    ;;
  all)
    for s in help codemeta ssl templates; do "$0" "$s"; done
    ;;
  *) echo "Использование: $0 help|codemeta|ssl|templates|graph [--full]|all"; exit 1 ;;
esac
