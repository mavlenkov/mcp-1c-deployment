# MCP Серверы для 1C:Enterprise

Полноценная система управления MCP серверами для разработки на 1C:Enterprise.

## Быстрый старт

### 1. Подготовка окружения

```bash
# Установка Docker (если ещё не установлен)
# Ubuntu/Debian:
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Перезагрузка сессии для применения групп
newgrp docker
```

### 2. Клонирование и настройка

```bash
# Переход в директорию проекта
cd /home/l7777/Проекты/mcp

# Создание конфигурационного файла
cp .env.example .env

# Редактирование .env - заполните необходимые параметры
nano .env
```

**Обязательные параметры для заполнения:**
- `OPENAI_API_KEY` - ваш ключ от OpenRouter
- `1C_BIN_PATH` - путь к установленной платформе 1С

### 3. Подготовка данных

Пользователь должен вручную скопировать файлы в директорию `${DATA_DIR}` (по умолчанию `/opt/mcp-data`):

```bash
# Создание структуры директорий
mkdir -p /opt/mcp-data/{report,files,ssl,templates}

# Копирование файлов
cp -r /path/to/ОтчетПоКонфигурации.txt /opt/mcp-data/report/
cp -r /path/to/ВыгрузкаКонфигурации/* /opt/mcp-data/files/
# (опционально) cp -r /path/to/БСП_справка/* /opt/mcp-data/ssl/
# (опционально) cp -r /path/to/шаблоны/* /opt/mcp-data/templates/
```

### 4. Запуск

#### Вариант A: Вручную (скрипты)

```bash
# Первичная настройка
./scripts/setup.sh

# Запуск всех серверов
./scripts/start.sh

# Проверка статуса
./scripts/status.sh

# Просмотр логов
./scripts/logs.sh 1c-mcp-graph
```

#### Вариант B: Автоматически (systemd)

```bash
# Установка systemd сервисов (требует root)
sudo ./scripts/install-services.sh

# Запуск всех сервисов
sudo systemctl start 1c-mcp-neo4j 1c-mcp-graph
sudo systemctl start 1c-mcp-docs 1c-mcp-syntax
sudo systemctl start 1c-mcp-metadata 1c-mcp-ssl
sudo systemctl start 1c-mcp-templates 1c-mcp-codechecker 1c-mcp-forms

# Автозапуск при загрузке
sudo systemctl enable 1c-mcp-graph
sudo systemctl enable 1c-mcp-docs
# ... и так далее для каждого сервиса
```

## MCP Серверы

| Сервер | Порт | Описание | Очерёдность запуска |
|--------|------|----------|---------------------|
| 1c-mcp-neo4j | 7474, 7687 | Графовая база данных | 1 |
| 1c-mcp-graph | 8006 | Графовый поиск по метаданным (рекомендуется) | 2 |
| 1c-mcp-metadata | 8000 | Поиск по метаданным и коду конфигурации | Любой |
| 1c-mcp-docs | 8003 | Справка по платформе 1С | Любой |
| 1c-mcp-syntax | 8002 | Проверка синтаксиса BSL | Любой |
| 1c-mcp-ssl | 8008 | Справка по БСП | Любой |
| 1c-mcp-templates | 8004 | Поиск шаблонов кода | Любой |
| 1c-mcp-codechecker | 8007 | Проверка кода через 1С:Напарник | Любой |
| 1c-mcp-forms | 8011 | Контекст для генерации форм | Любой |

## Интеграция с Cursor

Добавьте в `~/.config/Cursor/User/mcp.json`:

```json
{
  "mcpServers": {
    "1c-graph-metadata": {
      "url": "http://localhost:8006/mcp",
      "connection_id": "graph_metadata_001"
    },
    "1c-docs": {
      "url": "http://localhost:8003/mcp",
      "connection_id": "docs_service_001"
    },
    "1c-syntax-checker": {
      "url": "http://localhost:8002/mcp",
      "connection_id": "syntax_check_001"
    },
    "1c-metadata": {
      "url": "http://localhost:8000/mcp",
      "connection_id": "metadata_service_001"
    }
  }
}
```

