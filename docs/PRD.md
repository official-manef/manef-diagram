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
- The public canvas keeps service names whole, draws the relationship on each line, and defaults highlight to direct neighbors. Search, tags, and focus refit the visible services and the counts follow that view. An empty match says so. Export downloads JSON. Share copies a short link for the unedited public map.
- Each bundled connection has its own label. A filter that matches one end keeps that connection and shows the other service as linked; the service count stays the match count. The dashboard does not include an interaction-kit demo. Live backend status does not print the framework stack.
- The public site also has a product directory, guide, and audit. `/workspace` is a browser-local simulation with two isolated demo workspaces. It can mark catalog installs, sample connectors, routing, context, and MCP tool results, and it labels those as simulations. It does not install software, call a model, change DNS, or write the public seed. The editable public map remains `/app`.
- Narrow screens list the services at full size instead of scaling the desktop canvas down. The landing page shows those services. `/apps/*` speaks as the MANEF map: MANEF sign-in, no starter workspace, no library-version dashboard.
- Live sign-in redirects to WorkOS AuthKit. Direct Google OIDC stays the compatibility adapter. Consent, callback, refresh, and owner-isolated notes are still an acceptance gate.
- `POST /api/mcp/server` is the MCP route. An unauthenticated production POST returned 401. Tool output was not exercised. The handler reads the public seed only.
