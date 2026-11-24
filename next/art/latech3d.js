// The Employer card: the Louisiana Tech mark (the T over the state) raised into a shallow relief and drawn in
// the site's ink, like the arm and the skull. Outlines traced from the university logo; see latech-shape.json.
import * as THREE from 'three';
import { createInk, normalDepthMaterial } from '../ink.js';

const BASE = new URL('./', import.meta.url);

export async function mountLatech(host) {
  const canvas = host.querySelector('canvas');
  const shape = await (await fetch(new URL('latech-shape.json', BASE))).json();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(dpr);
  const ink = createInk(renderer, { dpr, hatch: 5, wobble: 1.0 });
  const mat = normalDepthMaterial();

  const toShape = pts => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const bevel = { bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 2, curveSegments: 1 };
  const state = new THREE.Mesh(new THREE.ExtrudeGeometry(toShape(shape.state), { depth: 0.07, ...bevel }), mat);
  const tee = new THREE.Mesh(new THREE.ExtrudeGeometry(toShape(shape.t), { depth: 0.16, ...bevel }), mat);
  const inner = new THREE.Group(); inner.add(state, tee);
  const box = new THREE.Box3().setFromObject(inner), mid = box.getCenter(new THREE.Vector3());
  inner.position.set(-mid.x, -mid.y, -mid.z);   // turn about the mark's own centre
  const mark = new THREE.Group(); mark.add(inner);
  mark.rotation.set(-0.32, 0.3, 0);             // tipped back and turned a little, so the relief and its sides read
  const scene = new THREE.Scene(); scene.add(mark);
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);

  let still = 0;
  function size() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false); ink.setSize(w, h);
    camera.aspect = w / h;
    const fitW = 2.45 / (2 * Math.tan(THREE.MathUtils.degToRad(13)) * camera.aspect), fitH = 2.2 / (2 * Math.tan(THREE.MathUtils.degToRad(13)));
    camera.position.set(0, 0, Math.max(fitW, fitH));
    camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
  }
  function draw(now = 0) {
    mark.rotation.y = 0.3 + Math.sin(now / 2600) * 0.08;   // a slow sway while it's on screen
    ink.uniforms.boil.value = Math.floor(now / 250);
    ink.render(scene, camera);
  }
  let raf = 0, visible = false;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loop = now => { draw(now); if (visible && !reduce) raf = requestAnimationFrame(loop); };
  new IntersectionObserver(es => {
    visible = es.some(e => e.isIntersecting);
    cancelAnimationFrame(raf); if (visible && !reduce) raf = requestAnimationFrame(loop);
  }).observe(host);
  new ResizeObserver(() => { size(); draw(still); }).observe(host);
  size(); draw(still);
  host.dataset.ready = '1';
}
