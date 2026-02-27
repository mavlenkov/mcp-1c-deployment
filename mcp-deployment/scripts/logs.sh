#!/bin/bash
if [ -z "$1" ]; then
    echo "Использование: ./scripts/logs.sh <имя_контейнера>"
    echo ""
    echo "Доступные контейнеры:"
    echo "  1c-mcp-docs        - HelpSearchServer"
    echo "  1c-mcp-syntax      - SyntaxCheckServer"
    echo "  1c-mcp-metadata    - CodeMetadataSearchServer"
    echo "  1c-mcp-ssl        - SSLSearchServer"
    echo "  1c-mcp-templates  - TemplatesSearchServer"
    echo "  1c-mcp-codechecker - 1CCodeChecker"
    echo "  1c-mcp-graph      - GraphMetadataSearchServer"
    echo "  1c-mcp-neo4j      - Neo4j"
    echo "  1c-mcp-forms      - FormsServer"
    echo ""
    echo "Примеры:"
    echo "  ./scripts/logs.sh 1c-mcp-graph"
    echo "  ./scripts/logs.sh 1c-mcp-neo4j"
    exit 1
fi

if docker ps --format '{{.Names}}' | grep -q "^${1}$"; then
    echo "Логи контейнера $1 (Ctrl+C для выхода):"
    echo "====================================="
    docker logs -f "$1"
else
    echo "Ошибка: контейнер '$1' не найден или не запущен"
    echo "Запустите './scripts/status.sh' для списка активных контейнеров"
    exit 1
fi
