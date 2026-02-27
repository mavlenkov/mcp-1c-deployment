#!/bin/bash
set -e

echo "=== Запуск MCP серверов ==="

# Проверка наличия .env файла
if [ ! -f .env ]; then
    echo "Ошибка: файл .env не найден!"
    echo "Выполните: cp .env.example .env && nano .env"
    exit 1
fi

# Загрузка переменных окружения
export $(cat .env | grep -v '^#' | xargs)

# Запуск основных серверов
echo "Запуск основных MCP серверов..."
docker compose up -d

# Запуск Graph metadata search с Neo4j
echo "Запуск Graph metadata search с Neo4j..."
docker compose -f docker-compose.graph.yml up -d

# Запуск Forms server
echo "Запуск Forms server..."
docker compose -f docker-compose.forms.yml up -d

# Запуск CloudEmbeddingsServer (если не конфликтует с CodeMetadataSearchServer)
if [ -f docker-compose.cloud.yml ]; then
    # Проверяем, запущен ли CodeMetadataSearchServer на порту 8000
    if docker ps --format '{{.Names}}' | grep -q '1c-mcp-metadata'; then
        echo "ПРОПУСК: CloudEmbeddingsServer — порт 8000 занят CodeMetadataSearchServer"
        echo "  Для использования CloudEmbeddings остановите metadata: docker compose stop 1c-metadata"
    else
        echo "Запуск CloudEmbeddingsServer..."
        docker compose -f docker-compose.cloud.yml up -d
    fi
fi

echo ""
echo "=== Все MCP серверы запущены ==="
echo ""
echo "Проверьте статус: ./scripts/status.sh"
echo "Логи: ./scripts/logs.sh <имя_контейнера>"
echo ""
echo "Доступные контейнеры:"
echo "  1c-mcp-docs, 1c-mcp-syntax, 1c-mcp-metadata"
echo "  1c-mcp-ssl, 1c-mcp-templates, 1c-mcp-codechecker"
echo "  1c-mcp-graph, 1c-mcp-neo4j, 1c-mcp-forms"
echo "  1c-mcp-cloud (если запущен)"
