import{o as e,r as t}from"./motion.CASNhnqH.js";import{a as n,c as r,i,s as a,u as o}from"./quality.CTYOUeGs.js";import{At as s,Bn as c,D as l,Dt as u,F as d,Gt as f,Jn as p,Kn as m,N as h,Ot as g,Pt as _,Sr as v,Tr as y,Xt as b,Yn as x,Z as S,_t as ee,br as te,gr as C,gt as w,it as T,l as E,nt as ne,o as D,or as O,rn as re,sr as k,v as A,xr as j,yt as M}from"./three.core.aYj4cLSI.js";import{r as N,s as P}from"./loaders.DL6deg2S.js";import{c as F,f as I,g as L,h as R,i as z,n as B,t as V,u as H}from"./hot-tub.Bty9WO1W.js";import{n as U,r as W,t as G}from"./world.87xbobg5.js";var K=4.55,q=-7;function J(e,t){let n=F(e,t)*.25,r=Math.max(0,-t-1.5);return n+Math.min(14,r*.42)*Math.exp(-(e*e)/260)}function Y(){return[{p:[8.4,3.4,5.2],t:[.1,4.1,-7],fov:34},{p:[5.2,4.15,1.4],t:[0,4.35,-7.2],fov:32},{p:[2.4,4.7,-2.2],t:[0,4.5,-7.4],fov:30}]}function X(e){return(`/`.endsWith(`/`)?`/`:`//`)+e.replace(/^\//,``)}function Z(e){return e.wrapS=c,e.wrapT=c,e.repeat.set(1.4,2.2),e.anisotropy=R(),e}function ie(){let e=new S;e.name=`SlopePlace`;let t=[],n=[],r=[],i=!0,a=new _({color:`#2a3036`,roughness:.58,metalness:.86,envMapIntensity:.45}),o=new _({color:`#b88862`,roughness:.72,metalness:.02,envMapIntensity:.25});n.push(a,o),L(a),L(o);let s=e=>{let n=new S,r=new l(.042,.05,e,12);t.push(r);let i=new g(r,a);i.position.y=e/2,i.castShadow=!0,n.add(i);for(let e=0;e<4;e+=1){let r=new k(.14,.012,6,16,Math.PI*1.7);t.push(r);let i=new g(r,a);i.rotation.x=Math.PI/2,i.rotation.z=e*.85,i.position.y=.16+e*.15,i.castShadow=!0,n.add(i)}let o=new l(.1,.1,.045,12);t.push(o);let s=new g(o,a);return s.position.y=e,s.castShadow=!0,n.add(s),n};for(let[t,n]of[[-2.05,-3.05],[2.05,-3.05],[-2.05,3.05],[2.05,3.05],[-2.05,0],[2.05,0]]){let r=J(t,q+n),i=s(Math.max(.4,K-r));i.position.set(t,r,q+n),e.add(i)}let c=new E(4.5,.16,6.7),u=c.getAttribute(`uv`);u&&c.setAttribute(`uv2`,u),t.push(c);let d=new g(c,o);d.name=`CedarDeck`,d.position.set(0,K,q),d.castShadow=!0,d.receiveShadow=!0,e.add(d);let f=H();f.object.position.set(0,4.63,q),f.setMood(.42),e.add(f.object);let p=e=>{for(let t of e)t.dispose()},h=e=>P().then(()=>Promise.all([N.loadAsync(X(`textures/${e}/diff.ktx2`)),N.loadAsync(X(`textures/${e}/nor_gl.ktx2`)),N.loadAsync(X(`textures/${e}/rough.ktx2`)),N.loadAsync(X(`textures/${e}/ao.ktx2`))]));return h(`metal_plate`).then(e=>{if(!i){p(e);return}let[t,n,o,s]=e;for(let t of e)Z(t);t.colorSpace=m,n.colorSpace=``,o.colorSpace=``,s.colorSpace=``,r.push(...e),a.map=t,a.normalMap=n,a.roughnessMap=o,a.aoMap=s,a.aoMapIntensity=.55,a.needsUpdate=!0}).catch(()=>void 0),h(`weathered_brown_planks`).then(e=>{if(!i){p(e);return}let[t,n,a,s]=e;for(let t of e)Z(t),t.repeat.set(2.25,3.35);t.colorSpace=m,n.colorSpace=``,a.colorSpace=``,s.colorSpace=``,r.push(...e),o.map=t,o.normalMap=n,o.roughnessMap=a,o.aoMap=s,o.aoMapIntensity=.28,o.color.setRGB(1.45,1.02,.68),o.needsUpdate=!0}).catch(()=>void 0),{object:e,dispose(){if(i){i=!1,f.dispose(),e.removeFromParent();for(let e of t)e.dispose();for(let e of n)e.dispose();for(let e of r)e.dispose()}}}}var ae=`
attribute vec4 aSeed;
uniform float uTime;

varying vec2 vUv;
varying float vAlpha;
varying float vEye;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289v(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289v(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

vec3 curl(vec3 p) {
  float e = 0.12;
  float n1 = snoise(p);
  float n2 = snoise(p + vec3(e, 0.0, 0.0));
  float n3 = snoise(p + vec3(0.0, e, 0.0));
  float n4 = snoise(p + vec3(0.0, 0.0, e));
  return vec3(n3 - n1, n4 - n1, n2 - n1) / e;
}

void main() {
  vUv = uv;
  float life = fract(aSeed.w + uTime * (0.035 + aSeed.y * 0.02));
  vec3 camForward = normalize(-vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]));
  vec3 camRight = normalize(vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]));
  vec3 camUp = normalize(vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]));
  float across = clamp(aSeed.x / 23.0, -1.0, 1.0);
  float depthN = clamp(aSeed.z / 23.0, -1.0, 1.0) * 0.5 + 0.5;
  float dist = mix(4.0, 18.0, depthN);
  float lift = (0.42 - life) * 1.35;
  vec3 drift = curl(vec3(across * 1.6, uTime * 0.045 + aSeed.y * 2.4, dist * 0.06));
  vec3 p = cameraPosition + camForward * dist + camRight * across * dist * 0.7 + camUp * lift * dist * 0.62;
  p += drift * 0.4;
  p = (instanceMatrix * vec4(p, 1.0)).xyz;
  float spin = aSeed.y * 6.28318 + life * 0.7;
  float cs = cos(spin);
  float sn = sin(spin);
  vec2 corner = vec2(cs * position.x - sn * position.y, sn * position.x + cs * position.y);
  float size = mix(0.07, 0.16, aSeed.y);
  vec3 toCam = normalize(cameraPosition - p);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
  vec3 up = normalize(cross(toCam, right));
  vec3 world = p + right * corner.x * size + up * corner.y * size;
  vAlpha = smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.84, 1.0, life));
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  vEye = -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
}
`,oe=`
uniform sampler2D tCloud;
uniform sampler2D tDepth;
uniform float uTime;
uniform float uSoft;
uniform vec2 uResolution;
uniform float uNear;
uniform float uFar;

