# Adversarial quality audit — 29 October 2026

## Verdict and bar

Baseline: main `79cf13858b95a93e1629c07c520dc648b02794a7` (PR #45 already merged).
A green functional suite did not establish good interaction design. The production
canvas exposed a mouse-centric pan gesture, had no keyboard focus entry, hid
focusable edge controls from assistive technology and reduced editing targets to
fractions of their intended size in an overview. Treat these as product defects,
not user training problems.

This recovery raises the local interaction baseline; it is not a declaration that
UI/UX/DX, accessibility or agent experience is now universally maximal. AX is
considered both accessibility and agent experience here. Public MCP stays read-only;
this task does not grant agents writes, backend ownership or private inventory.

## Confirmed findings and changes

| Priority | Baseline failure                                                                                                               | Recovery and regression evidence                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | Desktop pan required the middle mouse; trackpad deltaX was ignored and every wheel event changed zoom, including a zero delta. | Visible Select/Pan tool, left-button hand drag, Space drag, two-axis wheel pan, Shift horizontal pan, Ctrl/Meta wheel pinch zoom and anchored two-finger touch pinch. Keyboard arrows and single-click directional controls provide non-drag alternatives.                                                                                                                                                                                        |
| P1       | Canvas application had no focus entry or discoverable keyboard camera controls.                                                | Focusable, visibly outlined application with associated instructions; arrows, Shift+arrows, +/−, F/0 and 1. Native field keys and Tab are not intercepted.                                                                                                                                                                                                                                                                                        |
| P1       | Scaled overview turned node/port buttons into sub-24px adjacent targets.                                                       | Automated axe checks on the real 23-node seed reproduced WCAG 2.2 target-size failures. Below 75% zoom the canvas is a preview: tiny editing controls are disabled/hidden from accessibility navigation, full-size explorer buttons are exposed, and clicking/tapping a preview zooms into an editable service. Dense port groups use the full-size inspector rather than overlapping canvas buttons. No axe rules or page sections are excluded. |
| P1       | SVG contained 22 tab stops beneath aria-hidden. Graph-mode edges lacked the same unscaled list alternative.                    | Decorative SVG paths leave the tab sequence; connection-list buttons are available in Flow and Graph. Node and connection selection states and port direction/service labels are explicit.                                                                                                                                                                                                                                                        |
| P1       | Destructive edits had no undo; volatile documents could be lost on leaving.                                                    | Full-document undo/redo includes layout and unknown metadata. Each stack is bounded to 40 entries and eight million characters. Reload and in-app route departure warn for document changes; cancel leaves the editor intact. Applying/importing is not marked as saving. JSON/Markdown export is the persistence path, not an automatic backend save.                                                                                            |
| P2       | Node dragging depended on a timed hold and lacked a non-drag position editor.                                                  | Movement threshold replaces the hold timer; explicit X/Y controls provide an alternative. Pointer termination outside the canvas and no-button moves cannot leave a stale drag.                                                                                                                                                                                                                                                                   |
| P2       | Fit/Flow/physics animation ignored reduced-motion intent.                                                                      | Stable mode transitions and no physics restart while reduced motion is enabled, including after node dragging. Animation controls explain their disabled state.                                                                                                                                                                                                                                                                                   |
| P2       | Fixed desktop side panels consumed canvas space without a collapse path.                                                       | Explorer/inspector toggles reclaim width; selection reopens the inspector. Desktop panel resize preserves the camera center. Mobile list height is deliberately not treated as canvas camera geometry.                                                                                                                                                                                                                                            |
| P2       | Notes tests ignored the documented local browser override.                                                                     | Main, notes and dev suites share PLAYWRIGHT_CHROME_PATH support. Notes need no temporary configuration. Pure wheel interpretation is exported/tested through core.ts; the renderer no longer imports its own Svelte barrel.                                                                                                                                                                                                                       |

## Review is part of implementation

An independent static review of the first implementation found three regressions:
Apply incorrectly cleared dirty state, Graph dragging restarted physics under reduced
motion, and an unarmed drag could survive release outside the viewport. All three
were corrected and received browser regressions. Full-suite testing additionally
caught mobile list resize changing imported camera values and canvas-mode resize
moving the graph out of view. Both were fixed; an actual preview-click regression
now asserts that the graph is on screen, not merely that a world element exists.

Initial focused failures also included native mobile wheel CSS-pixel scaling and
new controls occupying an old synthetic touch coordinate. The tests now assert
received native deltas, a sub-pixel zoom-anchor tolerance and genuine empty-space
coordinates rather than bypassing hit testing.

## Local evidence

- Frozen Bun install and verify: type checks, standalone non-Svelte consumer, lint,
  309 unit tests and Vercel build.
- 270 E2E cases passed in complete project runs: 90 desktop, 90 mobile, 90 narrow mobile.
- Within those cases, 18 axe WCAG A/AA scans covered light/dark themes, real-seed
  overview/selected inspector/graph states, and all three browser projects.
- Eight synthetic private-note isolation cases and two development hydration cases passed.
- Node build/route smoke and Workers build/type check/deployment dry-run passed.
- Bun 1.4.2, Node 24.22.1 and locally available Chromium 156.0.8078.73. The shared
  executable override was used, not Playwright's downloaded revision.

Exact-head GitHub CI, review and deployed revision checks are separate gates. No
manual production deployment, merge, DNS, credential or access-policy changes belong
to this audit.

## Still not accepted at a high bar

1. Physical macOS/Windows touchpad and pen behavior, real iOS Safari/Android devices,
   VoiceOver/NVDA reading order and announcements, OS/browser zoom and high-contrast
   modes require manual assistive-device acceptance. Chromium emulation and axe are
   not WCAG certification.
2. Large-map latency, force-layout responsiveness, memory on low-end phones and bundle
   budgets require measurement. Build still reports large-chunk warnings. No performance
   SLA or concurrency ceiling is claimed.
3. History is tab-local, bounded and per change rather than coalesced typing transactions.
   It is neither durable autosave nor cross-device recovery. Browser beforeunload is
   not guaranteed during mobile process termination. Export remains necessary.
4. Unapplied source-buffer drafts need a separate recovery policy: current document
   history is not a claim that every transient textarea draft is retained. In particular,
   Refresh is a deliberate replacement of the source buffer; its draft-recovery UX
   remains a follow-up rather than an autosave claim.
5. Current production authentication/two-account CRUD, destination n8n execution,
   licensed LiveChat/Airin, private inventory authorization and distributed rate limiting
   remain the external acceptance work already recorded in the PRD.
6. Agent experience requires integration-level consumer acceptance as well as readable
   tools and a pure core. No new MCP writes or execution privileges were introduced.

Prioritize those gates explicitly; do not substitute a higher test count or a visual
redesign for evidence from real users and real operating environments.
