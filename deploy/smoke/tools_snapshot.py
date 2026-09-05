#!/usr/bin/env python3
"""Smoke-test + снапшот tools/list для всех 7 MCP-серверов контура (через туннель).

Использование:
  python3 deploy/smoke/tools_snapshot.py            # сверка со снапшотом (exit 1 при расхождении)
  python3 deploy/smoke/tools_snapshot.py --save     # перезаписать снапшот

Гонять после каждого `scripts/update.sh` (вендорский beta-канал дрейфует).
"""
import json, sys, urllib.request, pathlib

SERVERS = {
    # имя: (порт, путь) — у syntax нет trailing-slash редиректа, путь /mcp
    "codemeta":  (8100, "/mcp/"),
    "syntax":    (8102, "/mcp"),
    "help":      (8103, "/mcp/"),
    "templates": (8104, "/mcp/"),
    "graph":     (8106, "/mcp/"),
    "checker":   (8107, "/mcp/"),
    "ssl":       (8108, "/mcp/"),
}
SNAP = pathlib.Path(__file__).with_name("tools-snapshot.json")

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None

opener = urllib.request.build_opener(NoRedirect)

def rpc(base, payload, sid=None):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(base, data=data, headers={
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        **({"Mcp-Session-Id": sid} if sid else {})})
    try:
        r = opener.open(req, timeout=30)
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 307, 308):
            loc = e.headers.get("Location")
            if loc:
                return rpc(loc, payload, sid)
        raise
    sid = r.headers.get("Mcp-Session-Id", sid)
    body = r.read().decode()
    for line in body.splitlines():
        if line.startswith("data:"):
            return sid, json.loads(line[5:].strip())
    return sid, (json.loads(body) if body else {})

def tool_list(port, path):
    base = f"http://127.0.0.1:{port}{path}"
    sid, _ = rpc(base, {"jsonrpc": "2.0", "id": 1, "method": "initialize",
                        "params": {"protocolVersion": "2025-03-26", "capabilities": {},
                                   "clientInfo": {"name": "smoke", "version": "1"}}})
    rpc(base, {"jsonrpc": "2.0", "method": "notifications/initialized"}, sid)
    _, r = rpc(base, {"jsonrpc": "2.0", "id": 2, "method": "tools/list"}, sid)
    return sorted(t["name"] for t in r.get("result", {}).get("tools", []))

def main():
    save = "--save" in sys.argv
    current, failed = {}, []
    for name, (port, path) in SERVERS.items():
        try:
            current[name] = tool_list(port, path)
            print(f"{name:10s} :{port}  tools={len(current[name])}")
        except Exception as e:
            failed.append(name)
            print(f"{name:10s} :{port}  FAIL: {e}")
    if save:
        SNAP.write_text(json.dumps(current, ensure_ascii=False, indent=1, sort_keys=True))
        print(f"снапшот записан: {SNAP}")
        return 0 if not failed else 1
    if not SNAP.exists():
        print("снапшота нет — сначала --save"); return 2
    base = json.loads(SNAP.read_text())
    drift = False
    for name in SERVERS:
        old, new = set(base.get(name, [])), set(current.get(name, []))
        gone, added = old - new, new - old
        if gone or added:
            drift = True
            print(f"DRIFT {name}: удалены={sorted(gone) or '-'} добавлены={sorted(added) or '-'}")
    if failed or drift:
        return 1
    print("OK: схемы совпадают со снапшотом")
    return 0

if __name__ == "__main__":
    sys.exit(main())
