import * as THREE from 'three';
import { PEDESTAL_TOP } from './room.js';

/**
 * Pencahayaan museum.
 *
 * Prinsipnya meniru ruang pamer sungguhan: cahaya umum sengaja dibuat redup, sehingga
 * terang-gelapnya ruangan ditentukan oleh lampu. Daerah yang jauh dari lampu tampak gelap,
 * objek di bawah lampu sorot tampak terang dan menghasilkan bayangan.
 *
 * Lampu dikelompokkan menjadi "zona" yang masing-masing punya satu saklar:
 *   - aisle  : tiga lampu gantung di atas karpet lorong
 *   - wall   : penyorot dinding samping dan dinding judul
 *   - ex-0.. : satu lampu sorot (berbayangan) untuk tiap objek pameran
 *
 * Menyalakan/mematikan zona dilakukan bertahap (fade) agar terasa seperti lampu sungguhan.
 */

const SPOT_COLOR = 0xffe3bd; // putih hangat (sekitar 3000 K)
const BULB_COLOR = 0xffd29a; // kuning hangat (sekitar 2700 K)
const WASH_COLOR = 0xffeacf;

// ---------- Bahan visual lampu ----------

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// Berkas cahaya tipis berbentuk kerucut. Tepinya memudar (fresnel) dan makin tipis ke bawah.
const BEAM_VERT = /* glsl */ `
  uniform float uLen;
  varying float vT;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vT = position.z / uLen;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const BEAM_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vT;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    float facing = abs(dot(normalize(vN), normalize(vView)));
    float edge = facing * facing;
    float along = pow(clamp(1.0 - vT, 0.0, 1.0), 1.4) * smoothstep(0.0, 0.06, vT);
    gl_FragColor = vec4(uColor, edge * along * uOpacity);
  }
`;

