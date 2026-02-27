#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SYSTEMD_DIR="${PROJECT_DIR}/systemd"

echo "=== Установка systemd сервисов ==="

# Проверка прав root
if [ "$EUID" -ne 0 ]; then
    echo "Для установки systemd сервисов требуются права root"
    echo "Используйте: sudo ./scripts/install-services.sh"
    exit 1
fi

# Проверка наличия systemd
if ! command -v systemctl &> /dev/null; then
    echo "Ошибка: systemd не найден на этой системе"
    exit 1
fi

# Проверка наличия папки systemd
if [ ! -d "$SYSTEMD_DIR" ]; then
    echo "Ошибка: директория systemd не найдена: $SYSTEMD_DIR"
    exit 1
fi

# Проверка .env файла
if [ ! -f "${PROJECT_DIR}/.env" ]; then
    echo "Ошибка: файл .env не найден в ${PROJECT_DIR}"
    echo "Сначала создайте его: cp .env.example .env"
    exit 1
fi

# Копирование юнит-файлов
echo "Установка systemd юнит-файлов..."
for service_file in "${SYSTEMD_DIR}"/*.service; do
    if [ -f "$service_file" ]; then
        service_name=$(basename "$service_file")
        echo "  Установка ${service_name}..."
        cp "$service_file" /etc/systemd/system/
    fi
done

# Замена пути к проекту в юнит-файлах
echo "Обновление путей в юнит-файлах..."
sed -i "s|WorkingDirectory=/opt/mcp|WorkingDirectory=${PROJECT_DIR}|g" /etc/systemd/system/1c-mcp-*.service

# Перезагрузка systemd
systemctl daemon-reload

echo ""
echo "=== Сервисы установлены ==="
echo ""
echo "Доступные команды для управления:"
echo "  systemctl start 1c-mcp-graph       # Запуск Graph metadata"
echo "  systemctl start 1c-mcp-neo4j       # Запуск Neo4j"
echo "  systemctl start 1c-mcp-docs        # Запуск Docs search"
echo "  systemctl start 1c-mcp-syntax      # Запуск Syntax checker"
echo "  systemctl start 1c-mcp-metadata    # Запуск Metadata search"
echo "  systemctl start 1c-mcp-ssl         # Запуск SSL search"
echo "  systemctl start 1c-mcp-templates   # Запуск Templates search"
echo "  systemctl start 1c-mcp-codechecker # Запуск CodeChecker"
echo "  systemctl start 1c-mcp-forms       # Запуск Forms server"
echo ""
echo "Для автозапуска при загрузке системы:"
echo "  systemctl enable 1c-mcp-graph"
echo "  systemctl enable 1c-mcp-docs"
echo "  ... (аналогично для других сервисов)"
echo ""
echo "Просмотр логов:"
echo "  journalctl -u 1c-mcp-graph -f"
