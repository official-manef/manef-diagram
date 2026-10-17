# MANEF Architecture Inventory — PRD

## Cloudflare Workers pilot — 11 October 2026

Compare an isolated Workers deployment against Vercel production from source
`7d2b3be13c4d8310a38e634b7e3d1c6c2ddad48c`. Keep production DNS and backend unchanged.
Accept desktop/mobile canvas, navigation, public endpoints, all ten MCP tools,
anonymous denial and noindex behavior. Measure alternating HTTP/MCP samples from one
client and document limitations. Pilot authentication now uses the validated existing
Diagram Convex WorkOS credential and an independent Worker session secret. Real login
as official.manef@gmail.com, reload and private notes CRUD/cleanup passed. Automatic forced refresh, local logout and signed-out denial also passed. Private
inventory and two-account isolation remain separate acceptance gates. The production callback remains default and production remains
on Vercel with its old credential. Public or pilot QA does not authorize migration.

Public pilot acceptance and remaining gates: [Cloudflare pilot QA](cloudflare-pilot-qa.md).

## Goal
## Accepted ecosystem direction — 2026-10-14

The owner selected a studio for developer, business, enterprise and agent consumers.
Diagram supports architecture/dependency work and diagram creation; a wider general
diagramming scope is a future expansion, not a promise of feature parity with all
canvas tools. Diagram remains independently useful. MSO owns operational execution;
Agent@Manef owns portable context; the public workspace remains a simulation.

The source-backed ecosystem inventory and human catalog live in MANEF Web. This
directory now includes Agent@Manef with a source-first entry and a valid context-demo
link. Open marketplace, common identity, independent Connectors/Models/Operations,
cloud offers, billing and complete multilingual parity retain their own acceptance
work. New agent consumers use read-only discovery plus explicit owner authorization;
public metadata does not become a writable or executable API.

## Catalog entry journeys — 2026-10-14

MANEF Web owns concise bilingual project overviews and public Markdown briefs. Diagram’s first guide now leads from selecting a service to inspecting connections and exporting JSON. Public navigation offers sign-in only when authentication is enabled; the map remains accessible without an account. Browser-local Models and Operations forms wait for initialization before accepting input and are checked for save/reload behavior. These changes do not activate identity providers, host execution or real model routing.

## Architecture inventory goal

Provide one reusable architecture/inventory feature that visualizes MANEF products, infrastructure and relationships without coupling the graph model to a frontend framework.

## LiveChat and per-tenant Airin — 2026-10-16

The owner corrected the chat integration: LiveChat supplies the widget; each Airin
tenant owner connects their own LiveChat license to an agent in their tenant. Diagram
visitors retain separate LiveChat sessions under the website owner's license. Visitor
sign-in does not switch the owner account. The shared direct Airin embed is removed.
The replacement awaits the actual Diagram LiveChat snippet/license and verification
of its tenant/agent connection. Real AI replies and human handover remain acceptance
work until tested on that licensed connection.

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
11. A node may contain a child diagram of the same contract. Selecting that node again opens it, up to three levels deep. The public seed keeps nine services and adds their public modules. A seeded child describes this product and does not add private infrastructure.

## Landing ownership — 2026-10-11

- The ecosystem homepage belongs to `manef.dev`. Diagram's root is a product landing
  with an explicit `/app` entry point, guide, features and a link back to MANEF.
- `/products`, `/guide` and `/audit` remain Diagram references. The ecosystem workspace
  belongs to `manef.dev/workspace`; Diagram's old workspace addresses redirect to that
  host, retaining the selected surface and query. MANEF embeds one Svelte demo module
  from `/embed/workspace`. Local demo data remains on the Diagram origin.

## Shared theme, workspace ownership and authentication QA — 2026-10-11

- One palette and one light/dark/system preference apply to public pages, the editor
  and app chrome. Legacy preference migration and blocked storage must keep navigation
  and editor controls usable. Public navigation and canonical workspace links share
  a single registry; the embedded module reuses the existing surface registry and UI.
