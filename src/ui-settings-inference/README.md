# Inference settings mapping

ST3 maps provider snapshots to the existing settings rows. It adds no CSS,
network calls, pairing protocol or persistence. The provider fields and copy
are our product design, not claims about Linear's settings.

| Input | Display |
| --- | --- |
| A completed reachability probe | Connected or error, including keyless endpoints |
| No probe, required API key absent | Disconnected with a credential explanation |
| No probe for other auth kinds | Checking; absence of an optional key proves no failure |
| `baseUrl` | The caller's public endpoint snapshot; credentials stay separate |
| No selected model | No default model; discovery never chooses one implicitly |
| A selected model missing from discovery | The saved value, labelled “not listed”; it can be cleared |

The caller supplies masked credential status and clears stale reachability
after changing connection configuration. It handles row events, validation,
save/reload and fresh provider probes. An empty model value clears the default.
No discovered models and no saved model omit the select entirely.

Pairing gets a connection action and no API-key field. This does not establish
T3 compatibility or say how an external provider stores credentials.

Evidence and boundaries: [settings design](../../docs/plan/settings.md),
[inference contract](../../docs/plan/inference.md),
[shared row reference](../ui-settings/UI-REFERENCE.md), and
[T3 verification](../../docs/plan/t3-code-connect.md).
