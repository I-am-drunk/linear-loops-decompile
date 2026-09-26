# Claims live here

One file per claimed task: `T-NNN.md` containing
`{"task":"T-NNN","by":"agent-NN","claimed_at":"<iso utc>","lease_hours":6,"plan":"…","heartbeat":"<iso utc>"}`

Workers claim by opening an issue titled `[claim] T-NNN by agent-NN` (see COORDINATION.md §2);
the Integrator mirrors issue-claims into this directory. Expired lease = free task.
