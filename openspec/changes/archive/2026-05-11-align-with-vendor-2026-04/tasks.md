## 1. Подготовка репо (локально, безопасно)

- [x] 1.1 Добавить `MCP_Distr.zip` в `.gitignore`
- [x] 1.2 Очистить и заново распаковать `MCP_Distr.zip` в `MCP_Distr/` (с заменой старой структуры)
  ```bash
  cd /home/l7777/Проекты/mcp
  rm -rf MCP_Distr/* MCP_Distr/.[!.]*
  unzip -o MCP_Distr.zip -d MCP_Distr/
  ```
- [x] 1.3 `git status` — убедиться, что `MCP_Distr.zip` не попал в diff (благодаря .gitignore), а `MCP_Distr/` — тоже (он уже в .gitignore по corpus истории)

## 2. Sync свежей выгрузки 1С на alcor (А — данные)

> **ВАЖНО**: `~/Проекты/ЛИС1С/` и `~/Проекты/ЕвротестРасширение/` — это git-проекты с большим количеством dev-артефактов (в Евротест-проекте лежит `tox.fdb` ~5.3 ГБ!). Используем **whitelist** известных 1С-структур, а НЕ blacklist — иначе новый dev-артефакт когда-нибудь утечёт на alcor.

> **ВАЖНО 2**: на alcor рядом с 1С-выгрузкой Graph-сервер генерирует свои артефакты `business_info.html` (1371 файл в LISfiles, по одному на бизнес-объект — Graph генерирует их через LLM-запросы к OpenRouter). В исходной выгрузке их нет, и без защиты `--delete` их снесёт. Защищаем через `--exclude='business_info.html'` ПЕРЕД whitelist'ом (порядок паттернов важен — rsync применяет первое совпадение).

Whitelist-фильтр для основной конфигурации (без расширения):

```bash
ONEC_FILTER_MAIN=(
  --exclude='business_info.html'  # защита Graph-артефактов
  --include='Configuration.xml' --include='ConfigDumpInfo.xml'
  --include='AccountingRegisters/***' --include='AccumulationRegisters/***'
  --include='Bots/***' --include='BusinessProcesses/***'
  --include='CalculationRegisters/***' --include='Catalogs/***'
  --include='ChartsOfAccounts/***' --include='ChartsOfCalculationTypes/***'
  --include='ChartsOfCharacteristicTypes/***' --include='CommandGroups/***'
  --include='CommonAttributes/***' --include='CommonCommands/***'
  --include='CommonForms/***' --include='CommonModules/***'
  --include='CommonPictures/***' --include='CommonTemplates/***'
  --include='Constants/***' --include='DataProcessors/***'
  --include='DefinedTypes/***' --include='DocumentJournals/***'
  --include='DocumentNumerators/***' --include='Documents/***'
  --include='Enums/***' --include='EventSubscriptions/***'
  --include='ExchangePlans/***' --include='ExternalDataSources/***'
  --include='Ext/***' --include='FilterCriteria/***'
  --include='FunctionalOptions/***' --include='FunctionalOptionsParameters/***'
  --include='HTTPServices/***' --include='InformationRegisters/***'
  --include='IntegrationServices/***' --include='Interfaces/***'
  --include='Languages/***' --include='ParentConfigurations/***'
  --include='Reports/***' --include='Roles/***'
  --include='ScheduledJobs/***' --include='Sequences/***'
  --include='SessionParameters/***' --include='SettingsStorages/***'
  --include='Styles/***' --include='StyleItems/***'
  --include='Subsystems/***' --include='Tasks/***'
  --include='WebServices/***' --include='WSReferences/***'
  --include='XDTOPackages/***'
  --exclude='*'
)
```

Для расширения добавляются 2 типа объектов, специфичных для расширений:

```bash
# Для расширений: те же include'ы + 2 ext-only объекта.
# В extensions/Евротест на alcor business_info.html нет, но --exclude всё равно
# оставлен для единообразия (на всякий случай в будущем).
ONEC_FILTER_EXT=(
  "${ONEC_FILTER_MAIN[@]:0:${#ONEC_FILTER_MAIN[@]}-1}"  # все паттерны main кроме финального --exclude='*'
  --include='ExternalDataProcessors/***'
  --include='ExternalReports/***'
  --exclude='*'
)
```

- [x] 2.1 Dry-run: отчёты (фильтр не нужен, в `LISmcp/report/` только нужные `.txt`)
  ```bash
  rsync -avzn --delete /home/l7777/LISmcp/report/ alcor:/home/l7777/mcp/LISreport/
  ```
