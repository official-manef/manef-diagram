# QA interaksi editor dan dropdown — 9 November 2026

## Cakupan dan baseline

- Produk: editor `/app` MANEF Diagram; ini bukan audit seluruh halaman atau seluruh integrasi produksi.
- Baseline repo: `adbdd429a6bde2658911f8cc267345a8686c6185`; diuji pada worktree `feature/picker-hover-qa` beserta perubahan lokal di branch ini.
- Lingkungan: Bun 1.4.2, Node 24.22.2, Chromium Playwright; server build/preview lokal. Profil E2E menonaktifkan auth, AI, MCP dan Convex publik. Tidak ada data produksi, deploy, atau tindakan provider.
- Audit mencakup inventaris seluruh jenis interaksi di bawah; **tidak berarti seluruh kombinasi sudah lulus**. Kasus yang belum dieksekusi tercatat eksplisit di bagian batasan.

## Temuan dan perubahan dropdown

1. **Ukuran daftar:** daftar tipe berada di panel kiri dengan tinggi maksimal `min(16rem, 40dvh)`; opsi telepon memiliki tinggi minimal 44 px. Sebelum perbaikan, pengukuran pada layar 320 × 400 menunjukkan aturan CSS khusus opsi menimpa target sentuh 44 px; tes awal gagal, lalu lulus setelah perbaikan.
2. **Lazy preview:** membuka daftar tidak memuat chunk renderer atau langsung mengompilasi preview. Hover mouse pada opsi selama 120 ms memulai preview opsi tersebut. Berpindah cepat, keluar opsi, menutup picker atau memakai keyboard membatalkan jadwal hover lama.
3. **Akses alternatif:** hover bukan satu-satunya jalan. Tap/click memilih, tombol panah/Home/End dan huruf awal menelusuri, Enter/Space memilih, Escape menutup, Tab meneruskan fokus. Hover tidak memindahkan fokus dan preview tidak menyimpan view; `Add to selected node` tetap eksplisit.
4. **Dropdown native:** font dropdown desktop dinaikkan dari 11 ke 13 px dan tinggi dari 32 ke 36 px; opsi di ponsel minimal 44 px. Tema, format ekspor, tipe inventory dan format input tetap menggunakan kontrol native dengan label aksesibel.
5. **Satu klik:** klik pada kontrol lain menutup picker sekaligus menjalankan aksi; tidak memerlukan klik kedua. Shortcut destruktif tetap tidak diteruskan saat listbox aktif.

## Matriks interaksi

| Interaksi                                                                      | Hasil dan bukti                                                                                                                                                | Batas                                                                                       |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Buka/tutup picker; hover; debounce; klik keluar; fokus, Escape dan Enter       | Lulus: final dropdown subset 9 tes desktop, termasuk pemeriksaan lazy network dan single-click dismiss; dua tes spesifik tambahan untuk Enter dan batal hover. | Tidak membuktikan perilaku seluruh browser.                                                 |
| Keyboard listbox: panah, Home/End, huruf awal, Tab, selected/active descendant | Lulus: tes listbox/axe dan 33 tipe pada run implementasi awal; cek selected/focus juga di subset final.                                                        | Uji screen reader nyata belum dilakukan.                                                    |
| Tap pada opsi dan ukuran 320 × 400                                             | Lulus: 4 tes pada dua profil mobile setelah perubahan; preview melalui tap, daftar <= 40dvh, target >= 44px, tanpa overflow horizontal.                        | Emulasi Chromium, bukan perangkat fisik.                                                    |
| Theme, export, inventory, input format dropdown                                | Lulus: 3 tes dropdown final mencakup keyboard Home/End, label, ukuran kecil dan klik satu kali. Konverter menguji output JSON/Markdown/n8n pada run awal.      | Menu native bisa berbeda pada Firefox/WebKit dan perangkat nyata.                           |
| Node, port, view, koneksi, retarget, inspector tab                             | Lulus: 8 tes desktop pada kode akhir, termasuk hapus node/port, tambah view, retarget diterima/ditolak, ekspor dan undo/redo.                                  | Tidak semua kombinasi port, nested diagram dan perangkat diuji.                             |
| Impor, source draft, cancel, undo, recovery dan navigasi panduan               | Lulus: 10 tes editor-recovery desktop pada kode akhir.                                                                                                         | Konflik antar browser/akun belum diuji.                                                     |
| Canvas: zoom/pan, keyboard, selection, physics, panel, undo dan navigasi       | Lulus pada run sebelum penyesuaian akhir: 7 tes canvas/accessibility dan 8 tes canvas/edit desktop. Axe light/dark juga lulus pada subset itu.                 | Perlu rerun suite penuh dan audit manual assistive technology.                              |
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

- Jalankan seluruh suite E2E, bukan hanya subset; saat listing awal ada 426 kasus di 20 file sebelum file dropdown baru ditambahkan.
- Uji Firefox/WebKit, ponsel fisik, screen reader, zoom 200%, orientasi pendek/landscape, serta 1024/1025px.
- Uji seluruh kombinasi node/port/source/target pada koneksi dan kasus ketiadaan port; verifikasi perubahan tidak sengaja tidak tersimpan.
- Jalankan profile auth/backend terisolasi untuk claim, open/delete dan penolakan lintas akun. Jangan gunakan data produksi.
- Verifikasi kembali kasus keamanan yang telah diidentifikasi sebelumnya: isolasi referensi SVG, cleanup stream yang tidak selesai, dan kegagalan evaluasi modul. Tidak ada hasil eksploit yang diklaim di sini.
- Jalankan CI pada Node yang didukung, audit perubahan dan verifikasi hasil deployment sebelum menyatakan siap produksi.
