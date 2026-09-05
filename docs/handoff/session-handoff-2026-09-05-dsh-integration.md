# Session handoff — 2026-09-05 greenfield-beta завершён, DSH-интеграция

## Состояние (одним абзацем)

Greenfield-перестройка MCP-стека 1С на alcor ЗАВЕРШЕНА и принята: старый стек снесён,
все 7 серверов на beta-канале вендора 2026-08-30 работают и проверены, extension catalog
строит слои (база LISmcp + Евротест + Гистология + ЛОДЭ), scoped-инструменты graph
доступны. Идёт фаза интеграции с DSH: поднят SSH-туннель, снят smoke-снапшот схем,
написан skill `1c-mcp`; остался Cordis-плагин-мост (нужна сессия cordis-пресета).

## Сделано в этой сессии (коммиты)

- `2405b76`…`03ec977` на ветке `greenfield-beta-2026-09` (push на origin сделан):
  deploy/ (compose core+graph, scripts, systemd, README), CLIENT-ONBOARDING.md,
  smoke-снапшот `deploy/smoke/`, skill `deploy/skill-1c-mcp/` (симлинк в ~/.agents/skills/1c-mcp).
- На alcor: снос 9 контейнеров + 12 volumes + старых БД; развёрнут beta-контур
  (порты 81xx, loopback); systemd `1c-mcp-beta-core/graph` enabled+active.
- Приёмка 7/7: help docsearch ✅, graph (54 tools, слои, resolve_effective_entity,
  business_search) ✅, codemeta (stats: 3311/82500/4210/1432) ✅, ssl ✅,
  templates (+write-гейт 403) ✅, syntaxcheck_file ✅, checker (ONEC-токен) ✅.
- Локально (машина DSH): systemd user unit `mcp-1c-tunnel` (LocalForward 8100-8108
  → alcor), linger включён. GPT-6 Astra добавлена в settings.yaml (openai-codex,
  id `gpt-6-astra`), проверена реальным вызовом. NB: явный `models:` в settings
  ПЕРЕКРЫВАЕТ автокаталог pi-ai — там перечислены все модели (sol/terra/luna/…),
  не удалять.
- Коллегия по DSH-интеграции завершена 4/4 (Astra, Sol, GLM, K3): консенсус —
  гибрид (мост + allowlist + skill-runbook), роль Astra = эскалационный рецензент.
  Дополнения Sol: generic mcp1c_call — deny-by-default/экспертный путь, телеметрия
  (correlation id, latency), circuit breaker, приёмка включает обрыв туннеля.
- Дефолтная модель DSH переключена kimi/k3 → **zai/glm-5.3** (страховка на
  истечение подписки Kimi; проверена вызовом). Провайдеры: zai (API-ключ),
  openai-codex (подписка: astra/sol/terra/luna/5.5/5.4), kimi (подписка, истекает).

## На чём остановились / следующий согласованный шаг

**Реализовать Cordis-плагин `1c-mcp-bridge`** — в НОВОЙ СЕССИИ С ПРЕСЕТОМ `cordis`
(только там есть cordis_define/cordis_run/inspect). Выбор пресета — в селекторе
сессии GUI. План (консенсус коллегии Astra/GLM/K3): один мост, allowlist ~15-18
tools (ядро: graph list_graph_projects/search_metadata/get_object_dossier/
resolve_effective_entity/compare_base_and_extension/business_search; codemeta
metadatasearch/codesearch; syntax syntaxcheck+syntaxcheck_file; help docsearch;
ssl ssl_search; templates templatesearch; checker check_1c_code) + generic
`mcp1c_call(server, tool, args_json)`. URL — http://127.0.0.1:81xx (туннель жив).
Workflow разработки — по скиллу cordis-plugin-development (inspect → define → run).
Первая задача для Astra после реализации — ревью контракта моста.

## Открытые хвосты

- **ЛОДЭ**: слой в графе от старой выгрузки 21.03.2026 — пользователь решил ОСТАВИТЬ.
  Когда появится свежая: положить в `~/mcp/extensions/ЛОДЭ/` + restart graph.
- **Порядок слоёв** одинакового назначения сейчас по имени (warning в логах) — при
  пересекающихся патчах завести `extensions_order.json` в `~/mcp/extensions/`.
- Старые docker-образы на alcor не удалены (rollback) — почистить через неделю стабильной работы.
- `.audit/` в репо (распакованный дистрибутив с лицензионными ключами) — удалить, когда не нужен.
- CLAUDE.md/AGENTS.md репо — legacy-текст ниже баннера, переписать по новому контуру.
- Клиентские конфиги Cursor/прочие переключить на 81xx (см. deploy/CLIENT-ONBOARDING.md).

## Ждём извне

- Пользователь: открыть сессию cordis-пресета для реализации плагина-моста.

## Среда

- alcor: `~/mcp/deploy/` (стек), `/opt/mcp-data/*_beta` (данные), ключи в
  `~/mcp/deploy/.env` и `~/mcp/deploy/graph/.env` (НЕ в git), ONEC-токен в
  `~/.mcp-secrets/1c-code-checker.env`. Neo4j: 127.0.0.1:7574/7787 (пароль в graph/.env).
- Локально: туннель `systemctl --user status mcp-1c-tunnel`; smoke:
  `python3 deploy/smoke/tools_snapshot.py` (из репо mcp).
- Проверка живости: `ssh alcor '~/mcp/deploy/scripts/status.sh'`.

## Грабли сессии

- **GRAPH_SCOPE_MIGRATION_WINDOW=true обязателен**: boot-индексация НЕ промоутит
  генерации; без окна `list_graph_projects` пуст и scoped-инструменты отвечают
  project_not_accessible даже при полном графе. С закрытым окном гидратация
  persisted-состояния НЕ работает (проверено рестартом).
- `SOURCE_UNIT_MANIFEST_ENABLED=true` обязателен для refresh_graph_project —
  иначе только full rebuild, который стирает business-описания (4.4M токенов).
  refresh full ОТКАЗЫВАЕТ если нашёл контуры описаний — это защита, не баг.
- rsync-нутые выгрузки приезжают 640 → контейнеры не читают (`a+rX` после rsync).
- Старые root-owned business_info.html мешали генерации — удалены (1441 шт).
- Graph пишет business_info.html В исходники — rsync только с exclude.
- syntax MCP-путь `/mcp` (без слэша), остальные `/mcp/`; 307-редиректы.
- templates: `plugin_reload` виден в tools/list, но без MCP_OPERATOR_TOKEN → 403 (норма).
- `sudo bash script.sh` с sudo внутри → "root отсутствует в sudoers"; запускать от l7777.
