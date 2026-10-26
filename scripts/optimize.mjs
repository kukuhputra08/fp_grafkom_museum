// Mengoptimalkan model .glb agar ringan dimuat di website.
//
// Pemakaian:
//   node scripts/optimize.mjs <input.glb> <output.glb> [opsi]
//
// Opsi:
//   --tris 80000     batasi jumlah triangle (model disederhanakan kalau lebih banyak)
//   --error 0.02     batas kesalahan simplifikasi (pecahan dari ukuran model)
//   --drop "^ENV_"   hapus node yang namanya cocok dengan regex ini
//   --tex 1024       perkecil tekstur menjadi maksimal 1024 x 1024 px
//
// Contoh:
//   node scripts/optimize.mjs assets-src/reog.glb public/models/reog.glb --tris 100000 --tex 1024

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, textureCompress, meshopt } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import fs from 'node:fs';

const args = process.argv.slice(2);
const [input, output] = args;
if (!input || !output) {
  console.error('Pemakaian: node scripts/optimize.mjs <input.glb> <output.glb> [--tris N] [--error E] [--drop REGEX] [--tex PX]');
  process.exit(1);
}
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : fallback;
};
const maxTris = Number(opt('tris', 0));
const maxError = Number(opt('error', 0.02));
const dropRe = opt('drop', null);
const texSize = Number(opt('tex', 0));

await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready, MeshoptDecoder.ready]);

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });

const countTris = (doc) => {
  let t = 0;
  for (const mesh of doc.getRoot().listMeshes())
    for (const p of mesh.listPrimitives()) {
      const idx = p.getIndices();
      t += (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3;
    }
  return Math.round(t);
};
const mb = (file) => (fs.statSync(file).size / 1024 / 1024).toFixed(2) + ' MB';

const doc = await io.read(input);
console.log(`Input : ${input} | ${mb(input)} | ${countTris(doc).toLocaleString()} triangle`);

// 1. Hapus node yang tidak diperlukan (misalnya lingkungan/diorama di sekitar patung)
if (dropRe) {
  const re = new RegExp(dropRe);
  let dropped = 0;
  for (const node of doc.getRoot().listNodes()) {
    if (re.test(node.getName())) { node.dispose(); dropped++; }
  }
  console.log(`Node dihapus: ${dropped} (regex ${dropRe})`);
}

const steps = [dedup(), prune()];

// 2. Sederhanakan mesh kalau melebihi batas triangle
await doc.transform(...steps);
const before = countTris(doc);
if (maxTris && before > maxTris) {
  const ratio = maxTris / before;
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: maxError }), prune());
  console.log(`Simplifikasi: ${before.toLocaleString()} -> ${countTris(doc).toLocaleString()} triangle (target ${maxTris.toLocaleString()})`);
}

// 3. Perkecil tekstur
if (texSize) {
  await doc.transform(textureCompress({ encoder: sharp, resize: [texSize, texSize] }));
}

// 4. Kompres geometri (meshopt) supaya ukuran file kecil.
// Kalau file asal memakai Draco, ekstensi Draco dilepas dulu (hasil akhir memakai meshopt).
for (const ext of doc.getRoot().listExtensionsUsed()) {
  if (ext.extensionName === 'KHR_draco_mesh_compression') ext.dispose();
}
await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));

await io.write(output, doc);
console.log(`Output: ${output} | ${mb(output)} | ${countTris(doc).toLocaleString()} triangle\n`);
