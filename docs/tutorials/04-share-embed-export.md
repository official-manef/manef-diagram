# Share, embed and export

Once a diagram exists — imported at `/app` ([tutorial 1](01-create-a-diagram.md))
or created as a portable view ([tutorial 3](03-create-with-mcp.md)) — these are
the ways to move it out.

## Portable view URLs

`graph_create_portable_view` (and `graph_build_view` for the public graph) return
URLs that encode the view state in the link itself. Opening one restores the graph
in the editor. They are unpersisted (`persisted: false`): no database record is
created, and the link keeps working because the graph travels inside it.

- Treat a portable URL as the content itself — anyone with the link has the graph.
- Never encode credentials or secrets into one.

## Embedding

A dedicated route renders a portable graph inside a frameable page. Framing is
scoped: `/embed/diagram` carries its own framing policy while the editor and other
routes stay same-origin or allowlisted.

- Embed only through the intended embed route; pointing an iframe at the editor is
  not supported.
- Existing allowlisted origins live in `slices/workspace/embedding.ts`; adding an
  origin is a policy change, not a link trick.
- The embed renders the portable graph the same way the editor does, so the
  E2E suite (`tests/diagram-embed.e2e.ts`) is the regression gate.

## Export from the editor

The editor exports the current document in three lossless formats — JSON,
Markdown and an n8n workflow when the document carries one:

- **JSON** — the canonical envelope; re-imports losslessly.
- **Markdown** — human-readable Mermaid projections plus exactly one authoritative
  `manef-diagram-json` fenced block. Edit structure only inside that block; editing
  a projection does not change the canonical document.
- **n8n** — round-trips an imported workflow (`extensions.n8n`). Arbitrary diagram
  shapes have no executable n8n binding; export asks for an imported workflow
  instead of inventing node types.

## SVG

Rendering an SVG of the current or previewed diagram is a staged epic item
([PROGRESS-2026-11-05.md](../PROGRESS-2026-11-05.md)) — the renderer path exists
(`slices/architecture-inventory/lib/diagram-render.ts`, Pele with Mermaid fallback)
but check the current UI for a completed export action before promising one. A
theme-aware standalone SVG must carry its styling inside the file, not the editor's
CSS.

## Verification checklist

1. Portable URL opens and restores the exact graph.
2. Export → import round-trip is semantically identical.
3. Markdown still contains exactly one canonical fenced block.
4. Embed only allows the intended origins and the editor stays same-origin
   (`bun run test:e2e -- tests/diagram-embed.e2e.ts`).

For the format rules behind every lossless guarantee, see
[the document contract](../diagram-document.md).
