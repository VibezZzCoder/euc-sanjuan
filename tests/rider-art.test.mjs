/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Geometry probes adapted from EUC Thrills v1.6.1 redRiderKit.test.ts and copArt.test.ts (MIT, VibezZzCoder).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Mesh, MeshBasicMaterial, Raycaster, Vector3, Color } from '../vendor/three/build/three.core.js';
import { redRiderCamera } from '../js/euc/render/redRiderKit.js';
import { dorkinsFace } from '../js/euc/render/dorkinsHead.js';
import { riderLook } from '../js/euc/render/riderLook.js';

const manifest = JSON.parse(fs.readFileSync(new URL('../js/euc/MANIFEST.json', import.meta.url)));
test('each refreshed playable kit belongs only to its own deferred appearance', () => {
  for (const [id, kits] of Object.entries({ 'red-rider': ['redRiderKit'], trollina: ['trollinaSculpt'],
    'flo-with-zo': ['floRaceJacket', 'floWithZoHelmet'], adonisb2: ['adonisb2Kit'] })) {
    for (const kit of kits) {
      const file = `render/${kit}.js`;
      assert.ok(!manifest.eager.includes(file));
      assert.deepEqual(Object.keys(manifest.appearances).filter(key => manifest.appearances[key].includes(file)), [id]);
    }
  }
  assert.ok(manifest.eager.includes('render/dorkinsHead.js'));
});
test('Red Rider has a left-side camera with a recessed lens', () => {
  const geometry = redRiderCamera(), material = new MeshBasicMaterial(), camera = new Mesh(geometry, material);
  geometry.computeBoundingBox();
  assert.ok(geometry.boundingBox.min.x > .01);
  const depth = x => new Raycaster(new Vector3(x, .297, .5), new Vector3(0, 0, -1)).intersectObject(camera)[0].point.z;
  assert.ok(depth(.0592) - depth(.048) > .003);
  geometry.dispose(); material.dispose();
});
test('both of Dorkins’s glasses arms extend over and hook behind the ear', () => {
  const geometry = dorkinsFace(), material = new MeshBasicMaterial(), face = new Mesh(geometry, material);
  const frameTint = new Color(0x4c4034).r / new Color(riderLook('cop').materials.limbs.colour).r;
  for (const side of [-1, 1]) for (const [z, y] of [[.100,.204],[.030,.203],[-.012,.189]]) {
    const ray = new Raycaster(new Vector3(side * .2, y, z), new Vector3(-side, 0, 0), 0, .122);
    assert.ok(ray.intersectObject(face).some(hit => Math.abs(geometry.attributes.color.getX(hit.face.a) - frameTint) < 1e-6));
  }
  geometry.dispose(); material.dispose();
});

// A posed rig includes the rear lights the cloth must clear, unlike a rider in isolation.
import { TROLLINA_LOOK } from '../js/euc/render/riderAppearance-trollina.js';
import { TROLLINA_MACHINE_LOOK } from '../js/euc/render/machineLook.js';
import { createRidingRig } from '../js/euc/render/ridingRig.js';
import { createPose } from '../js/euc/simulation/EucController.js';
import { DoubleSide } from '../vendor/three/build/three.core.js';

test('Trollina’s hem swings both ways, clears the rear lamps in a crouch and returns to centre', () => {
  const rig = createRidingRig(TROLLINA_LOOK, TROLLINA_MACHINE_LOOK);
  const torso = rig.rider.pelvis.children.find(child => child.isMesh && child.castShadow);
  const radial = TROLLINA_LOOK.density.torso, positions = torso.geometry.attributes.position;
  const lampMaterial = new MeshBasicMaterial({side: DoubleSide});
  const lamps = ['euc-status-light', 'euc-taillight'].map(name => {
    const mesh = rig.group.getObjectByName(name), probe = new Mesh(mesh.geometry, lampMaterial);
    probe.matrixAutoUpdate = false;
    return { mesh, probe };
  });
  try {
    for (const bank of [-.58, .58, 0]) {
      const tuck = bank ? .88 : 0;
      rig.apply(Object.assign(createPose(), {rollAngle: bank, riderRoll: bank, crouch: tuck, tuck, speed: 7}));
      rig.group.updateMatrixWorld(true);
      for (const {mesh, probe} of lamps) probe.matrixWorld.copy(mesh.matrixWorld);
      const vertex = index => torso.localToWorld(new Vector3().fromBufferAttribute(positions, index));
      const belt = torso.localToWorld(new Vector3(0, TROLLINA_LOOK.hemDrapeGravity.anchorY, 0));
      let centre = 0;
      for (let i = 0; i < radial; i++) {
        centre += vertex(i).x / radial;
        for (const next of [(i + 1) % radial, i + radial]) {
          const from = vertex(i), edge = vertex(next).sub(from);
          const ray = new Raycaster(from, edge.clone().normalize(), 0, edge.length());
          for (const {probe} of lamps) assert.equal(ray.intersectObject(probe).length, 0);
        }
      }
      const offset = centre - belt.x;
      if (bank) assert.ok(-Math.sign(bank) * offset > .012, `hem offset ${offset} at bank ${bank}`);
      else assert.ok(Math.abs(offset) < .009, `neutral hem offset ${offset}`);
    }
  } finally { rig.dispose(); lampMaterial.dispose(); }
});
