# Diagram format reference

The authoritative contract is [diagram-document.md](../diagram-document.md) and
[slices/architecture-inventory/lib/document.ts](../../slices/architecture-inventory/lib/document.ts).
This tutorial is the practical tour an agent needs to build documents that pass
validation the first time.

## Envelope

```json
{
	"format": "manef-diagram",
	"schemaVersion": 1,
	"title": "Service map",
	"graph": { "schemaVersion": 1, "nodes": [], "edges": [] },
	"ui": { "diagramMode": "flow", "positions": {}, "layouts": { "[]": {} } },
	"extensions": {}
}
```

`ui` and `extensions` are optional. The importer also accepts a bare graph
(`{"schemaVersion":1,"nodes":[…],"edges":[…]}`) and untagged `{graph,…}`
objects, migrating them to version 1. Explicit unsupported formats or versions
fail with an actionable error.

## Nodes

```json
{
	"id": "api",
	"label": "Public API",
	"subtitle": "optional",
	"tags": ["service"],
	"group": "optional",
	"status": "active",
	"inputs": [{ "id": "in", "label": "requests", "kind": "optional" }],
	"outputs": [{ "id": "out", "label": "responses" }]
}
```

- `status` is `"active"`, `"proposed"` or `"private"` (optional).
- Ports are `{ id, label, kind? }`; IDs are unique within the node.
- `child` embeds another graph of the same contract (nested diagram). Maximum
  nesting depth is 3, root at depth 0.
- `views` holds extra authored diagrams on this node — see below.

## Edges

```json
{
	"id": "client-to-api",
	"source": "client",
	"sourcePort": "out",
	"target": "api",
	"targetPort": "in",
	"label": "HTTPS",
	"tags": []
}
```

Endpoints must resolve to existing nodes, and the port IDs to existing ports on
those nodes. Connections are unique; duplicate endpoint/port connections are
rejected.

## Views (the 33 bundled kinds)

Extra Mermaid-style diagrams attach to a node as `views: NodeView[]` with
`{ id, kind, title, format: "md" | "json", source }`:

| Group     | Kinds                                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------------- |
| Process   | Flowchart, sequence, state, user journey, Ishikawa, swimlane, event modeling, agent flow                          |
| Structure | Class, entity relationship, C4, block, architecture, packet, mindmap, tree, requirement, use case, railroad, info |
| Planning  | Gantt, timeline, Git graph, Kanban                                                                                |
| Charts    | Pie, quadrant, XY, radar, Sankey, treemap, Venn                                                                   |
| Strategy  | Wardley map, Cynefin                                                                                              |

A view keeps its authored source; conversions do not translate one diagram
language into another.

## UI state

`ui` may retain `flowDirection` (`LR`, `RL`, `TB`, `BT`; default LR), theme, layout
mode, trace/focus mode, search/filter state, open child path, camera pan/zoom and
`ui.positions` (`{x,y}` per node ID) plus `ui.layouts` keyed by `JSON.stringify(path)`
(root key `"[]"`). Diagram-type browsing is transient and is **not** serialized.

## Limits and JSON safety

- Document text import/export is bounded to 5,000,000 characters; the validator
  bounds nesting and value count.
- Integers must be inside JavaScript's safe integer range; store larger identifiers
  as strings. Negative zero is rejected. Store precision-sensitive decimals as strings.
- Cycles, accessors and unsupported JavaScript values produce errors instead of
  being silently omitted.
- Lossless round-trip means semantic JSON equality: formatting, key order and
  numeric spelling may change; values may not.
- Unknown JSON-safe fields are preserved at every boundary (document, graph, node,
  port, edge, view, inventory, UI) — safe for provider extensions such as
  `extensions.n8n`.

## Validation

Use `validateDiagramDocument(value)` from the source contract to check shape and
JSON safety without mutating anything; `parseDiagramDocument` / `parseDiagramMarkdown`
return a validated document or an actionable error. When a snippet is rejected,
re-read the error — it names the violated rule (missing port, duplicate ID,
unsupported version, size limit).
