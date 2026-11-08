# SVG render security and lazy-loading recovery — 2026-11-08

## Scope

Branch: `feature/diagram-picker-sidebar`, building on `1760540`.
Local changes only. No push, merge, deployment, provider operations or production-data writes.

## Implemented boundary

- DOMPurify 3.4.17 is an explicit pinned dependency, shared by both renderer outputs.
- The browser sanitizes a detached SVG fragment before inserting it with `replaceChildren`.
- Embedded HTML, scripts, navigation, image/remote-resource elements and SVG animation are forbidden.
- Event attributes and non-fragment href/resource references are removed.
- Renderer stylesheets are converted to allowlisted inline SVG presentation properties on detached nodes and removed. CSS cannot remain as a stylesheet affecting the surrounding page. Unsafe declaration values are rejected; non-style at-rules are skipped while safe sibling style rules are retained. CSS selector specificity, importance, inline precedence and source order are resolved before materialization.
- Output is bounded to 2,000,000 input characters, 10,000 elements, 100,000 cumulative stylesheet characters, 2,000 cumulative CSS rules, 2,000,000 estimated selector-element checks, 100,000 declaration candidates and 2,000,000 output style characters. Individual selectors are limited to 1,000 characters. Invalid/non-single-SVG output fails closed.
- Pele retains disabled links/images; Mermaid remains strict and uses SVG labels instead of embedded HTML labels.
- Rejected Pele load promises are cleared and load failures reach the Mermaid fallback. A Retry diagram button restarts rendering after errors. Existing stale-render cancellation remains in place.

## New browser evidence

Command:

```sh
bun run test:e2e -- tests/diagram-render-security.e2e.ts --project=desktop --workers=1
```

Result: **6 passed (13.7s)**, exit 0.

1. Actual Pele renders authored image/event-handler markup without injecting active elements or requesting the test remote image.
2. Blocking the Pele chunk forces actual Mermaid rendering; the same malicious authored input remains inert. The test asserts data-renderer is mermaid, not merely that an SVG exists.
3. Direct sanitizer test removes scripts, foreignObject, images, external resource URLs, navigation, animation and page-wide CSS; safe text, local marker references and allowlisted fill styling survive.
4. Blocking the renderer chunk shows Retry diagram; unblocking and retrying yields an SVG and clears aria-busy.
5. Blocking Pele yields a Mermaid preview; unblocking and selecting the next type retries Pele and yields data-renderer=pele, with at least two chunk requests.
6. Non-SVG, multiple SVG roots and excessive output are rejected.

## Regression evidence

- `bun run test:unit`: **346 passed / 40 files**, exit 0.
- `bun run check`: 0 Svelte errors/warnings; assets, n8n and core TypeScript checks pass.
- `bun run lint`: Prettier, ESLint and Svelte 5 guard pass.
- Each browser command built the local Vercel output successfully before running preview; this is not a deployment.
- Desktop controls subset: **4 passed (14.0s)**, covering accessible listbox/focus, previews for all 33 types, on-demand renderer loading, and authored injection regression.
- Responsive subset: **6 passed (13.0s)** across configured phone/desktop projects plus explicit 768px tablet viewport; picker and canvas do not overlap or cause horizontal page overflow.
- Both-engine malicious-input subset across phone and desktop projects: **6 passed (13.7s)**.
- Invalid Mermaid recovery regression: **1 passed (11.2s)**; repeated invalid/valid source changes do not leave renderer error artifacts outside the editor.

## Limits

Tests use Chromium, Bun 1.4.2 and Node 26.7.0. Node is outside the declared supported 22/24 range; rerun on supported runtime in CI before release. Existing SvelteKit alias-deprecation and large-chunk warnings remain. No complete cross-browser suite, penetration test, exhaustive renderer fuzzing, theme screenshot comparison or production acceptance was performed. Mermaid's representative forced-fallback flowchart is tested; all 33 Mermaid fallback types are not claimed. Strict display-only sanitization deliberately discards interactive/HTML/image features and unsupported CSS, which may alter some authored diagram styling.

## Independent review follow-up

Review identified CSS-only correctness and resource-budget issues, not a demonstrated XSS bypass. The follow-up fixes retain safe Mermaid rules alongside keyframes, resolve conflicting declarations using the pinned specificity 1.0.0 parser, and apply aggregate budgets across the SVG. Animations and other at-rules remain intentionally unsupported.

Rerun of the complete security/recovery file: **8 passed (14.4s)**, exit 0. Added assertions verify actual Mermaid node fill/stroke, selector specificity, important versus normal/inline declarations, source-order ties, :is() specificity, retained rules beside keyframes and aggregate multi-stylesheet limits. Prettier/ESLint/Svelte guard and static checks pass; the 33-type preview browser regression also passes after the follow-up (12.0s). This is a supported display-only CSS subset, not an implementation of every CSS feature (e.g. cascade layers and media queries are discarded).
