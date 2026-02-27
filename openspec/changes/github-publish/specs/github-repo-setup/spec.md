## ADDED Requirements

### Requirement: Repository SHALL have README.md with deployment instructions

Репозиторий SHALL содержать `README.md` в корне с:
- Описанием проекта (MCP-серверы для 1С:Enterprise)
- Списком серверов с портами
- Инструкцией по быстрому старту (копирование `.env.example`, настройка, запуск)
- Ссылками на документацию

#### Scenario: Новый пользователь читает README
- **WHEN** пользователь открывает репозиторий на GitHub
- **THEN** README содержит достаточно информации для самостоятельного развёртывания всех серверов

### Requirement: Git repository SHALL be initialized and pushed to GitHub

Проект SHALL быть инициализирован как git-репозиторий и опубликован на GitHub с чистой историей (без секретов в коммитах).

#### Scenario: Первый коммит без секретов
- **WHEN** выполняется `git log -p` по всей истории
- **THEN** ни один коммит не содержит реальных API-ключей, лицензий или паролей

#### Scenario: Remote настроен на GitHub
- **WHEN** выполняется `git remote -v`
- **THEN** origin указывает на репозиторий GitHub пользователя
