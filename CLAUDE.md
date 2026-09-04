# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **⚠️ МИГРАЦИЯ 2026-09-04 (в процессе):** старый стек (этот файл, `mcp-deployment/`,
> корневой `docker-compose.yml`, `run_mcp.sh`) снесён на alcor. Действующий контур —
> **`deploy/` (beta-канал вендорского дистрибутива 2026-08-30, порты 81xx, loopback)**:
> смотри `deploy/README.md`. Остаток этого файла описывает legacy-мир и будет
> переписан после завершения приёмки.

## Project Overview

This repository manages Docker-based MCP (Model Context Protocol) servers for 1C:Enterprise development. All servers run as Docker containers from pre-built `comol/*` images — there is no application source code to build here, only deployment configuration. There are no tests, build, or lint steps; "running" the project means starting/managing containers.

> `AGENTS.md` (root) is an older overlapping guide kept for other tools. **This `CLAUDE.md` is canonical** — prefer it when the two disagree.

## Key Commands

```bash
# Start all servers (legacy, uses docker run directly)
./run_mcp.sh

# Preferred: use mcp-deployment scripts
cd mcp-deployment
./scripts/setup.sh          # First-time environment check
./scripts/start.sh          # Start all servers
./scripts/stop.sh           # Stop all servers
./scripts/restart.sh        # Restart all servers
./scripts/status.sh         # Check status and ports
./scripts/logs.sh <name>    # View container logs (e.g., 1c-mcp-graph)

# Systemd (requires root)
sudo ./scripts/install-services.sh
sudo systemctl start|stop|restart|status 1c-mcp-graph
```

## Architecture

There are three deployment layers, from oldest to newest:

1. **`run_mcp.sh`** (root) — Legacy script with hardcoded `docker run` commands and embedded credentials. Kept for reference.
2. **`docker-compose.yml`** (root) — Intermediate approach: runs most servers via Compose, reads config from `.env`. Does NOT include Graph_metadata_search or FormsServer.
3. **`mcp-deployment/`** (recommended) — Full automated deployment with four Compose files, management scripts, and systemd units:
   - `docker-compose.yml` — Core servers (docs, syntax, metadata, ssl, templates, codechecker)
   - `docker-compose.graph.yml` — Graph metadata search + Neo4j (must start first: Neo4j on 7474/7687, then graph server on 8006)
   - `docker-compose.forms.yml` — FormsServer (port 8011)
   - `docker-compose.cloud.yml` — CloudEmbeddingsServer (port 8000, mutually exclusive with CodeMetadataSearchServer)

Subdirectories `FormsServer/` and `Graph_metadata_search/` at the root contain standalone docker-compose + env files from the original distribution (in `MCP_Distr/`).

## MCP Servers (by priority per vendor docs)

1. **HelpSearchServer** (8003) — 1C platform documentation for your exact version. Critical.
2. **Graph_metadata_search** (8006 + Neo4j 7474/7687) — Graph-based metadata search. Preferred over CodeMetadataSearchServer.
3. **CodeMetadataSearchServer** (8000) — Metadata search, config docs, code patterns (ChromaDB).
4. **SSLSearchServer** (8008) — Standard Subsystem Library (БСП) help. Essential if using БСП.
5. **TemplatesSearchServer** (8004) — Code template search (public + custom). Add your own templates.
6. **SyntaxCheckServer** (8002) — BSL Language Server syntax checking.
7. **1CCodeChecker** (8007) — 1C:Partner syntax & logic checking.
8. **FormsServer** (8011) — Context for form generation.
9. **CloudEmbeddingsServer** (8000) — Cloud-based parallel embeddings (`comol/1c_cloud_mcp_parallel`). Alternative to CodeMetadataSearchServer with multiple embedding provider support (openrouter, openai, cohere, jina, local). Supports parallel indexing via `EMBEDDING_CONCURRENCY`/`EMBEDDING_BATCH_SIZE`.

All MCP endpoints follow the pattern `http://localhost:<port>/mcp`.

## Known Issues & Patches

