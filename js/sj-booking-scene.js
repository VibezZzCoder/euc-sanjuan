/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan — adapted from VibezZzCoder/euc-sanfrancisco (MIT) */
// The booking desk, "Cuartelillo del Monociclo": Officer Dorkins's outdoor paperwork post on the forecourt of La
// Princesa. Presentation only: no collider, no light, nothing fixed to the real building (its door stays shut); the
// whole group is hidden unless a booking is on. Built once, compiled with the city. Adapted from the San Francisco
// edition (js/booking-scene.js, © 2026 VibezZzCoder, MIT; first written for the New York edition): an unmarked
// deep-blue painted timber desk with a timber top, an off-white form that tears in two, a warm desk lamp (its lens is
// a lit surface, not a light) and a small free-standing ivory and cobalt plaque. No insignia, crest or agency name.
import * as THREE from 'three/webgpu';
import { BOOKING_RULES } from './sj-booking-rules.js';

/**
 * site {x, y, z, heading}: the desk's ground centre; heading turns the local +Z side (where the rider stands).
 * officer: { begin(x, y, z, heading), present(dt, action), end(), tear() } (the officer part's presenter).
 */
export function createBookingScene(scene, site, officer = {}, { plaque = null } = {}) {
  if (!site || !['x', 'y', 'z', 'heading'].every(key => Number.isFinite(site[key]))) throw new TypeError('Booking site requires finite x, y, z and heading');
  const { x, y, z, heading } = site;
  const sin = Math.sin(heading), cos = Math.cos(heading);
  const world = (out, lx, ly, lz) => { out.x = x + cos * lx + sin * lz; out.y = y + ly; out.z = z - sin * lx + cos * lz; return out; };
  const group = new THREE.Group();
  group.name = 'booking-desk';
  group.position.set(x, y, z); group.rotation.y = heading;
  group.userData.presentationOnly = true;
  group.visible = false;

  const materials = [
    new THREE.MeshStandardMaterial({ color: 0x1f3d66, roughness: 0.72 }), // painted timber, the shutters' blue
    new THREE.MeshStandardMaterial({ color: 0x8a6542, roughness: 0.82 }), // timber top
    new THREE.MeshStandardMaterial({ color: 0xf3ecdc, roughness: 0.9 }), // the form
    new THREE.MeshBasicMaterial({ color: 0x17232c }), // ink
    new THREE.MeshBasicMaterial({ color: 0xffdca8, side: THREE.DoubleSide }), // the lamp's lit lens
    new THREE.MeshStandardMaterial({ color: 0x2a2f33, roughness: 0.5, metalness: 0.4 }), // lamp iron
  ];
  const [blue, wood, paper, ink, lensMaterial, iron] = materials;
  function box(bx, by, bz, w, h, d, material, parent = group) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(bx, by, bz); mesh.castShadow = false; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  box(0, 0.88, 0, 1.9, 0.08, 0.85, wood);
  box(0, 0.47, 0.36, 1.78, 0.74, 0.06, blue); // front panel, toward the rider
  for (const side of [-0.86, 0.86]) box(side, 0.44, 0, 0.1, 0.88, 0.8, blue);
  box(0, 0.12, 0, 1.62, 0.04, 0.7, blue); // foot rail
  box(-0.24, 0.935, 0, 0.52, 0.025, 0.53, blue); // the clipboard
  const halves = [-1, 1].map(side => box(-0.24, 0.955, side * 0.11, 0.43, 0.012, 0.215, paper));
  const scribble = box(-0.24, 0.964, 0, 0.32, 0.004, 0.025, ink);
  // the lamp: an iron stem and arm, a shade and its lit lens
  box(0.8, 1.38, -0.22, 0.045, 0.92, 0.045, iron);
  box(0.92, 1.83, -0.22, 0.28, 0.04, 0.04, iron);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.17, 14, 1, true), blue);
  shade.position.set(1.05, 1.76, -0.22); group.add(shade);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.13, 14), lensMaterial);
  lens.rotation.x = Math.PI / 2; lens.position.set(1.05, 1.68, -0.22); group.add(lens);
  // the plaque: free-standing on the desk, leaning back on its own stand, facing the rider
  if (plaque) {
    const texture = new THREE.CanvasTexture(plaque); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
    const face = new THREE.MeshBasicMaterial({ map: texture });
    materials.push(face); group.userData.texture = texture;
    const stand = new THREE.Group(); stand.position.set(0.38, 0.92, 0.22); stand.rotation.x = -0.32; group.add(stand);
    box(0, 0.105, -0.008, 0.64, 0.23, 0.012, blue, stand);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.19), face); sign.position.set(0, 0.105, 0.0005); stand.add(sign);
    box(0, 0.06, -0.06, 0.5, 0.012, 0.11, blue, stand);
  }
  scene.add(group);

  const officerPoint = world({}, 0, 0, -1.25);
  const action = world({ writing: false, age: 0 }, -0.24, 0.99, 0);
  const cameraView = { center: {}, dir: { x: 0, y: 0, z: 1 }, radius: 2.75, fov: 50 };
  let staged = false, torn = false, disposed = false;
  function end() {
    group.visible = false;
    if (staged) { staged = false; torn = false; officer.end?.(); }
  }
  return {
    group, cameraView, officerPoint,
    warm(on) { group.visible = !!on; for (const half of halves) half.visible = true; scribble.visible = !!on; },
    update(dt, state, aspect) {
      if (disposed) throw new Error('Booking scene is disposed');
      if (!state || state.phase === 'idle' || state.phase === 'captured') { end(); return null; }
      group.visible = true;
      if (!staged) { officer.begin?.(officerPoint.x, officerPoint.y + 0.35, officerPoint.z, heading); staged = true; }
      const signature = state.phase === 'signature';
      const writing = signature && state.age >= BOOKING_RULES.writeDelay && state.age < BOOKING_RULES.tearSeconds;
      const ripped = state.phase === 'released' || (signature && state.age >= BOOKING_RULES.tearSeconds);
      const fall = signature ? Math.max(0, Math.min(1, (state.age - BOOKING_RULES.tearSeconds) / 1.4)) : ripped ? 1 : 0;
      halves.forEach((half, i) => {
        const side = i === 0 ? -1 : 1;
        half.position.set(-0.24 + side * fall * 1.7, 0.955 * (1 - fall) + 1.4 * Math.sin(Math.PI * fall), side * (0.11 + fall * 0.25));
        half.rotation.set(Math.sin(Math.PI * fall) * side * 0.45, fall * side * 0.65, Math.sin(Math.PI * fall) * side * 0.55);
        half.visible = fall < 0.999 || state.phase !== 'released';
      });
      scribble.visible = writing && state.age > BOOKING_RULES.writeDelay + 0.3;
      scribble.rotation.y = Math.sin(state.age * 30) * 0.3;
      if (ripped && !torn) { torn = true; officer.tear?.(); }
      action.writing = writing; action.age = state.age;
      officer.present?.(dt, action);
      // the subject (rider, desk, form, officer) as a sphere and the side it is seen from; the host fits it into the part
      // of the screen the dialog leaves free
      const close = signature ? Math.min(1, state.age / 0.8) : 0;
      world(cameraView.center, 0.1, 1.1, 1.0);
      cameraView.radius = 2.75 - close * 0.35;
      const dx = 0.62, dy = 0.42, dz = 0.66, n = Math.hypot(dx, dy, dz);
      cameraView.dir.x = (cos * dx + sin * dz) / n; cameraView.dir.y = dy / n; cameraView.dir.z = (-sin * dx + cos * dz) / n;
      cameraView.fov = 50;
      return cameraView;
    },
    end,
    dispose() {
      if (disposed) return;
      disposed = true;
      try { end(); } finally {
        group.removeFromParent(); group.traverse(object => object.geometry?.dispose());
        for (const material of materials) material.dispose(); group.userData.texture?.dispose();
      }
    },
  };
}
