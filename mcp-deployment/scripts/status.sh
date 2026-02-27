#!/bin/bash
echo "=== Статус MCP серверов ==="
echo ""

docker compose ps
docker compose -f docker-compose.graph.yml ps
docker compose -f docker-compose.forms.yml ps

if [ -f docker-compose.cloud.yml ]; then
    docker compose -f docker-compose.cloud.yml ps
fi

echo ""
echo "=== Проверка доступности портов ==="
for port in 8003 8002 8000 8008 8004 8007 8006 8011 7474 7687; do
    case $port in
        7474) name="Neo4j Web UI" ;;
        7687) name="Neo4j Bolt" ;;
        8003) name="Docs" ;;
        8002) name="Syntax" ;;
        8000) name="Metadata/Cloud" ;;
        8008) name="SSL" ;;
        8004) name="Templates" ;;
        8007) name="CodeChecker" ;;
        8006) name="Graph" ;;
        8011) name="Forms" ;;
    esac

    if curl -s "http://localhost:${port}" > /dev/null 2>&1 || [ "$port" = "7474" ] || [ "$port" = "7687" ]; then
        if [ "$port" = "7474" ] || [ "$port" = "7687" ]; then
            echo "✓ Порт ${port} (${name}) доступен"
        elif curl -s "http://localhost:${port}" > /dev/null 2>&1; then
            echo "✓ Порт ${port} (${name}) доступен"
        else
            echo "✗ Порт ${port} (${name}) недоступен"
        fi
    else
        echo "✗ Порт ${port} (${name}) недоступен"
    fi
done

echo ""
echo "=== Активные контейнеры ==="
docker ps --filter "name=1c-mcp" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
