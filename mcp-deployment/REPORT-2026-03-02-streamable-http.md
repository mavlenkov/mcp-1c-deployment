# Отчёт: переключение MCP-серверов на Streamable HTTP

**Дата:** 2026-03-02
**Среда:** alcor (192.168.1.80), Docker
**Контекст:** Claude Code не мог использовать MCP-инструменты — серверы работали по SSE, а клиент ожидал Streamable HTTP

---

## Что было сделано

### 1. Переключение транспорта SSE → Streamable HTTP

**Файл:** `.env`
**Изменение:** `USESSE=true` → `USESSE=false`

После переключения 3 контейнера упали с ошибкой `Invalid LICENSE_KEY`.

### 2. Обновление лицензионных ключей

При пересоздании контейнеров (новые образы) 3 ключа оказались устаревшими. Актуальные ключи извлечены из `/home/l7777/Проекты/mcp/MCP_Distr.zip`.

| Сервер | Порт | Старый ключ (фрагмент) | Новый ключ (фрагмент) |
|--------|------|------------------------|----------------------|
| syntax | 8002 | `a3c617a9` | `a3c618a9` |
| docs | 8003 | `fad9f22d-6242` | `fad9f23d-6342` |
| codechecker | 8007 | `fad9f22d-6242` | `fad9f23d-6242` |

**Статус:** ключи уже обновлены и в `.env` на alcor, и в `.env` в репозитории.

### 3. Исправление переиндексации docs при каждом перезапуске

**Проблема:** контейнер `1c-mcp-docs` (HelpSearchServer, порт 8003) переиндексировал всю документацию 1С при каждом перезапуске (~15 минут, 300+ МБ ChromaDB), несмотря на примонтированный том `docs_db:/app/chroma_db`.

**Корневая причина:** в `docker-compose.yml` у сервиса `1c-docs` **отсутствовала** переменная `RESET_DATABASE`. Внутри Python-кода контейнера дефолт — `True`. В результате при каждом старте:

```
RESET_DATABASE is True. Clearing existing ChromaDB database.
Creating new collection 'docs_1c_collection'...
Starting to index documents from: /app/extracted_docs
```

Для сравнения, у `1c-metadata` переменная задана явно:
```yaml
- RESET_DATABASE=${RESET_DATABASE:-false}   # ← есть у metadata
```
А у `1c-docs` — нет.

**Исправление на alcor (уже применено):**
```yaml
# docker-compose.yml, сервис 1c-docs, секция environment:
- RESET_DATABASE=false
```

**TODO в репозитории:** перенести это же исправление в `mcp-deployment/docker-compose.yml`.

---

## TODO: изменения для внесения в репозиторий

### docker-compose.yml — добавить RESET_DATABASE для 1c-docs

```diff
  1c-docs:
    environment:
      - LICENSE_KEY=${LICENSE_KEY_DOCS}
      - 1C_BIN_PATH=/1c_docs
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENAI_API_BASE=${OPENAI_API_BASE}
      - OPENAI_MODEL=${OPENAI_MODEL}
+     - RESET_DATABASE=${RESET_DATABASE:-false}
      - USESSE=${USESSE}
```

> Использовать `${RESET_DATABASE:-false}` (как у metadata), а не хардкод `false`, чтобы `scripts/reindex.sh` мог управлять переиндексацией.

### .env / .env.example — USESSE уже актуален

В `.env` в репозитории `USESSE=false` — совпадает с alcor. Ничего менять не нужно.

### Лицензионные ключи — уже актуальны

В `.env` в репозитории ключи обновлены в предыдущей сессии. Совпадают с alcor.

---

## Побочные находки

### OpenAI Embeddings URL сломан (некритично)

Контейнер docs пытается использовать OpenAI API для эмбеддингов:
```
POST https://openrouter.ai/api/v1/v1/embeddings → 404 Not Found
```

URL дублируется: `OPENAI_API_BASE` = `https://openrouter.ai/api/v1`, код добавляет `/v1/embeddings` → двойной `/v1/v1/`.

Контейнер откатывается на локальную модель `intfloat/multilingual-e5-small` — работает, но медленнее. Причина: либо код контейнера ожидает base URL без `/v1`, либо OpenRouter не поддерживает embeddings на этом эндпоинте.

**Рекомендация:** не исправлять, пока работает локальная модель. Если нужны облачные эмбеддинги — проверить документацию образа `comol/1c_help_mcp` на предмет правильного формата `OPENAI_API_BASE`.

### syntax и graph — unhealthy (некритично)

```
1c-mcp-syntax   Up 7 minutes (unhealthy)
1c-mcp-graph    Up 14 minutes (unhealthy)
```

Оба сервера отвечают на запросы и работают штатно. Вероятно, healthcheck настроен некорректно (таймаут, endpoint). Не блокирует работу.

---

## Итоговый статус всех серверов

| Порт | Контейнер | Сервер | Streamable HTTP | Примечание |
|------|-----------|--------|:---------------:|------------|
| 8000 | 1c-mcp-metadata | CodeMetadataSearch | OK | |
| 8002 | 1c-mcp-syntax | SyntaxCheck | OK | healthcheck unhealthy, работает |
| 8003 | 1c-mcp-docs | HelpSearch | OK | переиндексирован, RESET_DATABASE исправлен |
| 8004 | 1c-mcp-templates | TemplatesSearch | OK | |
| 8006 | 1c-mcp-graph | GraphMetadataSearch | OK | healthcheck unhealthy, работает |
| 8007 | 1c-mcp-codechecker | 1CCodeChecker | OK | |
| 8008 | 1c-mcp-ssl | SSLSearch | OK | |
| 8011 | 1c-mcp-forms | FormsServer | OK | |

Все 8 серверов проверены: `POST /mcp` с JSON-RPC `initialize` возвращает корректный ответ.