- The MANEF host validates navigation messages against the exact Diagram origin and
  iframe source, retains browser Back navigation, and leaves cross-product links at
  the top level. The embedded route is noindex and loads no private session or Convex
  client. This is a browser-local simulation, not a deployed multi-tenant workspace.
- Live Convex status and anonymous private-read rejection passed on the linked
  `dutiful-zebra-689` deployment. WorkOS Production and the application's callback
  match, but Google returned `redirect_uri_mismatch`; WorkOS `verifyRedirectUri`
  returned false for its Google callback. Configuration state `Valid` is not login
  acceptance. Real consent, callback, refresh, private CRUD and two-account isolation
  remain blocked. See [WorkOS sign-in](workos-login.md) for the precise repair.
- Backend WorkOS JWT deployment remains unverified: the connected Convex API rejected
  its credential, and repository Actions secrets metadata contains no deployment key.
  Do not operate on another connected Convex project to work around that limitation.

## Phone canvas and MCP guide — 2026-10-11

- The Diagram landing follows manef.dev's monochrome studio palette, editorial
  headings, ruled feature grid and square primary actions. Product copy and /app,
  guide and MCP entry points remain specific to Diagram; the graph editor retains
  its working layout. Both themes must reflow at 320/390px and desktop widths.
- Every main public, demo and /apps page must remain inside a 320/390px phone.
  Mobile buttons/navigation use at least 44px targets; text fields use 16px text.
  Demo navigation collapses so content starts above the fold. Demo nodes support
  tap/keyboard selection with links between map and inspector; phone scrolling
  must not move stored node positions. Audit tables may scroll within their card.
- Workspace page search opens a native modal inside the viewport, supports filtering
  and restores focus to its trigger. The simulated support panel stays contained
  on narrow phones and scrolls internally when its content grows.

- Phones keep the readable service list and can switch to the bounded visual canvas.
  Empty-space dragging pans the phone canvas; zoom, fit, selection and physics controls
  remain available. Scroll outside the canvas to move through the page.
- Header actions wrap; filters, highlighting and focus are available on phones.
  Services and connections link to the inspector; a return link reaches the map.
  The phone inspector reuses output selection and input connection actions so users
  can create connections from the readable list without targeting scaled canvas ports.
  Long names wrap, empty results recover, and added Mermaid views remain visible.
- The product landing and MCP guide share endpoint copying and connection instructions.
  Ten actual graph tools are advertised from the reusable tool-name contract. Access
  still requires the private deployment bearer token. No OAuth or private inventory
  access is added; the demo playground remains a simulation.
- Acceptance coverage includes 320px list/canvas reflow, pan and zoom, filter/focus,
  connection creation/editing, JSON/import/export, component navigation, Mermaid views,
  clipboard success/denial and complete read-only MCP discovery. Release evidence
  is recorded for the exact CI and deployment revisions after these gates pass.

## Production MCP acceptance — 2026-10-11

- The official SDK client 1.30.0 initialized the production endpoint, discovered all
  ten read-only graph tools and successfully called each one on release `a46a4417`.
  Public counts were 23 nodes and 22 edges. Portable-view creation returned
  `persisted: false` and did not change server counts.
- Invalid tool inputs, anonymous/wrong-token denial, untrusted Origin denial and
  client cleanup passed. [AI/MCP setup](ai-mcp.md) includes the runnable connection
  example, tool arguments, rate-limit behavior and exact deployment evidence.
- Token storage is encrypted and correctly configured; production and preview share
  the current credential. Token rotation is a separate operational follow-up. OAuth,
  arbitrary client UI compatibility, private inventory and writes are not accepted.

## Revision evidence — 2026-10-09

- `diagram.manef.dev` on the public map has a component diagram: public directory, public map, demo workspace, graph contract, and the MCP read API. Other public services do not invent an inner diagram. A component diagram can contain another one, up to three levels, but the seed only fills the first.
- The second click on a selected node with a child opens that diagram. The mobile list uses the same gesture. A breadcrumb returns to an ancestor. Add component diagram creates a local child and does not write the seed, Convex, DNS, or a live tool.
- Share of an unedited map stays a short link and can include repeated `open` parameters. Export downloads the whole map. Anonymous MCP POST behavior is unchanged. Convex snapshots remain a flat graph.

