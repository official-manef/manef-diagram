# Diagram Cloudflare Workers pilot QA — 11 October 2026

Pilot: [manef-diagram-pilot](https://manef-diagram-pilot.manef-pilot-6f4d69.workers.dev). Production remains [diagram.manef.dev](https://diagram.manef.dev) on Vercel. The pilot starts from production source `7d2b3be13c4d8310a38e634b7e3d1c6c2ddad48c`; no production DNS or Convex schema/data migration was performed.

| Capability                   | Result       | Evidence / scope                                                                                                                                                                                         |
| ---------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public UI                    | PASS         | 33 main pages at desktop 1440×900 and mobile 390×844; 66 screenshots, no document overflow, broken images or unloaded fonts; 320px canvas/theme spot checks                                              |
| Canvas                       | PASS         | Flow/Graph, search, selection, component drill-down/back, List/Canvas, zoom/Fit, pointer pan, inspector edit and portable share; regression tests cover import/export, ports, facets and keyboard        |
| MCP client                   | PASS         | Codex 0.160.1 app-server runtime, bearerToken/connected; all ten tools, 23 nodes/22 edges; portable links stay on the pilot; invalid arguments fail without writes                                       |
| MCP access                   | PASS         | Anonymous and incorrect-token POST 401; untrusted Origin 403; client closes cleanly                                                                                                                      |
| Convex public/realtime       | PASS         | `dutiful-zebra-689` public `starter:status`; live-data UI reports backend responded; anonymous private notes/inventory rejected; later authenticated disposable notes QA was cleaned up                  |
| Workspace ownership          | PASS         | All 11 `/workspace` addresses return 308 to the matching MANEF address and preserve query state; public demos remain under `/embed/workspace`                                                            |
| Metadata/assets              | PASS         | Pilot noindex; initial public build 153 assets, login follow-up build 152 assets; immutable cache policy preserved                                                                                       |
| WorkOS configuration         | ENABLED      | Pilot callback registered; existing Diagram Convex WorkOS credential validated HTTP 200 and installed with independent session secret; production callback remains default                               |
| Real WorkOS + private Convex | PARTIAL PASS | Login as official.manef@gmail.com, reload, automatic forced refresh, local logout/denial and private notes create/read/update/cleanup passed; private inventory and two-account isolation remain pending |

The ten tools are `graph_status`, `graph_list_nodes`, `graph_list_edges`, `graph_trace`, `graph_layout`, `graph_search_inventory`, `graph_adjacency`, `graph_query`, `graph_build_view`, and `graph_create_portable_view`. The same controlled inputs used for production acceptance are recorded in [AI/MCP](ai-mcp.md).

The shared MCP guide derives its endpoint from `PUBLIC_SITE_URL` and copies secret-free Codex configuration. Browser Share view uses the current deployment origin. Keep production and pilot Codex tables separate (`diagram` / `diagram_pilot`) and use independent token environment variables. Tokens are absent from source, screenshots and reports.

## Lightweight performance comparison

Alternating requests from the same Windows client, identical paths and `graph_status` inputs. HTTP: eight rounds each for `/`, `/app`, and `/guide?section=mcp` (24 samples per host). MCP: eight waves of two concurrent calls (16 per host), below the 20-request local burst ceiling after cooldown. No failures in either sample.

| Measurement                       | Workers p50 / p95 | Vercel p50 / p95 |
| --------------------------------- | ----------------- | ---------------- |
| HTTP time to response headers     | 153 / 444 ms      | 310 / 413 ms     |
| MCP `graph_status`, concurrency 2 | 87 / 425 ms       | 310 / 1569 ms    |

These are small synthetic samples, not field Core Web Vitals, sustained capacity or a multi-region SLA. HTTP pools three routes; inspect individual samples before drawing page-specific conclusions. New client/Worker startup can be slower: first `graph_status` during final client acceptance took 2065 ms; the load table reflects subsequent requests. No paid plan upgrade was made. The existing burst counter is per-isolate on Workers and is not a distributed abuse/cost limit.

## Corrections and deployment boundaries

- Added a SvelteKit-2-compatible Workers adapter and an explicit pilot configuration; the default Vercel adapter remains unchanged.
- Passed the configured public origin through the three MCP view tools and replaced the shared landing/guide endpoint literal. Browser portable sharing also preserves its deployment.
- Added regression coverage for configured MCP origins, clipboard configuration and browser portable-share host.
- Preserved the adapter's immutable `_headers` in direct API deployment. An intermediate update omitted assets; post-deployment browser verification caught it, and the final asset manifest was restored before acceptance screenshots.
- Wrangler authentication on this machine was expired, so the authorized MANEF Cloudflare connector performed the API deployment. Wrangler still validated the build, generated types, dry-run and local Workers runtime. Normal future deployment uses authenticated Wrangler as described in [deployment](deployment.md).

## Remaining migration gates

The owner later authorized reuse of the existing Convex variables. The Diagram Convex key differed from Vercel and passed WorkOS validation; it is now installed only on the pilot. Worker secrets and Vercel variables remain separate. Real login, session reload and private notes CRUD/cleanup passed. Complete session lifecycle, private inventory and two-account isolation acceptance before migration. Physical Android/iOS Safari, real multi-touch gestures, full browser coverage, distributed rate limiting, sustained CPU/memory/cost observations and realistic cached/uncached Web Vitals remain untested. Phone QA used desktop Chromium viewports and pointer input; the in-app browser does not support synthetic touch dispatch.

Do not switch production DNS or merge a migration solely from public acceptance. Keep Vercel available for rollback; frontend rollback does not restore backend data. Re-run pilot acceptance after changes to WorkOS, Convex or deployment settings.

Operator evidence is saved locally as `diagram-workers-screenshots-2026-10-11.json`, `diagram-workers-codex-mcp-qa-2026-10-11.log`, `diagram-workers-performance-2026-10-11.json`, `diagram-workers-backend-qa-2026-10-11.json`, `diagram-workers-redirects-qa-2026-10-11.json` and `diagram-workers-local-smoke-2026-10-11.json`; credentials are excluded. Public route screenshots do not certify signed-in private states.

## Login follow-up

The first real callback failed with a TypeError during the WorkOS code exchange. The deployed Worker rejected the fetch redirect mode used there. WorkOS authentication now uses manual redirect mode and rejects every non-2xx response, preventing credentials from being forwarded to redirect destinations. Unit regressions cover 301/302/307/308. Temporary diagnostic headers carried only whitelisted error categories/code locations and are removed from the final build. Google provider tokens, authorization codes and API keys were not placed in reports or source. The production Vercel credential and DNS remain unchanged.

The login follow-up adds four provider-redirect security regressions; all 125 unit tests passed locally with one worker. An initial cold TypeScript lint integration hit its existing 15-second timeout under parallel execution; the focused test and the complete serial suite passed without changing assertions or deadlines. Windows Vercel output requires symlink permissions, so local browser checks use the existing Node adapter; CI checks Vercel on Linux. No authentication diagnostics remain in the final source.

An existing browser navigation test asserted the chunk-request counter before the asynchronous request handler ran. It now waits for that same request condition before releasing the gate; navigation, loading announcement and code-splitting assertions are unchanged.