varying vec2 vUv;
varying float vAlpha;
varying float vEye;

float eyeDist(float depth) {
  float z = depth * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}

void main() {
  vec2 flowA = vUv * 1.8 + vec2(uTime * 0.02, 0.0);
  vec2 flowB = vUv * 3.4 + vec2(0.2, -uTime * 0.03);
  float n1 = texture2D(tCloud, flowA).r;
  float n2 = texture2D(tCloud, flowB).r;
  float disc = smoothstep(0.5, 0.14, length(vUv - 0.5));
  float mote = smoothstep(0.2, 0.85, max(n1, n2));
  float flake = disc * mix(0.7, 1.0, mote);
  float alpha = vAlpha * flake * 0.86;
  if (uSoft > 0.5) {
    vec2 duv = clamp(gl_FragCoord.xy / uResolution, 0.0, 1.0);
    float sceneDepth = texture2D(tDepth, duv).r;
    float gap = eyeDist(sceneDepth) - vEye;
    float fade = smoothstep(0.0, 0.8, gap);
    if (sceneDepth <= 0.001 || sceneDepth >= 0.998) fade = 1.0;
    // A far-plane depth sample reads as a near surface and would erase the fall.
    fade = max(fade, 0.62);
    alpha *= fade;
  }
  if (alpha < 0.02) discard;
  vec3 col = vec3(0.96, 0.97, 0.98);
  gl_FragColor = vec4(col * alpha, alpha);
}
`,se=`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,ce=`
uniform sampler2D tSnow;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(tSnow, vUv);
}
`;function Q(e){return(`/`.endsWith(`/`)?`/`:`//`)+e.replace(/^\//,``)}function $(e){let t=Math.sin(e*127.1+311.7)*43758.5453;return t-Math.floor(t)}function le(){let e=r().tier;return e===`ultra`?200:e===`high`?160:e===`medium`?100:e===`low`?56:0}function ue(e){let t=le(),r=new Float32Array(Math.max(1,t)*4);for(let e=0;e<t;e+=1)r[e*4]=($(e+1)-.5)*46,r[e*4+1]=$(e+2),r[e*4+2]=($(e+3)-.5)*46,r[e*4+3]=$(e+4);let i=new f(1,1);i.setAttribute(`aSeed`,new ne(r,4));let a=new O().load(Q(`textures/fx/cloud.png`));a.colorSpace=``,a.wrapS=c,a.wrapT=c,a.magFilter=w,a.minFilter=ee;let o=new y(4,4,{depthBuffer:!0,stencilBuffer:!1});o.depthTexture=new d(4,4),o.depthTexture.format=h,o.depthTexture.type=C;let l=new s({depthPacking:D}),m=new y(4,4,{format:re,depthBuffer:!1,stencilBuffer:!1});m.texture.generateMipmaps=!1,m.texture.minFilter=w,m.texture.magFilter=w,m.texture.colorSpace=M;let _=new te(4,4),S=new x({uniforms:{uTime:{value:0},tCloud:{value:a},tDepth:{value:o.depthTexture},uSoft:{value:0},uResolution:{value:_},uNear:{value:.4},uFar:{value:260}},vertexShader:ae,fragmentShader:oe,transparent:!0,depthWrite:!1,depthTest:!1,side:2,blending:5,blendSrc:201,blendDst:205,blendEquation:100,blendSrcAlpha:201,blendDstAlpha:205}),E=new T(i,S,Math.max(1,t));E.name=`Snowfall`,E.count=t,E.frustumCulled=!1,E.renderOrder=2;let k=new u;for(let e=0;e<E.count;e+=1)E.setMatrixAt(e,k);E.instanceMatrix.needsUpdate=!0;let N=new p;t>0&&N.add(E);let P=new x({uniforms:{tSnow:{value:m.texture}},vertexShader:se,fragmentShader:ce,transparent:!0,depthTest:!1,depthWrite:!1,toneMapped:!1,blending:5,blendSrc:201,blendDst:205,blendEquation:100,blendSrcAlpha:201,blendDstAlpha:205}),F=new f(1,1),I=new g(F,P);I.name=`SnowCard`,I.frustumCulled=!1,I.renderOrder=8,I.visible=!1,t>0&&e.add(I);let L=0,R=0,z=!0,B=new j,V=new j,H=new b,U=new b,W=(e,t)=>{(e!==L||t!==R)&&(L=e,R=t,o.setSize(e,t),m.setSize(e,t),_.set(e,t))},G=t=>{e.updateWorldMatrix(!0,!1);let n=Math.max(t.near*2.2,.35);t.getWorldDirection(B),V.copy(t.position).addScaledVector(B,n),e.worldToLocal(V),I.position.copy(V),e.getWorldQuaternion(H),U.copy(t.quaternion),I.quaternion.copy(U).premultiply(H.invert());let r=t.fov*Math.PI/180,i=2*Math.tan(r*.5)*n,a=i*(t.aspect>0?t.aspect:1);I.scale.set(a,i,1)},K=(n,r)=>{let i=r.aspect>0?r.aspect:1,a=Math.max(2,i>=1?640:Math.floor(640*i)),s=Math.max(2,i>=1?Math.floor(640/i):640);W(a,s);let c=n.getRenderTarget(),u=n.autoClear,d=n.getScissorTest(),f=n.getViewport(new v),h=n.getScissor(new v),g=n.getClearColor(new A),_=n.getClearAlpha(),y=e,b=y instanceof p?y.overrideMaterial:null,x=[];try{if(n.autoClear=!0,n.setScissorTest(!1),y instanceof p){let e=new Set([`Terrain`,`AuraUnitSlot`,`HotTubSlot`,`SlopePlace`]);for(let t of y.children)!e.has(t.name)&&t.visible&&(t.visible=!1,x.push(t));y.overrideMaterial=l,n.setRenderTarget(o),n.setViewport(0,0,a,s),n.setClearColor(0,1),n.clear(!0,!0,!0),n.render(y,r),y.overrideMaterial=b,S.uniforms.uSoft.value=1}n.setRenderTarget(m),n.setViewport(0,0,a,s),n.setClearColor(0,0),n.clear(!0,!0,!0),n.render(N,r),I.visible=t>0}finally{for(let e of x)e.visible=!0;y instanceof p&&(y.overrideMaterial=b),n.setRenderTarget(c),n.setViewport(f),n.setScissor(h),n.setScissorTest(d),n.setClearColor(g,_),n.autoClear=u}};return{update(e){if(!z||t===0)return;S.uniforms.uTime.value=e.reduced?0:n(performance.now());let r=e.camera;if(r.isPerspectiveCamera){if(S.uniforms.uNear.value=r.near,S.uniforms.uFar.value=r.far,!e.renderer){S.uniforms.uSoft.value=0,I.visible=!1;return}try{K(e.renderer,r),G(r)}catch{S.uniforms.uSoft.value=0,I.visible=t>0}}},dispose(){z&&(z=!1,E.removeFromParent(),I.removeFromParent(),i.dispose(),F.dispose(),S.dispose(),P.dispose(),a.dispose(),l.dispose(),o.dispose(),m.dispose())}}}var de=[`grass`,`glass`,`steam`,`far`,`snow`,`slope`];function fe(e){let t=e.dataset.scene;return de.includes(t)?t:`grass`}var pe={grass:{exposure:1.06,tone:`agx`,hdri:`/hdri/evening_meadow_1k.hdr`,env:.42,ao:!1},far:{exposure:1,tone:`agx`,hdri:`/hdri/qwantani_dusk_2_puresky_1k.hdr`,env:.55,ao:!0},slope:{exposure:1.02,tone:`agx`,hdri:`/hdri/alps_field_1k.hdr`,env:.7,ao:!0},snow:{exposure:1.05,tone:`agx`,hdri:`/hdri/snowy_field_1k.hdr`,env:.85,ao:!0},glass:{exposure:1,tone:`neutral`,hdri:`/hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr`,env:1,ao:!0},steam:{exposure:1.08,tone:`agx`,hdri:`/hdri/qwantani_dusk_2_puresky_1k.hdr`,env:.2,ao:!0}},me=[{p:[2.6,2.7,13.2],t:[2.4,1.25,2.6],fov:38},{p:[1.2,2.3,9.2],t:[1.8,1.2,1.6],fov:34},{p:[-.2,1.85,6.2],t:[1.1,1.15,.4],fov:32}];function he(t,n){let r=t.ownerDocument,i=(e,t)=>{(e===`clear`||e===`mirror`||e===`tinted`)&&n.setFinish(e,t)},a=t=>{let n=t.target;n instanceof HTMLInputElement&&n.name===`glazing`&&n.closest(`.materials-swatches`)&&i(n.value,e()?0:1.2)};r.addEventListener(`change`,a);let o=r.querySelector(`.materials-swatches input[name="glazing"]:checked`);return o&&i(o.value,0),()=>r.removeEventListener(`change`,a)}function ge(e,t){let n=fe(e);e.dataset.sceneLive=n;let r=pe[n],i=(e,n)=>(e.setProgress(t()),{setProgress(t){e.setProgress(t)},destroy(){n?.(),e.destroy()}});if(n===`grass`)return i(W(e,{spline:U,timeOfDay:`day`,density:1,grade:`golden`,exposure:r.exposure,tone:r.tone,hdri:r.hdri,hdriPinned:!0,envIntensity:r.env,ao:!1,shadow:`soft`,bloom:{threshold:.8,intensity:.28},godrays:!0,flare:!0}));if(n===`far`){let t=null,n=null;return i(W(e,{spline:G,timeOfDay:`scroll`,density:1,nightScroll:!0,vista:!0,exposure:r.exposure,tone:r.tone,hdri:r.hdri,hdriPinned:!0,hdriNight:`/hdri/rogland_clear_night_1k.hdr`,envIntensity:r.env,ao:!0,shadow:`soft`,bloom:{threshold:.9,intensity:.42},steady:!0,occupyUnit(e){let n=H({rising:!0});return t=n,e.add(n.object),()=>{n.dispose(),t===n&&(t=null)}},occupyTub(e){let t=V();return n=t,e.add(t.object),()=>{t.dispose(),n===t&&(n=null)}},onFrame(e){t?.setMood(e.night),n?.update(e)}}))}if(n===`glass`){let t=()=>{};return i(W(e,{spline:I(),timeOfDay:`day`,density:1,exposure:r.exposure,tone:r.tone,hdri:r.hdri,hdriPinned:!0,envIntensity:r.env,ao:!0,product:!0,occupyUnit(n){t();let r=H();n.add(r.object);let i=new URLSearchParams(window.location.search).get(`glaze`);return(i===`clear`||i===`mirror`||i===`tinted`)&&r.setFinish(i,0),t=he(e,r),()=>{t(),t=()=>{},r.dispose()}}}),()=>t())}if(n===`steam`){let t=null;return i(W(e,{spline:z(),timeOfDay:`dusk`,density:1,exposure:1.02,tone:r.tone,hdri:r.hdri,hdriPinned:!0,envIntensity:.72,ao:!0,shadow:`soft`,bloom:{threshold:.9,intensity:.42},steady:!0,occupyUnit(e){let t=H();return e.add(t.object),()=>t.dispose()},occupyTub(e){t?.dispose(),t=B(),e.add(t.object);let n=t;return()=>{n.dispose(),t===n&&(t=null)}},onFrame(e){t?.update(e)}}))}if(n===`slope`)return i(W(e,{spline:Y(),timeOfDay:`day`,density:1,vista:!0,meadow:!1,ground:`rock`,heightAt:J,clear:{x:0,z:-7,r:4.2},exposure:r.exposure,tone:r.tone,hdri:r.hdri,hdriPinned:!0,envIntensity:r.env,ao:!0,shadow:`soft`,bloom:{threshold:.9,intensity:.28},steady:!0,occupyUnit(e){let t=e.parent;if(!t)return;let n=ie();return t.add(n.object),()=>n.dispose()}}));let a=null,o=null,s=null;return i(W(e,{spline:me,timeOfDay:`day`,density:1,vista:!0,meadow:!1,ground:`snow`,exposure:r.exposure,tone:r.tone,hdri:r.hdri,hdriPinned:!0,envIntensity:r.env,ao:!0,shadow:`soft`,bloom:{threshold:.9,intensity:.36},steady:!0,occupyUnit(e){let t=H({frost:!0});t.setMood(.72),a=t,e.add(t.object);let n=e.parent,r=n?ue(n):null;return s=r,()=>{t.dispose(),r?.dispose(),a===t&&(a=null),s===r&&(s=null)}},occupyTub(e){let t=V();return o=t,e.add(t.object),()=>{t.dispose(),o===t&&(o=null)}},onFrame(e){a?.setMood(Math.max(.72,e.night)),o?.update({camera:e.camera,renderer:e.renderer,dusk:.75,night:0,reduced:e.reduced}),s?.update(e)}}))}function _e(e){let n=!1,s=null,c=0,l=()=>{if(!(n||s)){if(r().tier===`off`){o(e);return}i(e),s=ge(e,()=>c)}},u=a(t=>{if(!n){if(t.tier===`off`){s?.destroy(),s=null,o(e);return}s||l()}});l();let d={setProgress(e){c=e,s?.setProgress(e)},destroy(){n||(n=!0,u(),s?.destroy(),s=null)}};return t(d.destroy),d}export{_e as mountMeadow};