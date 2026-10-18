# Project contract

## Product binding — MANEF Architecture

This starter is now bound to the MANEF Architecture product. The authoritative PRD is `docs/PRD.md`. Production origin is `https://diagram.manef.dev`; Svelte 5 is the reference renderer, while `slices/architecture-inventory/` owns the framework-neutral TypeScript contract reusable from SvelteKit and Next.js. A node may contain a child diagram of that same contract, at most three levels deep. The bundled public graph keeps nine services and adds the public modules around them so graph view is a readable cluster; only `diagram.manef.dev` ships a nested component diagram, and that diagram describes this product. Convex snapshots still store the flat graph. Convex Cloud is optional persistence. Production currently uses the Vercel adapter; the Node adapter supports Dokploy. Private infrastructure inventory must never be copied into the bundled public seed.

This is the maintained map of shared invariants and their authoritative files. Read it
at the start of each session. It records the current template, not a hypothetical client
application. Detailed implementation guidance lives in [architecture](docs/architecture.md).

## Public landing ownership

The accepted MANEF direction is a studio serving people and agents, with independent
products and separate Connectors/Models/Operations roadmaps. Web owns the human
ecosystem catalog and read-only `/ecosystem/v1.json`; the existing MSO installer
catalog remains a separate contract. Diagram's directory is a product/map reference,
not a marketplace or shared-account authority. Agent@Manef links to its selected
source repository; its context demo uses the existing `context` surface. See
`docs/PRD.md` for current scope versus future product direction.

`https://manef.dev` owns the MANEF ecosystem landing. `https://diagram.manef.dev/`
introduces Manef Diagram and links to its canonical application at `/app`. The
directory, guide and audit remain available as map references. The ecosystem demo's
canonical URL is `https://manef.dev/workspace`; legacy Diagram workspace URLs redirect
to MANEF. One Svelte implementation is served at `/embed/workspace/[[surface]]` for
the MANEF host, with no session or backend connection. Its browser-local state remains
on the Diagram origin, and every surface remains explicitly a simulation.

The embedded demo permits framing and navigation messages for the canonical MANEF
host and its staging origin. Development additionally permits loopback parents;
hosted Diagram instances do not send navigation to loopback origins. Surface links
retain preview mode, and storage denial or malformed saved demo state must leave a
usable local demo. Client-local demo forms stay disabled until mount initialization completes, so early input cannot become a native server request. Without JavaScript, the demo points users to public project briefs. Private app routes retain their separate framing policy.
Host announcements must match the parent window and approved origin; navigation
must keep working after a full iframe reload that changes the document referrer.

## Website support chat

