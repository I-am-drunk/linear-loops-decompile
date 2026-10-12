#!/usr/bin/env python3
"""Complete browserless Linear Agent inference: send prompt, poll sync, extract answer."""
import json, subprocess, time, uuid, sys

COOKIE = 'session:5f56a47f-41a0-4f57-8736-73d25a5dcdd2=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ2IjoyLCJzZXNzaW9uSWQiOiI4ZDEzMTAyZS1mNTAzLTRkOTktYWRkOC1hNjIwYzkzNjYxY2IiLCJ1c2VyQWNjb3VudElkIjoiNWY1NmE0N2YtNDFhMC00ZjU3LTg3MzYtNzNkMjVhNWRjZGQyIiwiY3JlYXRlZEF0IjoiMjAyNi0xMC0xMlQxOTozNjo0OS45NTlaIiwiaWF0IjoxNzkxODMzODEwfQ.ju6t02JV0YQQ2fA9CO829y6-UBphBh0KKVqfPTD3EH8; loggedIn=1'
HEADERS = ['content-type: application/json', 'Linear-Client-Version: 1.81135.0', 'Linear-Client-ID: b4nv7kmisu7/C',
           'user: 23fbdc5d-5226-415d-9e01-345976909177', 'userAccount: 5f56a47f-41a0-4f57-8736-73d25a5dcdd2',
           'organization: 58b57f06-882e-4336-9ef5-5a386d38bc6d', 'Cookie: ' + COOKIE]

def post(url, payload, accept=None):
    cmd = ['curl', '-s', '-m', '60', '-X', 'POST', url]
    for h in HEADERS: cmd += ['-H', h]
    if accept: cmd += ['-H', 'accept: ' + accept]
    cmd += ['-d', json.dumps(payload)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.stdout

def send(prompt, conv_id=None, msg_id=None):
    conv_id = conv_id or str(uuid.uuid4())
    msg_id = msg_id or str(uuid.uuid4())
    body = {"query": "mutation AiConversationSendMessage($input: AiConversationSendMessageInput!) { aiConversationSendMessage(input: $input) { success lastSyncId aiConversation { id } userMessage { id } assistantMessage { id } } }",
            "variables": {"input": {"conversationId": conv_id, "userMessageId": msg_id, "context": [],
                "bodyData": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": prompt}]}]},
                "resume": True, "fallbackMode": "queue"}},
            "operationName": "AiConversationSendMessage"}
    j = json.loads(post('https://client-api.linear.app/graphql', body))
    d = j.get("data", {}).get("aiConversationSendMessage", {})
    return conv_id, d.get("lastSyncId"), d

def poll_answer(conv_id, first_sync, timeout_s=120):
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        body = {"clientDatabaseId": str(uuid.uuid4()), "firstSyncId": first_sync,
                "requests": [{"indexedKey": "conversationId", "keyValue": conv_id, "modelName": "AiConversationTurn"}]}
        t = post('https://client-api.linear.app/sync/batch', body, accept='text/plain')
        for line in t.strip().split("\n"):
            try: row = json.loads(line)
            except Exception: continue
            if row.get("role") == "assistant" and row.get("status") == "completed":
                texts = []
                for part in row.get("parts", []):
                    bd = part.get("bodyData") or {}
                    for blk in bd.get("content", []):
                        for node in blk.get("content", []):
                            if node.get("text"): texts.append(node["text"])
                return "".join(texts), row
        time.sleep(2)
    return None, None

if __name__ == "__main__":
    prompt = sys.argv[1] if len(sys.argv) > 1 else "Reply with exactly: LINEAR-LOOP-OK"
    conv, sync, resp = send(prompt)
    print("send:", json.dumps(resp)[:200], flush=True)
    ans, raw = poll_answer(conv, sync)
    print("ANSWER:", ans, flush=True)
    print("status:", (raw or {}).get("status"), "| turns:", len((raw or {}).get("parts", [])), flush=True)
