// The skull flythrough that opens the observer side.
// Side view -> arc over to the top view, nose up -> a scan plane sweeps down through the skull, cut bone drawn
// as section hatching, until the cranial floor shows (the atlas's "calvaria removed" view) -> the scan keeps
// going and the camera falls with it, through the floor, into the page.
// Drawn as ink: depth/normal edges for outlines, light-driven hatching for shadow, a slow "boil" so it feels hand drawn.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const veil = document.getElementById('intro');
const PAPER = new URLSearchParams(location.search).get('theme') === 'paper';
const START = parseFloat(new URLSearchParams(location.search).get('start') || '0');
const canvas = veil.querySelector('canvas');
const skip = veil.querySelector('.skip');

function done() {
  if (veil.dataset.state === 'gone') return;
  veil.dataset.state = 'gone';
  document.documentElement.classList.remove('intro-on');
  setTimeout(() => veil.remove(), 900);
}

let seen = false;
try { seen = sessionStorage.getItem('observer-intro') === '1'; sessionStorage.setItem('observer-intro', '1'); } catch (_) {}
const params = new URLSearchParams(location.search);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (params.has('intro')) seen = false;
if (reduce || seen || params.has('nointro')) { veil.remove(); document.documentElement.classList.remove('intro-on'); }
else run().catch(err => { console.warn('intro skipped:', err); done(); });

