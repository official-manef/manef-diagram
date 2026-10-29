# MANEF Context Graph

`diagram.manef.dev` is both an interactive diagram editor and a portable context-map surface for agents.

## Context graph rather than only a note graph

The graph stores explicit relationships, input/output ports, status, searchable inventory references, and namespaced facets. An agent can request a bounded view and receive a navigable URL instead of only a screenshot or local vault reference.

## Facet convention

Use namespaced tags for machine-readable context:

- `project:<slug>` — project or workstream
- `platform:<slug>` — runtime, provider, or client surface
- `agent:<slug>` — agent responsibility or provenance
- `kind:<slug>` — product, service, decision, memory, person, document, backend, deployment, etc.
- `source:<slug>` — GitHub, MSO, Gmail, Notion, manual, etc.

Selections are OR-ed inside one namespace and AND-ed across namespaces.

## Navigable views

The `/app` route is canonical. `/diagram` redirects to `/app` and preserves the query string. `/app` accepts repeated `tag`, `seed`, and `open` parameters plus `q`, `mode=flow|graph`, `trace=direct|component`, `focus=1`, and optional `graph=<JSON>` for bounded portable graphs. Each `open` value is a node id. The second click on a selected node that has a child, or Open component diagram, shows that child. Repeating `open` walks the same path, for example `open=architecture`. An unknown id leaves the public map in place. Component diagrams use the same contract and stop at three levels below the root. The public seed only fills the first level, on `diagram.manef.dev`. Convex snapshots still store the flat graph; the canvas does not save them.

The UI copies a portable URL and puts that same URL in the address bar. An unedited public map omits the graph payload so the link stays short. An edited map still includes bounded `graph` JSON. Direct neighbor highlighting is the default; `trace=component` still selects the whole connected piece. All valid repeated seed values are restored as a selection set; duplicate/missing IDs are ignored without losing later valid IDs. Focus uses the complete selected trace independently of transient hover emphasis. Sharing preserves the full selected seed set, including within a component path.

## MCP surface

The MCP endpoint is `/api/mcp/server`. Existing read-only graph tools remain available. Context-graph tools add faceted query and navigable URL generation. Portable graph creation is stateless: the graph is encoded into the URL and validated by the same graph contract before rendering.

Portable links contain the graph in their query string. Share only content intended for every recipient; links can appear in browser history and host logs. Portable generation enforces two bounds from core.ts: at most 12,000 decoded graph characters and at most 16,000 bytes for the entire percent-encoded request target, including filters, seeds and component paths. Unicode therefore consumes more wire budget than its JSON character count. Oversized generation fails before clipboard/history changes or a successful MCP tool result; use complete JSON/Markdown files instead. Invalid or oversized URLs that reach the app recover to the default map. A URL rejected by the host before the app loads cannot display an in-app recovery message. Custom proxies may impose a lower request limit. These links do not save personal snapshots to Convex.

Owner-scoped Convex snapshots are a separate optional backend capability. Agent-write persistence still needs a dedicated server-side authorization boundary with provenance and access control rather than exposing Convex mutations directly to arbitrary clients.
