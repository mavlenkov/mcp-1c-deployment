## 1. Обновление лицензионных ключей и конфигурации

- [x] 1.1 Обновить лицензионные ключи в `mcp-deployment/.env` и `.env.example` (NOTE: большинство старых ключей работают с новыми образами, кроме SSL и Templates — для них нужны ключи из нового дистрибутива)
- [x] 1.2 Добавить новые переменные окружения для CloudEmbeddingsServer в `.env.example`: `LICENSE_KEY_CLOUD`, `EMBEDDING_PROVIDER`, `EMBEDDING_CONCURRENCY`, `EMBEDDING_BATCH_SIZE`
- [x] 1.3 Обновить переменные graph server: добавить `OPENAI_EMBEDDING_API_KEY`, `OPENAI_EMBEDDING_API_BASE`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_TEMPERATURE`, `OPENAI_MAX_COMPLETION_TOKENS`

## 2. Docker Compose файлы

- [x] 2.1 Создать `mcp-deployment/docker-compose.cloud.yml` для CloudEmbeddingsServer (`comol/1c_cloud_mcp_parallel:latest`, порт 8000)
- [x] 2.2 Обновить `mcp-deployment/docker-compose.graph.yml` по новому дистрибутиву (новые env-переменные, healthcheck)
- [x] 2.3 Обновить корневой `docker-compose.yml` — синхронизировать env-переменные с актуальным дистрибутивом

## 3. Скрипты управления

- [x] 3.1 Обновить `mcp-deployment/scripts/start.sh` — добавить запуск CloudEmbeddingsServer (с проверкой конфликта порта 8000)
- [x] 3.2 Обновить `mcp-deployment/scripts/stop.sh` — добавить остановку CloudEmbeddingsServer
- [x] 3.3 Обновить `mcp-deployment/scripts/restart.sh` — добавить перезапуск CloudEmbeddingsServer
- [x] 3.4 Обновить `mcp-deployment/scripts/status.sh` — добавить отображение статуса CloudEmbeddingsServer

## 4. Деплой на сервер alcor

- [x] 4.1 Подключиться к alcor, найти текущий деплоймент и сделать бэкап `.env`
- [x] 4.2 Обновить docker-образы (`docker-compose pull`) для всех compose-файлов
- [x] 4.3 Скопировать обновлённые файлы конфигурации на alcor
- [x] 4.4 Перезапустить контейнеры с сохранением volumes (без `RESET_DATABASE`)
- [x] 4.5 Добавить и запустить CloudEmbeddingsServer (если нужен вместо CodeMetadataSearchServer)

## 5. Проверка работоспособности

- [x] 5.1 Проверить health-эндпоинты всех серверов: `curl http://localhost:<port>/mcp`
- [x] 5.2 Проверить логи контейнеров на ошибки
- [x] 5.3 Исправить обнаруженные ошибки (SSL порт 8009→8008, SSL и Templates требовали новые ключи из дистрибутива)

## 6. Документация

- [x] 6.1 Обновить `CLAUDE.md` с актуальной информацией о серверах и ключах
- [x] 6.2 Обновить `AGENTS.md` с информацией о CloudEmbeddingsServer
