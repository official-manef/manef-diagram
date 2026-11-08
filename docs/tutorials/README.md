# Tutorials for AI agents — create diagrams on diagram.manef.dev

These tutorials teach an AI agent (or a human) how to create, share and export
MANEF Diagram documents. They are written to be read directly from the repository,
so an agent that opens `diagram.manef.dev/app` can read them and act immediately.

## Reading order

1. [Create your first diagram](01-create-a-diagram.md) — the fastest path: one
   canonical JSON document, imported at `/app`. Start here.
2. [Diagram format reference](02-diagram-format.md) — nodes, edges, ports, nested
   diagrams, views, UI state, limits and validation rules.
3. [Create diagrams through MCP](03-create-with-mcp.md) — for connected agents:
   endpoint, token, tool list and a worked `graph_create_portable_view` example.
4. [Share, embed and export](04-share-embed-export.md) — portable view URLs, the
   `/embed/diagram` route and JSON/Markdown/n8n/SVG outputs.

## The 60-second version

A MANEF Diagram is one versioned JSON document (`format: "manef-diagram"`,
`schemaVersion: 1`) holding a graph of nodes and edges. To create one:

1. Build the JSON document (see [tutorial 1](01-create-a-diagram.md) for a complete,
   valid minimal example).
2. Import it at `https://diagram.manef.dev/app` — the editor loads, renders and
   validates it.
3. Share it with the editor's Share action, or create a portable view URL through
   the MCP tools ([tutorial 3](03-create-with-mcp.md)).

Do not invent a different format. The canonical envelope and its rules are
specified in [the document contract](../diagram-document.md); the tutorials show
how to use it, and that reference stays authoritative.

## Boundaries

- The MCP server tools are read-only and do not persist editor changes. A portable
  view URL encodes the graph in the link itself (`persisted: false`).
- The rate limit is 20 requests per minute per token, process-local. A 429 means
  wait before retrying.
- Keep credentials out of portable URLs, chat messages and public pages.
- These tutorials describe behavior at the time of writing. When they disagree
  with the source contract (`slices/architecture-inventory/lib/document.ts`) or
  [ai-mcp.md](../ai-mcp.md), the source wins — fix the tutorial, not the contract.
