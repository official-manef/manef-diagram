# Changelog

Notable template changes follow [Semantic Versioning](https://semver.org/).
During 0.x, minor releases may change template structure; patch releases are compatible fixes.

## [Unreleased]

- Give every diagram kind a deterministic compiler that restructures the actual graph — labels, levels, ports, statuses and edges — into that kind's Mermaid source, replacing the canned templates the Diagram type picker used to insert. The picker now previews the compiled result of the current graph, so one demo graph demonstrates all 24 kinds; hierarchy kinds build trees from level-decreasing edges and chart kinds derive values from connection counts. Escaping and node/edge caps keep compiled sources inside the conversion limits.
- Centre the editor's mode cluster (Flow/Graph/Diagram type) between equal side zones on desktop, and render the diagram-type listbox at the editor's control type scale — 12.5px Inter at weight 500 on 36px rows with 10px uppercase group labels — instead of the 16px default that read as foreign to the rest of the chrome. Internal wrapping in each header zone keeps the no-overlap guarantee from the header correction.

- Route flow curves as shallow cubics that slip locally between rows or behind cards instead of arcing over the whole diagram; edge labels now prefer their curve midpoints so dense maps stop piling labels at the top. Cards already paint above the edge layer, so behind-card paths stay readable.
- Refresh every dependency that has a newer release: `ai` 7.0.157 with matching `@ai-sdk` providers, `@modelcontextprotocol/sdk` 1.32.2, `convex-svelte` 0.15.1, `@sveltejs/kit` 3.1.1, adapter-vercel 7.0.2, adapter-node 6.0.1, adapter-cloudflare 8.0.2, `@playwright/test` 1.64.1, `convex-test` 0.0.66, `shadcn-svelte` 1.7.2, `wrangler` 4.156.0, `bits-ui` 2.20.2, `jose` 6.2.14, `@lucide/svelte` 1.65.0. `@convex-dev/eslint-plugin` moves to 5.0.1 with the same five project rules enabled, `vitest` to 5.0.5 and `tailwind-variants` to 4.0.0, whose breaking changes do not reach the button and badge call sites. TypeScript stays at 6.0.3 because `svelte-check` and `typescript-eslint` cap it below 6.1, and `@types/node` stays on 22 to match the pinned runtime.

- Upgrade the toolchain to SvelteKit 3, Vite 8.3.5, eslint 10.13, Convex 1.48 and zod 4.6.7. Kit 3 removed the `$lib` alias and the `$env/dynamic/*` shims, so imports use `#lib` and `$app/env/public|private`, the layout reads declared public values, cross-origin workspace redirects are allowlisted and `handleError` uses the discriminated `CaughtError`. The notes fixture declares the same env names.
- Declare every environment variable the code reads and add `env:check`; the design guide records the measured palette, type scale and dial line.

- Prevent desktop editor header controls overlapping under different platform/font metrics by wrapping intrinsic-width groups and sizing the header row automatically. Add native hit-testing across four widths and font-metric stress cases.

- Make upper-right arrows control four-way Flow layout and direction-aware ports/curves; retain separate camera-pan controls and persist direction in documents/links/history.
- Replace the Add view select with keyboard-driven temporary type previews that work without a selected node; only explicit attachment authors a view.
- Make node selection camera-neutral, including overview, explorer and Focus mode; retain an explicit Zoom selection tool. Isolate chooser keyboard shortcuts from background edits.

- Bound complete encoded portable URLs, including multilingual graphs and filters, before UI or MCP success. Restore/share all valid URL seeds and keep multi-root focus independent of hover or the singular inspector selection. Reserve fitted canvas space for navigation controls.

- Guard stale source Apply and dirty raw-draft replacement, including Refresh/import/history/component navigation and departure after exporting the current document. Isolate authored overlays from covered map focus, restore inventory/view-deletion focus, and keep traced interactive text fully opaque.

- Add trackpad/wheel, keyboard, explicit hand tool, directional controls and anchored touch pinch for canvas navigation. Preserve selection mode and expose keyboard instructions.
- Add bounded tab-local document undo/redo, node position inputs, unsaved document departure warnings and a product-home exit.
- Replace undersized overview editing targets with full-size service navigation and preview-to-edit zoom. Expose connection alternatives in Graph and Flow, respect reduced motion during dragging, and support desktop side-panel collapse.
- Add actual-seed axe regressions without rule exclusions; share the local Chromium executable override with the notes suite.

- Complete interaction recovery: keep the filter trigger clickable above its backdrop, restore rejected connection controls with inline feedback, and retain invalid demo form drafts.
- Expose a framework-neutral core entry point with standalone TypeScript consumer validation. Reject ambiguous document envelopes and keep accepted documents exportable within the JSON/Markdown transport budget. Regenerate the offline n8n converter from that same core.

- Add a versioned full-diagram document with lossless JSON/Markdown transport for nested graphs, all 24 Mermaid kinds, metadata, inventory and layout. Preserve imported n8n workflows and provide an inactive standalone converter workflow with offline regression coverage.

- Isolate private note drafts, Convex auth callbacks and query caches by verified account. Reject token delivery when a page expects another cookie owner; cover local account/issuer denial and browser failure recovery.

- Align the public runtime claim with the live Vercel origin. Dokploy/adapter-node stays an optional container target, not the current production host.
- Fit the public architecture map to the canvas, center each flow column, and show kind, platform, and project on the node instead of a truncated tag string.
- Make the public map readable: full service names, labeled connections, direct-neighbor highlight, counts that follow search and focus, a real empty state, a JSON file export, and a short share link for the unedited map. Phones get a full-size list. The landing page shows the services. Surrounding app pages no longer present a starter workspace.
- Keep every public service and connection label on the `/app` canvas. Wide levels wrap into lanes, lines route around other cards, and the side panels open over the map instead of shrinking it.
- Name each public connection instead of repeating “product”, and keep the other end of a filtered connection visible without counting it as a match. Remove the interaction-kit demo from the dashboard. The optional backend status no longer prints the framework stack.
- Split the public directory and the browser-local workspace into their own slices. Audit rows keep a unique id, workspace pages come from one surface list, and the ten graph tools execute through the architecture-inventory contract. The demo still labels its results as a simulation.

## [0.1.0] - 2026-09-29

### Added

- MANEF Architecture Inventory as a reusable Svelte 5 feature slice with a framework-neutral TypeScript graph core for SvelteKit and Next.js consumers.
- Flow and graph layouts, pan/zoom, search and tag filtering, direct/connected trace, focus mode, editable nodes, ports and labeled edges, multi-target output connections, inventory materialization, and validated JSON import/export.
- Optional Convex Cloud architecture snapshot persistence with owner authorization, validators, bounded indexed reads, graph limits, and production deployment support.
- Product PRD, framework-adapter guidance, MANEF branding assets and production metadata for `architecture.manef.dev`.
- Unit and browser acceptance coverage across narrow mobile, mobile, desktop, production preview and dev hydration.

### Security and portability

- The bundled graph contains only a small public MANEF seed; private repository/domain inventory is not embedded in reusable source.
- Optional auth, AI, MCP, payment and email capabilities remain disabled unless explicitly configured.
- The reusable core imports no Svelte, React, Next.js, browser-global or Convex runtime APIs.

## [0.6.1] - 2026-09-08

- Align Composio setup with the current session-based MCP API and direct-tools preset.
  Keep existing standalone endpoints as a documented legacy migration path.

## [0.6.0] - 2026-09-08

### Added

- Type-aware async/exhaustiveness linting, runtime/slice import boundaries and official
  Convex validator/index/table-ID rules, with executable regression fixtures.
- Optional Google OIDC login, encrypted bounded sessions and owner-scoped Convex notes CRUD.
- Optional BYOK AI chat (OpenAI, Anthropic, Google) and official MCP SDK client/server,
  configured model/tool allowlists, manual execution review and Composio guidance.
- Node adapter and nonroot container target for VPS/Cloud Run deployment.

### Changed

- Override transitive cookie to patched 0.7.2; auth/browser checks cover the compatible API.
- Feature screens load on demand while retaining initial SSR; navigation/data waiting
  use accessible skeletons, render retry boundaries and safe error correlation IDs.
- Agent contract and focused guides cover auth, AI/MCP, typed lint and deployment limits.
- Auth recipe placeholders are replaced by actual Google settings; all new capabilities
  remain off in a clean clone. No provider credentials or private project source is included.

## Unreleased

## 0.5.0 — 2026-09-08

### Added

- A compact session entry point and maintained `CONTRACT.md`, with task-specific context loading and practical Ponytail/Caveman/optional RTK guidance.
- An environment consumer matrix and optional OIDC, GCP and Cloudflare configuration examples; Cloudflare has the same explicit unsupported guard as the auth/GCP recipes.
- Explicit SEO indexing opt-in, optional Google/Bing verification and Twitter/X attribution, plus robots and sitemap endpoints driven by shared settings.
- A development-server browser smoke check in CI alongside production browser coverage.

### Changed

- Design guidance addresses concrete copy, truthful state, accessible controls and context-dependent visual choices. Landing, settings and Convex setup copy reflect actual behavior.
- Removed the unused Svelte Testing Library dependency; browser and existing unit checks remain the verification tools.
- Allowed root feature slices through Vite's development filesystem boundary so their client modules load; unrelated root files remain outside the allowlist.
- Segmented controls and the workspace menu stay disabled until hydration so early keyboard/click input is not silently lost.
- Native disclosures retain an early open state across hydration; removed their unused controlled-state API.
- Updated CI actions for the supported runner runtime, pinned their release commits and disabled persisted checkout credentials.

### Migration notes

- `PUBLIC_SITE_URL` alone no longer enables indexing. Set `PUBLIC_SEO_INDEXABLE=true` for public production indexing; keep previews false.
- Replace the old static robots file with the endpoint. Crawling stays allowed so noindex is readable; sitemap URLs are announced only when indexing is enabled.
- Read `CONTRACT.md` at each new agent session and adapt its product section when generating an application. Optional cloud/auth values are recipes, not installed integrations.

## 0.4.0 — 2026-09-08

### Added

- Public app identity configuration and a shared asset catalog for branding and metadata.
- Eight replaceable SVG/PNG placeholders, a web manifest, asset validation and generated artwork prompts.
- Canonical and social metadata using `PUBLIC_SITE_URL`; unconfigured pages and app examples remain noindex.
- Disabled server transport adapters for basic DOKU Checkout, notification signature verification and Resend email, with mocked HTTP checks.
- Explicit private integration resolution, default provider choices and auth/GCP implementation recipes.
- Canonical design guidance, focused Svelte/Convex practices, an agent startup guide and a reusable PRD with measurable acceptance and operational handoff criteria.

### Changed

- Shared branding, locale and asset references replace duplicated page/shell values.
- The main check command validates generated assets alongside types and version consistency.
- Agent instructions link focused guidance and use cohesive boundaries instead of rigid file-size or library-specific rules.
- Documentation distinguishes implemented transports, mock verification and remaining product lifecycle work.

### Migration notes

- Customize `src/lib/config/app.ts` and `assets.config.ts` together, then regenerate assets and prompts. Mark final artwork `custom` before generation.
- Set the production HTTPS origin through `PUBLIC_SITE_URL`; leave it unset for noindex previews.
- Optional capabilities remain disabled. These adapters add no public callback/order endpoints, durable outbox, authentication or GCP deployment; merchant sandbox and real email lifecycle testing remain product work.
- The base Convex schema stays empty. See [the upgrade guide](docs/releasing.md) when adopting changes in a generated product.

## 0.3.0 — 2026-09-08

### Added

- Public template metadata, MIT license, contributor and security policies, issue/PR templates.
- GitHub CI for locked installs, typecheck, formatting, lint, unit tests, build and browser tests.
- Deployment, architecture, release and new-project guides; an explicit release checklist.
- Version synchronization command and metadata consistency check.
- Deployment key guards to keep Vercel preview and production backends separate.
- Browser metadata, response security headers and keyboard navigation coverage.

### Changed

- Bun pinned to 1.4.2; Node support documented and pinned for CI.
- Dashboard, settings and Convex status read versions from repository metadata.
- Convex status uses generated API types and validates its return value.
- Empty environment example preserves the unlinked first-run experience.
- Preparation errors fail visibly instead of being swallowed.

## 0.2.0 — 2026-08-31

- Existing VPS starter: Svelte 5 Runes, SvelteKit, Bun, shadcn-svelte and optional Convex.
- Root feature slices, registry-driven routes and responsive application shell.
- Dynamic app UI primitives with initial unit and browser coverage.
