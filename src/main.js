import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import './style.css';
import { OBJECTS, SETTINGS } from './config.js';
import { buildRoom, PEDESTAL_TOP } from './room.js';
import { createLighting } from './lighting.js';
import { createPlayer } from './player.js';
import { loadExhibit, failedExhibit } from './exhibit.js';
import { createUI } from './ui.js';

// ---------- Renderer, scene, kamera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // tepi bayangan dilembutkan lewat shadow.radius
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1518);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 80);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// ---------- Ruangan, lampu & pemain ----------
const room = buildRoom(scene, OBJECTS);
const lighting = createLighting(scene, room, OBJECTS, SETTINGS);
const player = createPlayer(camera, renderer.domElement, room, SETTINGS);

// ---------- UI ----------
const MODES = ['solid', 'wire', 'point'];
let exhibits = [];

function activeExhibit() {
  return ui.panelExhibit || nearestExhibit()?.exhibit || null;
}
function applyMode(mode) {
  const ex = activeExhibit();
  if (!ex || ex.failed) return;
  ex.setMode(mode);
  if (ui.panelExhibit) ui.refreshPanel();
}

const ui = createUI({
  onStart: () => player.controls.lock(),
  onModeClick: applyMode,
  lights: {
    list: () => lighting.list(),
    onToggle: (id) => lighting.toggle(id),
    onAll: (on) => lighting.setAll(on),
  },
});
lighting.onChange(() => ui.refreshLights());

player.controls.addEventListener('lock', () => ui.hideOverlay());
player.controls.addEventListener('unlock', () => ui.showOverlay(true));

document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyE') {
    if (ui.panelExhibit) ui.closePanel();
    else {
      const near = nearestExhibit();
      if (near) ui.openPanel(near.exhibit);
    }
  }
  if (e.code === 'Digit1') applyMode('solid');
  if (e.code === 'Digit2') applyMode('wire');
  if (e.code === 'Digit3') applyMode('point');

  // Saklar lampu
  if (e.code === 'KeyL') lighting.toggleAll();
  if (e.code === 'KeyZ') lighting.toggle('aisle');
  if (e.code === 'KeyX') lighting.toggle('wall');
  if (e.code === 'KeyF') {
    const near = nearestExhibit();
    if (near) lighting.toggle(`ex-${exhibits.indexOf(near.exhibit)}`);
  }
});

function nearestExhibit() {
  let best = null;
  for (const ex of exhibits) {
    const d = Math.hypot(camera.position.x - ex.slot.position.x, camera.position.z - ex.slot.position.z);
    if (!best || d < best.distance) best = { exhibit: ex, distance: d };
  }
  return best && best.distance <= SETTINGS.interactDistance ? best : null;
}

// ---------- Memuat model ----------
const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
loader.setDRACOLoader(draco);
loader.setMeshoptDecoder(MeshoptDecoder);

const progress = OBJECTS.map(() => 0);
const updateProgress = () => {
  const total = progress.reduce((a, b) => a + b, 0) / OBJECTS.length;
  ui.setProgress(total, `Memuat objek… ${Math.round(total * 100)}%`);
};

async function loadAll() {
  const results = await Promise.all(
    OBJECTS.map(async (def, i) => {
      try {
        const ex = await loadExhibit(def, loader, (f) => {
          progress[i] = f;
          updateProgress();
        });
        progress[i] = 1;
        updateProgress();
        return ex;
      } catch (err) {
        progress[i] = 1;
        updateProgress();
        return failedExhibit(def, err);
      }
    })
  );
  exhibits = results.map((ex, i) => {
    ex.slot = room.slots[i];
    ex.holder.position.set(ex.slot.position.x, PEDESTAL_TOP, ex.slot.position.z);
    scene.add(ex.holder);
    return ex;
  });
  const failed = exhibits.filter((e) => e.failed).length;
  ui.ready(failed ? `Siap (${failed} model gagal dimuat, cek console)` : 'Siap dijelajahi');
}
loadAll();

// ---------- Loop ----------
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  player.update(dt);
  lighting.update(dt);
  for (const ex of exhibits) ex.holder.rotation.y += SETTINGS.rotateSpeed * dt;

  const near = nearestExhibit();
  if (ui.panelExhibit && (!near || near.exhibit !== ui.panelExhibit)) ui.closePanel();
  if (near && !ui.panelExhibit) {
    const lampOn = lighting.isOn(`ex-${exhibits.indexOf(near.exhibit)}`);
    ui.setPrompt(`E — lihat info ${near.exhibit.def.name}   ·   F — ${lampOn ? 'matikan' : 'nyalakan'} lampu`);
  } else {
    ui.setPrompt(null);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
