# comol/1c_graph_metadata:latest — business_search возвращает Cypher SyntaxError на Neo4j 2026.04.0

## Краткое описание

После обновления образов 10.05.2026 (bug-fix релиз) MCP-tool `business_search` перестал работать. Все остальные tools (`search_metadata`, `find_objects_using_object` и др.) работают корректно.

## Окружение

- **Образ**: `comol/1c_graph_metadata:latest`
  digest `sha256:50d814b9135edff722b96a1d1b25425cbd0d0fec819be51672856a2f8e83ce07`
- **Neo4j**: `neo4j:latest` (версия 2026.04.0, Community)
- **Embeddings**: OpenRouter `qwen/qwen3-embedding-8b` (4096-dim)
- **Запуск**: docker compose, контейнеры `1c-mcp-graph` + `1c-mcp-neo4j` через `mcp-deployment/`

## Воспроизведение

1. Поднять graph через docker-compose с указанным образом
2. Дождаться окончания индексации (Neo4j заполнен, business_info embedding-и сгенерированы — видно в логах `Stored business_info embedding for ...`)
3. Через MCP-клиент вызвать tool `business_search` с любым query, например `{"query": "Подключаемое оборудование"}`

## Ожидаемо

Список объектов с бизнес-описаниями.

## Фактически

```
Error performing business search:
{neo4j_code: Neo.ClientError.Statement.SyntaxError}
{message: Invalid input 'SEARCH': expected a graph pattern, ',',
'ORDER BY', 'CALL', 'CREATE', 'LOAD CSV', 'DELETE', 'DETACH',
'FINISH', 'FOREACH', 'INSERT', 'LIMIT', 'MATCH', 'MERGE', 'NODETACH',
'OFFSET', 'OPTIONAL', 'REMOVE', 'RETURN', 'SET', 'SKIP', 'UNION',
'UNWIND', 'USE', 'USING', 'WHERE', 'WITH' or <EOF>
(line 3, column 21 (offset: 65))
"                    SEARCH node IN ("
                     ^}
{gql_status: 42001}
```

## Гипотеза о причине

В стандартной Cypher (Neo4j 5.x, 2025+, 2026.x) **нет ключевого слова `SEARCH`**. Синтаксис `SEARCH ... IN (...)` встречается в Memgraph, FalkorDB или Apache AGE. Похоже, в коде есть ветка генерации Cypher для альтернативного движка, и она ошибочно активируется в окружении с настоящим Neo4j.

## Временное решение у нас

Используем `search_metadata` вместо `business_search`.

## Дополнительная заметка

Старый баг с инициализацией (`web_server.vector_indexer` не синхронизирован с `mcp_server.vector_indexer`) в текущем образе всё ещё проявляется — у нас работает обходной патч `mcp-deployment/patches/graph_run_patch.py`, монтируемый как `/app/run_patched.py`. Без него сервер падает с `Vector indexer not initialized` при вызове `business_search`. Возможно, пора рассмотреть оба исправления одновременно.