## Revision evidence — 2026-10-08

- Canonical canvas is `/app`. `/diagram` must redirect there and keep the query string, instead of 404ing into the starter `/apps/dashboard` recovery link.
- The production origin responds with the Vercel adapter. README and the public inventory must not call Dokploy or adapter-node the current runtime. `platform:vercel` on `diagram.manef.dev` matches that origin.
- The bundled graph stays the public seed. Open Silong, Convex Cloud, and Dokploy remain inventory references, not canvas nodes. Private repository or domain inventory stays out of the seed.
- The canvas fits that public graph on load. Flow columns are centered so cards do not stack. Node cards show kind, platform, and project facets. No node is preselected, because a connected-component highlight would mark the whole map.
- The public canvas keeps service names whole, draws the relationship on each line, and defaults highlight to direct neighbors. Search, tags, and focus refit the visible services and the counts follow that view. An empty match says so. Export downloads JSON. Share copies a short link for the unedited public map.
- Each bundled connection has its own label. A filter that matches one end keeps that connection and shows the other service as linked; the service count stays the match count. The dashboard does not include an interaction-kit demo. Live backend status does not print the framework stack.
- The public site also has a product directory, guide, and audit. `/workspace` is a browser-local simulation with two isolated demo workspaces. It can mark catalog installs, sample connectors, routing, context, and MCP tool results, and it labels those as simulations. It does not install software, call a model, change DNS, or write the public seed. The editable public map remains `/app`.
- The public directory and the browser-local workspace are separate slices. Directory copy stays in the directory catalog. Graph reads, layout, trace, and portable links stay in the architecture-inventory contract, including the ten MCP tools. Audit rows use a unique id so the snapshot renders. Workspace routes read one surface list. The demo playground calls that same contract and still returns `simulation: true`.
- Narrow screens list the services at full size instead of scaling the desktop canvas down. The landing page shows those services. `/apps/*` speaks as the MANEF map: MANEF sign-in, no starter workspace, no library-version dashboard.
- Live sign-in redirects to WorkOS AuthKit. Direct Google OIDC stays the compatibility adapter. Consent, callback, refresh, and owner-isolated notes are still an acceptance gate.
- `POST /api/mcp/server` is the MCP route. An unauthenticated production POST returned 401. Tool output was not exercised. The handler reads the public seed only.

### Codex MCP acceptance — 2026-10-11

- Replacement token: installed Codex 0.160.1 MCP runtime reported bearerToken /
  connected and called all ten read-only tools successfully on production 99adbbe.
- Light load: 24 graph_status calls, concurrency two, all succeeded in 4,039 ms;
  p50 270 ms / p95 351 ms / max 929 ms. Health check after 65 seconds passed.
- Public landing and MCP guide now provide a copyable secret-free Codex table,
  masked PowerShell token entry, relaunch instructions and token-rotation troubleshooting.
- Remaining acceptance: desktop UI click-through, physical-phone Safari, larger
  capacity testing and distributed rate limiting. No production 429 was observed;
  this run does not establish a global ceiling or prove recovery from throttling.
- Detailed inputs, expected results and limits: [AI/MCP](ai-mcp.md).

### Desktop style acceptance — 2026-10-11

- Public pages and demo workspace headings explicitly retain their size and weight
  after the Tailwind reset. Product filters reuse the existing control style.
- The guide uses a 200px section navigation column and a flexible article on desktop,
  with one column below 900px. Standalone public sections keep header-aligned padding.
- MCP instructions show numbered steps and tool lists show bullets. Existing endpoint
  and secret-free client configuration copying remain covered by browser regression tests.
- Desktop regression coverage checks headings on the landing, directory, product,
  guide, audit and workspace, plus guide columns at 1440px and 1024px.
- Demo card stacks keep their content at natural heights; the diagram canvas does
  not stretch to the inspector height. Browser checks bound form buttons and canvas size.
- Production visual acceptance requires screenshots of all main UI route families,
  representative light/dark themes, and a mobile regression check after deployment.
