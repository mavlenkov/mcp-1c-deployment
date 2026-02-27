## Why

Проект MCP-серверов для 1С — готовое решение для развёртывания, которое может быть полезно другим разработчикам. Сейчас он существует только локально без контроля версий. Публикация на GitHub даст: версионирование, удобный деплой через `git pull`, возможность делиться конфигурацией. Главный риск — в репозитории присутствуют реальные API-ключи, лицензии и пароли в нескольких файлах, которые нельзя допустить в публичный доступ.

## What Changes

- Создать `.gitignore` с исключением всех файлов, содержащих секреты (`.env`, `run_mcp.sh`, дистрибутивные `.env`)
- Очистить файлы с hardcoded-секретами: `run_mcp.sh` (API-ключи, токены, лицензии), `FormsServer/.env`, `Graph_metadata_search/.env`, hardcoded пароли в docker-compose файлах дистрибутива
- Заменить реальные пароли в `mcp-deployment/.env.example` и `docker-compose.graph.yml` на безопасные значения по умолчанию
- Инициализировать git-репозиторий, создать README.md с описанием проекта и инструкцией по развёртыванию
- Опубликовать на GitHub в отдельный репозиторий

## Capabilities

### New Capabilities
- `secret-protection`: Аудит и очистка секретов, создание `.gitignore`, проверка что ни один секрет не попадёт в git history
- `github-repo-setup`: Инициализация git, создание README, настройка remote и первый push

### Modified Capabilities
_(нет изменений в существующих спецификациях)_

## Impact

- Файлы с реальными секретами: `run_mcp.sh`, `FormsServer/.env`, `Graph_metadata_search/.env`, `mcp-deployment/.env`, `MCP_Distr/**/.env`
- Файлы docker-compose с hardcoded паролями: `Graph_metadata_search/docker-compose.yml`, `MCP_Distr/Graph_metadata_search/docker-compose.yml`
- `.env.example` файлы — уже безопасны (плейсхолдеры), но нужна ревизия default-значений в compose-файлах
- Новые файлы: `.gitignore`, `README.md`
- GitHub: создание нового публичного репозитория