- [x] 2.2 Dry-run: основная конфигурация (whitelist)
  ```bash
  rsync -avzn --delete "${ONEC_FILTER_MAIN[@]}" \
    /home/l7777/Проекты/ЛИС1С/ alcor:/home/l7777/mcp/LISfiles/
  ```
- [x] 2.3 Dry-run: расширение Евротест (whitelist + ext-only объекты)
  ```bash
  rsync -avzn --delete "${ONEC_FILTER_EXT[@]}" \
    /home/l7777/Проекты/ЕвротестРасширение/ alcor:/home/l7777/mcp/extensions/Евротест/
  ```
- [x] 2.4 Показать пользователю diff из dry-run, получить явное ОК. Особое внимание:
  - какие файлы будут удалены на alcor (`deleting ...`) — должны быть только реально удалённые объекты 1С, не наши служебные
  - размер передачи (sent ... bytes) — не должен включать гигабайты от dev-артефактов
- [x] 2.5 Боевой прогон 3 rsync (без флага `n`) — те же команды

## 3. Бэкап .env и рестарт серверов конфигурации (А — рестарт)

- [x] 3.1 Бэкап .env на alcor с таймстампом
  ```bash
  ssh alcor 'cp ~/mcp/mcp-deployment/.env ~/mcp/mcp-deployment/.env.bak.$(date +%Y%m%d)'
  ```
- [x] 3.2 Убедиться, что `RESET_DATABASE=false` в .env
  ```bash
  ssh alcor 'grep RESET_DATABASE ~/mcp/mcp-deployment/.env'
  ```
- [x] 3.3 Перезапустить metadata
  ```bash
  ssh alcor 'cd ~/mcp/mcp-deployment && docker compose restart 1c-metadata'
  ```
- [x] 3.4 Перезапустить graph (ВНИМАНИЕ: имя сервиса `1c-graph-metadata`, НЕ `1c-graph`)
  ```bash
  ssh alcor 'cd ~/mcp/mcp-deployment && docker compose -f docker-compose.graph.yml restart 1c-graph-metadata'
  ```
- [x] 3.5 Подождать 30 секунд и проверить логи
  ```bash
  ssh alcor 'sleep 30 && docker logs 1c-mcp-metadata --tail 30 && echo "---" && docker logs 1c-mcp-graph --tail 30'
  ```
  — искать: `error`, `failed`, `traceback`. Должны увидеть начало фоновой индексации.

## 4. Pull обновлённых образов вендора (B)

- [x] 4.1 Pull для core compose
  ```bash
  ssh alcor 'cd ~/mcp/mcp-deployment && docker compose pull'
  ```
- [x] 4.2 Pull для graph compose
  ```bash
  ssh alcor 'cd ~/mcp/mcp-deployment && docker compose -f docker-compose.graph.yml pull'
  ```
- [x] 4.3 Pull для forms compose (используется)
  ```bash
  ssh alcor 'cd ~/mcp/mcp-deployment && docker compose -f docker-compose.forms.yml pull'
  ```
- [x] 4.4 Recreate с новыми образами (volumes сохраняются)
  ```bash
  ssh alcor 'cd ~/mcp/mcp-deployment && docker compose up -d && \
    docker compose -f docker-compose.graph.yml up -d && \
    docker compose -f docker-compose.forms.yml up -d'
  ```
- [x] 4.5 Подождать 30 секунд, проверить логи всех лицензируемых контейнеров (8, без neo4j) на `license invalid` / `401` / `unauthorized` — обнаружены ошибки у `1c-mcp-metadata` и `1c-mcp-graph`
  ```bash
  ssh alcor 'for c in 1c-mcp-docs 1c-mcp-syntax 1c-mcp-metadata 1c-mcp-ssl 1c-mcp-templates 1c-mcp-codechecker 1c-mcp-graph 1c-mcp-forms; do echo "=== $c ==="; docker logs $c --tail 15 2>&1 | grep -iE "license|auth|401|unauthorized|invalid" || echo "no auth issues"; done'
  ```

## 5. РЕАКТИВНО: обновить ключи если упали (B — опционально)

> Делается ТОЛЬКО если шаг 4.5 показал ошибки лицензии для конкретного сервера.

**Маппинг имён** (alcor `.env` ↔ vendor `config.env`):

