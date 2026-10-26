import * as THREE from 'three';

/**
 * Menghitung statistik representasi 3D dari mesh:
 *  - vertex : titik unik berdasarkan posisi (titik kembar di sambungan UV/normal digabung)
 *  - edge   : garis unik antar dua vertex
 *  - face   : jumlah segitiga
 */
function computeStats(meshes) {
  let vertices = 0;
  let edges = 0;
  let faces = 0;
  const cache = new Map();

  for (const mesh of meshes) {
    const geo = mesh.geometry;
    let s = cache.get(geo);
    if (!s) {
      const pos = geo.attributes.position;
      const index = geo.index;
      const ids = new Uint32Array(pos.count);
      const lookup = new Map();
      for (let i = 0; i < pos.count; i++) {
        const key = pos.getX(i).toFixed(5) + ',' + pos.getY(i).toFixed(5) + ',' + pos.getZ(i).toFixed(5);
        let id = lookup.get(key);
        if (id === undefined) {
          id = lookup.size;
          lookup.set(key, id);
        }
        ids[i] = id;
      }
      const n = lookup.size;
      const triCount = (index ? index.count : pos.count) / 3;
      const edgeSet = new Set();
      for (let t = 0; t < triCount; t++) {
        const a = ids[index ? index.getX(t * 3) : t * 3];
        const b = ids[index ? index.getX(t * 3 + 1) : t * 3 + 1];
        const c = ids[index ? index.getX(t * 3 + 2) : t * 3 + 2];
        for (const [u, v] of [[a, b], [b, c], [c, a]]) {
          if (u === v) continue;
          edgeSet.add(u < v ? u * n + v : v * n + u);
        }
      }
      s = { vertices: n, edges: edgeSet.size, faces: triCount };
      cache.set(geo, s);
    }
    vertices += s.vertices;
    edges += s.edges;
    faces += s.faces;
  }
  const materials = new Set(meshes.map((m) => m.material)).size;
  return { vertices, edges, faces, meshes: meshes.length, materials };
}

/** Memuat satu model .glb, menyesuaikan ukurannya, dan menyiapkan mode solid / wireframe / point. */
export async function loadExhibit(def, loader, onProgress) {
  const url = `${import.meta.env.BASE_URL}models/${def.file}`;
  const gltf = await loader.loadAsync(url, (e) => {
    if (e.lengthComputable && e.total > 0) onProgress?.(e.loaded / e.total);
  });
  const model = gltf.scene;

  const meshes = [];
  model.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  if (meshes.length === 0) throw new Error('Tidak ada mesh di ' + def.file);

  const stats = computeStats(meshes);

  // Objek menerima dan menghasilkan bayangan dari lampu sorot
  for (const m of meshes) {
    m.castShadow = true;
    m.receiveShadow = true;
  }

  // Sesuaikan ukuran & posisi: alas objek tepat di atas pedestal, di tengah
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = def.size / Math.max(size.x, size.y, size.z);
  model.position.set(-center.x, -box.min.y, -center.z);
  const inner = new THREE.Group();
  inner.scale.setScalar(scale);
  inner.add(model);
  const holder = new THREE.Group();
  holder.add(inner);

  // Material untuk tiap mode
  const wireMat = new THREE.MeshBasicMaterial({ color: 0xf1c97a, wireframe: true });
  const hiddenMat = new THREE.MeshBasicMaterial({ visible: false });
  const pointMat = new THREE.PointsMaterial({ color: 0xf1c97a, size: def.size * 0.012, sizeAttenuation: true });
  for (const m of meshes) m.userData.original = m.material;

  const exhibit = {
    def,
    holder,
    stats,
    mode: 'solid',
    failed: false,
    setMode(mode) {
      exhibit.mode = mode;
      for (const m of meshes) {
        m.material = mode === 'solid' ? m.userData.original : mode === 'wire' ? wireMat : hiddenMat;
        m.castShadow = mode === 'solid'; // wireframe dan point cloud tidak menghasilkan bayangan padat
        if (mode === 'point' && !m.userData.points) {
          m.userData.points = new THREE.Points(m.geometry, pointMat);
          m.add(m.userData.points);
        }
        if (m.userData.points) m.userData.points.visible = mode === 'point';
      }
    },
  };
  return exhibit;
}

/** Pengganti kalau model gagal dimuat, supaya museum tetap bisa dijelajahi. */
export function failedExhibit(def, error) {
  console.error(`Gagal memuat ${def.file}:`, error);
  const holder = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.8, 0.8),
    new THREE.MeshBasicMaterial({ color: 0x8a8a8a, wireframe: true })
  );
  box.position.y = 0.4;
  holder.add(box);
  return { def, holder, stats: null, mode: 'solid', failed: true, setMode() {} };
}
