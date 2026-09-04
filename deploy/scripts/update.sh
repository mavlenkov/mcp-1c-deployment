#!/usr/bin/env bash
# Обновление образов beta-контура по вендорской процедуре:
# pull → stop → rename в _backup_YYYYMMDD → up с теми же томами → проверка логов.
# Откат: docker stop <имя> && docker rename <имя>_backup_<дата> <имя>... (см. вывод).
#
#   update.sh           — обновить все сервера beta-контура
#   update.sh help ssl  — только перечисленные (имена сервисов compose)
set -euo pipefail
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DEPLOY_DIR"
STAMP="$(date +%Y%m%d)"

backup_rename() { # container
  local c="$1"
  docker stop "$c" >/dev/null
  docker rename "$c" "${c}_backup_${STAMP}" >/dev/null
  echo "  сохранён backup: ${c}_backup_${STAMP} (откат: docker rm ${c}_new... см. README)"
}

update_core() {
  local svcs=("$@")
  docker compose pull "${svcs[@]}"
  for s in "${svcs[@]}"; do
    c=$(docker compose ps -q "$s" | head -1)
    [ -n "$c" ] && backup_rename "$(docker inspect -f '{{.Name}}' "$c" | sed 's|^/||')"
  done
  docker compose up -d "${svcs[@]}"
}

if [ $# -gt 0 ]; then SVC_LIST=("$@"); else SVC_LIST=(help codemeta ssl templates syntaxcheck checker); fi

echo "== pull+update core: ${SVC_LIST[*]} =="
update_core "${SVC_LIST[@]}"

if [ $# -eq 0 ]; then
  echo "== pull+update graph (neo4j + mcp-app) =="
  docker compose -f graph/docker-compose.yml --env-file graph/.env pull
  for c in 1c_graph_metadata_beta neo4j_beta; do
    docker ps -q -f "name=^${c}\$" >/dev/null && docker ps -a -q -f "name=^${c}\$" | grep -q . && backup_rename "$c" || true
  done
  docker compose -f graph/docker-compose.yml --env-file graph/.env up -d
fi

echo
echo "== Проверка лицензий и ошибок =="
for c in $(docker ps --filter "name=_beta" --format '{{.Names}}'); do
  if docker logs "$c" 2>&1 | tail -50 | grep -qiE "Invalid.*LICENSE"; then
    echo "!!! $c: Invalid LICENSE_KEY — обнови beta-ключ в .env из ЛК https://vibecoding1c.ru/"
  else
    echo "  $c: OK"
  fi
done
echo
echo "Readiness: $DEPLOY_DIR/scripts/status.sh"
echo "После успешной проверки удали backup-контейнеры: docker rm \$(docker ps -aq -f 'name=_backup_${STAMP}')"
