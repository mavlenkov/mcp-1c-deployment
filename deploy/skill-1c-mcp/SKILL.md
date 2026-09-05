---
name: 1c-mcp
description: Работа с MCP-контуром 1С на alcor (7 серверов beta, порты 81xx через SSH-туннель). Использовать при любых задачах по конфигурации ЛИС (LISmcp): поиск метаданных/кода/доков, синтакс-проверка, слои расширений Евротест/Гистология, операционка контура.
---

# MCP-контур 1С (alcor, beta 2026-08-30)

## Доступ

Серверы на alcor, loopback. С машины DSH — через постоянный SSH-туннель
(systemd user unit `mcp-1c-tunnel`, LocalForward 8100–8108):

| Сервер | URL | Ключевые инструменты |
|---|---|---|
| graph | http://127.0.0.1:8106/mcp/ | search_metadata, get_object_dossier, resolve_effective_entity, compare_base_and_extension, business_search, run_graph_cypher_template |
| codemeta | http://127.0.0.1:8100/mcp/ | metadatasearch, codesearch, search_forms, get_metadata_details |
| syntax | http://127.0.0.1:8102/mcp | syntaxcheck, syntaxcheck_file |
| help | http://127.0.0.1:8103/mcp/ | docsearch, standards, formatspec |
| ssl | http://127.0.0.1:8108/mcp/ | ssl_search (БСП 3.1.11) |
| templates | http://127.0.0.1:8104/mcp/ | templatesearch, recall (запись выключена) |
| checker | http://127.0.0.1:8107/mcp/ | check_1c_code, review_1c_code, onec_help |

## Правила работы

1. **graph — первичный** по метаданным (знает слои расширений); codemeta — fallback
   и для полнотекстового поиска по коду.
2. Все scoped-инструменты graph требуют `project_id: "LISmcp"`. Не знаешь проект —
   сначала `list_graph_projects`.
3. Объект может существовать в нескольких слоях (база LISmcp + Евротест +
   Гистология + ЛОДЭ). Для выводов о поведении — `resolve_effective_entity`
   (эффективный слой), для сравнения — `compare_base_and_extension`.
   ЛОДЭ — слой от выгрузки 21.03.2026 (может быть устаревшим).
4. `syntaxcheck_file` принимает путь **от корня выгрузки на alcor**
   (напр. `CommonModules/Имя/Ext/Module.bsl`) — НЕ локальный путь. Локальный
   файл сначала залить/синкнуть, или использовать `syntaxcheck` с текстом.
5. Templates: `remember`/`recall` работают; `add_template` выключен (403 — это
   норма, write-гейт).
6. Порты 80xx не существуют. Старый стек снесён.

## Fallback без плагина (curl/python)

Плагин `1c-mcp-bridge` регистрирует ядро как dynamic tools. Если плагин мёртв —
обёртка рядом со скиллом: `python3 mcp-call.py <server> <tool> '<json-args>'`.
Протокол: POST /mcp(/) с initialize → notifications/initialized → tools/call,
заголовок `Accept: application/json, text/event-stream`, ответ SSE `data:`,
сессия в заголовке `Mcp-Session-Id`. Syntax (8102) — путь `/mcp` без слэша,
остальные `/mcp/`.

## Операционка (на alcor: `~/mcp/deploy/`)

- Статус: `scripts/status.sh`; логи: `scripts/logs.sh <имя> -f`.
- Туннель локально: `systemctl --user status mcp-1c-tunnel` (restart там же).
- Обновление выгрузок: rsync в `~/mcp/LISfiles`/`~/mcp/extensions/<Имя>`
  (`--exclude='business_info.html'` перед whitelist) → codemeta: `scripts/reindex.sh
  codemeta`; graph: `refresh_graph_project` incremental с changed_paths
  (НЕ mode=full — сотрёт business-описания); расширения: добавить/убрать каталог
  + `docker restart 1c_graph_metadata_beta`.
- После обновления образов (`scripts/update.sh`): `python3 deploy/smoke/tools_snapshot.py`
  — сверка drift схем.
- `GRAPH_SCOPE_MIGRATION_WINDOW=true` не трогать (иначе project_not_accessible).

## Эскалация на GPT-6 Astra

Триггеры: 2 неудачные попытки исполнителя / спор без консенсуса / метка
«критичное». Вход — готовое досье (проблема, что пробовали, артефакты).
Выход — решение + дешёвый способ проверки. Не эскалировать рутину.
