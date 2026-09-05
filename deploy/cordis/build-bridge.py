#!/usr/bin/env python3
"""Генератор code.host для dynamic-плагина Cordis `1c-mcp-bridge`.

Читает живые схемы MCP-инструментов из allowlist-schemas.json (снимок
deploy/smoke/tools-snapshot.py-совместимого sources/list, см. fetch ниже),
конвертирует JSON-Schema → DSL harness.defineTool и emits
deploy/cordis/1c-mcp-bridge.host.js — тело функции для cordis_define.

Правила конвертации схем (DSL хост-раннера, см. dsh-cordis-host-runner):
  - параметры: неявная карта свойств (без обёртки type:object);
  - каждое свойство обязано объявить type (anyOf → выбор не-null ветки);
  - nullable-свойства (anyOf с null) → oneOf: [<тип>, {type:'null'}];
  - разрешённые ключи: type/enum/const/items/properties/additionalProperties/
    required/annotations(description,title,default,examples);
  - minimum/maximum/format/minItems/pattern — НЕ поддерживаются DSL, срезаются;
  - object-свойства в DSL требуют явный boolean additionalProperties.

Обновление снапшота схем:
  python3 deploy/cordis/build-bridge.py --fetch   # снять живые схемы с 8100-8108
  python3 deploy/cordis/build-bridge.py            # перегенерировать code.host
"""
import argparse
import json
import re
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
SCHEMAS = HERE / "allowlist-schemas.json"
OUT = HERE / "1c-mcp-bridge.host.js"

SERVERS = {  # имя → (порт, путь) на локальной машине (SSH-туннель mcp-1c-tunnel)
    "codemeta": (8100, "/mcp/"),
    "syntax": (8102, "/mcp"),
    "help": (8103, "/mcp/"),
    "templates": (8104, "/mcp/"),
    "graph": (8106, "/mcp/"),
    "checker": (8107, "/mcp/"),
    "ssl": (8108, "/mcp/"),
}

# Allowlist ядра (консенсус коллегии Astra/GLM/K3, handoff 2026-09-05).
ALLOWLIST = {
    "graph": ["list_graph_projects", "search_metadata", "get_object_dossier",
              "resolve_effective_entity", "compare_base_and_extension", "business_search"],
    "codemeta": ["metadatasearch", "codesearch"],
    "syntax": ["syntaxcheck", "syntaxcheck_file"],
    "help": ["docsearch"],
    "ssl": ["ssl_search"],
    "templates": ["templatesearch"],
    "checker": ["check_1c_code"],
}

PREFIX = {
    "graph": "[1С·graph] ",
    "codemeta": "[1С·codemeta] ",
    "syntax": "[1С·syntax] ",
    "help": "[1С·help] ",
    "ssl": "[1С·ssl/БСП] ",
    "templates": "[1С·templates] ",
    "checker": "[1С·checker] ",
}

SUFFIX = {
    # graph — первичный по метаданным, знает слои расширений
    "graph": " Слои: база LISmcp + Евротест/Гистология/ЛОДЭ; project_id по умолчанию LISmcp.",
    # путь в syntaxcheck_file — от корня выгрузки на alcor
    "syntaxcheck_file": " file_path — путь от КОРНЯ выгрузки на alcor (напр. CommonModules/Имя/Ext/Module.bsl), не локальный.",
}

MAX_DESC = 700
MAX_DEPTH = 3

SIMPLE_TYPES = {"string", "integer", "number", "boolean", "null"}


def fetch_schemas():
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **k):
            return None

    opener = urllib.request.build_opener(NoRedirect)

    def rpc(base, payload, sid=None):
        req = urllib.request.Request(base, data=json.dumps(payload).encode(), headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            **({"Mcp-Session-Id": sid} if sid else {})})
        try:
            r = opener.open(req, timeout=60)
        except urllib.error.HTTPError as e:
            if e.code in (301, 302, 307, 308) and e.headers.get("Location"):
                return rpc(e.headers["Location"], payload, sid)
            raise
        sid = r.headers.get("Mcp-Session-Id", sid)
        for line in r.read().decode().splitlines():
            if line.startswith("data:"):
                return sid, json.loads(line[5:].strip())
        return sid, {}

    out = {}
    for srv, tools in ALLOWLIST.items():
        port, path = SERVERS[srv]
        base = f"http://127.0.0.1:{port}{path}"
        sid, _ = rpc(base, {"jsonrpc": "2.0", "id": 1, "method": "initialize",
                            "params": {"protocolVersion": "2025-03-26", "capabilities": {},
                                       "clientInfo": {"name": "build-bridge", "version": "1"}}})
        rpc(base, {"jsonrpc": "2.0", "method": "notifications/initialized"}, sid)
        _, r = rpc(base, {"jsonrpc": "2.0", "id": 2, "method": "tools/list"}, sid)
        live = {t["name"]: t for t in r.get("result", {}).get("tools", [])}
        out[srv] = {}
        for t in tools:
            if t not in live:
                raise SystemExit(f"MISSING на живом сервере: {srv}.{t}")
            out[srv][t] = {
                "description": live[t].get("description") or "",
                "inputSchema": live[t].get("inputSchema", {}),
            }
        print(f"{srv}: {len(out[srv])}/{len(tools)} схем снято")
    SCHEMAS.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"saved {SCHEMAS}")