- **~~Graph server `business_search` "Vector indexer not initialized"~~ FIXED by vendor (image 2026-05-08, verified 2026-05-26)**: Was a web-mode init bug (`web_server.vector_indexer`/`neo4j_loader` never synced to `mcp_server.*`). Worked around via `graph_run_patch.py` until the 2026-05-08 image fixed it. Patch removed (`command`/volume-mount dropped from `docker-compose.graph.yml`, file deleted). `business_search` verified working without the patch.
- **~~Graph `business_search` Cypher SyntaxError on Neo4j 2026.04.0~~ FIXED by vendor (image 2026-05-08, verified 2026-05-26)**: 2026-05-10 image generated invalid `SEARCH node IN (...)` Cypher; the 2026-05-08-built image pulled on 2026-05-26 no longer does. Bug report kept at `mcp-deployment/REPORT-2026-05-11-graph-business-search-cypher.md` for reference.
- **business_info descriptions returned as raw HTML** (still present): `business_search` returns object descriptions verbatim as `<!DOCTYPE html>...`. Cosmetic data issue — vendor strips Cypher error but not HTML markup. Low priority.

## Environment Configuration

Configuration lives in `.env` files (copy from `.env.example`). Key variables:
- `OPENAI_API_KEY` / `OPENAI_API_BASE` — API credentials (typically OpenRouter)
- `OPENAI_MODEL` — Text generation model (used by Graph server for business descriptions)
- `OPENAI_EMBEDDING_MODEL` — Embedding model (used by metadata, ssl, templates, graph servers)
- `LICENSE_KEY_*` — Per-server license keys
- `DATA_DIR` — Base path for persistent data (default `/opt/mcp-data`)
- `METADATA_HOST_PATH` — Path to configuration report (.txt files from "Конфигурация → Отчёт по конфигурации")
- `CODE_PATH` / `METADATA_FILES_HOST_PATH` — Path to file export ("Конфигурация → Выгрузить в файлы")
- `EXTENSIONS_PATH` — Path to extensions file exports (each extension in a subdirectory)
- `SSL_PATH` — Path to БСП reference data
- `USESSE` — Transport selector. **Set `USESSE=false`** for modern clients (Claude Code expects Streamable HTTP); `true` only for legacy SSE clients. Switching transports recreates containers, which can surface `Invalid LICENSE_KEY` if keys are stale (see Vendor Update Workflow). Background: `mcp-deployment/REPORT-2026-03-02-streamable-http.md`.
- `RESET_DATABASE` / `RESET_CACHE` — Force reindex on startup. **Gotcha:** the in-container default for `RESET_DATABASE` is `True`, so any service that omits it reindexes from scratch on *every* restart (e.g. docs = ~15 min, 300+ MB ChromaDB). Always pass `RESET_DATABASE=false` explicitly for normal runs.

### Persistence volumes

Indexed data persists via named/host volumes mounted at the container's vector-DB path (Neo4j uses its own data volume). The path is **per-server and version-dependent** — mounting elsewhere silently loses the index across restarts:
- docs, templates: **`/app/chroma_db`** (ChromaDB). Historic mistakes: templates was once `/app/data`.
- **SSLSearchServer (since the 2026-06 image): `/app/zvec_db`** — vendor migrated from ChromaDB to zvec; the mount path itself changed. Old `/app/chroma_db` data is unused; reindex happens on first run of the new image.
- **CodeMetadataSearchServer (since the 2026-06 image): zvec engine, but still mounted at `/app/chroma_db`.** The vector engine migrated to zvec (logs show `vectorindexer.zvec_store`, `zvec optimize DONE …`), yet — unlike SSL — the container path did NOT change, so the existing volume keeps working and data persists fine (no reindex needed on upgrade). Takeaway: the on-disk *engine* and the *mount path name* are independent — don't rename the metadata mount to `/app/zvec_db` just because the engine changed (that would orphan the index and force a full reindex).

When bumping an image, check the server doc in `MCP_Distr/servers/` for the current container volume path before assuming it's unchanged.

## Обновление конфигурации 1С