async function run() {
  skip.addEventListener('click', done);
  addEventListener('keydown', e => { if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') done(); });

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  const dpr = Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.004, 40);

  // pass 1: view-space normal (rgb) + linear depth (a). Bone the scan plane has cut open shows its inside
  // (back faces); those write negative depth so the ink pass can fill them as a section.
  const ndMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uPlane: { value: new THREE.Vector4(0, -1, 0, 99) } },
    vertexShader: `
      varying vec3 vN; varying float vD; varying vec3 vW;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vW = (modelMatrix * vec4(position,1.0)).xyz;
        vN = normalize(normalMatrix * normal); vD = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec4 uPlane; varying vec3 vN; varying float vD; varying vec3 vW;
      void main(){
        if (dot(uPlane.xyz, vW) + uPlane.w < 0.) discard;
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) { gl_FragColor = vec4(.5,.5,1., -vD); return; }
        gl_FragColor = vec4(n*0.5+0.5, vD);
      }`,
  });

  const gltf = await new GLTFLoader().loadAsync('skull.glb');
  const src = gltf.scene.getObjectByProperty('type', 'Mesh');
  const geo = src.geometry; geo.computeVertexNormals(); geo.computeBoundingBox();
  scene.add(new THREE.Mesh(geo, ndMat));
  const bb = geo.boundingBox, C = bb.getCenter(new THREE.Vector3());

  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true });
  const post = new THREE.ShaderMaterial({
    uniforms: {
      tND: { value: rt.texture }, res: { value: new THREE.Vector2() }, px: { value: dpr },
      boil: { value: 0 }, flip: { value: 0 }, draw: { value: 0 }, paper: { value: PAPER ? 1 : 0 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }`,
    fragmentShader: `
      uniform sampler2D tND; uniform vec2 res; uniform float px, boil, flip, draw, paper;
      varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      vec4 S(vec2 uv){ return texture2D(tND, uv); }
      float lines(vec2 p, float sp, float dir){ float d = abs(fract((p.x + dir*p.y) / sp) - .5) * sp; return 1. - smoothstep(.25, .6, d); }
      void main(){
        // hand wobble: offset the lookup by a low-frequency noise that re-rolls a few times a second
        vec2 w = vec2(n2(vUv*7. + boil*3.1), n2(vUv*7. + 9.2 + boil*2.3)) - .5;
        vec2 uv = vUv + w * 1.3 * px / res;
        vec2 e = 1.15 * px / res;
        vec4 c = S(uv);
        bool cut = c.a < 0.; float cd = abs(c.a);
        float edge = 0.;
        vec4 s[4]; s[0]=S(uv+vec2(e.x,0)); s[1]=S(uv-vec2(e.x,0)); s[2]=S(uv+vec2(0,e.y)); s[3]=S(uv-vec2(0,e.y));
        for(int i=0;i<4;i++){
          float sd = abs(s[i].a);
          float dd = (cd==0. || sd==0.) ? (max(cd,sd)>0. ? 1. : 0.) : abs(cd - sd) / max(min(cd, sd), 1e-3);
          float nd = (cd==0. || sd==0.) ? 0. : 1. - dot(c.rgb*2.-1., s[i].rgb*2.-1.);
          float cutEdge = (cut != (s[i].a < 0.)) ? 1. : 0.;
          edge = max(edge, max(max(smoothstep(.07, .16, dd), smoothstep(.45, .8, nd)), cutEdge));
        }
        vec2 p = gl_FragCoord.xy / px + w*3.;
        float hatch = 0.;
        if (cut) {
          // cut bone: filled solid, like bone on a CT slice
          hatch = 1.;
        } else if (cd > 0.) {
          // hatching from a single lamp, upper left
          vec3 n = normalize(c.rgb*2.-1.);
          float dark = 1. - clamp(dot(n, normalize(vec3(-.45,.6,.65)))*.5+.5, 0., 1.);
          hatch = max(step(.52, dark) * lines(p, 6., 1.), step(.70, dark) * lines(p, 6., -1.));
        }
        float grain = (h(gl_FragCoord.xy + boil*17.) - .5) * .03 * max(paper, flip);
        float ink = clamp(max(edge, hatch) * draw, 0., 1.);
        // two looks, no greys between: pitch black with off-white ink, or the site's paper with black ink
        float f = max(paper, flip);
        vec3 ground = mix(vec3(0.), vec3(.843,.824,.796), f);
        vec3 pen    = mix(vec3(.937,.918,.886), vec3(.067,.067,.063), f);
        gl_FragColor = vec4(mix(ground, pen, ink) + grain, 1.);
      }`,
    depthTest: false, depthWrite: false,
  });
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));

  function size() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    rt.setSize(Math.round(w * dpr), Math.round(h * dpr));
    post.uniforms.res.value.set(w * dpr, h * dpr);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  size(); addEventListener('resize', size);

  // ---------------- the path ----------------
  const ease = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
  const clamp01 = t => Math.min(1, Math.max(0, t));
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const lerp = (a, b, k) => a + (b - a) * k;

  // The atlas's floor cut (scene.js): normal (-0.12, -1, 0) through (-0.45, 0.20, 0). The scan sweeps
  // down to it, rests on the floor view, then carries on through the floor.
  const scanN = new THREE.Vector3(-0.12, -1, 0).normalize();
  const FLOOR_Y = 0.20, TOP_Y = bb.max.y + 0.03, BOTTOM_Y = bb.min.y + 0.12;
  const scanAt = y => { const p0 = new THREE.Vector3(-0.45, y, 0); ndMat.uniforms.uPlane.value.set(scanN.x, scanN.y, scanN.z, -scanN.dot(p0)); };

  const span = (bb.max.x - bb.min.x) * 1.2, tall = (bb.max.y - bb.min.y) * 1.4, k = 2 * Math.tan(THREE.MathUtils.degToRad(15));
  const fitSide = () => Math.max(span / (k * camera.aspect), tall / k);           // long axis across the screen
  const fitTop  = () => Math.max(span / k, (bb.max.z - bb.min.z) * 1.4 / (k * camera.aspect));  // long axis up the screen
  const fitFace = () => START ? fitSide() * 1.25 : Math.max((bb.max.z - bb.min.z) * 1.5 / (k * camera.aspect), tall * 1.1 / k);  // looking down the snout
  const sella = new THREE.Vector3(-0.42, 0, 0);                                    // middle of the cranial floor

  // The camera rides one smooth path round the skull (face -> side -> top) at one steady pace and one distance,
  // always aimed at the skull's centre. Then the scan takes the skull away layer by layer, easing over the
  // floor view without stopping, while the camera pushes straight in. When the last layer is gone, the page.
  const smooth = x => x * x * x * (x * (x * 6 - 15) + 10);
  const easeSine = x => 0.5 - 0.5 * Math.cos(Math.PI * x);

  // view directions on the sphere: face, front three-quarter, side, side from above, straight above
  const ROUTE = [[1, 0, 0], [0.72, 0.02, 0.69], [0, 0, 1], [0, 0.72, 0.69], [0, 1, 0]].map(v => new THREE.Vector3(...v).normalize());
  const curve = new THREE.CatmullRomCurve3(ROUTE, false, 'centripetal');
  const TURN = [0.6, 5.6];

  // monotone cubic through keyframes: smooth speed, never runs backwards, no full stops
  function track(keys) {
    const n = keys.length, m = new Array(n).fill(0), d = [];
    for (let i = 0; i < n - 1; i++) d.push((keys[i + 1][1] - keys[i][1]) / (keys[i + 1][0] - keys[i][0]));
    for (let i = 1; i < n - 1; i++) if (d[i - 1] * d[i] > 0) m[i] = 2 / (1 / d[i - 1] + 1 / d[i]);   // harmonic mean (Fritsch-Butland)
    return t => {
      if (t <= keys[0][0]) return keys[0][1];
      if (t >= keys[n - 1][0]) return keys[n - 1][1];
      let i = 0; while (t > keys[i + 1][0]) i++;
      const [x0, y0] = keys[i], [x1, y1] = keys[i + 1], h = x1 - x0, u = (t - x0) / h;
      const h00 = 2*u*u*u - 3*u*u + 1, h10 = u*u*u - 2*u*u + u, h01 = -2*u*u*u + 3*u*u, h11 = u*u*u - u*u;
      return h00 * y0 + h10 * h * m[i] + h01 * y1 + h11 * h * m[i + 1];
    };
  }
  const SCAN = track([[5.5, TOP_Y], [8.2, FLOOR_Y + 0.025], [9.2, FLOOR_Y - 0.025], [11.4, bb.min.y - 0.02]]);
  const DIST = () => fitTop() * 0.94;
  const PUSH = track([[5.5, 1], [9.2, 0.82], [11.4, 0.42]]);     // fraction of the turning distance

  const up = new THREE.Vector3(), dir = new THREE.Vector3(), look = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
  let flipAt = 0;
  const t0 = performance.now();
  veil.dataset.state = 'running';

  function frame(now) {
    if (veil.dataset.state === 'gone') { renderer.dispose(); return; }
    const t = params.has('t') ? parseFloat(params.get('t')) : (now - t0) / 1000;   // ?t=4.2 freezes a moment, for checking frames
    const u = easeSine(seg(t, ...TURN));
    curve.getPointAt(Math.min(u, 0.9999), dir).normalize();
    if (u >= 0.9999) dir.copy(ROUTE[ROUTE.length - 1]);
    const D = DIST() * PUSH(t);
    camera.position.copy(C).addScaledVector(dir, D);
    camera.up.copy(up.copy(Y).lerp(X, Math.max(0, dir.y)).normalize());   // nose turns to the top of the screen as it rises
    if (dir.y > 0.999) camera.up.copy(X);
    camera.lookAt(look.copy(C));
    camera.updateProjectionMatrix();

    const planeY = SCAN(t);
    scanAt(planeY);

    post.uniforms.draw.value = smooth(seg(t, 0.1, 1.2));
    post.uniforms.boil.value = Math.floor(t * 4);           // re-draw four times a second, like pencil animation
    if (!flipAt && t >= 11.2) flipAt = t;   // the last layer is going
    if (flipAt) {
      post.uniforms.flip.value = params.has('t') ? 1 : ease(seg(t, flipAt, flipAt + 0.45));
      post.uniforms.draw.value *= 1 - smooth(seg(t, flipAt + 0.1, flipAt + 0.5));   // the drawing dissolves into the paper
      if (t > flipAt + 0.55 && !params.has('t')) done();
    }

    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.render(quadScene, quadCam);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