def clean_text(s, limit):
    s = re.sub(r"\s+", " ", (s or "")).strip()
    return s[:limit]


def convert_prop(ps, depth=0):
    """MCP JSON-Schema свойства → DSL-свойство harness.defineTool."""
    if not isinstance(ps, dict):
        return {"type": "json"}
    nullable = False
    if "anyOf" in ps and isinstance(ps["anyOf"], list):
        branches = [b for b in ps["anyOf"] if isinstance(b, dict)]
        nulls = [b for b in branches if b.get("type") == "null"]
        rest = [b for b in branches if b.get("type") != "null"]
        nullable = bool(nulls)
        if len(rest) == 1:
            ps = dict(rest[0])
            # одноразовая вложенная anyOf (напр. docsearch.top_k)
            if "anyOf" in ps and isinstance(ps["anyOf"], list):
                inner = [b for b in ps["anyOf"] if isinstance(b, dict) and b.get("type") != "null"]
                if len(inner) == 1:
                    ps = dict(inner[0])
        elif not rest:
            ps = {"type": "null"} if nullable else {}
    out = {}
    t = ps.get("type")
    desc = clean_text(ps.get("description"), 500)
    if desc:
        out["description"] = desc
    if t not in SIMPLE_TYPES and t not in ("array", "object"):
        out = dict(out)
        out["type"] = "json"
        return maybe_nullable(out, nullable)
    if t in SIMPLE_TYPES:
        out["type"] = t

        def type_ok(v):
            # const/enum внутри типизированной ветки обязаны совпадать с типом;
            # null покрывается отдельной веткой oneOf, а bool не является integer
            if v is None or isinstance(v, bool):
                return t in ("boolean",) and isinstance(v, bool)
            if t == "string":
                return isinstance(v, str)
            if t == "integer":
                return isinstance(v, int)
            if t == "number":
                return isinstance(v, (int, float))
            return False

        enum = ps.get("enum")
        if isinstance(enum, list):
            enum = [v for v in enum if type_ok(v)]
            if enum:
                out["enum"] = enum
        const = ps.get("const")
        if type_ok(const):
            out["const"] = const
    elif t == "array":
        out["type"] = "array"
        items = ps.get("items")
        if depth < MAX_DEPTH and isinstance(items, dict) and items:
            out["items"] = convert_prop(items, depth + 1)
        else:
            out["items"] = {"type": "json"}
    elif t == "object":
        out["type"] = "object"
        out["additionalProperties"] = True
        props = ps.get("properties")
        if depth < MAX_DEPTH and isinstance(props, dict) and props:
            out["properties"] = {k: convert_prop(v, depth + 1) for k, v in props.items()}
    return maybe_nullable(out, nullable)


def maybe_nullable(out, nullable):
    if not nullable:
        return out
    branch = {k: v for k, v in out.items() if k not in ("description",)}
    wrapped = {"oneOf": [branch, {"type": "null"}]}
    if "description" in out:
        wrapped["description"] = out["description"]
    return wrapped


def convert_parameters(input_schema):
    props = (input_schema or {}).get("properties", {}) or {}
    required = set((input_schema or {}).get("required", []) or [])
    dsl = {}
    for name, ps in props.items():
        if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name):
            continue
        p = convert_prop(ps)
        if name in required:
            p["required"] = True
        dsl[name] = p
    return dsl


def build_allowlist():
    raw = json.loads(SCHEMAS.read_text(encoding="utf-8"))
    entries = []
    for srv, tools in ALLOWLIST.items():
        for t in tools:
            meta = raw[srv][t]
            desc = PREFIX[srv] + clean_text(meta.get("description"), MAX_DESC)
            if t in SUFFIX:
                desc += SUFFIX[t]
            elif srv == "graph" and t != "list_graph_projects":
                desc += SUFFIX["graph"]
            params = convert_parameters(meta.get("inputSchema"))
            entry = {
                "name": f"mcp1c__{srv}__{t}",
                "server": srv,
                "tool": t,
                "description": desc,
                "parameters": params,
            }
            if srv == "graph" and "project_id" in params:
                entry["defaultProjectId"] = True
            entries.append(entry)
    return entries


TEMPLATE = r'''// 1c-mcp-bridge — dynamic Cordis plugin (host half), сгенерировано deploy/cordis/build-bridge.py.
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

    const allowlist = __ALLOWLIST__;

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
'''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch", action="store_true", help="сначала снять живые схемы с 8100-8108")
    args = ap.parse_args()
    if args.fetch or not SCHEMAS.exists():
        fetch_schemas()
    allowlist = build_allowlist()
    code = TEMPLATE.replace("__ALLOWLIST__",
                            json.dumps(allowlist, ensure_ascii=False, indent=2))
    OUT.write_text(code, encoding="utf-8")
    n_params = sum(len(e["parameters"]) for e in allowlist)
    print(f"OK: {OUT}")
    print(f"инструментов: {len(allowlist)} allowlist + 1 generic; всего параметров: {n_params}")
    for e in allowlist:
        req = [k for k, v in e["parameters"].items() if v.get("required")]
        print(f"  {e['name']:42s} req={','.join(req) or '-'}")


if __name__ == "__main__":
    main()
