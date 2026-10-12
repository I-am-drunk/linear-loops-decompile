#!/usr/bin/env python3
"""Minimal MCP server — streamable HTTP transport (2025-06-18 spec), no auth, 2 tools."""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

TOOLS = [
    {"name": "get_weather", "description": "Get the current weather for a city",
     "inputSchema": {"type": "object", "properties": {"city": {"type": "string", "description": "City name"}}, "required": ["city"]}},
    {"name": "add_numbers", "description": "Add two numbers together",
     "inputSchema": {"type": "object", "properties": {"a": {"type": "number"}, "b": {"type": "number"}}, "required": ["a", "b"]}},
]

def call_tool(name, args):
    if name == "get_weather":
        return {"content": [{"type": "text", "text": f"Weather in {args.get('city','?')}: 22C, sunny (from iris MCP)"}]}
    if name == "add_numbers":
        return {"content": [{"type": "text", "text": str((args.get("a") or 0) + (args.get("b") or 0))}]}
    return {"content": [{"type": "text", "text": "unknown tool"}], "isError": True}

class H(BaseHTTPRequestHandler):
    def _send(self, obj, status=200):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, *a): pass
    def do_GET(self):
        self._send({"status": "mcp-ok", "tools": [t["name"] for t in TOOLS]})
    def do_POST(self):
        length = int(self.headers.get("content-length", 0))
        raw = self.rfile.read(length)
        try: req = json.loads(raw)
        except Exception: return self._send({"error": "bad json"}, 400)
        method = req.get("method")
        rid = req.get("id")
        def result(r): return self._send({"jsonrpc": "2.0", "id": rid, "result": r})
        if method == "initialize":
            return result({"protocolVersion": req.get("params", {}).get("protocolVersion", "2025-06-18"),
                           "capabilities": {"tools": {}},
                           "serverInfo": {"name": "iris-test-mcp", "version": "0.1.0"}})
        if method == "notifications/initialized":
            return self._send({}, 202)
        if method == "tools/list":
            return result({"tools": TOOLS})
        if method == "tools/call":
            p = req.get("params", {})
            return result(call_tool(p.get("name"), p.get("arguments") or {}))
        return self._send({"jsonrpc": "2.0", "id": rid, "error": {"code": -32601, "message": "method not found: " + str(method)}})

HTTPServer(("127.0.0.1", 8399), H).serve_forever()
