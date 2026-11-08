# QA interaksi editor dan dropdown — 9 November 2026

## Cakupan dan baseline

- Produk: editor `/app` MANEF Diagram; ini bukan audit seluruh halaman atau seluruh integrasi produksi.
- Baseline repo: `adbdd429a6bde2658911f8cc267345a8686c6185`; suite lengkap menguji commit `21faa585e129c292cf453e4736907a6c0db71935` pada worktree `feature/picker-hover-qa`. Pembaruan laporan ini hanya mengubah dokumentasi dan ringkasan bukti, bukan source aplikasi.
- Lingkungan: Bun 1.4.2, Node 24.22.2, Chromium Playwright; server build/preview lokal. Profil E2E menonaktifkan auth, AI, MCP dan Convex publik. Tidak ada data produksi, deploy, atau tindakan provider.
- Audit mencakup inventaris seluruh jenis interaksi di bawah; **tidak berarti seluruh kombinasi sudah lulus**. Kasus yang belum dieksekusi tercatat eksplisit di bagian batasan.

## Hasil E2E lengkap

Suite Playwright utama selesai pada 9 November 2026 (WIB), mulai 03:09:48, dalam 125,4 detik. Seluruh 444 kasus terdaftar pada 21 file diproses tanpa filter grep atau pemilihan subset. Hasil: **443 lulus, 1 dilewati, 0 gagal, 0 flaky**, tanpa error global pada laporan.

| Profil        | Lulus | Dilewati | Gagal |
| ------------- | ----: | -------: | ----: |
| narrow-mobile |   148 |        0 |     0 |
| mobile        |   148 |        0 |     0 |
| desktop       |   147 |        1 |     0 |
| Total         |   443 |        1 |     0 |

Satu-satunya skip: `tests/diagram-controls.e2e.ts:565`, “touch tap requests a preview without requiring hover”, pada desktop. Tes memang mensyaratkan perangkat touch; kasus yang sama lulus pada kedua profil mobile. **Tidak ada kegagalan atau retry flaky yang disembunyikan.**

Suite tambahan juga dijalankan: Notes isolation **8/8 lulus** (4 desktop, 4 mobile; fixture lokal, 8,8 detik), dan dev server **2/2 lulus** (desktop, 15,2 detik). Secara keseluruhan ini 453 eksekusi lulus dan 1 skip dari 454 eksekusi; bukan 454 skenario unik karena ada profil/smoke yang berulang.

Ringkasan mesin yang disimpan di repo: [e2e-full-2026-11-09.summary.json](e2e-full-2026-11-09.summary.json). Angka diturunkan dari laporan JSON penuh yang dibaca kembali, bukan estimasi dari log progres.

### Cakupan per file pada suite utama

| File                                       | Lulus | Dilewati | Gagal |
| ------------------------------------------ | ----: | -------: | ----: |
| `tests/assistant.e2e.ts`                   |    27 |        0 |     0 |
| `tests/canvas-input.e2e.ts`                |    48 |        0 |     0 |
| `tests/context-view.e2e.ts`                |    12 |        0 |     0 |
| `tests/diagram-controls.e2e.ts`            |    71 |        1 |     0 |
| `tests/diagram-demo-forms.e2e.ts`          |    21 |        0 |     0 |
| `tests/diagram-desktop.e2e.ts`             |    12 |        0 |     0 |
| `tests/diagram-embed.e2e.ts`               |     9 |        0 |     0 |
| `tests/diagram-filter-recovery.e2e.ts`     |    27 |        0 |     0 |
| `tests/diagram-interactions.e2e.ts`        |    24 |        0 |     0 |
| `tests/diagram-mobile.e2e.ts`              |    12 |        0 |     0 |
| `tests/diagram-phone-pages.e2e.ts`         |     9 |        0 |     0 |
| `tests/diagram-render-security.e2e.ts`     |    24 |        0 |     0 |
| `tests/diagram-theme-ownership.e2e.ts`     |     9 |        0 |     0 |
| `tests/diagram-workspace-focus.e2e.ts`     |    15 |        0 |     0 |
| `tests/diagram-workspace-ownership.e2e.ts` |    15 |        0 |     0 |
| `tests/document-converters.e2e.ts`         |    15 |        0 |     0 |
| `tests/dropdown-interactions.e2e.ts`       |     9 |        0 |     0 |
| `tests/editor-header.e2e.ts`               |     6 |        0 |     0 |
| `tests/editor-recovery.e2e.ts`             |    30 |        0 |     0 |
| `tests/portable-agent.e2e.ts`              |    15 |        0 |     0 |
| `tests/starter.e2e.ts`                     |    33 |        0 |     0 |

