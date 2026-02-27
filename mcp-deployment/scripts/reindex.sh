#!/bin/bash
# Переиндексация MCP-серверов при обновлении конфигурации 1С
# Использование: ./scripts/reindex.sh [--all | --servers <список>] [--yes]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# Проверка .env
if [ ! -f .env ]; then
    echo "Ошибка: файл .env не найден!"
    exit 1
fi

# Доступные серверы для переиндексации и их compose-файлы
declare -A SERVER_COMPOSE=(
    ["metadata"]="docker-compose.yml:1c-metadata"
    ["docs"]="docker-compose.yml:1c-docs"
    ["ssl"]="docker-compose.yml:1c-ssl"
    ["templates"]="docker-compose.yml:1c-templates"
    ["graph"]="docker-compose.graph.yml:1c-graph-metadata"
    ["cloud"]="docker-compose.cloud.yml:1c-cloud-embeddings"
    ["forms"]="docker-compose.forms.yml:1c-forms"
)

declare -A SERVER_DESCRIPTION=(
    ["metadata"]="CodeMetadataSearchServer (код и метаданные, ~1-3 часа)"
    ["docs"]="HelpSearchServer (справка платформы, ~1-2 часа)"
    ["ssl"]="SSLSearchServer (справка БСП, ~30 мин-1 час)"
    ["templates"]="TemplatesSearchServer (шаблоны, ~5-15 мин)"
    ["graph"]="Graph metadata search (граф метаданных, ~1-4 часа)"
    ["cloud"]="CloudEmbeddingsServer (облачные embeddings, зависит от API)"
    ["forms"]="FormsServer (формы, ~10-30 мин)"
)

# Серверы, которые обычно нужно переиндексировать при обновлении конфигурации
CONFIG_SERVERS="metadata graph"

show_help() {
    echo "Переиндексация MCP-серверов при обновлении конфигурации 1С"
    echo ""
    echo "Использование:"
    echo "  ./scripts/reindex.sh --all              Переиндексировать все серверы"
    echo "  ./scripts/reindex.sh --config           Серверы, зависящие от конфигурации (metadata, graph)"
    echo "  ./scripts/reindex.sh --servers <список> Указать серверы через запятую"
    echo "  ./scripts/reindex.sh --help             Показать эту справку"
    echo ""
    echo "Флаги:"
    echo "  --yes    Пропустить подтверждение"
    echo ""
    echo "Доступные серверы:"
    for server in "${!SERVER_DESCRIPTION[@]}"; do
        echo "  $server  — ${SERVER_DESCRIPTION[$server]}"
    done | sort
    echo ""
    echo "Примеры:"
    echo "  ./scripts/reindex.sh --config                  # После обновления конфигурации 1С"
    echo "  ./scripts/reindex.sh --servers metadata,graph   # Только metadata и graph"
    echo "  ./scripts/reindex.sh --servers ssl --yes        # SSL без подтверждения"
    echo ""
    echo "Процедура обновления конфигурации:"
    echo "  1. Экспортировать конфигурацию из 1С (Конфигуратор → Выгрузить в файлы)"
    echo "  2. Скопировать файлы в каталог CODE_PATH (см. .env)"
    echo "  3. Запустить: ./scripts/reindex.sh --config"
}

SERVERS=""
SKIP_CONFIRM=false

# Парсинг аргументов
while [[ $# -gt 0 ]]; do
    case $1 in
        --all)
            SERVERS=$(IFS=,; echo "${!SERVER_COMPOSE[*]}")
            shift
            ;;
        --config)
            SERVERS="$CONFIG_SERVERS"
            shift
            ;;
        --servers)
            SERVERS="${2//,/ }"
            shift 2
            ;;
        --yes|-y)
            SKIP_CONFIRM=true
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            echo "Неизвестный параметр: $1"
            echo "Используйте --help для справки"
            exit 1
            ;;
    esac
done

if [ -z "$SERVERS" ]; then
    show_help
    exit 0
fi

# Валидация серверов
for server in $SERVERS; do
    if [ -z "${SERVER_COMPOSE[$server]}" ]; then
        echo "Ошибка: неизвестный сервер '$server'"
        echo "Доступные: ${!SERVER_COMPOSE[*]}"
        exit 1
    fi
done

# Показать что будет переиндексировано
echo "=== Переиндексация MCP-серверов ==="
echo ""
echo "Будут переиндексированы:"
for server in $SERVERS; do
    echo "  • ${SERVER_DESCRIPTION[$server]}"
done
echo ""
echo "⚠  ВНИМАНИЕ: Переиндексация может занять от нескольких минут до нескольких часов."
echo "   Серверы будут недоступны во время индексации."
echo ""

# Подтверждение
if [ "$SKIP_CONFIRM" = false ]; then
    read -p "Продолжить? (y/n): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ] && [ "$confirm" != "д" ] && [ "$confirm" != "Д" ]; then
        echo "Отменено."
        exit 0
    fi
fi

# Переиндексация каждого сервера
for server in $SERVERS; do
    IFS=':' read -r compose_file service_name <<< "${SERVER_COMPOSE[$server]}"

    if [ ! -f "$compose_file" ]; then
        echo "⚠  Пропуск $server: файл $compose_file не найден"
        continue
    fi

    echo ""
    echo "--- Переиндексация: $server ($service_name) ---"

    # Остановить контейнер
    echo "  Остановка $service_name..."
    docker compose -f "$compose_file" stop "$service_name" 2>/dev/null || true

    # Запустить с RESET_DATABASE=true
    echo "  Запуск с RESET_DATABASE=true..."
    RESET_DATABASE=true docker compose -f "$compose_file" up -d "$service_name"

    echo "  ✓ $server запущен с переиндексацией"
    echo "  Следите за прогрессом: docker compose -f $compose_file logs -f $service_name"
done

echo ""
echo "=== Переиндексация запущена ==="
echo ""
echo "Мониторинг:"
for server in $SERVERS; do
    IFS=':' read -r compose_file service_name <<< "${SERVER_COMPOSE[$server]}"
    echo "  docker compose -f $compose_file logs -f $service_name"
done
echo ""
echo "После завершения индексации серверы автоматически начнут обслуживать запросы."
