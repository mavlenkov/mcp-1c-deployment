## 1. Скрипт переиндексации

- [x] 1.1 Создать `mcp-deployment/scripts/reindex.sh` с поддержкой `--all`, `--servers <list>`, `--yes`, `--help`
- [x] 1.2 Реализовать логику: перезапуск выбранных контейнеров с `RESET_DATABASE=true` (через docker compose up -d с override env)
- [x] 1.3 Добавить подтверждение перед запуском и информацию о примерном времени

## 2. Поддержка расширений

- [x] 2.1 Добавить `EXTENSIONS_PATH` в `.env.example` и `.env` (по умолчанию `${DATA_DIR}/extensions`)
- [x] 2.2 Добавить volume mount для расширений в `docker-compose.yml` (CodeMetadata) и `docker-compose.cloud.yml` (CloudEmbeddings)
- [x] 2.3 Добавить volume mount для расширений в `docker-compose.graph.yml` (Graph server)
- [x] 2.4 Протестировать на alcor: создать каталог расширений, проверить что серверы видят файлы из него

## 3. Деплой и тестирование

- [x] 3.1 Скопировать обновлённые файлы на alcor
- [x] 3.2 Протестировать `reindex.sh --servers templates` на alcor (быстрее для теста)
- [x] 3.3 Проверить что переиндексация запускается и завершается корректно

## 4. Документация

- [x] 4.1 Добавить раздел «Обновление конфигурации» в CLAUDE.md с пошаговой инструкцией
- [x] 4.2 Добавить раздел «Расширения конфигурации» в CLAUDE.md
- [x] 4.3 Обновить AGENTS.md с информацией о reindex.sh и расширениях
