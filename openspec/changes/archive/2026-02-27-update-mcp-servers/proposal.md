## Why

Получен обновлённый дистрибутив MCP-серверов (февраль 2026), содержащий обновлённые лицензионные ключи для всех серверов, новые параметры конфигурации и новый сервер CloudEmbeddingsServer. Текущие docker-compose файлы в `mcp-deployment/` используют устаревшие ключи и не включают CloudEmbeddingsServer. Необходимо привести деплоймент в соответствие с актуальным дистрибутивом, добавить новый сервер и проверить работоспособность на сервере alcor.

## What Changes

- Обновить лицензионные ключи во всех `.env` файлах в соответствии с новым дистрибутивом (`MCP_Distr/`)
- Добавить CloudEmbeddingsServer (`comol/1c_cloud_mcp_parallel`) как опциональный compose-файл в `mcp-deployment/`
- Обновить `docker-compose.graph.yml` по новому дистрибутиву (новые env-переменные: `OPENAI_EMBEDDING_API_KEY`, `OPENAI_EMBEDDING_API_BASE`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_TEMPERATURE`, `OPENAI_MAX_COMPLETION_TOKENS`)
- Обновить скрипты `start.sh`/`stop.sh`/`restart.sh`/`status.sh` для поддержки CloudEmbeddingsServer
- Обновить `CLAUDE.md` и `AGENTS.md` с актуальной информацией
- Развернуть обновления на сервере alcor, сохранив существующие данные индексации
- Проверить работоспособность всех серверов

## Capabilities

### New Capabilities
- `cloud-embeddings-server`: Добавление CloudEmbeddingsServer — облачного сервера параллельных embeddings с поддержкой множества провайдеров (openrouter, openai, cohere, jina, local) и параллельной индексации

### Modified Capabilities
<!-- нет изменений на уровне спецификаций существующих серверов — только обновление конфигурации -->

## Impact

- **Конфигурация**: обновление `.env`, `.env.example` в `mcp-deployment/`, новый `docker-compose.cloud.yml`
- **Скрипты**: `mcp-deployment/scripts/*.sh` — добавление управления новым сервером
- **Документация**: `CLAUDE.md`, `AGENTS.md`
- **Сервер alcor**: обновление образов, перезапуск контейнеров (с сохранением volume mounts)
- **Риски**: потеря данных индексации при неаккуратном обновлении (часы/дни переиндексации)
