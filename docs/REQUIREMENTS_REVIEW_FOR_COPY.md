# Requirements review — Codex

### Do not reuse graph state from a previous scan

> The system must not reuse graph nodes or edges from a previous scan when building the graph for the current workbench state.

| Check | Result | Notes or suggested change |
| --- | --- | --- |
| **Necessary** | Pass | Prevents stale circuit topology from being used after a component is added, removed, or moved. |
| **Unambiguous** | Fix | Define the scope as every topology scan and make clear that the graph is reconstructed from current scan data only. |
| **Singular** | Pass | Nodes and edges are both parts of the same graph-state rule. |
| **Verifiable** | Pass | Change the board between two scans and verify that the second graph contains no nodes or edges that exist only in the first scan. |
| **Feasible** | Pass | Rebuilding the graph from each scan is feasible; the implementation must retain only the current scan data while the graph is being constructed. |
| **Complete** | Fix | State the required positive outcome: a complete graph built only from the current scan. |
| **Consistent** | N/A | No other authoritative requirement or design decision was supplied with this review. Check for conflicts when the active specification is available. |
| **Traceable** | Fix | Add a link to the stakeholder need or design decision that requires stateless graph construction, plus a test that changes the board between consecutive scans. |

**Suggested rewrite:**

> For every topology scan, the system shall construct the complete circuit graph solely from the current scan data and shall not retain nodes or edges from any previous scan.

**Decision:** Changes requested

**Author response:** <!-- Replace the original requirement with the suggested rewrite, or explain an alternative. -->

**Re-review completed:** No
