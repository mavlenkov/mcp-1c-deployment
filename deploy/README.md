# deploy/ — BETA-контур MCP-серверов 1С (greenfield 2026-09-04)

Источник истины по контрактам: вендорский `MCP_Distr` 2026-08-30
(`INSTALL.md`, `servers/*.md`). Этот каталог — тонкий ops-слой поверх
вендорской схемы (стратегия C, утверждена коллегией и владельцем).

## Состав

| Сервер | Контейнер | Порт (loopback) | Readiness |
|---|---|---|---|
| HelpSearch | `1c_help_mcp_beta` | 8103 | `/ready` (healthcheck = /ready, `starting` при индексации — норма) |
| CodeMetadata | `1c_code_metadata_mcp_beta` | 8100 | `/ready` (`/live` ≠ готов!) |
| SSL (БСП) | `1c_ssl_mcp_beta` | 8108 | `/ready` (`/health` нет) |
| Templates | `1c_templates_mcp_beta` | 8104 | `/ready`; memory без auth → ТОЛЬКО loopback |
| SyntaxCheck | `1c_syntaxcheck_mcp_beta` | 8102 | HTTP нет; внутренний healthcheck |
| 1CCodeChecker | `1c_code_checker_beta` | 8107 | `/health` |
| Graph + Neo4j | `1c_graph_metadata_beta`, `neo4j_beta` | 8106, 7574/7787 | `/readyz` |

Образы: `light-beta` везде, где есть; `latest-beta` для syntaxcheck.
Ключи: **только beta-набор** `LICENSE_KEY_*_BETA` — stable-ключи дают
`Invalid LICENSE_KEY` и немедленный выход.

## Операции

```bash
scripts/start.sh          # up -d core + graph
scripts/stop.sh           # stop (НЕ down! данные и контейнеры сохраняются)
scripts/status.sh         # docker-статус + readiness-эндпоинты
scripts/logs.sh <имя> -f  # логи (help|codemeta|ssl|templates|syntaxcheck|checker|graph|neo4j)
scripts/reindex.sh <сервер>   # RESET_DATABASE=true на прогон → возврат false
scripts/reindex.sh graph --full  # полная перестройка графа (WIPE, часы)
scripts/update.sh [svc...]    # pull → backup-rename → up → проверка лицензий
```

## Секреты

- `deploy/.env` и `deploy/graph/.env` — локально, НЕ в git (см. `.env.example`).
- `ONEC_AI_TOKEN` — только `/home/l7777/.mcp-secrets/1c-code-checker.env`
  (внешний env-файл, требование вендора).
- `MCP_OPERATOR_TOKEN` не задан: пишущие инструменты Templates выключены,
  память (remember/recall) работает без него.

## Расширения (extension catalog)

`EXTENSIONS_HOST_PATH=/home/l7777/mcp/extensions`, каждое расширение —
подкаталог с `Configuration.xml`. Каталог — источник истины
(`EXTENSION_CATALOG_SYNC=true`): исчезнувшая выгрузка удаляет свой слой.
Порядок при одинаковом назначении — `extensions_order.json` в каталоге.
Новые MCP-инструменты слоёв: `resolve_effective_entity`,
`compare_base_and_extension`, `list_graph_projects`.

⚠️ graph монтирует PATH_CODE **на запись** (business_info.html). В rsync
выгрузок `--exclude='business_info.html'` ставить ПЕРЕД whitelist.

## Плагины

`/app/plugins` монтируется из `${PATH_BASES}/graph_plugins` (graph).
Перед первым монтированием положить туда копии `example.py` и `AGENTS.md`
из образа — иначе они скрываются. Derived-state хуки перестраивают индекс.

## Отличия от вендорской схемы (осознанные)

1. Всё на beta как основной и единственный контур (решение владельца);
   при появлении stable с catalog — он займёт порты 80xx.
2. `GRAPH_ONLY=false` + business search включены сразу (паритет со старым
   использованием); вендорский дефолт — graph-only.
3. `GRAPH_SCOPE_ENFORCED=true` — легально: Neo4j чистая (greenfield).
4. Systemd-юниты — симлинки, не snapshot-копии.
