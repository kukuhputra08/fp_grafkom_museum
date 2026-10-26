# Museum Budaya Nusantara Virtual

Tugas Grafika Komputer: museum virtual first-person di browser untuk memamerkan objek 3D budaya Nusantara.
Dibangun dengan **Three.js + Vite** (JavaScript). Model dibuat di Blender dan dimuat sebagai `.glb`.

## Menjalankan

Butuh Node.js 18 atau lebih baru.

```bash
npm install
npm run dev
```

Buka alamat yang muncul di terminal (biasanya http://localhost:5173).
Jangan membuka `index.html` dengan klik dua kali, karena model dimuat lewat server.

## Kontrol

| Tombol | Fungsi |
|---|---|
| W A S D (atau panah) | Berjalan |
| Mouse | Melihat sekitar |
| Shift | Berlari |
| E | Buka/tutup panel info objek terdekat |
| 1 / 2 / 3 | Mode tampilan: Solid / Wireframe / Point Cloud |
| L | Nyalakan semua lampu / matikan semua lampu |
| Z | Lampu gantung di lorong |
| X | Lampu dinding dan dinding judul |
| F | Lampu sorot objek terdekat |
| Esc | Jeda (panel info dan panel saklar lampu bisa diklik) |

Saat dijeda (Esc), panel **Saklar Lampu** di kiri atas bisa diklik: ada tombol *Nyalakan semua*,
*Matikan semua*, dan satu tombol per zona lampu. Kursor yang berada di atas panel membuat layar jeda
transparan, sehingga perubahan cahayanya langsung terlihat.

## Struktur folder

| Path | Isi |
|---|---|
| `src/config.js` | **Daftar objek** (nama, asal, deskripsi, ukuran) dan pengaturan terang/gelap |
| `src/room.js` | Ruangan, lantai, dinding, karpet, pedestal, plakat |
| `src/lighting.js` | **Pencahayaan**: lampu gantung, lampu sorot berbayangan, penyorot dinding, dan logika saklar |
| `src/player.js` | Kontrol first-person dan tabrakan |
| `src/exhibit.js` | Memuat `.glb`, menghitung vertex/edge/face, mode solid/wireframe/point |
| `src/ui.js`, `src/style.css`, `index.html` | Tampilan (layar awal, HUD, panel info) |
| `public/models/` | File `.glb` yang dimuat website (sudah dioptimasi) |
| `assets-src/` | Tempat menyimpan `.glb` asli dari Blender (tidak ikut dipakai website) |
| `scripts/optimize.mjs` | Skrip untuk mengecilkan model |

## Pencahayaan

Cahaya umum sengaja dibuat redup, jadi terang-gelapnya ruangan ditentukan oleh lampu seperti di ruang pamer
sungguhan: sudut yang jauh dari lampu tampak gelap, objek di bawah lampu sorot terang dan menghasilkan bayangan.

| Zona (saklar) | Isi |
|---|---|
| Lampu gantung lorong | 3 lampu gantung di atas karpet |
| Lampu dinding & judul | 2 penyorot dinding samping dan 1 penyorot tulisan judul |
| Satu zona per objek | Lampu sorot di atas pedestal (berbayangan, dengan berkas cahaya tipis) |

- Lampu menyala dan padam bertahap, dan semakin banyak lampu menyala, cahaya pantulan di ruangan ikut naik sedikit.
- Saat semua lampu mati masih ada cahaya sisa yang sangat redup supaya siluet ruangan tetap terlihat.
- Plakat, tulisan judul, dan objek ikut gelap saat lampunya mati. Mode wireframe dan point cloud
  tidak terpengaruh lampu karena itu tampilan teknis (bahan tanpa pencahayaan).
- Semua angka (terang lampu, cahaya sisa, resolusi bayangan, berkas cahaya) ada di `SETTINGS` pada `src/config.js`.

## Menambah atau mengganti objek

1. Export dari Blender: File → Export → glTF 2.0 (.glb), centang *Apply Modifiers*.
2. Simpan file asli di `assets-src/`.
3. Optimasi untuk web:
   ```bash
   npm run optimize -- assets-src/nama.glb public/models/nama.glb --tris 60000
   ```
   Opsi lain: `--tex 1024` (perkecil tekstur), `--drop "^ENV_"` (hapus node berdasarkan nama).
4. Tambahkan satu entri di `src/config.js`. Posisi pedestal, ukuran ruangan, dan lampu sorot
   (lengkap dengan tombol saklarnya) dihitung otomatis, jadi 8 objek tinggal ditambahkan ke daftar.

## Hasil optimasi model yang sudah ada

| Model | Asli | Untuk web |
|---|---|---|
| Reog | 1,41 juta triangle, 3,8 MB | 100 ribu triangle, 1,5 MB |
| Patung Gajah Mada | 540 ribu triangle, 13 MB (termasuk diorama lingkungan `ENV_*`) | 60 ribu triangle, 0,4 MB (hanya patung dan alasnya) |
| Mobil | 8 ribu triangle | tidak disederhanakan |
| Wayang | 1,2 ribu triangle | tidak disederhanakan |

File asli tidak diubah. Angka di panel info adalah angka model versi web.
Vertex dihitung dari titik unik berdasarkan posisi, sedangkan edge dari garis unik antar vertex.

## Deploy

```bash
npm run build
```

Isi folder `dist/` bisa diunggah ke GitHub Pages, Netlify, atau Vercel.

## Catatan

- Deskripsi objek ada di `src/config.js`; sesuaikan, terutama untuk mobil.
- Terlalu gelap atau terang: ubah `SETTINGS.spot` (lampu sorot), `SETTINGS.pendant` (lampu gantung),
  `SETTINGS.wash` (lampu dinding), atau `SETTINGS.ambientOn` (cahaya pantulan).
- Terasa berat setelah ada bayangan: turunkan `SETTINGS.shadowSize` ke 512 atau set `SETTINGS.beams` ke `false`.
- Layar kosong atau model tidak muncul: buka Console browser (F12) dan cek nama file di `public/models/`.
- Terasa berat di laptop lemah: turunkan `--tris` saat optimasi.
- Versi ini untuk desktop (keyboard dan mouse), belum untuk layar sentuh.
