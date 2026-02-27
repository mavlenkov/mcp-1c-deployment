## ADDED Requirements

### Requirement: .gitignore SHALL exclude all files with secrets

Репозиторий SHALL содержать `.gitignore` в корне, исключающий:
- Все `.env` файлы (кроме `.env.example`)
- `run_mcp.sh` (legacy-скрипт с hardcoded-секретами)
- `MCP_Distr/` (дистрибутивные файлы с лицензиями и большими артефактами)
- Бэкапы `.env.backup*`
- Директории данных и БД (`chroma_db`, `neo4j/data`, и т.д.)

#### Scenario: .env исключён из git
- **WHEN** разработчик выполняет `git status` при наличии файлов `.env` в любом подкаталоге
- **THEN** ни один `.env` файл (кроме `.env.example`) не отображается как untracked

#### Scenario: run_mcp.sh исключён из git
- **WHEN** разработчик выполняет `git status` при наличии `run_mcp.sh` в корне
- **THEN** `run_mcp.sh` не отображается как untracked

#### Scenario: MCP_Distr исключён из git
- **WHEN** разработчик выполняет `git status` при наличии каталога `MCP_Distr/`
- **THEN** каталог `MCP_Distr/` и его содержимое не отображаются как untracked

### Requirement: .env.example SHALL contain only placeholder values

Все файлы `.env.example` в репозитории SHALL содержать только шаблонные значения (`your_*_here`, generic defaults), без реальных ключей и паролей.

#### Scenario: Проверка .env.example на отсутствие реальных ключей
- **WHEN** проверяется содержимое `mcp-deployment/.env.example`
- **THEN** все значения LICENSE_KEY содержат `your_license_key_here`, OPENAI_API_KEY содержит `your_openrouter_key_here`, NEO4J_PASSWORD содержит generic значение

### Requirement: Pre-commit verification SHALL catch accidental secret commits

Перед первым коммитом SHALL быть выполнена проверка `git diff --cached` на отсутствие паттернов секретов (`sk-or-v1-`, реальных UUID лицензий, `***`).

#### Scenario: Проверка staged файлов перед коммитом
- **WHEN** выполняется `git add` и `git diff --cached`
- **THEN** в staged файлах отсутствуют строки, содержащие реальные API-ключи, лицензии или пароли
