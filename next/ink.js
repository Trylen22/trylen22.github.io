// The site's ink look for 3D: render view-space normals + depth, then draw outlines from depth/normal breaks
// and hatch the shadow side from one lamp. Shared by the arm card and anything else drawn this way.
import * as THREE from 'three';

export const INK = { ground: [0, 0, 0], pen: [0.937, 0.918, 0.886] };

export function normalDepthMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec3 vN; varying float vD;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal); vD = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vN; varying float vD;
      void main(){
        vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n;
        gl_FragColor = vec4(n*0.5+0.5, vD);
      }`,
  });
}

export function createInk(renderer, { dpr = 1, hatch = 6, wobble = 1.3 } = {}) {
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true });
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tND: { value: rt.texture }, res: { value: new THREE.Vector2(1, 1) }, px: { value: dpr },
      boil: { value: 0 }, sp: { value: hatch }, wob: { value: wobble },
      ground: { value: new THREE.Vector3(...INK.ground) }, pen: { value: new THREE.Vector3(...INK.pen) },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }`,
    fragmentShader: `
      uniform sampler2D tND; uniform vec2 res; uniform float px, boil, sp, wob; uniform vec3 ground, pen;
      varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      vec4 S(vec2 uv){ return texture2D(tND, uv); }
      float lines(vec2 p, float s, float dir){ float d = abs(fract((p.x + dir*p.y) / s) - .5) * s; return 1. - smoothstep(.25, .6, d); }
      void main(){
        vec2 w = vec2(n2(vUv*7. + boil*3.1), n2(vUv*7. + 9.2 + boil*2.3)) - .5;
        vec2 uv = vUv + w * wob * px / res;
        vec2 e = 1.1 * px / res;
        vec4 c = S(uv);
        float edge = 0.;
        vec4 s[4]; s[0]=S(uv+vec2(e.x,0)); s[1]=S(uv-vec2(e.x,0)); s[2]=S(uv+vec2(0,e.y)); s[3]=S(uv-vec2(0,e.y));
        for(int i=0;i<4;i++){
          float dd = (c.a==0. || s[i].a==0.) ? (max(c.a,s[i].a)>0. ? 1. : 0.) : abs(c.a - s[i].a) / max(min(c.a, s[i].a), 1e-3);
          float nd = (c.a==0. || s[i].a==0.) ? 0. : 1. - dot(c.rgb*2.-1., s[i].rgb*2.-1.);
          edge = max(edge, max(smoothstep(.05, .12, dd), smoothstep(.25, .6, nd)));
        }
        float hatch = 0.;
        if (c.a > 0.) {
          vec3 n = normalize(c.rgb*2.-1.);
          float dark = 1. - clamp(dot(n, normalize(vec3(-.45,.6,.65)))*.5+.5, 0., 1.);
          vec2 p = gl_FragCoord.xy / px + w*3.;
          hatch = max(step(.55, dark) * lines(p, sp, 1.), step(.72, dark) * lines(p, sp, -1.));
        }
        gl_FragColor = vec4(mix(ground, pen, clamp(max(edge, hatch), 0., 1.)), 1.);
      }`,
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Scene();
  quad.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  const qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    uniforms: mat.uniforms,
    setSize(w, h) { rt.setSize(Math.round(w * dpr), Math.round(h * dpr)); mat.uniforms.res.value.set(w * dpr, h * dpr); },
    render(scene, camera) {
      renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
      renderer.setRenderTarget(null); renderer.render(quad, qcam);
    },
  };
}
