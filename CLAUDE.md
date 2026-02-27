# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository manages Docker-based MCP (Model Context Protocol) servers for 1C:Enterprise development. All servers run as Docker containers from pre-built `comol/*` images — there is no application source code to build here, only deployment configuration.

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

## Environment Configuration

Configuration lives in `.env` files (copy from `.env.example`). Key variables:
- `OPENAI_API_KEY` / `OPENAI_API_BASE` / `OPENAI_MODEL` — Used for embeddings (typically via OpenRouter)
- `LICENSE_KEY_*` — Per-server license keys
- `DATA_DIR` — Base path for persistent data (default `/opt/mcp-data`)
- `METADATA_HOST_PATH`, `CODE_PATH`, `SSL_PATH` — Paths to 1C configuration exports
- `USESSE` — Enable SSE transport for legacy MCP clients
- `RESET_DATABASE` / `RESET_CACHE` — Force reindex on startup

## Обновление конфигурации 1С

При обновлении конфигурации 1С необходимо переиндексировать MCP-серверы:

1. Экспортировать конфигурацию из Конфигуратора (Конфигурация → Выгрузить конфигурацию в файлы)
2. Скопировать файлы в каталог `CODE_PATH` (см. `.env`, по умолчанию `/opt/mcp-data/files`)
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

1. Экспортировать расширения из Конфигуратора (Конфигурация → Расширения → Выгрузить в файлы)
2. Поместить каждое расширение в отдельный подкаталог в `EXTENSIONS_PATH` (по умолчанию `/opt/mcp-data/extensions`)
3. Переиндексировать серверы: `./scripts/reindex.sh --config`

Расширения монтируются как read-only volume в контейнеры CodeMetadataSearchServer, CloudEmbeddingsServer и Graph metadata search.

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
- Distribution files with per-server setup instructions: `MCP_Distr/`