export function createLighting(scene, room, objects, S) {
  const { width, depth, height } = room.dims;

  // Cahaya sisa + pantulan. Besarnya naik-turun mengikuti jumlah lampu yang menyala.
  const hemi = new THREE.HemisphereLight(0xfff1de, 0x4a3a30, S.ambientOff);
  scene.add(hemi);

  const glowTex = glowTexture();
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x15110f, roughness: 0.45, metalness: 0.7 });

  const zones = [];
  const byId = new Map();
  const listeners = [];

  function addZone(id, label, key, weight) {
    const z = { id, label, key, weight, target: 1, level: 1, lights: [], glows: [], halos: [], beams: [] };
    zones.push(z);
    byId.set(id, z);
    return z;
  }

  function addHalo(zone, parent, position, size, color, max) {
    const mat = new THREE.SpriteMaterial({
      map: glowTex,
      color,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      opacity: 0,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(position);
    sprite.scale.setScalar(size);
    parent.add(sprite);
    zone.halos.push({ mat, max });
  }

  /** Lampu sorot yang menggantung di langit-langit dan menghadap ke satu titik. */
  function addSpotFixture(zone, pos, target, o) {
    const light = new THREE.SpotLight(o.color, o.intensity, o.distance, o.angle, o.penumbra, 2);
    light.position.copy(pos);
    light.target.position.copy(target);
    scene.add(light, light.target);
    zone.lights.push({ light, base: o.intensity });

    if (o.shadow) {
      light.castShadow = true;
      light.shadow.mapSize.set(S.shadowSize, S.shadowSize);
      light.shadow.camera.near = 0.8;
      light.shadow.bias = -0.0004;
      light.shadow.normalBias = 0.03;
      light.shadow.radius = 3;
    }

    // Bodi lampu: batang, rumah lampu, dan lensa yang menyala
    const root = new THREE.Group();
    root.position.copy(pos);
    scene.add(root);
    const stemLen = height - pos.y;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, stemLen, 8), housingMat);
    stem.position.y = stemLen / 2;
    root.add(stem);

    const head = new THREE.Group();
    root.add(head);
    root.updateMatrixWorld(true);
    head.lookAt(target); // sumbu +z kepala lampu menghadap target

    const bodyGeo = new THREE.CylinderGeometry(0.14, 0.1, 0.34, 24);
    bodyGeo.rotateX(Math.PI / 2);
    head.add(new THREE.Mesh(bodyGeo, housingMat));
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: o.color, emissiveIntensity: 0 });
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.125, 24), lensMat);
    lens.position.z = 0.172;
    head.add(lens);
    zone.glows.push({ mat: lensMat, max: 3.5 });
    addHalo(zone, head, new THREE.Vector3(0, 0, 0.22), 0.85, o.color, 0.55);

    // Berkas cahaya
    if (o.beam && S.beams) {
      const dir = target.clone().sub(pos).normalize();
      const len = dir.y < -0.05 ? Math.min(pos.y / -dir.y, 9) : 6;
      const radius = len * Math.tan(o.angle * 0.85);
      const geo = new THREE.ConeGeometry(radius, len, 40, 1, true);
      geo.translate(0, -len / 2, 0); // ujung kerucut di lensa
      geo.rotateX(-Math.PI / 2); // ujung di z = 0, dasar di z = len
      const mat = new THREE.ShaderMaterial({
        uniforms: { uLen: { value: len }, uColor: { value: new THREE.Color(o.color) }, uOpacity: { value: 0 } },
        vertexShader: BEAM_VERT,
        fragmentShader: BEAM_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const beam = new THREE.Mesh(geo, mat);
      beam.position.z = 0.17;
      beam.frustumCulled = false;
      head.add(beam);
      zone.beams.push({ mat, max: 0.3 });
    }
    return light;
  }

  /** Lampu gantung berkap kuningan di atas lorong; cahayanya turun ke lantai. */
  function addPendant(zone, x, z) {
    const cord = 0.9;
    const domeH = 0.42 * 0.75;
    const baseY = height - cord - domeH;

    const root = new THREE.Group();
    root.position.set(x, baseY, z);
    scene.add(root);

    const domeGeo = new THREE.SphereGeometry(0.42, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const outer = new THREE.Mesh(
      domeGeo,
      new THREE.MeshStandardMaterial({ color: 0xb08a45, roughness: 0.4, metalness: 0.65 })
    );
    outer.scale.y = 0.75;
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x4a3a28,
      roughness: 0.8,
      emissive: BULB_COLOR,
      emissiveIntensity: 0,
      side: THREE.BackSide,
    });
    const inner = new THREE.Mesh(domeGeo, innerMat);
    inner.scale.set(0.97, 0.73, 0.97);
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: BULB_COLOR, emissiveIntensity: 0 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), bulbMat);
    bulb.position.y = 0.04;
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, cord, 6), housingMat);
    wire.position.y = domeH + cord / 2;
    const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 16), housingMat);
    rose.position.y = domeH + cord - 0.015;
    root.add(outer, inner, bulb, wire, rose);

    zone.glows.push({ mat: bulbMat, max: 4 }, { mat: innerMat, max: 1.1 });
    addHalo(zone, root, new THREE.Vector3(0, -0.12, 0), 1.9, BULB_COLOR, 0.5);

    const light = new THREE.SpotLight(BULB_COLOR, S.pendant, 13, 0.85, 1, 2);
    light.position.set(x, baseY - 0.02, z);
    light.target.position.set(x, 0, z);
    scene.add(light, light.target);
    zone.lights.push({ light, base: S.pendant });
  }

  // ---------- Susunan lampu ----------

  // 1) Lampu gantung di lorong
  const aisle = addZone('aisle', 'Lampu gantung lorong', 'Z', 0.3);
  for (const zz of [-depth * 0.3, 0, depth * 0.3]) addPendant(aisle, 0, zz);

  // 2) Penyorot dinding samping + dinding judul
  const wall = addZone('wall', 'Lampu dinding & judul', 'X', 0.2);
  for (const side of [-1, 1]) {
    addSpotFixture(
      wall,
      new THREE.Vector3(side * (width / 2 - 2.4), height - 0.5, -1),
      new THREE.Vector3(side * (width / 2), 2.0, -1),
      { color: WASH_COLOR, intensity: S.wash, distance: 12, angle: 0.7, penumbra: 0.9 }
    );
  }
  addSpotFixture(
    wall,
    new THREE.Vector3(0, height - 0.5, -depth / 2 + 3.2),
    new THREE.Vector3(0, 3.9, -depth / 2),
    { color: WASH_COLOR, intensity: S.wash * 0.65, distance: 10, angle: 0.8, penumbra: 0.9 }
  );

  // 3) Satu lampu sorot berbayangan untuk tiap objek
  objects.forEach((obj, i) => {
    const slot = room.slots[i];
    const zone = addZone(`ex-${i}`, obj.name, null, 0.5 / objects.length);
    addSpotFixture(
      zone,
      new THREE.Vector3(slot.position.x + slot.facing * 1.8, height - 0.55, slot.position.z),
      new THREE.Vector3(slot.position.x, PEDESTAL_TOP + 0.9, slot.position.z),
      { color: SPOT_COLOR, intensity: S.spot, distance: 14, angle: 0.55, penumbra: 0.45, shadow: true, beam: true }
    );
  });

  // ---------- Kontrol ----------

  function applyZone(z) {
    const k = z.level;
    for (const l of z.lights) {
      l.light.intensity = l.base * k;
      // Lampu padam tidak perlu menggambar ulang peta bayangan (tanpa mengubah jumlah lampu,
      // supaya shader tidak perlu dikompilasi ulang).
      if (l.light.castShadow) l.light.shadow.autoUpdate = k > 0.01;
    }
    for (const g of z.glows) g.mat.emissiveIntensity = g.max * k;
    for (const h of z.halos) h.mat.opacity = h.max * k;
    for (const b of z.beams) b.mat.uniforms.uOpacity.value = b.max * k;
  }

  function applyAmbient() {
    let bounce = 0;
    for (const z of zones) bounce += z.weight * z.level;
    hemi.intensity = S.ambientOff + S.ambientOn * bounce;
    room.materials.ceiling.emissiveIntensity = 0.5 * bounce;
    scene.environmentIntensity = S.environmentOff + S.environmentOn * bounce;
  }

  const emit = () => listeners.forEach((fn) => fn());

  for (const z of zones) applyZone(z);
  applyAmbient();

  return {
    /** Daftar zona + status untuk UI. */
    list: () => zones.map((z) => ({ id: z.id, label: z.label, key: z.key, on: z.target > 0.5 })),
    isOn: (id) => (byId.get(id)?.target ?? 0) > 0.5,
    set(id, on) {
      const z = byId.get(id);
      if (!z || (z.target > 0.5) === on) return;
      z.target = on ? 1 : 0;
      emit();
    },
    toggle(id) {
      const z = byId.get(id);
      if (z) this.set(id, z.target < 0.5);
    },
    setAll(on) {
      for (const z of zones) z.target = on ? 1 : 0;
      emit();
    },
    /** Kalau semua sudah menyala maka dimatikan semua; selain itu dinyalakan semua. */
    toggleAll() {
      this.setAll(!zones.every((z) => z.target > 0.5));
    },
    onChange: (fn) => listeners.push(fn),
    /** Dipanggil tiap frame: menggeser terang lampu pelan-pelan menuju targetnya. */
    update(dt) {
      const k = 1 - Math.exp(-dt * S.lampFade);
      let changed = false;
      for (const z of zones) {
        if (z.level === z.target) continue;
        z.level += (z.target - z.level) * k;
        if (Math.abs(z.target - z.level) < 0.003) z.level = z.target;
        applyZone(z);
        changed = true;
      }
      if (changed) applyAmbient();
    },
  };
}