При обновлении конфигурации 1С необходимо переиндексировать MCP-серверы:

1. Экспортировать конфигурацию из Конфигуратора (Конфигурация → Выгрузить конфигурацию в файлы) в каталог `CODE_PATH`
2. Сформировать отчёт по конфигурации (Конфигурация → Отчёт по конфигурации → Сохранить в файл) в каталог `METADATA_HOST_PATH`
3. Запустить переиндексацию:

```bash
cd mcp-deployment
./scripts/reindex.sh --config              # Серверы, зависящие от конфигурации (metadata, graph)
./scripts/reindex.sh --servers metadata    # Только конкретный сервер
./scripts/reindex.sh --all --yes           # Все серверы, без подтверждения
```

Переиндексация останавливает контейнер и перезапускает его с `RESET_DATABASE=true`. Серверы недоступны во время индексации (от 5 минут до 4 часов в зависимости от сервера).

## Расширения конфигурации

Расширения конфигурации 1С можно индексировать наряду с основной конфигурацией:

1. Выгрузить расширения в файлы (Конфигурация → Расширения → Выгрузить в файлы) — каждое в подкаталог `EXTENSIONS_PATH`
2. Сформировать отчёт по расширению (Конфигурация → Расширения → Отчёт по расширению → Сохранить) — положить `.txt` в `METADATA_HOST_PATH` рядом с основным отчётом
3. Переиндексировать серверы: `./scripts/reindex.sh --config`

Файлы расширений монтируются как read-only volume в контейнеры CodeMetadataSearchServer, CloudEmbeddingsServer и Graph metadata search. Отчёты по расширениям читаются из `METADATA_HOST_PATH` вместе с основным отчётом.

### Graph: индексация расширения поверх уже заполненного Neo4j

Особенность graph-сервера: structural resume gate скипает parse+load, если в Neo4j уже есть объекты проекта — простой рестарт или `RESET_DATABASE=true` **не** подхватят новый отчёт (`RESET_DATABASE` у graph сбрасывает только векторные индексы, Neo4j не трогает; полная очистка проекта — `python /app/run.py index --clear`, вызывает `clear_project_data`).

Правильный путь — вендорский механизм расширений, разовым прогоном **без** reset (проверено на Гистологии, 2026-07-03). Resume gate scope-aware: при заданном `EXTENSION_NAME` скип срабатывает только если объекты именно этого расширения уже в графе, поэтому прогон поверх заполненной базы работает:

```bash
# 1. Каталог только с отчётом расширения (иначе base-отчёт перезагрузится с origin=extension)
docker exec 1c-mcp-graph sh -c 'mkdir -p /tmp/ext_metadata && cp "/app/metadata/ОтчетПоРасширению<Имя>.txt" /tmp/ext_metadata/'
# 2. Разовый прогон (5-10 сек на расширение ~400 объектов); business info выключаем —
#    живой сервер догенерирует в фоне после рестарта
docker exec \
  -e EXTENSION_NAME=<Имя> -e EXTENSION_BASE_PROJECT=LISmcp \
  -e METADATA_DIRECTORY=/tmp/ext_metadata \
  -e METADATA_FILES=/app/extensions/<Имя> -e CODE_EXPORT_PATH=/app/extensions/<Имя> \
  -e CALCULATE_BUSINESS_INFO=false -e BACKGROUND_POST_INDEXING=false \
  1c-mcp-graph python /app/run.py index
# 3. Уборка и рестарт — фоновые задачи сгенерируют business info и эмбеддинги для новых объектов
docker exec 1c-mcp-graph rm -rf /tmp/ext_metadata && docker restart 1c-mcp-graph
```

