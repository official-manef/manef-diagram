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
