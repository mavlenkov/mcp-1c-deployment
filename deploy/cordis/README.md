# Cordis dynamic-плагин `1c-mcp-bridge`

Мост DSH → 7 MCP-серверов контура 1С (beta, alcor, SSH-туннель `mcp-1c-tunnel`,
127.0.0.1:8100-8108). Реализует консенсус коллегии Astra/GLM/K3 (handoff
2026-09-05): один мост, allowlist ядра + generic `mcp1c_call`, телеметрия
(correlation id, latency), circuit breaker, deny-by-default generic-путь.

## Состав

| Файл | Назначение |
|---|---|
| `build-bridge.py` | Генератор: снимает живые схемы MCP (`--fetch`), конвертирует JSON-Schema → DSL `harness.defineTool`, emits `1c-mcp-bridge.host.js` |
| `1c-mcp-bridge.host.js` | Готовый `code.host` для `cordis_define` (тело JS-функции, без import/JSX) |
| `allowlist-schemas.json` | Снапшот живых схем 15 инструментов (для drift-контроля и регенерации) |
| `test-bridge.mjs` | Офлайн-харнесс: real `defineTool`+`assertSupportedJsonSchema`, мок `ctx.shell`→curl, живые вызовы, breaker-тест |

## Контракт инструментов (16)

- 14 allowlist `mcp1c__<server>__<tool>`:
  graph (list_graph_projects, search_metadata, get_object_dossier,
  resolve_effective_entity, compare_base_and_extension, business_search),
  codemeta (metadatasearch, codesearch), syntax (syntaxcheck, syntaxcheck_file),
  help (docsearch), ssl (ssl_search), templates (templatesearch),
  checker (check_1c_code).
- generic `mcp1c_call(server, tool, args_json)` — экспертный путь ко ВСЕМ
  инструментам серверов (deny-by-default: сначала allowlist).

Особенности: graph-инструментам `project_id` подставляется `LISmcp` по умолчанию;
транспорт — одноразовая MCP-сессия на вызов (initialize → initialized →
tools/call через `ctx.shell`+curl, payload через stdin, заголовки ответа через
`curl -i`); текст результата обрезается на 256 KiB; 3 транспортных фейла подряд
→ circuit OPEN на 60с с подсказкой про туннель.

## Деплой (сессия DSH с пресетом cordis)

1. Туннель жив: `systemctl --user status mcp-1c-tunnel`; smoke:
   `python3 deploy/smoke/tools_snapshot.py` (из корня репо).
2. В cordis-сессии: `cordis_inspect_list` → `cordis_inspect_query`
   (Service `shell`, Builtin `harness`) — убедиться, что контракт совпал с
   assumptions генератора.
3. `cordis_define` kind:"new", prefix `mcp1c`, code.host = содержимое
   `1c-mcp-bridge.host.js` (код ВЕСЬ файл, включая `return {…}`).
4. `cordis_run` mode:"run" c возвращёнными pluginId/packageId.
5. Приёмка: `mcp1c__graph__list_graph_projects`, generic-вызов, обрыв туннеля
   (`systemctl --user stop mcp-1c-tunnel` → 3 фейла → OPEN → восстановление).

## Регенерация при drift схем

```bash
python3 deploy/cordis/build-bridge.py --fetch   # живые схемы → allowlist-schemas.json
node deploy/cordis/test-bridge.mjs              # офлайн-проверки
# затем cordis_define kind:"existing" + cordis_run mode:"update"
```
