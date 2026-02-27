# MCP Серверы для 1C:Enterprise - Автоматизированное развёртывание

Эта папка содержит все необходимые файлы для автоматизированного развёртывания MCP серверов через Docker Compose и systemd.

## Структура папки

```
mcp-deployment/
├── .env.example                  # Шаблон конфигурационного файла
├── docker-compose.yml            # Основные MCP серверы
├── docker-compose.graph.yml      # Graph metadata search с Neo4j
├── docker-compose.forms.yml      # FormsServer
├── README.md                    # Инструкция по развёртыванию
├── scripts/                     # Скрипты управления
│   ├── setup.sh                # Первичная настройка
│   ├── start.sh                # Запуск всех серверов
│   ├── stop.sh                 # Остановка всех серверов
│   ├── restart.sh              # Перезапуск
│   ├── status.sh               # Статус сервисов
│   ├── logs.sh                 # Просмотр логов
│   └── install-services.sh      # Установка systemd сервисов
└── systemd/                    # Systemd юнит-файлы
    ├── 1c-mcp-neo4j.service
    ├── 1c-mcp-graph.service
    ├── 1c-mcp-docs.service
    ├── 1c-mcp-syntax.service
    ├── 1c-mcp-metadata.service
    ├── 1c-mcp-ssl.service
    ├── 1c-mcp-templates.service
    ├── 1c-mcp-codechecker.service
    └── 1c-mcp-forms.service
```

## Быстрый старт

### 1. Настройка конфигурации

```bash
# Переход в папку развертывания
cd /home/l7777/Проекты/mcp/mcp-deployment

# Создание .env файла из шаблона
cp .env.example .env

# Редактирование .env (укажите OPENAI_API_KEY и другие параметры)
nano .env
```

**Обязательные параметры:**
- `OPENAI_API_KEY` - ключ от OpenRouter
- `1C_BIN_PATH` - путь к платформе 1С (например, `/opt/1cv8/x86_64/8.3.27.1859`)

### 2. Подготовка данных

Скопируйте файлы метаданных в директорию `${DATA_DIR}` (по умолчанию `/opt/mcp-data`):

```bash
# Создание структуры директорий
mkdir -p /opt/mcp-data/{report,files,ssl,templates}

# Копирование ваших файлов
cp -r /path/to/ОтчетПоКонфигурации.txt /opt/mcp-data/report/
cp -r /path/to/ВыгрузкаКонфигурации/* /opt/mcp-data/files/
# (опционально) cp -r /path/to/БСП /opt/mcp-data/ssl/
# (опционально) cp -r /path/to/шаблоны /opt/mcp-data/templates/
```

### 3. Запуск серверов

#### Вариант A: Через скрипты

```bash
# Первичная проверка окружения
./scripts/setup.sh

# Запуск всех серверов
./scripts/start.sh

# Проверка статуса
./scripts/status.sh

# Просмотр логов
./scripts/logs.sh 1c-mcp-graph
```

#### Вариант B: Через systemd (автозапуск)

```bash
# Установка systemd сервисов (требует root)
sudo ./scripts/install-services.sh

# Запуск всех сервисов
sudo systemctl start 1c-mcp-neo4j 1c-mcp-graph
sudo systemctl start 1c-mcp-docs 1c-mcp-syntax
sudo systemctl start 1c-mcp-metadata 1c-mcp-ssl
sudo systemctl start 1c-mcp-templates 1c-mcp-codechecker 1c-mcp-forms

# Включение автозапуска при загрузке
sudo systemctl enable 1c-mcp-graph
sudo systemctl enable 1c-mcp-docs
# ... (аналогично для других сервисов)
```

## MCP Серверы

| Порт | Контейнер | Описание |
|------|------------|----------|
| 7474, 7687 | 1c-mcp-neo4j | Neo4j графовая БД |
| 8006 | 1c-mcp-graph | Графовый поиск по метаданным |
| 8003 | 1c-mcp-docs | Справка по платформе 1С |
| 8002 | 1c-mcp-syntax | Проверка синтаксиса BSL |
| 8000 | 1c-mcp-metadata | Поиск по метаданным и коду |
| 8008 | 1c-mcp-ssl | Справка по БСП |
| 8004 | 1c-mcp-templates | Поиск шаблонов кода |
| 8007 | 1c-mcp-codechecker | Проверка через 1С:Напарник |
| 8011 | 1c-mcp-forms | Контекст для генерации форм |

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
    }
  }
}
```

## Управление

| Скрипт | Описание |
|---------|----------|
| `./scripts/start.sh` | Запуск всех MCP серверов |
| `./scripts/stop.sh` | Остановка всех серверов |
| `./scripts/restart.sh` | Перезапуск |
| `./scripts/status.sh` | Статус сервисов |
| `./scripts/logs.sh <name>` | Логи указанного контейнера |
| `./scripts/setup.sh` | Первичная настройка окружения |
| `./scripts/install-services.sh` | Установка systemd сервисов |

## Устранение проблем

### Контейнер не запускается

```bash
./scripts/status.sh
./scripts/logs.sh 1c-mcp-graph
```

### Проблемы с индексацией

Индексация может занять от нескольких минут до нескольких часов. Мониторьте через `docker logs`.

### API Key ошибки

Проверьте, что `OPENAI_API_KEY` задан в `.env`.

## Оригинальные инструкции

Полная инструкция находится в файле `README.md`.
Оригинальные инструкции по каждому серверу находятся в соседней папке `../MCP_Distr/`.
