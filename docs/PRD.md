# MANEF Architecture Inventory — PRD

## Goal

Provide one reusable architecture/inventory feature that visualizes MANEF products, infrastructure and relationships without coupling the graph model to a frontend framework.

## Canonical implementation

- Product: MANEF Architecture Inventory
- Production origin: `https://diagram.manef.dev`
- Canonical UI: Svelte 5 + SvelteKit
- Backend: Convex Cloud, optional until configured
- Runtime hosting: Vercel, with adapter-node available for separately managed hosts
- Reusable contract: `slices/architecture-inventory/index.ts`

## Acceptance

1. Flow and graph layouts share one graph contract.
2. Search, tags, direct/component trace and focus work without backend credentials.
3. Nodes expose multiple labeled input/output ports; one output can connect to multiple inputs.
4. Node/edge edits and JSON import/export validate against the same contract.
5. The TypeScript core can be consumed by SvelteKit and Next.js without framework imports.
6. Private repository/domain inventory is never hardcoded into the reusable public seed.
7. Convex persistence remains opt-in and protected server-side.
8. Release gates include Bun frozen install, check, lint, unit tests, production build and browser smoke when available.
9. Portable links restore validated graph data and view filters; invalid or oversized links show a recoverable error with the default graph.
10. Namespaced tag facets combine alternatives within a namespace and intersect namespaces, including arbitrary user-supplied namespace names.

## Revision evidence — 2026-10-08

- Canonical canvas is `/app`. `/diagram` must redirect there and keep the query string, instead of 404ing into the starter `/apps/dashboard` recovery link.
- The production origin responds with the Vercel adapter. README and the public inventory must not call Dokploy or adapter-node the current runtime. `platform:vercel` on `diagram.manef.dev` matches that origin.
- The bundled graph stays the public seed. Open Silong, Convex Cloud, and Dokploy remain inventory references, not canvas nodes. Private repository or domain inventory stays out of the seed.
- The canvas fits that public graph on load. Flow columns are centered so cards do not stack. Node cards show kind, platform, and project facets. No node is preselected, because a connected-component highlight would mark the whole map.
- Live sign-in redirects to WorkOS AuthKit. Direct Google OIDC stays the compatibility adapter. Consent, callback, refresh, and owner-isolated notes are still an acceptance gate.
- `POST /api/mcp/server` is the MCP route. An unauthenticated production POST returned 401. Tool output was not exercised. The handler reads the public seed only.
