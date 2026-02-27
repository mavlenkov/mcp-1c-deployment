## Context

MCP-серверы развёрнуты на сервере alcor (~/mcp, пользователь l7777). Текущий деплоймент в `mcp-deployment/` использует три docker-compose файла: основной (8 серверов), graph (Neo4j + graph server), forms. Получен обновлённый дистрибутив (февраль 2026) с новыми лицензионными ключами и новым сервером CloudEmbeddingsServer.

Данные индексации хранятся в примонтированных volumes (`/opt/mcp-data/*`). Переиндексация занимает часы/дни — потеря данных недопустима.

## Goals / Non-Goals

**Goals:**
- Обновить лицензионные ключи в `.env` по новому дистрибутиву
- Добавить CloudEmbeddingsServer как отдельный compose-файл (`docker-compose.cloud.yml`)
- Обновить конфигурацию graph server (новые env-переменные embedding API)
- Обновить скрипты управления для нового сервера
- Обновить образы и перезапустить контейнеры на alcor без потери данных
- Проверить работоспособность всех эндпоинтов (`/mcp`)

**Non-Goals:**
- Миграция с docker-compose на другую оркестрацию
- Изменение существующей структуры директорий данных
- Добавление мониторинга или алертинга
- Переход на другой embedding-провайдер (остаётся OpenRouter)

## Decisions

### 1. CloudEmbeddingsServer как отдельный compose-файл
CloudEmbeddingsServer использует порт 8000, который занят CodeMetadataSearchServer. Эти серверы взаимоисключающие (Cloud — альтернатива Code). Отдельный `docker-compose.cloud.yml` позволяет запускать один из них.

**Альтернатива**: добавить оба в основной compose с profiles — отвергнуто, т.к. profiles усложняют скрипты и не все версии compose их поддерживают.

### 2. Обновление ключей только в .env, не в compose-файлах
Ключи подставляются через переменные окружения из `.env`. Compose-файлы ссылаются на `${LICENSE_KEY_*}`. Менять нужно только `.env`.

### 3. Порядок обновления на alcor: pull → update env → restart
Сначала `docker pull` новых образов, затем обновление `.env`, затем restart. Volumes сохраняются автоматически при restart (не recreate с --volumes).

### 4. RESET_DATABASE=false при обновлении
Критически важно: при обновлении образов НЕ включать `RESET_DATABASE=true`, иначе все индексы будут пересозданы с нуля.

## Risks / Trade-offs

- **Конфликт портов 8000** → CloudEmbeddingsServer и CodeMetadataSearchServer не могут работать одновременно. Скрипты должны предотвращать запуск обоих.
- **Потеря индексов при recreate** → Использовать `docker-compose up -d` (не `--force-recreate --renew-anon-volumes`). Проверить, что `RESET_DATABASE=false` в `.env`.
- **Несовместимость новых образов со старыми индексами** → Маловероятно, но при проблемах — переиндексация отдельного сервера через `RESET_DATABASE=true` для него.
- **Sudo без пароля на alcor** → Все операции через docker (без sudo), sudo только для systemd если нужно.

## Migration Plan

1. Бэкап текущего `.env` на alcor
2. `docker-compose pull` для всех compose-файлов
3. Обновить `.env` (ключи, новые переменные)
4. Добавить `docker-compose.cloud.yml` и обновить скрипты
5. `docker-compose down && docker-compose up -d` для каждого compose-файла
6. Проверить health: `curl http://localhost:<port>/mcp` для каждого сервера
7. Rollback: восстановить `.env` из бэкапа, `docker-compose down && docker-compose up -d`
