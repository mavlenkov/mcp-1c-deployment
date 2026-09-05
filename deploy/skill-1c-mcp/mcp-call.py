#!/usr/bin/env python3
"""Минимальный вызов MCP-инструмента контура 1С (fallback без плагина).

  python3 mcp-call.py <server> <tool> '<json-args>'
  python3 mcp-call.py graph resolve_effective_entity '{"object_name":"Справочник.Номенклатура","project_id":"LISmcp"}'
  python3 mcp-call.py --list graph
"""
import json, sys, urllib.request

SERVERS = {"codemeta": (8100, "/mcp/"), "syntax": (8102, "/mcp"), "help": (8103, "/mcp/"),
           "templates": (8104, "/mcp/"), "graph": (8106, "/mcp/"), "checker": (8107, "/mcp/"),
           "ssl": (8108, "/mcp/")}

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
        r = opener.open(req, timeout=120)
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 307, 308) and e.headers.get("Location"):
            return rpc(e.headers["Location"], payload, sid)
        raise
    sid = r.headers.get("Mcp-Session-Id", sid)
    for line in r.read().decode().splitlines():
        if line.startswith("data:"):
            return sid, json.loads(line[5:].strip())
    return sid, {}

def main():
    args = sys.argv[1:]
    if not args or args[0] not in SERVERS and args[0] != "--list":
        print(__doc__); return 2
    if args[0] == "--list":
        port, path = SERVERS[args[1]]
        base = f"http://127.0.0.1:{port}{path}"
        sid, _ = rpc(base, {"jsonrpc": "2.0", "id": 1, "method": "initialize",
                            "params": {"protocolVersion": "2025-03-26", "capabilities": {},
                                       "clientInfo": {"name": "mcp-call", "version": "1"}}})
        rpc(base, {"jsonrpc": "2.0", "method": "notifications/initialized"}, sid)
        _, r = rpc(base, {"jsonrpc": "2.0", "id": 2, "method": "tools/list"}, sid)
        for t in r.get("result", {}).get("tools", []):
            print(t["name"], "-", (t.get("description") or "")[:100])
        return 0
    name, tool = args[0], args[1]
    call_args = json.loads(args[2]) if len(args) > 2 else {}
    port, path = SERVERS[name]
    base = f"http://127.0.0.1:{port}{path}"
    sid, _ = rpc(base, {"jsonrpc": "2.0", "id": 1, "method": "initialize",
                        "params": {"protocolVersion": "2025-03-26", "capabilities": {},
                                   "clientInfo": {"name": "mcp-call", "version": "1"}}})
    rpc(base, {"jsonrpc": "2.0", "method": "notifications/initialized"}, sid)
    _, r = rpc(base, {"jsonrpc": "2.0", "id": 3, "method": "tools/call",
                      "params": {"name": tool, "arguments": call_args}}, sid)
    for c in r.get("result", {}).get("content", []):
        if c.get("type") == "text":
            print(c["text"])
    return 0

if __name__ == "__main__":
    sys.exit(main())
