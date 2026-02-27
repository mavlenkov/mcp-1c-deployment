# MCP-серверы для 1С:Enterprise

Deployment-конфигурация Docker-контейнеров [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) серверов для разработки на платформе 1С:Enterprise. Серверы предоставляют AI-ассистентам (Cursor, Claude Code, Windsurf и др.) доступ к метаданным, коду, справке и инструментам проверки.

## Серверы

| Сервер | Порт | Назначение |
|--------|------|------------|
| **HelpSearchServer** | 8003 | Справка по платформе 1С для вашей версии |
| **Graph_metadata_search** | 8006 | Графовый поиск по метаданным (Neo4j) |
| **CodeMetadataSearchServer** | 8000 | Поиск по метаданным и коду конфигурации |
| **SSLSearchServer** | 8008 | Справка по БСП (Библиотека стандартных подсистем) |
| **TemplatesSearchServer** | 8004 | Поиск шаблонов кода |
| **SyntaxCheckServer** | 8002 | Проверка синтаксиса (BSL Language Server) |
| **1CCodeChecker** | 8007 | Проверка кода через 1С:Напарник |
| **FormsServer** | 8011 | Контекст для генерации форм |
| **CloudEmbeddingsServer** | 8000 | Облачные параллельные embeddings (альтернатива CodeMetadata) |

Все MCP-эндпоинты: `http://localhost:<порт>/mcp`

## Быстрый старт

### Требования

- Docker и Docker Compose
- Лицензионные ключи MCP-серверов (приобретаются отдельно)
- API-ключ OpenRouter / OpenAI (для embeddings)
- Выгрузка конфигурации 1С в файлы

### Установка

```bash
cd mcp-deployment

# 1. Создать файл конфигурации
cp .env.example .env
# Отредактировать .env: заполнить пути, ключи, пароли

# 2. Проверить окружение
./scripts/setup.sh

# 3. Запустить серверы
./scripts/start.sh

# 4. Проверить статус
./scripts/status.sh
```

### Управление

```bash
./scripts/start.sh          # Запуск всех серверов
./scripts/stop.sh           # Остановка
./scripts/restart.sh        # Перезапуск
./scripts/status.sh         # Статус и порты
./scripts/logs.sh <имя>     # Логи контейнера (например, 1c-mcp-graph)
```

## Обновление конфигурации 1С

При обновлении конфигурации 1С необходимо переиндексировать серверы:

1. Экспортировать конфигурацию (Конфигуратор -> Выгрузить в файлы)
2. Скопировать файлы в каталог `CODE_PATH` (см. `.env`)
3. Запустить переиндексацию:

```bash
./scripts/reindex.sh --config              # Серверы конфигурации (metadata, graph)
./scripts/reindex.sh --servers ssl,templates  # Конкретные серверы
./scripts/reindex.sh --all --yes           # Все серверы без подтверждения
```

## Расширения конфигурации

Расширения 1С индексируются наряду с основной конфигурацией:

1. Экспортировать расширения (Конфигуратор -> Расширения -> Выгрузить в файлы)
2. Поместить каждое расширение в подкаталог `EXTENSIONS_PATH` (по умолчанию `/opt/mcp-data/extensions`)
3. Переиндексировать: `./scripts/reindex.sh --config`

## Структура проекта

```
mcp-deployment/                    # Основной deployment (рекомендуется)
  docker-compose.yml               # Базовые серверы (docs, syntax, metadata, ssl, templates, codechecker)
  docker-compose.graph.yml         # Graph metadata + Neo4j
  docker-compose.forms.yml         # FormsServer
  docker-compose.cloud.yml         # CloudEmbeddingsServer
  .env.example                     # Шаблон конфигурации
  scripts/                         # Скрипты управления
FormsServer/                       # Standalone FormsServer (из дистрибутива)
Graph_metadata_search/             # Standalone Graph metadata (из дистрибутива)
```

## Подключение к IDE

Добавьте в конфигурацию MCP вашего редактора:

```json
{
  "mcpServers": {
    "1c-graph-metadata": {
      "url": "http://localhost:8006/mcp"
    },
    "1c-help": {
      "url": "http://localhost:8003/mcp"
    },
    "1c-syntax": {
      "url": "http://localhost:8002/mcp"
    }
  }
}
```

## Документация

- [Документация MCP-серверов](https://docs.onerpa.ru/mcp-servery-1c)
- [Cursor Rules для 1С](https://github.com/comol/cursor_rules_1c)
