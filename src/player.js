import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const EYE_HEIGHT = 1.65;
const MARGIN = 0.5;

/** Kontrol first-person: WASD + mouse, dengan tabrakan sederhana dengan dinding dan pedestal. */
export function createPlayer(camera, domElement, room, settings) {
  const controls = new PointerLockControls(camera, domElement);
  const keys = new Set();
  const vel = new THREE.Vector2();

  camera.position.set(room.spawn.x, EYE_HEIGHT, room.spawn.z);

  const blocked = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
  document.addEventListener('keydown', (e) => {
    if (blocked.includes(e.code) && controls.isLocked) e.preventDefault();
    keys.add(e.code);
  });
  document.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  const down = (...codes) => codes.some((c) => keys.has(c));

  function collide() {
    const p = camera.position;
    p.x = THREE.MathUtils.clamp(p.x, -room.bounds.halfW + MARGIN, room.bounds.halfW - MARGIN);
    p.z = THREE.MathUtils.clamp(p.z, -room.bounds.halfD + MARGIN, room.bounds.halfD - MARGIN);
    for (const o of room.obstacles) {
      const dx = p.x - o.x;
      const dz = p.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d < o.r && d > 0.0001) {
        p.x = o.x + (dx / d) * o.r;
        p.z = o.z + (dz / d) * o.r;
      }
    }
    p.y = EYE_HEIGHT;
  }

  function update(dt) {
    if (!controls.isLocked) {
      vel.set(0, 0);
      return;
    }
    const speed = down('ShiftLeft', 'ShiftRight') ? settings.runSpeed : settings.walkSpeed;
    const fwd = (down('KeyW', 'ArrowUp') ? 1 : 0) - (down('KeyS', 'ArrowDown') ? 1 : 0);
    const right = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0);
    const dir = new THREE.Vector2(right, fwd);
    if (dir.lengthSq() > 1) dir.normalize();
    const k = Math.min(1, 12 * dt);
    vel.x += (dir.x * speed - vel.x) * k;
    vel.y += (dir.y * speed - vel.y) * k;
    controls.moveRight(vel.x * dt);
    controls.moveForward(vel.y * dt);
    collide();
  }

  return { controls, update };
}
