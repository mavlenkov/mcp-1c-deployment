# MCP-серверы для 1С:Enterprise

Набор Docker-контейнеров, реализующих протокол [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) для разработки на платформе 1С:Enterprise.

MCP-серверы расширяют возможности AI-ассистентов (Cursor, Claude Code, Windsurf и др.), предоставляя им доступ к вашей конфигурации 1С: метаданным, коду модулей, справке платформы, библиотеке стандартных подсистем (БСП), шаблонам кода и инструментам проверки. Благодаря этому AI-помощник работает с платформой как опытный 1С-разработчик — понимает структуру конфигурации, находит нужные объекты и процедуры, проверяет синтаксис и генерирует код по стандартам.

Этот репозиторий содержит готовую deployment-конфигурацию: Docker Compose файлы, скрипты управления и systemd-юниты. Серверы запускаются из готовых образов [`comol/*`](https://hub.docker.com/u/comol) — сборка не требуется.

> **Предупреждение:** Данная конфигурация не предназначена для использования в рабочих (production) системах. Конфигурация не прошла полноценного тестирования. Использование — на свой страх и риск.

> **Документация:** [docs.onerpa.ru/mcp-servery-1c](https://docs.onerpa.ru/mcp-servery-1c)

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

1. Выгрузить конфигурацию в файлы (Конфигуратор → Конфигурация → Выгрузить конфигурацию в файлы) в каталог `CODE_PATH`
2. Сформировать отчёт по конфигурации (Конфигуратор → Конфигурация → Отчёт по конфигурации → Сохранить) в каталог `METADATA_HOST_PATH`
3. Запустить переиндексацию:

```bash
./scripts/reindex.sh --config              # Серверы конфигурации (metadata, graph)
./scripts/reindex.sh --servers ssl,templates  # Конкретные серверы
./scripts/reindex.sh --all --yes           # Все серверы без подтверждения
```

## Расширения конфигурации

Расширения 1С индексируются наряду с основной конфигурацией:

1. Выгрузить расширения в файлы (Конфигуратор → Расширения → Выгрузить в файлы) — каждое в подкаталог `EXTENSIONS_PATH`
2. Сформировать отчёт по расширению (Конфигуратор → Расширения → Отчёт по расширению → Сохранить) — положить `.txt` файл в `METADATA_HOST_PATH` рядом с основным отчётом
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

Для подключения MCP-серверов к AI-ассистенту создайте конфигурационный файл со списком серверов. Подключайте только те серверы, которые вам нужны — остальные можно удалить из конфигурации.

> **Важно:** CloudEmbeddingsServer и CodeMetadataSearchServer используют один порт (8000) и не могут работать одновременно. Подключайте только один из них.

### Полный пример конфигурации

```json
{
  "mcpServers": {
    "1c-help": {
      "url": "http://localhost:8003/mcp"
    },
    "1c-graph-metadata": {
      "url": "http://localhost:8006/mcp"
    },
    "1c-metadata": {
      "url": "http://localhost:8000/mcp"
    },
    "1c-ssl": {
      "url": "http://localhost:8008/mcp"
    },
    "1c-templates": {
      "url": "http://localhost:8004/mcp"
    },
    "1c-syntax": {
      "url": "http://localhost:8002/mcp"
    },
    "1c-codechecker": {
      "url": "http://localhost:8007/mcp"
    },
    "1c-forms": {
      "url": "http://localhost:8011/mcp"
    }
  }
}
```

### Куда поместить файл конфигурации

| IDE | Файл | Примечание |
|-----|------|------------|
| **Cursor** | `.cursor/mcp.json` в корне проекта | Создайте каталог `.cursor/` если его нет |
| **Claude Code** | Настройки проекта или `~/.claude.json` | Через команду `/mcp` в интерфейсе Claude Code |
| **Windsurf** | `~/.codeium/windsurf/mcp_config.json` | Глобальная конфигурация |

Если серверы развёрнуты на удалённом хосте, замените `localhost` на IP-адрес или hostname сервера.

## Документация

- [Официальная документация MCP-серверов](https://docs.onerpa.ru/mcp-servery-1c) — подробные инструкции по каждому серверу
- [Cursor Rules для 1С](https://github.com/comol/cursor_rules_1c) — правила для генерации кода 1С
