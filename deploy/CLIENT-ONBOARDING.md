# Подключение клиентов к новому контуру (beta, 2026-09-04)

> Черновик до завершения приёмки. Финальная версия — после green по всем readiness
> и регистрации проекта в graph.

## Endpoints (все — только 127.0.0.1 на alcor)

| Сервер | URL | Назначение |
|---|---|---|
| HelpSearchServer | `http://127.0.0.1:8103/mcp` | Документация платформы 1С (8.3.27.2325) |
| Graph metadata search | `http://127.0.0.1:8106/mcp` | Граф метаданных ЛИС + слои расширений |
| CodeMetadataSearchServer | `http://127.0.0.1:8100/mcp` | Поиск по метаданным/коду (zvec) |
| SSLSearchServer | `http://127.0.0.1:8108/mcp` | БСП 3.1.11 |
| TemplatesSearchServer | `http://127.0.0.1:8104/mcp` | Шаблоны кода (поиск; запись выключена) |
| SyntaxCheckServer | `http://127.0.0.1:8102/mcp` | Синтакс-проверка BSL (`syntaxcheck`, `syntaxcheck_file`) |
| 1CCodeChecker | `http://127.0.0.1:8107/mcp` | Проверка кода 1C:Partner |

Порты 80xx больше не существуют. Старые контейнеры `1c-mcp-*` удалены.

## Ключевые отличия от старого стека

1. **Graph требует scope**: `GRAPH_SCOPE_ENFORCED=true`. Scoped-инструменты
   (`get_object_dossier`, `resolve_effective_entity`, `run_graph_cypher_template` и др.)
   требуют `project_id`. Единственный проект: **`LISmcp`**.
   Старт сессии с graph: сначала `list_graph_projects`, затем передавать `project_id="LISmcp"`.
2. **Расширения — слои одного проекта** (не отдельные проекты):
   база `LISmcp` + слои `Евротест`, `Гистология` (и `ЛОДЭ`, когда будет свежая выгрузка).
   Для «эффективного» вида с учётом слоёв: `resolve_effective_entity`,
   `compare_base_and_extension(object_name, extension_name)`.
3. **`execute_metadata_cypher` убран вендором** — вместо него `run_graph_cypher_template`
   и предметные инструменты (54 шт.).
4. **SyntaxCheck**: новый инструмент `syntaxcheck_file` (проверка файла из полного
   индекса конфигурации; путь относительный от корня выгрузки, напр.
   `CommonModules/<Имя>/Ext/Module.bsl`). Ответ в TOON-формате.
5. **Templates**: `remember`/`recall` работают (персональная память на loopback);
   `add_template` выключен (`MCP_ENABLE_WRITE_TOOLS=false`) — включается только с
   `MCP_OPERATOR_TOKEN` (задать в `deploy/.env` при необходимости).
6. **business_search** (graph): семантический поиск по LLM-описаниям объектов —
   вторичен, после `search_metadata`. Генерация описаний фоновая, при первой
   индексации занимает часы.

## Cursor / другие MCP-клиенты (mcp.json)

```json
{
  "mcpServers": {
    "1c-help":      { "url": "http://127.0.0.1:8103/mcp" },
    "1c-graph":     { "url": "http://127.0.0.1:8106/mcp" },
    "1c-metadata":  { "url": "http://127.0.0.1:8100/mcp" },
    "1c-ssl":       { "url": "http://127.0.0.1:8108/mcp" },
    "1c-templates": { "url": "http://127.0.0.1:8104/mcp" },
    "1c-syntax":    { "url": "http://127.0.0.1:8102/mcp" },
    "1c-checker":   { "url": "http://127.0.0.1:8107/mcp" }
  }
}
```

Если клиент не на alcor — SSH-туннель: `ssh -L 8103:127.0.0.1:8103 ... alcor`.

## Операционка (на alcor)

- Стек: `~/mcp/deploy/` (compose + scripts + systemd `1c-mcp-beta-{core,graph}`).
- Статус: `~/mcp/deploy/scripts/status.sh`; логи: `scripts/logs.sh <сервер>`.
- Переиндексация: `scripts/reindex.sh <сервер|all>` (graph `--full` — с WIPE, осторожно).
- Обновление образов: `scripts/update.sh` (pull → backup-rename → up → проверка лицензий).
- Новые выгрузки 1С: `~/mcp/LISfiles/`, расширения — `~/mcp/extensions/<Имя>/`
  (появление/удаление каталога подхватывается catalog'ом автоматически, sync включён).
- Плагины graph: `/opt/mcp-data/graph_plugins/` (монтируется в `/app/plugins`).