LiveChat (Text Platform) supplies the website widget and visitor conversations. Each
Airin tenant owner connects their own LiveChat license to an agent in the same tenant.
The website uses its owner's license; signing in as a visitor does not select a
separate owner account. The former direct Airin embed is disabled. Installing the
replacement requires the actual LiveChat script/license for Diagram. See
[integrations](docs/integrations.md#livechat-and-airin).

## Authentication provider boundary

MANEF targets the existing WorkOS project for its shared production identity. The WorkOS adapter and
rollout requirements are documented in [WorkOS sign-in](docs/workos-login.md). Direct
Google OIDC remains a compatibility opt-in; no Google-owned data is silently migrated
by email. Private ownership uses the verified issuer and subject. The client, query cache and private form lifetime follow that identity; token delivery
rejects an expected identity that differs from the cookie owner. Hosted login, backend
JWT configuration, and real production consent are separate acceptance gates.

## Current baseline

- One SvelteKit app uses Svelte 5 Runes and Bun. `bun.lock` is the only package lockfile.
- Convex is the default backend; its frontend connection is optional. A clean clone
  starts without credentials. Status metadata is public; notes require backend ownership checks.
- Feature UI lives in root `slices/<slug>/`; cross-slice imports use `$features/<slug>`
  barrels. Routes are thin framework adapters; the existing app page family uses one registry.
- Payments and email are disabled transport building blocks, preferring DOKU and Resend
  when selected. Google auth/private notes, BYOK AI and remote MCP are implemented opt-ins. GCP service
  adapters remain recipes; Node hosting and an isolated Cloudflare Workers pilot target
  are implemented. Workers acceptance is separate from Vercel production acceptance.
- Workspace and settings examples are local UI state. They provide no identity, ownership
  or tenancy guarantee. Verified issuer and subject own private notes. Payment/email lifecycle acceptance
  remains product work; provider credentials and product deployment need tenant-specific setup.

## Authoritative inputs

| Concern                              | Source of truth                                                           |
| ------------------------------------ | ------------------------------------------------------------------------- |
| Runtime and dependencies             | `package.json`, `bun.lock`, `.node-version`                               |
| Release identity                     | `version.json`; synchronize with `bun run version:bump`                   |
| Public brand and metadata            | `src/lib/config/app.ts`, `src/lib/config/metadata.ts`                     |
| Feature definitions and navigation   | Slice definitions and `slices/app-shell/registry.ts`                      |
| Theme and reusable UI                | `src/routes/layout.css`, `src/lib/theme.svelte.ts`, `src/lib/components/` |
| Public links and workspace ownership | `src/lib/config/navigation.ts`, `slices/workspace/surfaces.ts`            |
| Assets and generation inputs         | `assets.config.ts`; outputs follow [assets.md](docs/assets.md)            |
| Backend schema and API               | `src/convex/`; `_generated/` is CLI-produced and committed                |
| Private integration selection        | `src/lib/server/integrations/config.ts`                                   |
| Authentication                       | `src/lib/server/auth/`, `src/convex/auth.config.ts`                       |
| AI/MCP selection and request access  | `src/lib/server/ai/`, `src/lib/server/mcp/`, `src/lib/server/access.ts`   |
| Environment requirements             | `.env.example`, [consumer matrix](docs/environment.md)                    |

Do not duplicate version pins, menus, brand constants or provider checks in other files.
Ordinary feature-local copy stays local; sharing configuration does not require turning
every value into a global option. Indexing needs `PUBLIC_SEO_INDEXABLE=true` and an
explicit origin; preview sites and demo app routes remain noindex. Metadata and crawler
documents share the SEO settings in `src/lib/config/metadata.ts`.

The landing, directory, guide, audit, editor and app chrome consume the same semantic
light/dark tokens and theme preference. Legacy editor theme names are compatibility
aliases, not separate palettes. Blocked browser storage uses a memory-only preference.

## Trust and runtime boundaries

Private reads, writes and actions authenticate and authorize ownership/tenant membership
on the backend. Validate arguments, results and business limits; bound growing reads.
Public metadata is an explicit exception, never a private-feature auth pattern.

Public config, assets, prompts and browser data contain no secrets. Immutable shared
configuration is allowed; mutable user/session state shared across server requests is not.
The bounded burst limiter is a documented exception for hashed counters only, not a session
or credential store; multi-instance deployments need an external rate limit.
SvelteKit server modules and Convex actions use the environment of their executing runtime.
Convex imports cannot depend on SvelteKit aliases or environment modules. BYOK keys and
chat history stay in current request/tab memory. Tool output is untrusted data; MCP calls
require configured endpoint/tool allowlists and explicit review, never automatic model execution. See the focused
[Svelte](docs/svelte-best-practices.md) and [Convex](docs/convex-best-practices.md) rules.

Switching provider/server context clears its former BYOK credential. Setup refreshes
retain still-approved selections, validate their complete response before rendering,
and clear keys belonging to removed selections. Clearing the page invalidates pending
callbacks so old requests cannot restore cleared state. Tool discovery requires unique
names and valid schemas before rendering or manual execution.

## Adapting this contract to a product

The product PRD is `docs/PRD.md`; deployment ownership and live acceptance evidence must stay revision-specific. When creating a
product, add `docs/PRD.md` from [the template](docs/prd-template.md), then replace this
paragraph with its link and current scope. Record the product owner, deployment/operations
owner, enabled capabilities and acceptance evidence there; never invent names or credentials.
Keep product identity in its code config and runtime values in their environment.

## Maintenance and proof

Update this contract in the same change that moves an authoritative file, changes a
shared boundary/default, activates a capability or changes its ownership model. Update
the affected detailed guide too. Routine component edits need no contract rewrite.

Checks live in `package.json` and [CHECKLIST.md](CHECKLIST.md); evidence belongs to the
actual revision and environment tested. Keep transient progress in the task/PRD, not
as a second status ledger here. Use [agent-workflow.md](docs/agent-workflow.md) to resume
from current files and preserve clear, compact handoffs.
