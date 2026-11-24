// The Lite 6 on the front page: UFACTORY's meshes (BSD-3, see LICENSE-xarm_ros2.txt) posed by the Lab deck's
// kinematics, playing the Lab's shelf-transfer example. shelf-run.json is that program compiled by the Lab's own
// interpreter (LITE6/assets/lab/program.js) and sampled at 30 fps: six joints, the block's position, suction.
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { createInk, normalDepthMaterial } from '../ink.js';

const BASE = new URL('./', import.meta.url);
const SPEED = 1.6;   // the real program takes 27 s; a little faster reads better here

export async function mountArm(host) {
  const canvas = host.querySelector('canvas'), button = host.querySelector('.play');
  const run = await (await fetch(new URL('shelf-run.json', BASE))).json();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(dpr);
  const ink = createInk(renderer, { dpr, hatch: 5, wobble: 1.0 });
  const mat = normalDepthMaterial();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 20, 8000);
  camera.up.set(0, 0, 1);

  // the arm: link frames chained from the joint origins (Rz·Ry·Rx), each joint turning about its own z
  const origins = run.joints.map(j => new THREE.Matrix4().compose(
    new THREE.Vector3(...j.xyz), new THREE.Quaternion().setFromEuler(new THREE.Euler(j.rpy[0], j.rpy[1], j.rpy[2], 'ZYX')), new THREE.Vector3(1, 1, 1)));
  const loader = new STLLoader();
  const names = ['link_base', 'link1', 'link2', 'link3', 'link4', 'link5', 'link6'];
  const links = names.map(() => { const g = new THREE.Group(); g.matrixAutoUpdate = false; scene.add(g); return g; });
  await Promise.all(names.map(async (n, i) => {
    const g = await loader.loadAsync(new URL(n + '.stl', BASE).href); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.scale.setScalar(1000); links[i].add(m);
  }));
  const grip = await loader.loadAsync(new URL('vacuum_gripper_lite.stl', BASE).href); grip.computeVertexNormals();
  const gm = new THREE.Mesh(grip, mat); gm.scale.setScalar(1000); links[6].add(gm);

  // the shelf, the block, and the floor it starts on
  const s = run.shelf, ext = s.max.map((v, i) => v - s.min[i]);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(...ext), mat);
  shelf.position.set(...s.min.map((v, i) => v + ext[i] / 2)); scene.add(shelf);
  const block = new THREE.Mesh(new THREE.BoxGeometry(run.size, run.size, run.size), mat); scene.add(block);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), mat); floor.position.set(150, -150, -1); scene.add(floor);

  const rz = new THREE.Matrix4(), T = new THREE.Matrix4();
  function pose(f) {
    T.identity(); links[0].matrix.copy(T);
    for (let i = 0; i < 6; i++) { T.multiply(origins[i]).multiply(rz.makeRotationZ(f[i] * Math.PI / 180)); links[i + 1].matrix.copy(T); }
    for (const l of links) l.matrixWorldNeedsUpdate = true;
    block.position.set(f[6], f[7], f[8] + run.size / 2);
  }

  function size() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false); ink.setSize(w, h);
    camera.aspect = w / h;
    // framed on the reach between the pickup spot and the shelf; pulls back on wide cards
    const dist = 2150 * Math.max(1, 0.75 / camera.aspect) ** 0.35;
    const look = new THREE.Vector3(150, -120, 190), dir = new THREE.Vector3(1, 0.85, 0.6).normalize();
    camera.position.copy(look).addScaledVector(dir, dist); camera.lookAt(look);
    camera.updateProjectionMatrix();
  }

  let playing = false, t = 0, last = 0, raf = 0;
  const frames = run.frames, dur = (frames.length - 1) / run.fps;
  function draw() { pose(frames[Math.min(frames.length - 1, Math.round(t * run.fps))]); ink.render(scene, camera); }
  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    t += dt * SPEED;
    ink.uniforms.boil.value = Math.floor(now / 250);
    if (t >= dur) { t = dur; playing = false; button.textContent = 'Play again'; button.setAttribute('aria-pressed', 'false'); draw(); return; }
    draw(); raf = requestAnimationFrame(tick);
  }
  button.addEventListener('click', () => {
    if (playing) { playing = false; cancelAnimationFrame(raf); button.textContent = 'Play'; button.setAttribute('aria-pressed', 'false'); return; }
    if (t >= dur) t = 0;
    playing = true; button.textContent = 'Pause'; button.setAttribute('aria-pressed', 'true');
    last = performance.now(); raf = requestAnimationFrame(tick);
  });
  new ResizeObserver(() => { size(); draw(); }).observe(host);
  size(); draw();
  host.dataset.ready = '1';
  const q = new URLSearchParams(location.search).get('armt');   // ?armt=8 shows a moment, for checking frames
  if (q) { t = parseFloat(q); draw(); }
}