| alcor (`mcp-deployment/.env`) | vendor (`MCP_Distr/config.env`) | compose-файл | сервис |
|---|---|---|---|
| `LICENSE_KEY_DOCS` | `LICENSE_KEY_HELP` | `docker-compose.yml` | `1c-docs` |
| `LICENSE_KEY_GRAPH` | `LICENSE_KEY_GRAPH` | `docker-compose.graph.yml` | `1c-graph-metadata` |
| `LICENSE_KEY_METADATA` | `LICENSE_KEY_CODEMETADATA` | `docker-compose.yml` | `1c-metadata` |
| `LICENSE_KEY_SSL` | `LICENSE_KEY_SSL` | `docker-compose.yml` | `1c-ssl` |
| `LICENSE_KEY_TEMPLATES` | `LICENSE_KEY_TEMPLATES` | `docker-compose.yml` | `1c-templates` |
| `LICENSE_KEY_SYNTAX` | `LICENSE_KEY_SYNTAX` | `docker-compose.yml` | `1c-syntax` |
| `LICENSE_KEY_CODECHECKER` | `LICENSE_KEY_CODECHECKER` | `docker-compose.yml` | `1c-codechecker` |
| `LICENSE_KEY_FORMS` | _нет у вендора_ | `docker-compose.forms.yml` | `1c-forms` |
| `LICENSE_KEY_CLOUD` | _нет у вендора_ | `docker-compose.cloud.yml` | `1c-cloud` |

- [x] 5.1 Найти упавший ключ в `MCP_Distr/config.env` по маппингу выше — METADATA (CODEMETADATA) и GRAPH
- [x] 5.2 Обновить через sed на alcor: `LICENSE_KEY_METADATA=f6ed45f8-…` и `LICENSE_KEY_GRAPH=c2143f0b-…`
- [x] 5.3 Пересоздать `1c-metadata` (core) и `1c-graph-metadata` (graph compose)
- [x] 5.4 Проверить логи повторно — ошибки ушли, оба сервера индексируют

## 6. Функциональная проверка

- [x] 6.1 Доступность портов — все 8 отвечают валидными HTTP-кодами (405/406/307)
- [x] 6.2 Функциональный вызов `metadatasearch` — работает, возвращает реальные данные. ⚠ API изменился: больше нет `max_chunks`
- [x] 6.3 Функциональный вызов `search_metadata` для graph — работает, реальные данные. ✨ Graph теперь имеет 17 tools (было 3)
- [x] 6.4 Функциональный вызов `business_search` для graph — patch активен (run_patched.py), сервер не падает с null. ⚠ Возвращает Cypher syntax error — отдельный новый issue, не блокирует
- [x] 6.5 Функциональный вызов `forms.get_instructions` — работает

## 7. Документация и память

- [x] 7.1 Обновить `CLAUDE.md` проекта: добавлены разделы Vendor Update Workflow и Источники данных 1С, ссылка на личный кабинет, новая точка входа INSTALL.md
- [x] 7.2 Обновить `~/.claude/projects/-home-l7777---------mcp/memory/deployment.md` — реактивная модель ключей, актуальные ключи, маппинг имён, картина :light/:latest, rsync workflow
- [x] 7.3 Обновить `~/.claude/projects/-home-l7777---------mcp/memory/open-issues.md` — добавлены 5 новых issues (Cypher syntax, max_chunks API, MCP-rules, ЛОДЭ stale, Forms/Cloud dropped), 2 закрыты (USESSE, Forms test script)

## 8. Коммит и архив

- [x] 8.1 `git add .gitignore openspec/changes/align-with-vendor-2026-04/ CLAUDE.md`
- [x] 8.2 Закоммитить — commit 8d88f3c
- [ ] 8.3 Push в origin (после явного ОК пользователя)
- [ ] 8.4 После приёма пользователем — `openspec archive align-with-vendor-2026-04`

## 9. Open follow-ups (не блокируют этот change)

- [ ] 9.1 Открыть change `slim-mcp-deployment-202X-XX` (см. memory/architecture_decision_2026-05.md)
- [ ] 9.2 Связаться с вендором: где «MCP для правил» из анонса 15.04
- [ ] 9.3 Обновить расширение ЛОДЭ (отдельным маленьким change или вместе с slim)
- [ ] 9.4 Оценить установку OneMCP.cfe в свою 1С (отдельный change)
- [ ] 9.5 Решение про :light миграцию — не сейчас, не в slim, отдельным changes когда захочется
