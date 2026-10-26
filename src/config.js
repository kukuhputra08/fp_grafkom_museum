// Daftar objek yang dipamerkan.
// Untuk menambah objek: letakkan file .glb di public/models/, lalu tambahkan satu entri di bawah.
// Posisi pedestal dan ukuran ruangan dihitung otomatis dari jumlah objek.

export const OBJECTS = [
  {
    id: 'reog',
    name: 'Reog Ponorogo',
    origin: 'Ponorogo, Jawa Timur',
    file: 'reog.glb',
    size: 1.7, // ukuran terbesar objek saat dipajang (meter)
    description:
      'Reog Ponorogo adalah kesenian tradisional dari Ponorogo, Jawa Timur. Ikon utamanya adalah dadak merak, topeng berbentuk kepala harimau yang dihiasi bulu merak.',
  },
  {
    id: 'wayang',
    name: 'Wayang',
    origin: 'Jawa, Indonesia',
    file: 'wayang.glb',
    size: 1.5,
    description:
      'Wayang adalah seni pertunjukan tradisional Indonesia yang membawakan kisah epos dan legenda. UNESCO menetapkannya sebagai Mahakarya Warisan Budaya Lisan dan Takbenda Kemanusiaan pada tahun 2003.',
  },
  {
    id: 'gajah-mada',
    name: 'Patung Gajah Mada',
    origin: 'Kerajaan Majapahit',
    file: 'patung-gajah-mada.glb',
    size: 2.2,
    description:
      'Gajah Mada adalah mahapatih Kerajaan Majapahit yang dikenal lewat Sumpah Palapa, ikrar untuk menyatukan Nusantara.',
  },
  {
    id: 'mobil',
    name: 'Mobil Klasik',
    origin: 'Koleksi kendaraan klasik',
    file: 'mobil.glb',
    size: 2.8,
    description:
      'Mobil klasik sebagai koleksi museum. Bodi, kaca, roda, dan bagian lainnya disusun dari beberapa mesh dengan material yang berbeda.',
  },
];

// Pengaturan tampilan (silakan diubah kalau terlalu terang/gelap)
export const SETTINGS = {
  // --- Pencahayaan (lihat src/lighting.js) ---
  // Satuan lampu adalah candela. Makin besar angkanya, makin terang kolam cahayanya.
  spot: 170, // lampu sorot di atas tiap objek (menghasilkan bayangan)
  pendant: 95, // lampu gantung di lorong tengah
  wash: 85, // lampu penyorot dinding samping dan dinding judul
  ambientOff: 0.1, // cahaya sisa saat semua lampu mati (supaya tidak gelap gulita)
  ambientOn: 0.5, // tambahan cahaya pantulan saat semua lampu menyala
  environmentOff: 0.03, // pantulan lingkungan pada material, saat lampu mati
  environmentOn: 0.22, // pantulan lingkungan pada material, saat lampu menyala
  shadowSize: 1024, // resolusi peta bayangan (512 lebih ringan, 2048 lebih tajam)
  beams: true, // berkas cahaya tipis di bawah lampu sorot
  lampFade: 7, // kecepatan lampu menyala/padam (makin besar makin cepat)

  walkSpeed: 3.6, // m/detik
  runSpeed: 6.5,
  interactDistance: 3.6, // jarak (meter) untuk bisa menekan E
  rotateSpeed: 0.35, // kecepatan putar objek di pedestal (rad/detik)
};
