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
deploy/smoke/tools_snapshot.py # сверка tools/list со снапшотом (через туннель)
```

## Обновление кодовой базы 1С (НОВОЕ, 2026-09-05)

1. Свежая выгрузка rsync'ом в `~/mcp/LISfiles/` (и `~/mcp/extensions/<Имя>/`),
   с `--exclude='business_info.html'` ПЕРЕД whitelist-фильтрами.
2. **codemeta**: `scripts/reindex.sh codemeta` (полная переиндексация, ~40 мин).
3. **graph — БЕЗ полной перестройки**: incremental refresh по manifest'у
   (сохраняет business-описания и эмбеддинги; полный rebuild через refresh их СОТРЁТ):

   ```
   MCP tools/call refresh_graph_project {
     project_id: "LISmcp", mode: "incremental",
     changed_paths: ["CommonModules/<Имя>/Ext/Module.bsl", ...]  # от корня выгрузки
   }
   ```
   Проверено 05.09: 1 модуль = 120 мс, проект промоутит generation (is_accessible=true).
   Без `changed_paths` (вся выгрузка) — план на ~12k unit'ов; у части типов
   (forms, role_rights, dcs_template...) нет per-unit обновления → сервер ОТКАЖЕТ
   и предложит mode=full. Тогда — `scripts/reindex.sh graph --full` (часы, токены
   на business_info заново).
4. **Расширения**: добавить/удалить/обновить каталог в `~/mcp/extensions/` →
   `docker restart 1c_graph_metadata_beta` — catalog сам перечитает слои
   (SYNC=true уберёт исчезнувшие). codemeta расширения индексирует вместе с базой
   при reindex (CODE_PATH общий).
5. После `update.sh` — прогнать smoke: `tools_snapshot.py` (drift схем beta).

ВАЖНО: `GRAPH_SCOPE_MIGRATION_WINDOW=true` держать ВКЛЮЧЁННЫМ — boot-индексация
не промоутит генерации, без окна проект недоступен scoped-инструментам
(проверено: с false list_graph_projects пуст даже при заполненном графе).

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