Прогон создаёт объекты с `origin="extension"`, `extension_name=<Имя>` и связи EXTENDS/OVERRIDES с базой. BSL reconcile трогает только отсканированные модули — base-модули вне скана не удаляются. Нюансы:
- `EXTENSION_BASE_PROJECT` = `PROJECT_NAME` базовой конфигурации (у нас `LISmcp`).
- Исторический факт: Евротест и ЛОДЭ попали в граф иначе — при первичной индексации их отчёты уже лежали в `METADATA_HOST_PATH` и были распарсены как `origin="base"` без extension-связей. Работает для поиска, но EXTENDS/OVERRIDES у них нет. Повторный extension-прогон для них не делать без проверки на дубли (объекты уже есть под тем же filename).
- Полный reindex с очисткой чистит проект целиком, включая расширения — после него extension-прогоны нужно повторить.

## 1C:Enterprise Code Style

When generating 1C:Enterprise code through these MCP servers:
- Comments in Russian for business logic
- CamelCase for objects, snake_case for local variables
- 4-space indentation
- `"` for standard strings, `|` for multi-line string literals

## Network

All containers share the `mcp-deployment_default` Docker network.

## OpenSpec (Spec-Driven Development)

This project uses [OpenSpec](https://github.com/Fission-AI/OpenSpec) for structured change management. Slash commands:

- `/opsx:propose "idea"` — Create a new change proposal (generates `openspec/changes/<name>/` with proposal.md, specs/, design.md, tasks.md)
- `/opsx:apply` — Implement tasks from the current proposal
- `/opsx:archive` — Archive completed changes
- `/opsx:explore` — Explore existing specs

## Reference Documentation

- Full MCP server docs: https://docs.onerpa.ru/mcp-servery-1c
- 1C cursor rules (must include in project rules): https://github.com/comol/cursor_rules_1c
- Distribution files: `MCP_Distr/` (актуальный AI-first дистрибутив с `INSTALL.md` и `config.env` от 15.04.2026; точка входа — `MCP_Distr/INSTALL.md`)
- Личный кабинет (ротация лицензионных ключей): https://vibecoding1c.ru/

## Vendor Update Workflow (с мая 2026)

После большого вендорского релиза 15.04.2026:
- Фоновое обновление индексов и fallback во время индексации работают — `RESET_DATABASE=false` обычно достаточно
- Ключи обновляются **реактивно**: `docker compose pull && up -d`, и только если в логах появилось `Invalid LICENSE_KEY` — обновлять `LICENSE_KEY_*` в `.env` из `MCP_Distr/config.env` (с маппингом имён: alcor `LICENSE_KEY_DOCS` ↔ vendor `LICENSE_KEY_HELP`, alcor `LICENSE_KEY_METADATA` ↔ vendor `LICENSE_KEY_CODEMETADATA`)
- Образы `:latest` содержат локальную модель E5, но при `OPENAI_EMBEDDING_MODEL=qwen/qwen3-embedding-8b` в `.env` фактически работают на cloud-embeddings — локальная модель не используется

## Источники данных 1С (mai 2026)

Источники для синхронизации на alcor — раздельные:
- Отчёты: `~/LISmcp/report/` (в т.ч. `ОтчетПоКонфигурации.txt`, `ОтчетПоРасширениюЕвротест.txt`, `ОтчетПоРасширениюЛОДЭ.txt`)
- Основная конфигурация: `~/Проекты/ЛИС1С/` (каталог выгрузки из Конфигуратора, **не git**)
- Расширение Евротест: `~/Проекты/ЕвротестРасширение/` (git-проект-выгрузка)
- Расширение ЛОДЭ: пока без отдельного git-проекта (на alcor — снимок от 21.03.2026)

При rsync на alcor:
- `~/LISmcp/report/` → `alcor:~/mcp/LISreport/`
- `~/Проекты/ЛИС1С/` → `alcor:~/mcp/LISfiles/`
- `~/Проекты/ЕвротестРасширение/` → `alcor:~/mcp/extensions/Евротест/`

ВАЖНО при `--delete`:
- Использовать whitelist стандартных 1С-структур (Catalogs, Documents, ... — список в openspec changes), НЕ blacklist (в git-проектах есть много dev-артефактов вплоть до больших файлов)
- Защищать `business_info.html` через `--exclude='business_info.html'` ПЕРЕД whitelist'ом — это артефакты Graph-сервера, ~1300+ файлов, генерируются через LLM-запросы к OpenRouter
