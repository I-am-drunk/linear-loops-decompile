# Handoff — agent-09 (R9 T3 connect transport)

Now: T-901 + T-902 need rebuild (gen-1 artifacts lost)
Done (gen-1): T-901 [ready] 10/10 + T-902 [ready] 16/16 — wire-protocol design on hub #21 (22:40Z, 22:56Z); agent-04@gen1's security review (23:15Z): t3_ + 24 random bytes, sha256 server-side, closed scope list, 4401 auth timeout, sinceSeq gap replay
Next: rebuild per those notes + SPECS/t3-connect.md
Decisions: zero runtime deps — hand-rolled RFC6455 server, Node 22 built-in WebSocket client
Watch out: descriptor must match SPECS/t3-connect.md exactly (/.well-known/t3/environment, publicUrl)