## Управление

### Скрипты

| Команда | Описание |
|---------|----------|
| `./scripts/setup.sh` | Первичная проверка окружения и создание директорий |
| `./scripts/start.sh` | Запуск всех MCP серверов |
| `./scripts/stop.sh` | Остановка всех MCP серверов |
| `./scripts/restart.sh` | Перезапуск всех серверов |
| `./scripts/status.sh` | Статус серверов и проверка портов |
| `./scripts/logs.sh <name>` | Логи указанного контейнера |
| `./scripts/install-services.sh` | Установка systemd сервисов (требует root) |

### Systemd

```bash
# Управление отдельным сервисом
sudo systemctl start 1c-mcp-graph
sudo systemctl stop 1c-mcp-graph
sudo systemctl restart 1c-mcp-graph
sudo systemctl status 1c-mcp-graph

# Просмотр логов
sudo journalctl -u 1c-mcp-graph -f

# Включение автозапуска
sudo systemctl enable 1c-mcp-graph
```

## Структура проекта

```
mcp/
├── .env                      # Конфигурационный файл (создаётся пользователем)
├── .env.example              # Шаблон конфигурации
├── docker-compose.yml        # Основные MCP серверы
├── docker-compose.graph.yml  # Graph_metadata_search с Neo4j
├── docker-compose.forms.yml  # FormsServer
├── scripts/                 # Скрипты управления
│   ├── setup.sh
│   ├── start.sh
│   ├── stop.sh
│   ├── restart.sh
│   ├── status.sh
│   ├── logs.sh
│   └── install-services.sh
├── systemd/                # Systemd юнит-файлы
│   ├── 1c-mcp-graph.service
│   ├── 1c-mcp-neo4j.service
│   └── ...
├── MCP_Distr/             # Оригинальные инструкции (сохранены)
├── Graph_metadata_search/  # Конфигурация Graph metadata (сохранена)
└── FormsServer/           # Конфигурация FormsServer (сохранена)
```

## Устранение проблем

### Контейнер не запускается

```bash
# Проверка логов
./scripts/logs.sh <container_name>

# Проверка Docker
docker ps -a

# Проверка статуса всех сервисов
./scripts/status.sh
```

### Проблемы с индексацией

Индексация может занять от нескольких минут до нескольких часов в зависимости от размера конфигурации. Мониторьте прогресс через `docker logs`.

```bash
# Просмотр логов индексации Graph metadata
./scripts/logs.sh 1c-mcp-graph

# Просмотр логов индексации Docs
./scripts/logs.sh 1c-mcp-docs
```

### API Key ошибки

Убедитесь, что `OPENAI_API_KEY` корректно указан в `.env` файле.

### Neo4j пароль

Если вы изменили `NEO4J_PASSWORD` в `.env`, убедитесь что Neo4j перезапущен:

```bash
./scripts/restart.sh
```

### Проблемы с доступом к файлам

Убедитесь, что пользователь имеет права на чтение файлов метаданных и выгрузки конфигурации:

```bash
ls -la /opt/mcp-data/
```

## Обновление Docker образов

Для получения последних версий контейнеров:

```bash
# Обновление образов
docker pull comol/1c_help_mcp:latest
docker pull comol/1c_syntaxcheck_mcp:latest
docker pull comol/1c_code_metadata_mcp:latest
docker pull comol/mcp_ssl_server:latest
docker pull comol/template-search-mcp:latest
docker pull comol/1c-code-checker:latest
docker pull comol/1c_forms:latest
docker pull comol/1c_graph_metadata:latest
docker pull neo4j:latest

# Перезапуск сервисов
./scripts/restart.sh
```

## Ссылки

- [MCP Documentation](https://modelcontextprotocol.io)
- [Cursor MCP Integration](https://docs.cursor.sh/features/mcp)
- [1C:Enterprise](https://1c-dn.com)
- [OpenRouter](https://openrouter.ai)
