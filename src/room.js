import * as THREE from 'three';

const PEDESTAL_H = 0.9;
export const PEDESTAL_TOP = PEDESTAL_H + 0.08;

function canvasTexture(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function woodTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    const planks = 8;
    const pw = w / planks;
    for (let i = 0; i < planks; i++) {
      const light = 36 + Math.random() * 8;
      g.fillStyle = `hsl(25, 38%, ${light}%)`;
      g.fillRect(i * pw, 0, pw, h);
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 2;
      g.strokeRect(i * pw, 0, pw, h);
      g.strokeStyle = 'rgba(0,0,0,0.07)';
      g.lineWidth = 1;
      for (let k = 0; k < 14; k++) {
        const x = i * pw + Math.random() * pw;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + (Math.random() * 6 - 3), h);
        g.stroke();
      }
    }
  });
}

function plaqueTexture(name, origin) {
  return canvasTexture(512, 192, (g, w, h) => {
    g.fillStyle = '#2a1d1a';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c8963e';
    g.lineWidth = 6;
    g.strokeRect(10, 10, w - 20, h - 20);
    g.textAlign = 'center';
    g.fillStyle = '#f6efe6';
    let size = 52;
    g.font = `bold ${size}px Georgia, serif`;
    while (g.measureText(name).width > w - 60 && size > 24) {
      size -= 2;
      g.font = `bold ${size}px Georgia, serif`;
    }
    g.fillText(name, w / 2, 90);
    g.fillStyle = '#d9b36a';
    g.font = '30px Georgia, serif';
    g.fillText(origin, w / 2, 140);
  });
}

function titleTexture() {
  return canvasTexture(1024, 256, (g, w, h) => {
    g.textAlign = 'center';
    g.fillStyle = '#c8963e';
    g.font = 'bold 84px Georgia, serif';
    g.fillText('MUSEUM ', w / 2, 110);
    g.fillText('Virtual', w / 2, 205);
  });
}

/** Atur apakah mesh menerima / menghasilkan bayangan dari lampu sorot. */
function shade(mesh, { cast = false, receive = true } = {}) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

/**
 * Membangun ruangan museum dan pedestal (tanpa lampu; lampu ada di lighting.js).
 * Mengembalikan data slot (posisi tiap pedestal), ukuran & batas ruangan, dan titik awal pemain.
 */
export function buildRoom(scene, objects) {
  const count = objects.length;
  const perSide = Math.ceil(count / 2);
  const spacing = 6.5;
  const width = 20;
  const depth = Math.max(21, perSide * spacing + 8);
  const height = 6;

  // Lantai
  const floorTex = woodTexture();
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(width / 4, depth / 4);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.4, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  shade(floor);
  scene.add(floor);

  // Plafon
  // Plafon sedikit "menyala" mengikuti cahaya pantulan lampu (diatur dari lighting.js)
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x5a504b, emissive: 0x5a504b, emissiveIntensity: 0, roughness: 1 });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = height;
  scene.add(ceiling);

  // Dinding (+ lapisan wainscot di bagian bawah)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe9dfd0, roughness: 0.95 });
  const wainMat = new THREE.MeshStandardMaterial({ color: 0x5a1f2e, roughness: 0.8 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xc8963e, roughness: 0.4, metalness: 0.6 });
  const wallPlane = (w, h, y, mat, side, inset = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    const hw = width / 2 - inset;
    const hd = depth / 2 - inset;
    if (side === 'back') m.position.set(0, y, -hd);
    if (side === 'front') { m.position.set(0, y, hd); m.rotation.y = Math.PI; }
    if (side === 'left') { m.position.set(-hw, y, 0); m.rotation.y = Math.PI / 2; }
    if (side === 'right') { m.position.set(hw, y, 0); m.rotation.y = -Math.PI / 2; }
    shade(m);
    scene.add(m);
  };
  for (const side of ['back', 'front', 'left', 'right']) {
    const w = side === 'back' || side === 'front' ? width : depth;
    wallPlane(w, height, height / 2, wallMat, side);
    wallPlane(w, 1.2, 0.6, wainMat, side, 0.01);
    wallPlane(w, 0.06, 1.23, trimMat, side, 0.012);
  }

  // Karpet di lorong tengah
  const rugGold = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, depth - 5),
    new THREE.MeshStandardMaterial({ color: 0xc8963e, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
  );
  rugGold.rotation.x = -Math.PI / 2;
  rugGold.position.y = 0.01;
  shade(rugGold);
  scene.add(rugGold);
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(4.0, depth - 5.4),
    new THREE.MeshStandardMaterial({ color: 0x7a1f36, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.02;
  shade(rug);
  scene.add(rug);

  // Judul di dinding belakang
  const title = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 2),
    new THREE.MeshStandardMaterial({ map: titleTexture(), transparent: true, roughness: 0.5, metalness: 0.15 })
  );
  title.position.set(0, 3.9, -depth / 2 + 0.02);
  scene.add(title);

  // Pedestal
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3128, roughness: 0.6 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x33211b, roughness: 0.7 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xc8963e, roughness: 0.35, metalness: 0.6 });

  const slots = [];
  const obstacles = [];
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1; // -1 = kiri, +1 = kanan
    const row = Math.floor(i / 2);
    const x = side * (width / 2 - 4.5);
    const z = -1 + (row - (perSide - 1) / 2) * spacing;
    const facing = -side; // arah hadap plakat (menuju lorong tengah)

    const ped = new THREE.Group();
    ped.position.set(x, 0, z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 1.7), darkMat);
    base.position.y = 0.05;
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, PEDESTAL_H, 1.5), woodMat);
    body.position.y = PEDESTAL_H / 2;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 1.8), brassMat);
    cap.position.y = PEDESTAL_H + 0.04;
    for (const part of [base, body, cap]) shade(part, { cast: true });
    ped.add(base, body, cap);

    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.45),
      new THREE.MeshStandardMaterial({ map: plaqueTexture(objects[i].name, objects[i].origin), roughness: 0.55, metalness: 0.1 })
    );
    plaque.position.set(facing * 0.755, 0.5, 0);
    plaque.rotation.y = facing > 0 ? Math.PI / 2 : -Math.PI / 2;
    ped.add(plaque);
    scene.add(ped);

    slots.push({ position: new THREE.Vector3(x, 0, z), facing });
    obstacles.push({ x, z, r: 1.35 });
  }

  return {
    slots,
    obstacles,
    bounds: { halfW: width / 2, halfD: depth / 2 },
    dims: { width, depth, height },
    materials: { ceiling: ceilingMat },
    spawn: new THREE.Vector3(0, 0, depth / 2 - 2.5),
  };
}
