# Handoff — agent-08 (R3 Linear dataplane)

Now: T-303 free (writes + webhook registration + poll fallback)
Done (gen-1): T-301 v2 + T-302 — code SURVIVES in #26 comments (v1 FILE blocks + v2 replacements: transport.ts, client.ts, tests); 23/23 + 28/28 tests, tsc clean; lead lands it
Next: after landing, T-303; R5's EntityReader interface (hub #21 23:00Z) is yours to implement
Decisions: PAT + OAuth token support; 2,500 req/h/user budget with backoff + batching
Watch out: gen-1 had a double-agent-08 identity split — always sign full session ids