### Perintah dan artefak

```sh
bun run test:e2e -- --reporter=list,json --workers=3 --output=/tmp/manef-full-qa-20261109-results
bun run test:notes -- --workers=1 --output=/tmp/manef-notes-qa-20261109-results
bun run test:dev -- --workers=1 --output=/tmp/manef-dev-qa-20261109-results
```

Laporan penuh awal di host: `/tmp/manef-full-qa-20261109.json`; hasil/trace di `/tmp/manef-full-qa-20261109-results`; log tambahan `/tmp/manef-notes-qa-20261109.log` dan `/tmp/manef-dev-qa-20261109.log`. Jalur `/tmp` bersifat sementara; ringkasan terverifikasi di repo tidak bergantung pada retensinya. Tidak ada rerun source aplikasi setelah pengujian ini karena perubahan berikutnya hanya laporan.

## Temuan dan perubahan dropdown

1. **Ukuran daftar:** daftar tipe berada di panel kiri dengan tinggi maksimal `min(16rem, 40dvh)`; opsi telepon memiliki tinggi minimal 44 px. Sebelum perbaikan, pengukuran pada layar 320 × 400 menunjukkan aturan CSS khusus opsi menimpa target sentuh 44 px; tes awal gagal, lalu lulus setelah perbaikan.
2. **Lazy preview:** membuka daftar tidak memuat chunk renderer atau langsung mengompilasi preview. Hover mouse pada opsi selama 120 ms memulai preview opsi tersebut. Berpindah cepat, keluar opsi, menutup picker atau memakai keyboard membatalkan jadwal hover lama.
3. **Akses alternatif:** hover bukan satu-satunya jalan. Tap/click memilih, tombol panah/Home/End dan huruf awal menelusuri, Enter/Space memilih, Escape menutup, Tab meneruskan fokus. Hover tidak memindahkan fokus dan preview tidak menyimpan view; `Add to selected node` tetap eksplisit.
4. **Dropdown native:** font dropdown desktop dinaikkan dari 11 ke 13 px dan tinggi dari 32 ke 36 px; opsi di ponsel minimal 44 px. Tema, format ekspor, tipe inventory dan format input tetap menggunakan kontrol native dengan label aksesibel.
5. **Satu klik:** klik pada kontrol lain menutup picker sekaligus menjalankan aksi; tidak memerlukan klik kedua. Shortcut destruktif tetap tidak diteruskan saat listbox aktif.

## Matriks interaksi — bukti subset sebelumnya

Tabel berikut mempertahankan riwayat QA per area. Run E2E lengkap di atas kini menggantikan keterbatasan cakupan subset; batas perangkat, akun nyata, dan lingkungan produksi tetap berlaku.

