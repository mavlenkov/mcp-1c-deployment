## ADDED Requirements

### Requirement: CloudEmbeddingsServer compose-файл
Система ДОЛЖНА предоставлять `docker-compose.cloud.yml` для запуска CloudEmbeddingsServer (`comol/1c_cloud_mcp_parallel:latest`) на порту 8000 с поддержкой embedding-провайдеров (openrouter, openai, cohere, jina, local) и параллельной индексации.

#### Scenario: Запуск CloudEmbeddingsServer через compose
- **WHEN** выполняется `docker-compose -f docker-compose.cloud.yml up -d` при остановленном CodeMetadataSearchServer
- **THEN** контейнер запускается на порту 8000 и эндпоинт `http://localhost:8000/mcp` отвечает

#### Scenario: CloudEmbeddingsServer с volume для индексов
- **WHEN** контейнер запущен с примонтированной директорией для ChromaDB
- **THEN** данные индексации сохраняются между перезапусками контейнера

### Requirement: Конфигурация CloudEmbeddingsServer через .env
`.env` ДОЛЖЕН содержать переменные для CloudEmbeddingsServer: `LICENSE_KEY_CLOUD`, `EMBEDDING_PROVIDER`, `EMBEDDING_CONCURRENCY`, `EMBEDDING_BATCH_SIZE`, а также использовать существующие `OPENAI_API_KEY`/`CODE_PATH`.

#### Scenario: Настройка провайдера embeddings
- **WHEN** в `.env` установлен `EMBEDDING_PROVIDER=openrouter` и `OPENAI_API_KEY` содержит валидный ключ OpenRouter
- **THEN** CloudEmbeddingsServer использует OpenRouter для генерации embeddings

### Requirement: Взаимоисключаемость с CodeMetadataSearchServer
CloudEmbeddingsServer и CodeMetadataSearchServer ДОЛЖНЫ использовать разные compose-файлы и НЕ ДОЛЖНЫ запускаться одновременно (оба слушают порт 8000).

#### Scenario: Предотвращение конфликта портов
- **WHEN** CodeMetadataSearchServer запущен на порту 8000 и пользователь пытается запустить CloudEmbeddingsServer
- **THEN** скрипт `start.sh` предупреждает о конфликте или автоматически запускает только один из них

### Requirement: Скрипты управления поддерживают CloudEmbeddingsServer
Скрипты `start.sh`, `stop.sh`, `restart.sh`, `status.sh` ДОЛЖНЫ поддерживать управление CloudEmbeddingsServer.

#### Scenario: Статус включает CloudEmbeddingsServer
- **WHEN** выполняется `./scripts/status.sh` и CloudEmbeddingsServer запущен
- **THEN** в выводе отображается статус контейнера CloudEmbeddingsServer и порт 8000
