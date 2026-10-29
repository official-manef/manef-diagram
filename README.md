# MANEF Architecture

Reusable MANEF architecture inventory and graph feature.

- Canonical app: `https://diagram.manef.dev`
- Canonical UI: Svelte 5 + SvelteKit
- Reusable core: framework-neutral TypeScript through `slices/architecture-inventory/core.ts`
- Backend: optional Convex Cloud; clean clones work from the bundled public seed
- Production runtime: Vercel adapter at `https://diagram.manef.dev` (live `server: Vercel`). `DEPLOY_TARGET=node` and the Dockerfile remain available for Dokploy or another container host; they are not the current origin.
- Public directory: `/products`, `/guide`, and `/audit`. The ecosystem demo belongs at `https://manef.dev/workspace`; old `/workspace` links redirect there. MANEF embeds the single browser-local implementation from `/embed/workspace`. The public map is `/app`.
- Package manager: Bun only

## Why this exists

The product turns MANEF product/infrastructure relationships into an editable graph without coupling the graph contract to one frontend framework. The Svelte workspace is the reference renderer. Next.js consumers reuse the same types and pure graph/inventory functions and can render them with their own UI layer.

The large repository/domain inventory used during discovery is **not** bundled into the reusable source. Runtime/private inventories must be connected through an authorized data adapter.

## Development

```sh
bun install --frozen-lockfile
bun run dev
```

To develop the embedded workspace together with `manef-web`, run Diagram on port 5173
and start Web with `NEXT_PUBLIC_DIAGRAM_ORIGIN=http://localhost:5173` on port 3000.
Open Web's `/workspace/diagram?preview=1` to check iframe navigation and Browser Back.
The embedded demo permits loopback parents only during development; hosted parents
are limited to `https://manef.dev` and `https://staging.manef.dev`. Preview mode stays
in the URL when changing demo pages. Browser storage denial keeps the demo usable
in memory, and malformed saved data falls back to a fresh demo without overwriting it.
The host and iframe also exchange validated readiness messages so full iframe
navigation can restore the parent origin even when the browser replaces its referrer.

Verification:

```sh
bun run check
bun run lint
bun run test:unit
bun run build
```

See `docs/PRD.md`, `docs/framework-adapters.md`, and `CONTRACT.md`.

## Agent context graph

The diagram supports portable navigable views and namespaced facets for project, platform, agent, kind, and source context. See docs/context-graph.md.

---

## Catatan pemeliharaan (17 Oktober 2026)

### Batas ruang lingkup

- `slices/architecture-inventory/` adalah inti TypeScript yang tidak bergantung pada framework; aplikasi SvelteKit menjadi renderer rujukan.
- Graph publik bawaan adalah data contoh publik, bukan inventaris infrastruktur privat. Data privat memerlukan adapter yang berwenang.
- Convex bersifat opsional untuk persistensi. Demo workspace yang disematkan berjalan lokal di browser dan bukan sesi atau koneksi backend.
- Arah produk dan kriteria penerimaan ada di [docs/PRD.md](docs/PRD.md); kontrak bersama ada di [CONTRACT.md](CONTRACT.md).

### Navigasi kode dan panduan

- Implementasi graph dan inventaris: `slices/architecture-inventory/`.
- Komponen shell aplikasi: `slices/app-shell/`.
- Panduan arsitektur, integrasi, lingkungan, dan deployment: `docs/architecture.md`, `docs/integrations.md`, `docs/environment.md`, dan `docs/deployment.md`.
- Panduan kontribusi dan prasyaratnya: [CONTRIBUTING.md](CONTRIBUTING.md).

### Cakupan pemeriksaan

`bun run test` menjalankan unit test saja; `test:e2e` dan `test:dev` adalah perintah terpisah. `bun run check` mencakup pemeriksaan tipe, versi, dan aset; `bun run lint` memeriksa format, ESLint, dan aturan Svelte 5. `bun run verify` menggabungkan `check`, `lint`, `test`, dan `build`, tetapi tidak menjalankan pengujian Playwright. Daftar perintah tersebut menjelaskan cakupan skrip, bukan bukti bahwa pemeriksaan telah dijalankan atau lulus.

## Canvas controls and recovery

- Two-finger scroll or an ordinary wheel pans; Ctrl/Meta + scroll or a pinch zooms.
- Choose Pan for left-button/trackpad dragging, or focus the canvas and hold Space.
  Select keeps desktop box selection. Directional buttons pan without dragging.
- Tab to the canvas: arrows pan, Shift moves farther, +/− zoom, F/0 fits and 1 shows actual size.
- Overview is a preview, not a cluster of tiny editing buttons. Click a service in the
  full-size explorer or its preview to select only; use Zoom selection to zoom explicitly. Inspector ports and X/Y position
  fields do not require dragging. Desktop Explorer/Inspector panels can collapse.
- Undo/Redo restores tab-local document edits and layout; it is bounded history, not
  durable autosave. Export JSON/Markdown to keep your work. Leaving changed documents
  warns; mobile process termination can still discard a tab without a warning.

For test environments with an existing Chromium binary, PLAYWRIGHT_CHROME_PATH is
supported consistently by E2E, notes and dev suites. Automated accessibility coverage
uses axe on the actual public seed in light/dark overview, inspector and graph states.
See docs/quality-audit-2026-10-29.md for the adversarial findings, evidence and open gates.

Unapplied source drafts have separate discard protection: stale Apply asks before
replacing newer canvas edits; Refresh/import and component/history navigation ask
before replacing raw text. Exporting the current document does not save that raw draft.
Authored view overlays isolate the covered map from keyboard focus and restore their
opener when closed. Trace dimming preserves readable node text and focus indicators.

Portable links restore and share every valid selected seed, including component views.
The core validates the entire encoded request target (16,000 bytes) as well as decoded
graph size (12,000 characters). Unicode and all filters consume that wire budget.
Larger maps should use complete JSON/Markdown exports; no successful copy or MCP
result is reported for a rejected oversized URL.

### Flow direction and keyboard diagram previews

The four arrows at the canvas upper right choose Flow direction: left-to-right (LR),
right-to-left (RL), top-to-bottom (TB) and bottom-to-top (BT). They do not pan the
camera; non-drag camera pan buttons live in the explorer. Direction is retained in
JSON/Markdown, portable links and undo/redo. Legacy documents default to LR.

Diagram type opens a focused listbox instead of a native select. Up/Down immediately
changes its temporary preview; Home/End jumps, Enter/Escape closes, and Tab moves to
the next field. No node selection is required for previewing all 24 types. Only Add
to selected node creates an authored view; browsing options never appends view records.

A single canvas/overview/explorer click only selects a node, even when Focus is enabled.
Zoom selection is a separate toolbar action. The previous preview-click auto-zoom
policy is superseded by this explicit owner preference.
