## Context

Проект содержит deployment-конфигурацию для 9 MCP-серверов 1С:Enterprise. Исторически секреты попали в несколько файлов: legacy-скрипт `run_mcp.sh`, standalone `.env` файлы в `FormsServer/` и `Graph_metadata_search/`, дистрибутивные файлы в `MCP_Distr/`. Основной deployment в `mcp-deployment/` использует `.env` (не коммитится) и `.env.example` (безопасный шаблон).

Обнаруженные секреты:
- OpenRouter API key (`sk-or-v1-...`) — в `run_mcp.sh`, `FormsServer/.env`, `Graph_metadata_search/.env`
- 1C License keys (UUID) — в `run_mcp.sh`, `mcp-deployment/.env`, standalone `.env` файлы
- ONEC_AI_TOKEN — в `run_mcp.sh`
- Neo4j password `***` — в `mcp-deployment/.env`, `Graph_metadata_search/.env`
- Default password `password123` — в docker-compose файлах (default-значения)

## Goals / Non-Goals

**Goals:**
- Ни один реальный секрет не должен попасть в git history
- `.gitignore` должен предотвращать случайный коммит `.env` и других чувствительных файлов
- README.md с инструкцией по развёртыванию
- Публикация на GitHub

**Non-Goals:**
- Ротация скомпрометированных ключей (отдельная задача после публикации)
- CI/CD pipeline
- Автоматическое тестирование
- Изменение архитектуры deployment

## Decisions

### 1. Стратегия работы с секретами: `.gitignore` + очистка

**Решение:** Не коммитить файлы с реальными секретами (`.env`, `run_mcp.sh`), коммитить только `.env.example` с плейсхолдерами.

**Альтернатива:** git-crypt / SOPS для шифрования. Отклонено — избыточно для deployment-конфигурации, усложняет onboarding.

### 2. `run_mcp.sh` — не коммитить

**Решение:** Добавить в `.gitignore`. Это legacy-скрипт с hardcoded-секретами, его функциональность полностью заменена `mcp-deployment/scripts/`.

### 3. `MCP_Distr/` — не коммитить

**Решение:** Добавить в `.gitignore`. Содержит бинарные артефакты (большие файлы), standalone `.env` с лицензиями, и README-инструкции, которые уже интегрированы в CLAUDE.md.

### 4. `FormsServer/`, `Graph_metadata_search/` standalone — не коммитить `.env`

**Решение:** Коммитить docker-compose.yml (без секретов), `.env` добавить в `.gitignore`. Эти каталоги — standalone альтернативы, docker-compose используют переменные окружения.

### 5. Default-пароли в compose-файлах

**Решение:** Оставить `password123` как default в `docker-compose.graph.yml` — это docker-compose default fallback, настоящий пароль задаётся через `.env`. Документировать в README обязательность смены.

### 6. Имя GitHub-репозитория

**Решение:** Спросить у пользователя при создании.

## Risks / Trade-offs

- **[Risk]** Случайный `git add .` добавит `.env` → **Mitigation:** `.gitignore` + проверка `git status` перед первым коммитом
- **[Risk]** Standalone `FormsServer/`, `Graph_metadata_search/` docker-compose.yml содержат hardcoded `password123` → **Mitigation:** Это default, не реальный пароль; документировать необходимость `.env`
- **[Risk]** Пользователь забудет создать `.env` → **Mitigation:** README с чёткой инструкцией, `setup.sh` проверяет наличие `.env`
