# Production deploy checklist

A dated checklist for publishing a new main to https://diagram.manef.dev.
Deployment itself is an owner action; this page makes the gates explicit.
The reference for build targets is [deployment.md](deployment.md) and the
variable contract lives in [environment.md](environment.md) plus
`.env.example`. Run `bun run env:check` before deploying: it fails when the
code reads a variable the environment does not declare.

## Checklist — deploy from main `bd2bf99` (embed, Pele renderer, claim)

### 1. Local pre-flight

- [ ] `git checkout main && git pull` — record the exact SHA (this checklist: `bd2bf99`)
- [ ] `bun install --frozen-lockfile`
- [ ] `bun run verify` — svelte-check 0 errors, prettier/eslint, unit suite, build
- [ ] `bun run test:e2e` — all three projects pass on the pinned Chromium
- [ ] `bun run test:notes` and `bun run test:dev`
- [ ] Hosted CI on that exact head is green

### 2. Convex backend (claim + notes)

- [ ] Deploy the production backend: `bunx convex deploy` — schema includes
      `architectureSnapshots` (owner, name, graph, updatedAt) and `notes`
- [ ] Record the deployment URL — it becomes `PUBLIC_CONVEX_URL`
- [ ] Confirm `convex/auth.config.ts` is deployed so SvelteKit session tokens authenticate
- [ ] Account isolation is enforced server-side and unit-tested (`architecture.spec.ts`)

### 3. Environment variables (Vercel project settings)

Required for the new features:

- [ ] `PUBLIC_CONVEX_URL` — the production Convex URL (enables claim + notes)
- [ ] `PUBLIC_SITE_URL` — `https://diagram.manef.dev` (canonical origin; MCP + metadata)

Required for sign-in (docs/auth.md):

- [ ] `AUTH_ENABLED=true`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET` (WorkOS AuthKit)
- [ ] `AUTH_SESSION_SECRET` — 32 random bytes, base64url, unique per environment
- [ ] Provider callback registered: `https://diagram.manef.dev/auth/callback`
- [ ] Optional: `GITHUB_AUTH_CLIENT_ID`/`GITHUB_AUTH_CLIENT_SECRET` for GitHub login

Required for batonly.site to call MCP:

- [ ] `MCP_SERVER_ENABLED=true`
- [ ] `MCP_SERVER_TOKEN` — random, at least 32 characters; never leaves the two
      server environments (this app and the baton site env)

Optional: `AI_ENABLED` + `AI_MODELS_JSON` (BYOK assistant),
`PUBLIC_SEO_INDEXABLE` + verification tokens, `CAPABILITY_ACCESS_TOKEN`.
Do not set payment or email credentials unless activating those features.

### 4. Deploy (Vercel)

- [ ] Framework: SvelteKit; root: repository root; package manager: Bun
- [ ] Build: `bun run verify`; install: `bun install --frozen-lockfile`; devDependencies included
- [ ] Node major matches `engines.node` / `.node-version`; `DEPLOY_TARGET` unset
- [ ] Promote to production and record the deployed SHA (must equal `bd2bf99`)

### 5. Post-deploy verification

Headers and routes:

- [ ] `/app` sends `X-Frame-Options: SAMEORIGIN`; its CSP does not mention batonly.site
- [ ] `/embed/diagram` CSP includes `https://batonly.site https://review.batonly.site`
      and sends no `X-Frame-Options`
- [ ] `/embed/workspace` policy unchanged

Renderer:

- [ ] Diagram type previews run through all 33 kinds with no errors and stay
      instant across theme switches (`.view-canvas` reports `data-renderer="pele"`)

MCP:

- [ ] `POST /api/mcp/server` with the bearer token: initialize, tools/list (10 tools),
      `graph_create_portable_view` returns a valid portable URL
- [ ] Without the token the endpoint answers 401

Claim flow (real sign-in):

- [ ] Open a portable link, sign in, "Claim this diagram" saves it
- [ ] "Claimed diagrams" lists, reopens and removes claimed snapshots
- [ ] Two different accounts never see each other's snapshots

Embed on batonly.site:

- [ ] The landing Integrations section shows the live tunnel diagram iframe
- [ ] "Open in a new tab" opens diagram.manef.dev with the same graph
- [ ] Claim works inside the iframe for a signed-in visitor

General:

- [ ] Share view links stay under the encoded budget and restore correctly
- [ ] `/api/health` matches its contract; robots/sitemap follow `PUBLIC_SEO_INDEXABLE`

### 6. Rollback and secrets

- [ ] Rollback: Vercel → Deployments → previous production → Promote to Production
- [ ] If any token leaks: rotate `MCP_SERVER_TOKEN`, `AUTH_SESSION_SECRET` and
      provider credentials in both environments (never share secrets in chat)
