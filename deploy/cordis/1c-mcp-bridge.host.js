// 1c-mcp-bridge — dynamic Cordis plugin (host half), сгенерировано deploy/cordis/build-bridge.py.
// Мост к 7 MCP-серверам контура 1С (SSH-туннель mcp-1c-tunnel, 127.0.0.1:81xx).
// Allowlist ядра + generic mcp1c_call; телеметрия (correlation id, latency) и circuit breaker.
// Не редактировать вручную таблицу allowlist — перегенерируй build-bridge.py (--fetch при drift схем).
return {
  inject: ['shell'],
  apply(ctx) {
    const SERVERS = {
      codemeta:  'http://127.0.0.1:8100/mcp/',
      syntax:    'http://127.0.0.1:8102/mcp',
      help:      'http://127.0.0.1:8103/mcp/',
      templates: 'http://127.0.0.1:8104/mcp/',
      graph:     'http://127.0.0.1:8106/mcp/',
      checker:   'http://127.0.0.1:8107/mcp/',
      ssl:       'http://127.0.0.1:8108/mcp/'
    };
    const GRAPH_DEFAULT_PROJECT = 'LISmcp';
    const CURL_TIMEOUT_S = 90;         // на один HTTP-раунд
    const SHELL_TIMEOUT_MS = 110000;   // на один раунд с запасом на spawn
    const TOOL_TIMEOUT_MS = 300000;    // на весь вызов инструмента (3 раунда)
    const MAX_TEXT = 262144;           // потолок переносимого текста (256 KiB)
    const BREAKER_THRESHOLD = 3;       // подряд транспортных фейлов → open
    const BREAKER_OPEN_MS = 60000;     // сколько цепь держится открытой

    const breaker = {};
    let seq = 0;
    const corrId = () => Date.now().toString(36) + '-' + (seq += 1).toString(36);

    const allowlist = [
  {
    "name": "mcp1c__graph__list_graph_projects",
    "server": "graph",
    "tool": "list_graph_projects",
    "description": "[1С·graph] Shared contract parameters: cursor: Continuation token from the `cursor` field of a truncated response. Only valid for the same project, generation, tool and query. max_items: Page size, capped by the server's hard limit. Ask for fewer items, never more. Returns a shared response envelope (contract version 2.0): contract_version, context, total and returned, plus the payload — `items`, `text`, `nodes`/`edges` or `data` — or a typed `error`. A key that would say nothing is absent, and absent means empty, false or null: `truncated`, `truncation_reason`, `cursor` and `limits` appear only on a truncated answer, `warnings` and `degraded` only when there is something to report.",
    "parameters": {
      "cursor": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "max_items": {
        "oneOf": [
          {
            "type": "integer"
          },
          {
            "type": "null"
          }
        ]
      }
    }
  },
  {
    "name": "mcp1c__graph__search_metadata",
    "server": "graph",
    "tool": "search_metadata",
    "description": "[1С·graph] Shared contract parameters: project_id: Graph project this call is scoped to (see list_graph_projects). Required unless the migration window is open and exactly one project is registered. generation: Graph generation the answer must come from. Omit to use the active one; a generation that is no longer active fails with `stale_generation`. cursor: Continuation token from the `cursor` field of a truncated response. Only valid for the same project, generation, tool and query. max_items: Page size, capped by the server's hard limit. Ask for fewer items, never more. Returns a shared response envelope (contract version 2.0): contract_version, context, total and returned, plus the payload — `items` Слои: база LISmcp + Евротест/Гистология/ЛОДЭ; project_id по умолчанию LISmcp.",
    "parameters": {
      "query": {
        "type": "string",
        "required": true
      },
      "project_name": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "project_id": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "generation": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "cursor": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "max_items": {
        "oneOf": [
          {
            "type": "integer"
          },
          {
            "type": "null"
          }
        ]
      }
    },
    "defaultProjectId": true
  },
  {
    "name": "mcp1c__graph__get_object_dossier",
    "server": "graph",
    "tool": "get_object_dossier",
    "description": "[1С·graph] Shared contract parameters: project_id: Graph project this call is scoped to (see list_graph_projects). Required unless the migration window is open and exactly one project is registered. generation: Graph generation the answer must come from. Omit to use the active one; a generation that is no longer active fails with `stale_generation`. cursor: Continuation token from the `cursor` field of a truncated response. Only valid for the same project, generation, tool and query. max_items: Page size, capped by the server's hard limit. Ask for fewer items, never more. Returns a shared response envelope (contract version 2.0): contract_version, context, total and returned, plus the payload — `items` Слои: база LISmcp + Евротест/Гистология/ЛОДЭ; project_id по умолчанию LISmcp.",
    "parameters": {
      "object_name": {
        "type": "string",
        "required": true
      },
      "sections": {
        "type": "array",
        "items": {
          "type": "json"
        }
      },
      "project_name": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "project_id": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "generation": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "cursor": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "max_items": {
        "oneOf": [
          {
            "type": "integer"
          },
          {
            "type": "null"
          }
        ]
      }
    },
    "defaultProjectId": true
  },
  {
    "name": "mcp1c__graph__resolve_effective_entity",
    "server": "graph",
    "tool": "resolve_effective_entity",
    "description": "[1С·graph] Shared contract parameters: project_id: Graph project this call is scoped to (see list_graph_projects). Required unless the migration window is open and exactly one project is registered. generation: Graph generation the answer must come from. Omit to use the active one; a generation that is no longer active fails with `stale_generation`. cursor: Continuation token from the `cursor` field of a truncated response. Only valid for the same project, generation, tool and query. max_items: Page size, capped by the server's hard limit. Ask for fewer items, never more. Returns a shared response envelope (contract version 2.0): contract_version, context, total and returned, plus the payload — `items` Слои: база LISmcp + Евротест/Гистология/ЛОДЭ; project_id по умолчанию LISmcp.",
    "parameters": {
      "object_name": {
        "type": "string",
        "required": true
      },
      "entity_kind": {
        "type": "string"
      },
      "entity_name": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "project_id": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "generation": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "cursor": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "max_items": {
        "oneOf": [
          {
            "type": "integer"
          },
          {
            "type": "null"
          }
        ]
      }
    },
    "defaultProjectId": true
  },
  {
    "name": "mcp1c__graph__compare_base_and_extension",
    "server": "graph",
    "tool": "compare_base_and_extension",
    "description": "[1С·graph] Shared contract parameters: project_id: Graph project this call is scoped to (see list_graph_projects). Required unless the migration window is open and exactly one project is registered. generation: Graph generation the answer must come from. Omit to use the active one; a generation that is no longer active fails with `stale_generation`. cursor: Continuation token from the `cursor` field of a truncated response. Only valid for the same project, generation, tool and query. max_items: Page size, capped by the server's hard limit. Ask for fewer items, never more. Returns a shared response envelope (contract version 2.0): contract_version, context, total and returned, plus the payload — `items` Слои: база LISmcp + Евротест/Гистология/ЛОДЭ; project_id по умолчанию LISmcp.",
    "parameters": {
      "object_name": {
        "type": "string",
        "required": true
      },
      "extension_name": {
        "type": "string",
        "required": true
      },
      "project_id": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "generation": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "cursor": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "max_items": {
        "oneOf": [
          {
            "type": "integer"
          },
          {
            "type": "null"
          }
        ]
      }
    },
    "defaultProjectId": true
  },
  {
    "name": "mcp1c__graph__business_search",
    "server": "graph",
    "tool": "business_search",
    "description": "[1С·graph] Shared contract parameters: project_id: Graph project this call is scoped to (see list_graph_projects). Required unless the migration window is open and exactly one project is registered. generation: Graph generation the answer must come from. Omit to use the active one; a generation that is no longer active fails with `stale_generation`. cursor: Continuation token from the `cursor` field of a truncated response. Only valid for the same project, generation, tool and query. max_items: Page size, capped by the server's hard limit. Ask for fewer items, never more. Returns a shared response envelope (contract version 2.0): contract_version, context, total and returned, plus the payload — `items` Слои: база LISmcp + Евротест/Гистология/ЛОДЭ; project_id по умолчанию LISmcp.",
    "parameters": {
      "query": {
        "type": "string",
        "required": true
      },
      "top_k": {
        "type": "integer"
      },
      "filter_type": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "include_structure": {
        "type": "boolean"
      },
      "project_name": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "project_id": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "generation": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "cursor": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "max_items": {
        "oneOf": [
          {
            "type": "integer"
          },
          {
            "type": "null"
          }
        ]
      }
    },
    "defaultProjectId": true
  },
  {
    "name": "mcp1c__codemeta__metadatasearch",
    "server": "codemeta",
    "tool": "metadatasearch",
    "description": "[1С·codemeta] Search in XML metadata files of 1C configuration. When ``object_type`` is provided, retrieval is constrained to matching top-level metadata categories such as ``Справочники`` or ``Документы``. When ``names_only`` is ``True``, returns only a compact list of matching metadata object names (with full_path, object_type, and synonym) instead of raw text chunks. **Prefer names_only=True when you need to identify which configuration objects are relevant** — their detailed attributes and tabular parts can then be fetched via ``get_metadata_details``. While background indexing is still populating the metadata collection, the tool transparently falls back to grep-level scanning of the source ``.txt`` ",
    "parameters": {
      "query": {
        "type": "string",
        "required": true
      },
      "limit": {
        "type": "integer"
      },
      "object_type": {
        "type": "string"
      },
      "names_only": {
        "type": "boolean"
      },
      "max_chars": {
        "type": "integer"
      },
      "max_items": {
        "type": "integer"
      },
      "detail_level": {
        "type": "string"
      },
      "cursor": {
        "type": "string"
      },
      "origin": {
        "type": "string"
      }
    }
  },
  {
    "name": "mcp1c__codemeta__codesearch",
    "server": "codemeta",
    "tool": "codesearch",
    "description": "[1С·codemeta] Search in object modules and common modules of 1C. Falls back to file-level grep over ``.bsl`` when the code collection is still empty (background indexing in progress); response then has ``search_layer: \"grep\"`` on success. Response budget (optional; the defaults reproduce the previous payload exactly). ``max_chars`` caps the serialized response measured on the final payload, ``max_items`` caps one page, ``detail_level`` is ``outline`` or ``full``, and ``cursor`` continues a truncated response. Every response carries ``items_total``, ``items_returned``, ``truncated`` and ``next_cursor`` with the compact query API's semantics; every item carries ``item_id``, ``location`` (``file:start:end``)",
    "parameters": {
      "query": {
        "type": "string",
        "required": true
      },
      "limit": {
        "type": "integer"
      },
      "max_chars": {
        "type": "integer"
      },
      "max_items": {
        "type": "integer"
      },
      "detail_level": {
        "type": "string"
      },
      "cursor": {
        "type": "string"
      },
      "origin": {
        "type": "string"
      }
    }
  },
  {
    "name": "mcp1c__syntax__syntaxcheck",
    "server": "syntax",
    "tool": "syntaxcheck",
    "description": "[1С·syntax] Analyzes BSL code for syntax errors using bsl-analyzer. This tool takes a string of BSL code, saves it to a temporary file, runs bsl-analyzer on it, and returns the analysis report as a string in TOON format (one document under an \"events\" key: a \"start\" event, a \"file\" event whose diagnostics are written as one table, and a \"done\" summary event). 'file_name' says what the code is: give it 'ObjectModule.bsl' and the analyzer sees an object module under that name, and every location in the answer is that name rather than a temporary path of this server's. It is a name and not a location - a path separator, a parent segment, an absolute or drive-qualified form, a control character, an empty st",
    "parameters": {
      "code": {
        "description": "A string containing the BSL code to be analyzed.",
        "type": "string",
        "required": true
      },
      "file_name": {
        "description": "Optional logical module name for the submitted code, e.g. \"ObjectModule.bsl\". A bare file name ending in .bsl - never a path. Empty analyses the code under a generic name.",
        "type": "string"
      }
    }
  },
  {
    "name": "mcp1c__syntax__syntaxcheck_file",
    "server": "syntax",
    "tool": "syntaxcheck_file",
    "description": "[1С·syntax] Analyzes a BSL file from the mounted files directory for syntax errors. This is a project-file read mode, and that is its contract, and where a directory is mounted it is the way to check code that lives in it: the file is analysed under its own name and in its own place, and `syntaxcheck` is for code that has no file yet. What this tool can say depends on whether the container keeps an index. Without one - the default - three diagnostics are switched off, because a call analysing one module cannot resolve a call, a field or a query's metadata against the rest of the configuration and would report every cross-module reference as unresolved. Started with FULLINDEX=true the container indexes t file_path — путь от КОРНЯ выгрузки на alcor (напр. CommonModules/Имя/Ext/Module.bsl), не локальный.",
    "parameters": {
      "file_path": {
        "description": "Path to the BSL file, relative to the mounted files directory.",
        "type": "string",
        "required": true
      },
      "lines": {
        "description": "Optional 1-based lines to check, e.g. \"5, 10-20, 35\". Empty string checks the whole file.",
        "type": "string"
      }
    }
  },
  {
    "name": "mcp1c__help__docsearch",
    "server": "help",
    "tool": "docsearch",
    "description": "[1С·help] Searches 1C platform syntax documentation using a hybrid approach. Don't mention in query that you need 1C code or syntax, tool will return only 1C related info. Use this when you need to find documentation by description, question, or partial name. If you know the exact object or method name, use docinfo instead. Args: query: The search term or question in Russian. top_k: How many matching documents the answer may contain at all. Omitted, every document that clears the relevance threshold is a result. This bounds the result set; max_items bounds one page of it. doc_type: Restrict the answer to one kind of page - \"method\", \"property\", \"constructor\", \"event\", \"object\", \"type\", \"structure\" or ",
    "parameters": {
      "query": {
        "type": "string",
        "required": true
      },
      "top_k": {
        "oneOf": [
          {
            "type": "integer"
          },
          {
            "type": "null"
          }
        ]
      },
      "doc_type": {
        "oneOf": [
          {
            "type": "string",
            "enum": [
              "method",
              "property",
              "constructor",
              "event",
              "object",
              "type",
              "structure",
              "other"
            ]
          },
          {
            "type": "null"
          }
        ]
      },
      "scope": {
        "oneOf": [
          {
            "type": "string",
            "enum": [
              "syntax",
              "docs",
              "all"
            ]
          },
          {
            "type": "null"
          }
        ]
      },
      "max_chars": {
        "description": "Hard cap on the size of the serialized response, in characters.",
        "type": "integer"
      },
      "max_items": {
        "description": "Maximum number of documents in the response.",
        "type": "integer"
      },
      "detail_level": {
        "description": "'detailed' returns whole document bodies, 'compact' a short sample of each: the snippets the query reached, in the document's own order.",
        "type": "string",
        "enum": [
          "detailed",
          "compact"
        ]
      },
      "cursor": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "diagnostics": {
        "description": "Add a report of how the answer was retrieved: which lanes ran and what each contributed, how they were fused, the relevance thresholds applied, the index generation, and where in its document each hit sits. Off by default - it is for debugging retrieval, and it is paid for out of the same max_chars that would otherwise carry documentation.",
        "type": "boolean"
      }
    }
  },
  {
    "name": "mcp1c__ssl__ssl_search",
    "server": "ssl",
    "tool": "ssl_search",
    "description": "[1С·ssl/БСП] Searches for functions in 1C 'БСП'(SSL) - standard subsystems library. This tool should always be used if 'БСП'(SSL) present in 1C configuration. Searches through the SSL (Standard Subsystems Library) documentation using vector search. query can be method description of method name, or some text, describing what are you going to do Each hit is rendered as a citation header followed by the entry, and the hits are separated by '---': [database=3111.db version=3.1.11 doc_id=3111.db_42 source=3111.db#functions section=\"Базовая функциональность\" lane=semantic score=0.9269 (similarity, higher is more relevant)] <the entry> The header is one line. `database` is the BSP database the entry came from,",
    "parameters": {
      "query": {
        "description": "The search term or question in Russian.",
        "type": "string",
        "required": true
      },
      "limit": {
        "description": "How many hits to return, from 1 to 20. Defaults to 5.",
        "type": "integer"
      },
      "min_score": {
        "oneOf": [
          {
            "type": "number"
          },
          {
            "type": "null"
          }
        ]
      },
      "database": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "detail": {
        "oneOf": [
          {
            "type": "string",
            "enum": [
              "compact",
              "full"
            ]
          },
          {
            "type": "null"
          }
        ]
      },
      "cursor": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "doc_id": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      }
    }
  },
  {
    "name": "mcp1c__templates__templatesearch",
    "server": "templates",
    "tool": "templatesearch",
    "description": "[1С·templates] Searches the 1C code template or some additional context for a given query. Args: query: The search term or question in Russian, describing the desired functionality or some case Returns: A formatted string with context or code",
    "parameters": {
      "query": {
        "type": "string",
        "required": true
      }
    }
  },
  {
    "name": "mcp1c__checker__check_1c_code",
    "server": "checker",
    "tool": "check_1c_code",
    "description": "[1С·checker] Basic check of 1C:Enterprise code — syntax errors, logical issues, and performance problems. Use this tool for a technical correctness check: will the code compile, are there bugs, are there N+1 queries or other performance anti-patterns. In direct mode the upstream syntax capability produces both the syntax result and the logic-and-performance analysis within a single discussion. When that capability is not available, or the call does not succeed, the answer comes from the prompt path and the result carries a machine-readable `fallback_reason` saying which capability was concerned and what state it resolved to. For style/standards compliance, use review_1c_code instead. For an AI-proposed r",
    "parameters": {
      "code": {
        "description": "1C code to check",
        "type": "string"
      },
      "files": {
        "oneOf": [
          {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          {
            "type": "null"
          }
        ]
      }
    }
  }
];

    function breakerRecord(server, ok) {
      let st = breaker[server];
      if (st === undefined) st = breaker[server] = { fails: 0 };
      if (ok) { st.fails = 0; delete st.openUntil; return; }
      st.fails += 1;
      if (st.fails >= BREAKER_THRESHOLD) {
        st.openUntil = Date.now() + BREAKER_OPEN_MS;
        console.error('[1c-mcp-bridge] circuit OPEN: ' + server + ' после ' + st.fails + ' фейлов подряд');
      }
    }
    function breakerGuard(server) {
      const st = breaker[server];
      if (st === undefined || st.openUntil === undefined) return;
      const left = st.openUntil - Date.now();
      if (left > 0) {
        throw new Error('circuit breaker OPEN для «' + server + '» — подождите ~' + Math.ceil(left / 1000)
          + 'с и проверьте туннель: systemctl --user status mcp-1c-tunnel');
      }
    }

    function parseHeaders(text) {
      const out = { status: '', sessionId: undefined, location: undefined };
      for (const line of String(text).split(/\r?\n/)) {
        if (/^HTTP\/[\d.]+\s+\d{3}/.test(line)) { out.status = line.trim(); continue; }
        const i = line.indexOf(':');
        if (i > 0) {
          const name = line.slice(0, i).trim().toLowerCase();
          const value = line.slice(i + 1).trim();
          if (name === 'mcp-session-id') out.sessionId = value;
          else if (name === 'location') out.location = value;
        }
      }
      return out;
    }

    function parseBody(body) {
      const s = String(body).replace(/^\uFEFF/, '').trim();
      if (s.startsWith('{')) {
        try { return JSON.parse(s); } catch (e) { return undefined; }
      }
      for (const line of s.split(/\r?\n/)) {
        if (line.startsWith('data:')) {
          const chunk = line.slice(5).trim();
          if (chunk.length === 0) continue;
          try { return JSON.parse(chunk); } catch (e) { /* ищем дальше */ }
        }
      }
      return undefined;
    }

    async function httpPost(url, payload, sessionId, signal) {
      // URL/sessionId — серверные константы; пользовательские данные идут через stdin.
      // -i: заголовки ответа попадают в начало stdout (надёжнее -D /dev/stderr,
      // который не открывается, когда stderr — пайп).
      let command = "curl -sS -i --max-time " + CURL_TIMEOUT_S + " -X POST '" + url + "'"
        + " -H 'Content-Type: application/json'"
        + " -H 'Accept: application/json, text/event-stream'";
      if (sessionId !== undefined) command += " -H 'Mcp-Session-Id: " + sessionId + "'";
      command += " --data-binary @-";
      const res = await ctx.shell.run({
        command: command,
        stdin: JSON.stringify(payload),
        timeoutMs: SHELL_TIMEOUT_MS,
        stdoutMaxBytes: 16 * 1024 * 1024,
        signal: signal
      });
      // отделяем блок заголовков от тела по первой пустой строке
      const raw = String(res.stdout.text);
      let head = raw, body = '';
      const sep = raw.indexOf('\r\n\r\n') !== -1 ? raw.indexOf('\r\n\r\n') : raw.indexOf('\n\n');
      if (sep !== -1) {
        head = raw.slice(0, sep);
        body = raw.slice(sep + (raw.indexOf('\r\n\r\n') !== -1 ? 4 : 2));
      }
      return { exitCode: res.exitCode, headers: parseHeaders(head), body: body };
    }

    async function rpc(url, payload, sessionId, signal, depth) {
      const r = await httpPost(url, payload, sessionId, signal);
      if (r.exitCode !== 0) {
        throw new Error('curl exit ' + r.exitCode + ' — сервер/туннель недоступны (systemctl --user status mcp-1c-tunnel)');
      }
      const st = r.headers.status || '';
      if (/\s(307|308)\s/.test(st) && r.headers.location !== undefined && depth < 2) {
        return rpc(r.headers.location, payload, sessionId, signal, depth + 1);
      }
      if (!/\s2\d\d\s/.test(st)) {
        const snippet = r.body.length > 0 && r.body.length < 400 ? ' — ' + String(r.body).slice(0, 300) : '';
        throw new Error('HTTP ' + st + snippet);
      }
      return {
        sessionId: r.headers.sessionId !== undefined ? r.headers.sessionId : sessionId,
        message: parseBody(r.body)
      };
    }

    async function mcpCall(server, tool, args, signal) {
      const url = SERVERS[server];
      if (url === undefined) throw new Error('неизвестный сервер «' + server + '»');
      breakerGuard(server);
      const started = Date.now();
      const id = corrId();
      try {
        let r = await rpc(url, { jsonrpc: '2.0', id: 1, method: 'initialize',
          params: { protocolVersion: '2025-03-26', capabilities: {},
                    clientInfo: { name: 'dsh-1c-mcp-bridge', version: '1' } } }, undefined, signal, 0);
        if (r.message === undefined) throw new Error('initialize: пустой ответ');
        await rpc(url, { jsonrpc: '2.0', method: 'notifications/initialized' }, r.sessionId, signal, 0);
        r = await rpc(url, { jsonrpc: '2.0', id: 2, method: 'tools/call',
          params: { name: tool, arguments: args === undefined ? {} : args } }, r.sessionId, signal, 0);
        breakerRecord(server, true);
        const latency = Date.now() - started;
        if (r.message === undefined) throw new Error('tools/call: пустой ответ');
        if (r.message.error !== undefined) {
          return { server: server, tool: tool, ok: false, latencyMs: latency, correlationId: id,
                   error: (r.message.error.message || 'MCP error') + ' (code ' + r.message.error.code + ')' };
        }
        const result = r.message.result || {};
        const parts = [];
        if (Array.isArray(result.content)) {
          for (const c of result.content) {
            if (c !== null && typeof c === 'object' && c.type === 'text' && typeof c.text === 'string') parts.push(c.text);
            else if (typeof c === 'string') parts.push(c);
          }
        }
        let text = parts.join('\n');
        if (text.length === 0 && result.structuredContent !== undefined) text = JSON.stringify(result.structuredContent);
        if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT) + '\n…[обрезано мостом: −' + (text.length - MAX_TEXT) + ' символов]';
        console.log('[1c-mcp-bridge] ' + server + '.' + tool + ' ok ' + latency + 'ms corr=' + id + ' bytes=' + text.length);
        return { server: server, tool: tool, ok: result.isError !== true, latencyMs: latency,
                 correlationId: id, text: text };
      } catch (e) {
        breakerRecord(server, false);
        const latency = Date.now() - started;
        const msg = e && e.message ? e.message : String(e);
        console.error('[1c-mcp-bridge] ' + server + '.' + tool + ' FAIL ' + latency + 'ms corr=' + id + ': ' + msg);
        throw new Error(server + '.' + tool + ' (' + latency + 'ms, corr=' + id + '): ' + msg);
      }
    }

    const render = (args, value) => {
      if (value === null || typeof value !== 'object') return [{ type: 'text', text: String(value) }];
      const head = value.ok === false
        ? '⚠ ' + value.server + '.' + value.tool + ' — ошибка (' + value.latencyMs + 'ms, corr=' + value.correlationId + ')'
        : value.server + '.' + value.tool + ' (' + value.latencyMs + 'ms, corr=' + value.correlationId + ')';
      const body = typeof value.text === 'string' ? value.text
        : value.error !== undefined ? 'ERROR: ' + value.error : JSON.stringify(value);
      return [{ type: 'text', text: head + '\n' + body }];
    };

    const disposers = [];
    for (const spec of allowlist) {
      const tool = harness.defineTool({
        name: spec.name,
        description: spec.description,
        parameters: spec.parameters,
        output: { schema: { type: 'json' }, render: render },
        timeoutMs: TOOL_TIMEOUT_MS,
        execute: async (args, exec) => {
          const fwd = {};
          for (const k of Object.keys(args)) if (args[k] !== undefined) fwd[k] = args[k];
          if (spec.defaultProjectId === true && fwd.project_id === undefined) fwd.project_id = GRAPH_DEFAULT_PROJECT;
          if (spec.defaultProjectId === true && fwd.project_id === null) fwd.project_id = GRAPH_DEFAULT_PROJECT;
          return mcpCall(spec.server, spec.tool, fwd, exec.signal);
        }
      });
      disposers.push(harness.registerTool(ctx, tool));
    }

    const generic = harness.defineTool({
      name: 'mcp1c_call',
      description: 'Экспертный generic-вызов ЛЮБОГО инструмента 7 MCP-серверов контура 1С '
        + '(graph/codemeta/syntax/help/ssl/templates/checker). Deny-by-default: сначала пробуйте '
        + 'allowlist-инструменты вида mcp1c__<server>__<tool>; этот путь — для остальных инструментов '
        + '(напр. run_graph_cypher_template, review_1c_code, standards). Список инструментов сервера: '
        + 'python3 deploy/skill-1c-mcp/mcp-call.py --list <server>.',
      parameters: {
        server: { type: 'string', required: true, enum: ['graph', 'codemeta', 'syntax', 'help', 'ssl', 'templates', 'checker'],
                  description: 'Целевой MCP-сервер контура 1С' },
        tool: { type: 'string', required: true, description: 'Точное имя MCP-инструмента на сервере' },
        args_json: { type: 'string', description: 'Аргументы инструмента как JSON-объект в строке (по умолчанию {})' }
      },
      output: { schema: { type: 'json' }, render: render },
      timeoutMs: TOOL_TIMEOUT_MS,
      execute: async (args, exec) => {
        let parsed = {};
        const raw = args.args_json;
        if (raw !== undefined && raw !== '') {
          try { parsed = JSON.parse(raw); }
          catch (e) { throw new Error('args_json не является JSON: ' + (e && e.message ? e.message : String(e))); }
          if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('args_json должен быть JSON-объектом, не ' + (Array.isArray(parsed) ? 'массивом' : typeof parsed));
          }
        }
        return mcpCall(args.server, args.tool, parsed, exec.signal);
      }
    });
    disposers.push(harness.registerTool(ctx, generic));

    console.log('[1c-mcp-bridge] зарегистрировано инструментов: ' + disposers.length
      + ' (' + (disposers.length - 1) + ' allowlist + mcp1c_call)');

    ctx.effect(() => () => {
      for (const d of disposers) { try { d(); } catch (e) { /* idempotent cleanup */ } }
    });
  }
}