| Interaksi                                                                      | Hasil dan bukti                                                                                                                                                | Batas                                                                                       |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Buka/tutup picker; hover; debounce; klik keluar; fokus, Escape dan Enter       | Lulus: final dropdown subset 9 tes desktop, termasuk pemeriksaan lazy network dan single-click dismiss; dua tes spesifik tambahan untuk Enter dan batal hover. | Tidak membuktikan perilaku seluruh browser.                                                 |
| Keyboard listbox: panah, Home/End, huruf awal, Tab, selected/active descendant | Lulus: tes listbox/axe dan 33 tipe pada run implementasi awal; cek selected/focus juga di subset final.                                                        | Uji screen reader nyata belum dilakukan.                                                    |
| Tap pada opsi dan ukuran 320 × 400                                             | Lulus: 4 tes pada dua profil mobile setelah perubahan; preview melalui tap, daftar <= 40dvh, target >= 44px, tanpa overflow horizontal.                        | Emulasi Chromium, bukan perangkat fisik.                                                    |
| Theme, export, inventory, input format dropdown                                | Lulus: 3 tes dropdown final mencakup keyboard Home/End, label, ukuran kecil dan klik satu kali. Konverter menguji output JSON/Markdown/n8n pada run awal.      | Menu native bisa berbeda pada Firefox/WebKit dan perangkat nyata.                           |
| Node, port, view, koneksi, retarget, inspector tab                             | Lulus: 8 tes desktop pada kode akhir, termasuk hapus node/port, tambah view, retarget diterima/ditolak, ekspor dan undo/redo.                                  | Tidak semua kombinasi port, nested diagram dan perangkat diuji.                             |
| Impor, source draft, cancel, undo, recovery dan navigasi panduan               | Lulus: 10 tes editor-recovery desktop pada kode akhir.                                                                                                         | Konflik antar browser/akun belum diuji.                                                     |
| Canvas: zoom/pan, keyboard, selection, physics, panel, undo dan navigasi       | Lulus pada run sebelum penyesuaian akhir: 7 tes canvas/accessibility dan 8 tes canvas/edit desktop. Axe light/dark juga lulus pada subset itu.                 | Suite penuh sudah lulus; audit manual assistive technology belum dilakukan.                 |
| Responsif List/Canvas, editor dan header                                       | Lulus pada run awal: 8 tes di dua profil mobile; 2 tes header desktop. Cek picker/touch dan dropdown kecil diulang setelah perubahan akhir.                    | 1024/1025, landscape nyata dan pinch multiskenario belum lengkap.                           |
| Tag filter dan embed                                                           | Lulus pada run awal: 14 tes desktop/berbagai viewport (filter, header, embed).                                                                                 | Klaim diagram disembunyikan saat auth/Convex nonaktif; bukan uji akun nyata.                |
| Render aman dan recovery                                                       | Lulus: 8 tes desktop pada kode akhir mencakup Pele/Mermaid, sanitasi SVG, input berbahaya dan retry saat kegagalan jaringan.                                   | Bukan penetration test; semua payload dan browser tidak tercakup.                           |
| Share, export dan link                                                         | Lulus sebagian melalui editor-recovery serta tes konverter run awal.                                                                                           | Verifikasi clipboard lintas browser dan penggunaan link di deployment aktual belum lengkap. |

## Bukti eksekusi

- `bun run check`: exit 0; Svelte 0 error/0 warning; core, asset dan n8n check lulus.
- `bun run lint`: exit 0.
- `bun run test:unit`: 347 tes lulus di 40 file, exit 0.
- `tests/diagram-controls.e2e.ts` dan `tests/dropdown-interactions.e2e.ts` subset final: 9 lulus, exit 0.
- `tests/diagram-controls.e2e.ts` touch/short-screen pada narrow-mobile dan mobile: 4 lulus, exit 0.
- `tests/diagram-interactions.e2e.ts` desktop: 8 lulus, exit 0.
- `tests/editor-recovery.e2e.ts` desktop: 10 lulus, exit 0.
- `tests/diagram-render-security.e2e.ts` desktop: 8 lulus, exit 0.
- Run awal `diagram-controls.e2e.ts` desktop mencapai 13 tes lulus, lalu dihentikan oleh batas waktu 26 detik (exit 124); sisa 8 tes dijalankan terpisah dan lulus, satu tes touch sengaja dilewati di desktop. Dua tes keyboard/delay baru juga lulus terpisah. Jangan menyebut run yang timeout sebagai suite penuh yang lulus.
- Log mentah sementara pada host: `/tmp/manef-hover-final-interaction.log`, `/tmp/manef-hover-touch-final.log`, `/tmp/manef-hover-interactions-final.log`, `/tmp/manef-hover-recovery-final.log`, `/tmp/manef-hover-security-final.log`, `/tmp/manef-hover-final-check.log`, `/tmp/manef-hover-final-lint.log`, `/tmp/manef-hover-final-unit.log`. File `/tmp` dapat terhapus.

## QA lanjutan sebelum rilis

- Suite default E2E lengkap sudah selesai: 444 kasus, 443 lulus dan 1 skip yang dijelaskan di atas. Kasus yang tidak dicakup oleh profil atau implementasi tes tidak otomatis dianggap terverifikasi.
- Uji Firefox/WebKit, ponsel fisik, screen reader, zoom 200%, orientasi pendek/landscape, serta 1024/1025px.
- Uji seluruh kombinasi node/port/source/target pada koneksi dan kasus ketiadaan port; verifikasi perubahan tidak sengaja tidak tersimpan.
- Jalankan profile auth/backend terisolasi untuk claim, open/delete dan penolakan lintas akun. Jangan gunakan data produksi.
- Verifikasi kembali kasus keamanan yang telah diidentifikasi sebelumnya: isolasi referensi SVG, cleanup stream yang tidak selesai, dan kegagalan evaluasi modul. Tidak ada hasil eksploit yang diklaim di sini.
- Jalankan CI pada Node yang didukung, audit perubahan dan verifikasi hasil deployment sebelum menyatakan siap produksi.
