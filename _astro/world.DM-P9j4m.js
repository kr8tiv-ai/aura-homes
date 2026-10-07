import{o as e}from"./motion.CASNhnqH.js";import{d as t,f as n,l as r,r as i}from"./quality.DMoPNsuA.js";import{$ as a,A as o,Bn as s,Bt as c,C as l,D as u,Dt as d,Fn as f,G as p,Gt as m,J as h,Jn as g,Jt as _,K as v,Kn as y,L as b,Ln as x,Ot as S,Pn as C,Pt as w,Rn as T,Sr as E,Tr as D,Tt as O,Ut as ee,Vt as k,W as A,Xt as te,Y as ne,Yn as j,Z as M,_ as N,_t as re,a as P,at as ie,br as F,c as I,d as ae,dr as oe,er as L,et as se,gr as ce,gt as le,h as ue,in as de,ir as fe,it as pe,kt as R,l as me,m as he,n as ge,nt as z,or as _e,qt as ve,rn as ye,rr as be,rt as xe,tr as Se,u as B,v as V,xr as H,y as Ce,yt as we,z as Te,zn as Ee}from"./three.core.aYj4cLSI.js";import{a as De,c as Oe,d as ke,i as Ae,l as U,n as je,r as Me,s as Ne}from"./loaders.DL6deg2S.js";import{_ as Pe,a as W,c as G,g as K,h as Fe,m as q,o as Ie,p as Le,s as Re}from"./hot-tub.BV50o4Wb.js";import{n as ze,t as Be}from"./tier-assets.B0bblncw.js";import{t as Ve}from"./stage.YlI-vllg.js";var He=e=>Math.min(1,Math.max(0,e)),Ue=(e,t,n)=>{let r=He((n-e)/(t-e));return r*r*(3-2*r)};function We(e,t=0){let n=Math.sin(e*127.1+t*311.7)*43758.5453;return n-Math.floor(n)}function Ge(e,t){let n=Math.sin(e*127.1+t*311.7)*43758.5453;return n-Math.floor(n)}function Ke(e,t){let n=Math.floor(e),r=Math.floor(t),i=e-n,a=t-r,o=i*i*(3-2*i),s=a*a*(3-2*a),c=Ge(n,r),l=Ge(n+1,r),u=Ge(n,r+1),d=Ge(n+1,r+1);return c*(1-o)*(1-s)+l*o*(1-s)+u*(1-o)*s+d*o*s}var qe=new F(.82,.57).normalize();function Je(e){let t=e%9/9;return t<.18?Ue(0,1,t/.18):t<.46?1:t<.78?1-Ue(0,1,(t-.46)/.32):0}var Ye=5.6,Xe=new H(18,16,13).normalize();function Ze(e){let t=[],n=[],r=[],i=(e,i,a,o,s)=>{let c=t.length/3;t.push(...e,...i,...a,...o),n.push(s,s,s,s),r.push(c,c+1,c+2,c,c+2,c+3)},a=(e,i,a,o)=>{let s=t.length/3;t.push(...e,...i,...a),n.push(o,o,o),r.push(s,s+1,s+2)},o=.03,s=.02;i([-.03,0,0],[o,0,0],[s,1,0],[-.02,1,0],0),i([0,0,o],[0,0,-.03],[0,1,-.02],[0,1,s],0);let c=e?6:5;for(let t=0;t<c;t++){let n=t/c*Math.PI*2,r=Math.cos(n),o=Math.sin(n),s=(e,t,n)=>[r*e-o*n,t,o*e+r*n];e?i(s(.03,1,0),s(.095,1.03,.042),s(.165,1.06,0),s(.095,1.03,-.042),1):a(s(.03,1,-.036),s(.03,1,.036),s(.155,1.045,0),1)}let l=e?1.045:1.02,u=.04;i([-.04,l,-.04],[-.04,l,u],[u,l,u],[u,l,-.04],2);let d=new ae;return d.setAttribute(`position`,new A(t,3)),d.setIndex(r),d.computeVertexNormals(),{pos:d.attributes.position.array,nrm:d.attributes.normal.array,part:new Float32Array(n),idx:new Uint16Array(r),tris:r.length/3}}function Qe(e,t,n,r=!1){let i=Ze(t),a=[],o=[],s=0,c=1/0,l=-1/0,u=1/0,d=-1/0,f=1/0,p=-1/0,m=e*60;for(let t=0;t<m&&s<e;t++){let e=-30+We(t,211)*60,i=-6+We(t,212)*46,m=e*.045+i*.012,h=i*.07-e*.018,g=r?Ue(.6,.8,Ke(m+2.1,h+4.4)):Ue(.52,.72,Ke(e*.13+7.7,i*.13+3.9));if(g<=.01)continue;let _=1-Ue(8,24,Math.hypot(e,i-4)),v=n.density(e,i)*g*(.25+.75*_);v<.02||We(t,213)>v||n.clearance(e,i)<.45||(a.push(e,n.ground(e,i)-.01,i),o.push(We(t,214)*Math.PI*2,.16+We(t,215)**1.4*.16,Ge(Math.floor(e*.35),Math.floor(i*.35)),We(t,216)),c=Math.min(c,e),l=Math.max(l,e),u=Math.min(u,i),d=Math.max(d,i),f=Math.min(f,a[s*3+1]),p=Math.max(p,a[s*3+1]),s++)}if(s<8)return null;let h=new xe;h.setAttribute(`position`,new B(i.pos,3)),h.setAttribute(`normal`,new B(i.nrm,3)),h.setAttribute(`aPart`,new B(i.part,1)),h.setIndex(new B(i.idx,1)),h.setAttribute(`aPos`,new z(new Float32Array(a),3)),h.setAttribute(`aInst`,new z(new Float32Array(o),4)),h.instanceCount=s;let g=new Float32Array(s*3);for(let e=0;e<s;e+=1)g[e*3]=a[e*3],g[e*3+1]=a[e*3+1]+o[e*4+1],g[e*3+2]=a[e*3+2];let _=(c+l)/2,v=(u+d)/2,y=(f+p)/2;return h.boundingSphere=new L(new H(_,y+.2,v),Math.hypot(l-_,d-v)+1),{geo:h,heads:g,placed:s,tris:s*i.tris}}var $e=`
precision highp float;

attribute vec3  aPos;   // world root position, planted on the real ground
attribute vec4  aInst;  // yaw, stem height (m), species, fade/phase seed
attribute float aPart;  // 0 stem, 1 petal, 2 centre

uniform float uTime;
uniform vec2  uWindDir;
uniform float uGust;
uniform vec3  uCamPos;

varying vec3  vColor;
varying vec3  vNormal;
varying vec3  vWorld;
varying float vPart;

float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x),
             mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main(){
  float yaw = aInst.x;
  float c = cos(yaw), s = sin(yaw);
  vec3 lp = vec3(position.x * c - position.z * s, position.y, position.x * s + position.z * c);
  vec3 nl = vec3(normal.x * c - normal.z * s, normal.y, normal.x * s + normal.z * c);

  float dist = distance(aPos, uCamPos);

  /* near/mid/far — the grass layers' own dissolve idiom: a smooth band on
     the per-instance fade seed, so flowers thin out individually over
     18..30 m instead of a whole field popping at a ring. The near guard
     stops a head flashing across the lens as the camera brushes past. */
  float keep = 1.0 - smoothstep(18.0, 30.0, dist);
  float vis = 1.0 - smoothstep(keep - 0.16, keep, aInst.w);
  vis *= smoothstep(0.25, 0.6, dist);

  float h = aInst.y * vis;

  // anti-shimmer widening with distance — same trick, slightly stronger
  // than the grass's 0.010/m because stems are narrower than blades
  lp.xz *= 1.0 + dist * 0.014;

  /* ---- WIND: the meadow's field, not a private one ----
     Use the hero grass's exact three analytic travelling/cross/ripple
     phases. Flowers remain stiffer and respond at lower amplitude, but a
     gust now reaches every planted layer at the same world position and
     time instead of crossing two different procedural weather fields. */
  vec2 wd = normalize(uWindDir);
  float stiff = 1.15 + 0.55 * h21(aPos.xz * 4.3 + 5.1);
  float ph = aInst.w * 6.2831853;
  float travelling = sin(uTime * 0.62 - dot(aPos.xz, wd) * 0.22);
  float crossWave = sin(uTime * 0.41 + aPos.x * 0.082 - aPos.z * 0.057 + ph);
  float ripple = sin(uTime * 1.85 + aPos.x * 0.31 + aPos.z * 0.23 + ph * 0.5);
  float front = 0.5 + 0.5 * travelling;
  float amp = (0.34 + 0.66 * front * uGust) / stiff;
  float flutter = sin(uTime * 2.6 / stiff + ph) * 0.14;
  float lean = (0.55 + travelling * 0.30 + ripple * 0.10 + flutter) * amp * 0.5;
  float windYaw = crossWave * 0.30 + ripple * 0.06;
  vec2 windDir = wd * cos(windYaw) + vec2(-wd.y, wd.x) * sin(windYaw);

  // a small static lean per flower, seeded from world position, so the
  // drift is never a grid of verticals even in still air — the grass's
  // rest-arch idea at flower stiffness
  float la = h21(floor(aPos.xz * 3.7)) * 6.2831853;
  vec2 sway = vec2(cos(la), sin(la)) * (0.04 + 0.10 * h21(aPos.xz * 1.9 + 7.0)) + windDir * lean;

  /* root-pinned quadratic bend: the base stays planted, travel grows with
     the square of height, and the head drops slightly as it leans — a stem
     arcs, it does not hinge. */
  float yy = max(lp.y, 0.0);
  vec3 bent = lp * h;
  bent.xz += sway * yy * yy * h;
  bent.y -= length(sway) * 0.30 * yy * yy * h;

  vec3 world = aPos + bent;

  /* ---- species colour, in linear space ----
     Three muted alpine families, clumped per drift by the JS sampler:
       cream   #f2f1e4 · lavender #9c8fc9 · straw-gold #dcc884
     centre #cfa54e, stem sward-green #5c7a48 — all inside the scene's
     palette, nothing orange, nothing brighter than the sky. */
  float sp = aInst.z;
  vec3 petal = vec3(0.886, 0.877, 0.772);
  petal = mix(petal, vec3(0.340, 0.280, 0.592), smoothstep(0.42, 0.50, sp) * (1.0 - smoothstep(0.74, 0.82, sp)));
  petal = mix(petal, vec3(0.723, 0.586, 0.235), smoothstep(0.74, 0.82, sp));
  petal *= 0.90 + 0.20 * h21(aPos.xz * 2.1); // per-flower value jitter
  vec3 col = mix(vec3(0.106, 0.197, 0.062), petal, step(0.5, aPart));
  col = mix(col, vec3(0.633, 0.384, 0.074), step(1.5, aPart));

  vColor = col;
  vNormal = nl;
  vWorld = world;
  vPart = aPart;

  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`,et=`
precision highp float;

uniform vec3  uSunDir;
uniform vec3  uSunCol;
uniform float uSunI;
uniform vec3  uHemiSky;
uniform vec3  uHemiGround;
uniform vec3  uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3  uCamPos;
uniform float uNight;
uniform float uHeightFog;
uniform vec3  uHeightFogSun;
uniform vec3  uHeightFogColor;
uniform float uHeightFogFalloff;

varying vec3  vColor;
varying vec3  vNormal;
varying vec3  vWorld;
varying float vPart;

void main(){
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;

  // wrapped diffuse + hemisphere — the exact light model the grass uses,
  // so a flower sits IN the sward rather than pasted on it
  float ndl = dot(N, uSunDir) * 0.5 + 0.5;
  vec3 light = uSunCol * uSunI * ndl * ndl;
  light += mix(uHemiGround, uHemiSky, N.y * 0.5 + 0.5) * 0.55;

  vec3 col = vColor * light;
  // petals scatter a little — a whisper of lift so heads read against the
  // green, held well under the grass's bloom clamp
  col *= 1.0 + 0.10 * step(0.5, vPart);

  col *= mix(1.0, 0.38, uNight);
  col = mix(col, col * vec3(0.45, 0.55, 0.85), uNight);
  col = min(col, vec3(2.2));

  float fd = distance(uCamPos, vWorld);
  if (uHeightFog > 0.5) {
    float band = smoothstep(uFogNear, uFogFar, fd);
    float valley = exp(-max(vWorld.y - 0.35, 0.0) * uHeightFogFalloff);
    float amt = clamp(band * mix(0.32, 1.08, valley), 0.0, 0.9);
    vec3 toward = normalize(vWorld - uCamPos);
    float sunw = pow(max(dot(toward, normalize(uHeightFogSun)), 0.0), 6.0);
    vec3 warm = uHeightFogColor * vec3(1.14, 0.97, 0.76);
    vec3 cool = uHeightFogColor * vec3(0.78, 0.88, 1.03);
    col = mix(col, mix(cool, warm, sunw), amt);
  } else {
    col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, fd));
  }

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;function tt(){return new j({vertexShader:$e,fragmentShader:et,side:2,uniforms:{uTime:{value:0},uWindDir:{value:qe.clone()},uGust:{value:.4},uCamPos:{value:new H},uSunDir:{value:Xe.clone()},uSunCol:{value:new V(`#fff3dd`)},uSunI:{value:1.15},uHemiSky:{value:new V(`#dcecf4`)},uHemiGround:{value:new V(`#7a8b5e`)},uFogColor:{value:new V(`#e3ede7`)},uFogNear:{value:30},uFogFar:{value:88},uNight:{value:0},uHeightFog:{value:0},uHeightFogSun:{value:new H(.756,.36,.547).normalize()},uHeightFogColor:{value:new V(`#e4c9a4`)},uHeightFogFalloff:{value:.38}}})}var nt={near:16,far:34,pmin:.04,band:.16,tile:8,segs:4},rt={near:8,far:16,pmin:0,band:.16,tile:6,segs:1},it=e=>Math.min(1,Math.max(0,e)),at=(e,t,n)=>{let r=it((n-e)/(t-e));return r*r*(3-2*r)},ot=(e,t)=>1+(e.pmin-1)*at(e.near,e.far,t);function st(e){let t=[],n=[],r=[];if(e===1)return t.push(-.5,0,0,.5,0,0,0,1,0),n.push(0,0,1,0,.5,1),r.push(0,1,2),{pos:new Float32Array(t),uvs:new Float32Array(n),idx:new Uint16Array(r)};for(let r=0;r<=e;r++){let i=r/e;r===e?(t.push(0,i,0),n.push(.5,i)):(t.push(-.5,i,0,.5,i,0),n.push(0,i,1,i))}for(let t=0;t<e-1;t++){let e=t*2;r.push(e,e+1,e+2,e+1,e+3,e+2)}let i=(e-1)*2;return r.push(i,i+1,i+2),{pos:new Float32Array(t),uvs:new Float32Array(n),idx:new Uint16Array(r)}}var ct=`
precision highp float;
attribute vec3 aPos;
attribute vec4 aRand;
attribute float aClear;
uniform float uTime;
uniform vec4 uLod;
uniform float uRichWind;
uniform vec2 uWindDir;
uniform vec3 uCamPos;
uniform float uProjScale;
uniform float uGust;
varying float vT;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vHue;
varying vec3 vGround;
varying float vSpecies;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 groundColor(vec2 p){
  vec3 cA = vec3(0.22, 0.40, 0.18);
  vec3 cB = vec3(0.34, 0.50, 0.24);
  vec3 cC = vec3(0.46, 0.52, 0.22);
  float pick = h21(floor(p * 0.18));
  vec3 clump = cA;
  clump = mix(clump, cB, smoothstep(0.30, 0.42, pick));
  clump = mix(clump, cC, smoothstep(0.64, 0.76, pick));
  float n1 = 0.5 + 0.5 * sin(p.x * 0.23 + p.y * 0.17 + 1.2);
  return mix(clump, mix(cA, cB, n1), 0.16);
}
float meadowD(vec2 p){
  float r = length(p);
  float ring = 1.0 - smoothstep(16.0, 35.0, r);
  float corr = (1.0 - smoothstep(9.0, 18.0, abs(p.x))) * smoothstep(5.5, 11.0, p.y) * (1.0 - smoothstep(33.0, 41.0, p.y));
  float scat = 0.34 * (1.0 - smoothstep(28.0, 48.0, r));
  float d = max(ring, max(corr, scat));
  d *= 1.0 - smoothstep(6.0, 15.0, -p.y);
  return clamp(d, 0.0, 1.0);
}
void main(){
  float t = uv.y;
  float side = position.x;
  vec3 base = aPos;
  float dist = distance(base, uCamPos);
  float p = mix(1.0, uLod.x, smoothstep(uLod.y, uLod.z, dist));
  float projH = (aRand.y * aClear) * uProjScale / max(dist, 0.001);
  p *= smoothstep(0.0040, 0.020, projH);
  float vis = 1.0 - smoothstep(p - uLod.w, p, aRand.w);
  vis *= smoothstep(0.18, 0.55, dist);
  float sp = h21(floor(base.xz * 0.55) + 19.3);
  float isTuft = smoothstep(0.48, 0.54, sp) * (1.0 - smoothstep(0.78, 0.84, sp));
  float isStem = smoothstep(0.78, 0.84, sp);
  float hMul = mix(1.0, 0.66, isTuft) * mix(1.0, 1.75, isStem);
  float wMul = mix(1.0, 1.12, isTuft) * mix(1.0, 0.5, isStem);
  float bendMul = mix(1.0, 1.4, isTuft) * mix(1.0, 0.3, isStem);
  float bh = aRand.y * aClear * vis * hMul;
  float bw = aRand.z * wMul;
  bw *= 1.0 + dist * 0.010;
  vec2 wd = normalize(uWindDir);
  float stiff = 0.74 + 0.52 * h21(base.xz * 4.3 + 5.1);
  float ph = aRand.w * 6.2831853;
  float travelling = sin(uTime * 0.62 - dot(base.xz, wd) * 0.22);
  float crossWave = sin(uTime * 0.41 + base.x * 0.082 - base.z * 0.057 + ph);
  float ripple = sin(uTime * 1.85 + base.x * 0.31 + base.z * 0.23 + ph * 0.5);
  float front = 0.5 + 0.5 * travelling;
  float amp = (0.38 + 0.74 * front * uGust) / stiff;
  float lean;
  vec2 dir;
  if (uRichWind > 0.5) {
    float flutter = sin(uTime * 2.6 / stiff + ph) * 0.16;
    lean = (0.66 + travelling * 0.30 + ripple * 0.18 + flutter) * amp;
    float yaw = crossWave * 0.52 + ripple * 0.12;
    dir = wd * cos(yaw) + vec2(-wd.y, wd.x) * sin(yaw);
  } else {
    lean = (0.66 + travelling * 0.34 + 0.14 * sin(uTime * 2.6 / stiff + ph)) * amp;
    dir = wd;
  }
  float la = h21(floor(base.xz * 3.7)) * 6.2831853;
  vec2 rest = vec2(cos(la), sin(la)) * mix(0.05, 0.26, h21(base.xz * 1.9 + 7.0));
  vec2 restH = rest * bendMul;
  vec2 windH = dir * lean * 0.60 * bendMul;
  vec2 horiz = restH + windH;
  float hl = length(horiz);
  vec3 tipOff = normalize(vec3(horiz.x, max(1.0 - hl * 0.42, 0.22), horiz.y)) * bh;
  vec2 midH = restH * 0.32 + windH * 0.15;
  vec3 midOff = normalize(vec3(midH.x, 0.76, midH.y)) * bh * 0.5;
  float omt = 1.0 - t;
  vec3 curve = 2.0 * omt * t * midOff + t * t * tipOff;
  vec3 wDir3 = vec3(cos(aRand.x + position.z), 0.0, sin(aRand.x + position.z));
  float taper = mix(1.0 - 0.76 * t * t, 1.0 - 0.40 * t, isTuft);
  float head = 1.0 + isStem * 3.2 * smoothstep(0.70, 0.85, t) * (1.0 - smoothstep(0.90, 1.0, t));
  float w = bw * taper * head;
  vec3 viewDir = normalize(uCamPos - base);
  float edgeOn = abs(dot(viewDir, wDir3));
  w *= mix(1.0, 1.3, edgeOn);
  vec3 world = base + curve + wDir3 * side * w;
  vec3 tang = 2.0 * (1.0 - 2.0 * t) * midOff + 2.0 * t * tipOff;
  vec3 nrm = normalize(cross(wDir3, normalize(tang + vec3(0.0, 1e-4, 0.0))));
  nrm = normalize(nrm + wDir3 * side * 1.1);
  vT = t;
  vNormal = nrm;
  vWorld = world;
  vHue = h21(floor(base.xz * 2.3) + 3.1);
  float md = meadowD(base.xz);
  vGround = mix(groundColor(base.xz), vec3(0.0744, 0.1442, 0.0546), md * 0.45) * (1.0 - 0.35 * md);
  vSpecies = sp;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`,lt=`
precision highp float;
uniform vec3 uColTip;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uHemiSky;
uniform vec3 uHemiGround;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uCamPos;
uniform float uNight;
uniform float uSunI;
uniform float uHeightFog;
uniform vec3 uHeightFogSun;
uniform vec3 uHeightFogColor;
uniform float uHeightFogFalloff;
varying float vT;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vHue;
varying vec3 vGround;
varying float vSpecies;
void main(){
  vec3 tip = uColTip;
  tip = mix(tip, tip * vec3(1.10, 1.05, 0.88), smoothstep(0.78, 0.86, vSpecies));
  vec3 col = mix(vGround, tip, pow(vT, 1.35));
  vec3 straw = vec3(0.72, 0.58, 0.32);
  col = mix(col, straw, smoothstep(0.72, 0.96, vT) * smoothstep(0.58, 0.86, vSpecies) * 0.62);
  col *= (0.88 + vHue * 0.26) * vec3(1.0 + vHue * 0.04 - 0.02, 1.0, 1.0 - vHue * 0.04 + 0.02);
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  float ndl = dot(N, uSunDir) * 0.5 + 0.5;
  vec3 light = uSunCol * uSunI * ndl * ndl;
  light += mix(uHemiGround, uHemiSky, N.y * 0.5 + 0.5) * 0.55;
  vec3 V = normalize(uCamPos - vWorld);
  float back = pow(max(dot(-V, uSunDir), 0.0), 2.2);
  light += uSunCol * back * 0.62 * pow(vT, 1.4);
  float ao = mix(0.68, 1.04, smoothstep(0.0, 0.6, vT));
  col *= light * ao;
  vec3 H = normalize(V + uSunDir);
  float glint = pow(max(dot(N, H), 0.0), 64.0) * smoothstep(0.72, 0.98, vT);
  col += uSunCol * glint * 0.55;
  col *= mix(1.0, 0.38, uNight);
  col = mix(col, col * vec3(0.45, 0.55, 0.85), uNight);
  col = min(col, vec3(2.2));
  float fd = distance(uCamPos, vWorld);
  if (uHeightFog > 0.5) {
    float band = smoothstep(uFogNear, uFogFar, fd);
    float valley = exp(-max(vWorld.y - 0.35, 0.0) * uHeightFogFalloff);
    float amt = clamp(band * mix(0.32, 1.08, valley), 0.0, 0.9);
    vec3 toward = normalize(vWorld - uCamPos);
    float sunw = pow(max(dot(toward, normalize(uHeightFogSun)), 0.0), 6.0);
    vec3 warm = uHeightFogColor * vec3(1.14, 0.97, 0.76);
    vec3 cool = uHeightFogColor * vec3(0.78, 0.88, 1.03);
    col = mix(col, mix(cool, warm, sunw), amt);
  } else {
    col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, fd));
  }
  gl_FragColor = vec4(col, 1.0);
}
`;function ut(e){return new j({vertexShader:ct,fragmentShader:lt,side:2,uniforms:{uTime:{value:Ye},uLod:{value:new E(e.pmin,e.near,e.far,e.band)},uRichWind:{value:+(e.segs>=4)},uWindDir:{value:qe.clone()},uCamPos:{value:new H},uProjScale:{value:2.7},uGust:{value:Je(Ye)},uColTip:{value:new V(`#93b06a`)},uSunDir:{value:new H(18,16,13).normalize()},uSunCol:{value:new V(`#fff3dd`)},uSunI:{value:1.15},uHemiSky:{value:new V(`#dcecf4`)},uHemiGround:{value:new V(`#7a8b5e`)},uFogColor:{value:new V(`#e3ede7`)},uFogNear:{value:30},uFogFar:{value:88},uNight:{value:0},uHeightFog:{value:0},uHeightFogSun:{value:new H(.756,.36,.547).normalize()},uHeightFogColor:{value:new V(`#e4c9a4`)},uHeightFogFalloff:{value:.38}}})}function dt(e,t,n,r,i,a,o){let s=new Float32Array(i*3),c=new Float32Array(i*4),l=new Float32Array(i),u=0,d=1/0,f=-1/0,p=Math.max(1,Math.ceil(Math.sqrt(i)));for(let e=0;e<i;e+=1){let i=Math.floor(e/p),m=e%p,h=a*10007+e,g=n+(m+W(h,1))/p*t.tile,_=r+(i+W(h,2))/p*t.tile,v=Re(g,_);if(v<.015||W(h,3)>v)continue;let y=Ie(g,_,!o);if(y<.055)continue;let b=G(g,_)-.02;s[u*3]=g,s[u*3+1]=b,s[u*3+2]=_,c[u*4]=W(h,4)*Math.PI*2,c[u*4+1]=o?.18+W(h,5)**1.5*.34:.08+W(h,5)*.1,c[u*4+2]=o?.026+W(h,6)*.018:.045+W(h,6)*.04,c[u*4+3]=W(h,7),l[u]=o?y:Math.sqrt(y),d=Math.min(d,b),f=Math.max(f,b),u+=1}if(u<4)return null;let m=Array.from({length:u},(e,t)=>t).sort((e,t)=>c[e*4+3]-c[t*4+3]),h=new Float32Array(u*3),g=new Float32Array(u*4),_=new Float32Array(u);m.forEach((e,t)=>{h.set(s.subarray(e*3,e*3+3),t*3),g.set(c.subarray(e*4,e*4+4),t*4),_[t]=l[e]});let v=st(t.segs),y=new xe;y.setAttribute(`position`,new B(v.pos,3)),y.setAttribute(`uv`,new B(v.uvs,2)),y.setIndex(new B(v.idx,1)),y.setAttribute(`aPos`,new z(h,3)),y.setAttribute(`aRand`,new z(g,4)),y.setAttribute(`aClear`,new z(_,1)),y.instanceCount=u;let b=n+t.tile/2,x=r+t.tile/2,S=(d+f)/2;return y.boundingSphere=new L(new H(b,S+.25,x),Math.hypot(t.tile,t.tile)/2+.8),{id:e,geo:y,cx:b,cy:S,cz:x,radius:Math.hypot(t.tile,t.tile)/2+.4,n:u}}function ft(e){let t=[],n=[],r=Math.max(.2,e),i=3;for(let e=-8;e<40;e+=nt.tile)for(let n=-32;n<32;n+=nt.tile){i+=1;let a=Re(n+4,e+4);if(a<.06)continue;let o=Math.round((a>.35?220:90)*r),s=dt(`h-${n}-${e}`,nt,n,e,o,i,!0);s&&t.push(s)}for(let e=0;e<32;e+=rt.tile)for(let t=-24;t<24;t+=rt.tile){if(i+=1,Re(t+3,e+3)<.08)continue;let a=dt(`f-${t}-${e}`,rt,t,e,Math.round(160*r),i,!1);a&&n.push(a)}return{hero:t,fill:n}}function pt(e,t,n){for(let r of e){let e=n.x-r.cx,i=n.y-r.cy,a=n.z-r.cz,o=ot(t,Math.max(0,Math.hypot(e,i,a)-r.radius)),s=r.geo.userData.mesh;if(!s)continue;if(o<=.001){s.visible=!1;continue}let c=Math.ceil(Math.min(1,o+.02)*r.n);c<2?s.visible=!1:(s.visible=!0,r.geo.instanceCount=c)}}function mt(e,t){return e?Ye:t}var ht=new H(.756,.36,.547).normalize(),J={color:{value:new V(`#e4c9a4`)},sun:{value:ht.clone()},falloff:{value:.38},near:{value:28},far:{value:140}},gt=`
#include <fog_pars_vertex>
varying vec3 vHeightWorld;
`,_t=`
#include <fog_vertex>
#if defined USE_INSTANCING || defined USE_INSTANCING_INDIRECT
  vec4 heightWorld = instanceMatrix * vec4(transformed, 1.0);
  vHeightWorld = (modelMatrix * heightWorld).xyz;
#else
  vHeightWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif
`,vt=`
#include <fog_pars_fragment>
varying vec3 vHeightWorld;
uniform vec3 uHeightFogColor;
uniform vec3 uHeightFogSun;
uniform float uHeightFogFalloff;
uniform float uHeightFogNear;
uniform float uHeightFogFar;
`,yt=`
float heightDist = distance(cameraPosition, vHeightWorld);
float heightBand = smoothstep(uHeightFogNear, uHeightFogFar, heightDist);
float heightValley = exp(-max(vHeightWorld.y - 0.35, 0.0) * uHeightFogFalloff);
float heightAmt = clamp(heightBand * mix(0.32, 1.08, heightValley), 0.0, 0.9);
vec3 heightTo = normalize(vHeightWorld - cameraPosition);
float heightSun = pow(max(dot(heightTo, normalize(uHeightFogSun)), 0.0), 6.0);
vec3 heightWarm = uHeightFogColor * vec3(1.14, 0.97, 0.76);
vec3 heightCool = uHeightFogColor * vec3(0.78, 0.88, 1.03);
gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(heightCool, heightWarm, heightSun), heightAmt);
`;function bt(e){let t=e.onBeforeCompile,n=e.customProgramCacheKey.bind(e);return e.onBeforeCompile=(n,r)=>{t.call(e,n,r),n.uniforms.uHeightFogColor=J.color,n.uniforms.uHeightFogSun=J.sun,n.uniforms.uHeightFogFalloff=J.falloff,n.uniforms.uHeightFogNear=J.near,n.uniforms.uHeightFogFar=J.far,n.vertexShader=n.vertexShader.replace(`#include <fog_pars_vertex>`,gt).replace(`#include <fog_vertex>`,_t),n.fragmentShader=n.fragmentShader.replace(`#include <fog_pars_fragment>`,vt),n.fragmentShader=n.fragmentShader.includes(`#include <tonemapping_fragment>`)?n.fragmentShader.replace(`#include <tonemapping_fragment>`,`${yt}\n#include <tonemapping_fragment>`).replace(`#include <fog_fragment>`,``):n.fragmentShader.replace(`#include <fog_fragment>`,yt)},e.customProgramCacheKey=()=>`height-fog-${n()}`,e}var xt=class e extends S{constructor(){let t=e.SkyShader,n=new j({name:t.name,uniforms:oe.clone(t.uniforms),vertexShader:t.vertexShader,fragmentShader:t.fragmentShader,side:1,depthWrite:!1});super(new me(1,1,1),n),this.isSky=!0}};xt.SkyShader={name:`SkyShader`,uniforms:{turbidity:{value:2},rayleigh:{value:1},mieCoefficient:{value:.005},mieDirectionalG:{value:.8},sunPosition:{value:new H},cloudScale:{value:2e-4},cloudSpeed:{value:2e-5},cloudCoverage:{value:.4},cloudDensity:{value:.4},cloudElevation:{value:.5},showSunDisc:{value:1},time:{value:0}},vertexShader:`
		uniform vec3 sunPosition;
		uniform float rayleigh;
		uniform float turbidity;
		uniform float mieCoefficient;

		varying vec3 vWorldPosition;
		varying vec3 vSunDirection;
		varying float vSunfade;
		varying vec3 vBetaR;
		varying vec3 vBetaM;
		varying float vSunE;

		// constants for atmospheric scattering
		const float e = 2.71828182845904523536028747135266249775724709369995957;
		const float pi = 3.141592653589793238462643383279502884197169;

		// wavelength of used primaries, according to preetham
		const vec3 lambda = vec3( 680E-9, 550E-9, 450E-9 );
		// this pre-calculation replaces older TotalRayleigh(vec3 lambda) function:
		// (8.0 * pow(pi, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N * pow(lambda, vec3(4.0)) * (6.0 - 7.0 * pn))
		const vec3 totalRayleigh = vec3( 5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5 );

		// mie stuff
		// K coefficient for the primaries
		const float v = 4.0;
		const vec3 K = vec3( 0.686, 0.678, 0.666 );
		// MieConst = pi * pow( ( 2.0 * pi ) / lambda, vec3( v - 2.0 ) ) * K
		const vec3 MieConst = vec3( 1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14 );

		// earth shadow hack
		// cutoffAngle = pi / 1.95;
		const float cutoffAngle = 1.6110731556870734;
		const float steepness = 1.5;
		const float EE = 1000.0;

		float sunIntensity( float zenithAngleCos ) {
			zenithAngleCos = clamp( zenithAngleCos, -1.0, 1.0 );
			return EE * max( 0.0, 1.0 - pow( e, -( ( cutoffAngle - acos( zenithAngleCos ) ) / steepness ) ) );
		}

		vec3 totalMie( float T ) {
			float c = ( 0.2 * T ) * 10E-18;
			return 0.434 * c * MieConst;
		}

		void main() {

			vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
			vWorldPosition = worldPosition.xyz;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			gl_Position.z = gl_Position.w; // set z to camera.far

			vSunDirection = normalize( sunPosition );

			vSunE = sunIntensity( vSunDirection.y );

			vSunfade = 1.0 - clamp( 1.0 - exp( ( sunPosition.y / 450000.0 ) ), 0.0, 1.0 );

			float rayleighCoefficient = rayleigh - ( 1.0 * ( 1.0 - vSunfade ) );

			// extinction (absorption + out scattering)
			// rayleigh coefficients
			vBetaR = totalRayleigh * rayleighCoefficient;

			// mie coefficients
			vBetaM = totalMie( turbidity ) * mieCoefficient;

		}`,fragmentShader:`
		varying vec3 vWorldPosition;
		varying vec3 vSunDirection;
		varying vec3 vBetaR;
		varying vec3 vBetaM;
		varying float vSunE;

		uniform float mieDirectionalG;
		uniform float cloudScale;
		uniform float cloudSpeed;
		uniform float cloudCoverage;
		uniform float cloudDensity;
		uniform float cloudElevation;
		uniform float showSunDisc;
		uniform float time;

		// gradient at a lattice corner; sinless hash so every GPU produces the same clouds
		vec2 gradient( vec2 i ) {
			vec3 p = fract( i.xyx * vec3( 0.1031, 0.1030, 0.0973 ) );
			p += dot( p, p.yzx + 33.33 );
			return fract( ( p.xx + p.yz ) * p.zy ) * 2.0 - 1.0;
		}

		// 2D gradient noise: isotropic lobes like Perlin at value-noise cost
		float noise( vec2 p ) {
			vec2 i = floor( p );
			vec2 f = fract( p );
			vec2 u = f * f * f * ( f * ( f * 6.0 - 15.0 ) + 10.0 ); // quintic fade
			float a = dot( gradient( i ), f );
			float b = dot( gradient( i + vec2( 1.0, 0.0 ) ), f - vec2( 1.0, 0.0 ) );
			float c = dot( gradient( i + vec2( 0.0, 1.0 ) ), f - vec2( 0.0, 1.0 ) );
			float d = dot( gradient( i + vec2( 1.0, 1.0 ) ), f - vec2( 1.0, 1.0 ) );
			return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y ) * 1.6; // ~[-1,1]
		}

		// fbm; per-octave drift makes clouds billow instead of scrolling as a rigid stamp
		float fbm( vec2 p, float drift ) {
			float result = 0.0;
			float amplitude = 1.0;
			for ( int i = 0; i < 4; i ++ ) {
				result += amplitude * noise( p );
				amplitude *= 0.5;
				p = p * 2.0 + drift;
			}
			return result;
		}

		// constants for atmospheric scattering
		const float pi = 3.141592653589793238462643383279502884197169;

		const float n = 1.0003; // refractive index of air
		const float N = 2.545E25; // number of molecules per unit volume for air at 288.15K and 1013mb (sea level -45 celsius)

		// optical length at zenith for molecules
		const float rayleighZenithLength = 8.4E3;
		const float mieZenithLength = 1.25E3;
		// 66 arc seconds -> degrees, and the cosine of that
		const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;

		// 3.0 / ( 16.0 * pi )
		const float THREE_OVER_SIXTEENPI = 0.05968310365946075;
		// 1.0 / ( 4.0 * pi )
		const float ONE_OVER_FOURPI = 0.07957747154594767;

		float rayleighPhase( float cosTheta ) {
			return THREE_OVER_SIXTEENPI * ( 1.0 + pow( cosTheta, 2.0 ) );
		}

		float hgPhase( float cosTheta, float g ) {
			float g2 = pow( g, 2.0 );
			float inverse = 1.0 / pow( 1.0 - 2.0 * g * cosTheta + g2, 1.5 );
			return ONE_OVER_FOURPI * ( ( 1.0 - g2 ) * inverse );
		}

		void main() {

			vec3 direction = normalize( vWorldPosition - cameraPosition );

			// optical length
			// cutoff angle at 90 to avoid singularity in next formula.
			float zenithAngle = acos( max( 0.0, direction.y ) );
			float inverse = 1.0 / ( cos( zenithAngle ) + 0.15 * pow( 93.885 - ( ( zenithAngle * 180.0 ) / pi ), -1.253 ) );
			float sR = rayleighZenithLength * inverse;
			float sM = mieZenithLength * inverse;

			// combined extinction factor
			vec3 Fex = exp( -( vBetaR * sR + vBetaM * sM ) );

			// in scattering
			float cosTheta = dot( direction, vSunDirection );

			float rPhase = rayleighPhase( cosTheta * 0.5 + 0.5 );
			vec3 betaRTheta = vBetaR * rPhase;

			float mPhase = hgPhase( cosTheta, mieDirectionalG );
			vec3 betaMTheta = vBetaM * mPhase;

			vec3 Lin = pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * ( 1.0 - Fex ), vec3( 1.5 ) );
			Lin *= mix( vec3( 1.0 ), pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * Fex, vec3( 1.0 / 2.0 ) ), clamp( pow( 1.0 - vSunDirection.y, 5.0 ), 0.0, 1.0 ) );

			// nightsky
			float theta = acos( direction.y ); // elevation --> y-axis, [-pi/2, pi/2]
			float phi = atan( direction.z, direction.x ); // azimuth --> x-axis [-pi/2, pi/2]
			vec2 uv = vec2( phi, theta ) / vec2( 2.0 * pi, pi ) + vec2( 0.5, 0.0 );
			vec3 L0 = vec3( 0.1 ) * Fex;

			// composition + solar disc
			float sundisc = clamp( ( cosTheta - sunAngularDiameterCos ) * 50000.0, 0.0, 1.0 ) * showSunDisc;
			vec3 sundiscColor = ( 760.0 * sundisc ) * min( vSunE * Fex, 80.0 );

			vec3 texColor = ( Lin + L0 ) * 0.04 + sundiscColor + vec3( 0.0, 0.0003, 0.00075 );

			// Clouds
			if ( direction.y > 0.0 && cloudCoverage > 0.0 ) {

				// Project to cloud plane (higher elevation = clouds appear lower/closer)
				float elevation = mix( 1.0, 0.1, cloudElevation );
				vec2 cloudUV = direction.xz / ( direction.y * elevation );
				cloudUV *= cloudScale;
				cloudUV += time * cloudSpeed;

				// Cloud density field
				float evolve = time * cloudSpeed * 300.0;
				float cloudNoise = clamp( fbm( cloudUV * 1000.0, evolve ) * 0.7 + 0.5, 0.0, 1.0 );

				// Large-scale coverage variation: clear gaps next to dense banks
				float region = noise( cloudUV * 300.0 ) * 0.37 + 0.5;
				float cov = clamp( cloudCoverage + ( region - 0.5 ) * 0.6, 0.0, 1.0 );

				// Carve clouds where noise rises above the coverage level
				float threshold = 1.0 - cov;
				float cloudMask = smoothstep( threshold, threshold + 0.3, cloudNoise );

				// Fade clouds near horizon (adjusted by elevation)
				float horizonFade = smoothstep( 0.0, 0.03 + 0.06 * cloudElevation, direction.y );
				cloudMask *= horizonFade;

				// Cloud lighting from the sky's own radiance
				float dayFactor = smoothstep( -0.08, 0.3, vSunDirection.y );
				vec3 sunColor = vSunE * Fex * 0.22 * 0.04; // 0.22 ~ albedo/pi, 0.04 = exposure; the aerial composite adds the eye-leg extinction
				vec3 skyAmbient = Lin * 0.04 + vec3( 0.0, 0.0003, 0.00075 );

				// Beer-powder self-shadow from the sampled density
				float depth = max( 0.0, cloudNoise - threshold );
				float beer = exp( depth * -4.0 );
				float powder = 1.0 - beer * beer; // beer*beer == exp(-8*depth)
				float shade = mix( 0.45, 1.0, clamp( beer * powder * 2.6, 0.0, 1.0 ) ); // 2.6 = 1/0.385, normalizes beer*powder peak to 1

				// Henyey-Greenstein forward lobe ( g = 0.7 ): silver lining on rims toward the sun
				float silver = clamp( 0.51 / pow( 1.49 - cosTheta * 1.4, 1.5 ), 0.0, 3.0 ); // 0.51=1-g^2, 1.49=1+g^2, 1.4=2g
				float edge = cloudMask * ( 1.0 - cloudMask ) * 4.0;

				vec3 cloudColor = skyAmbient + sunColor * shade;
				cloudColor += sunColor * silver * edge * 0.6;
				cloudColor *= max( dayFactor, 0.03 );

				// Cloud opacity via Beer's law: density sets how solid the clouds get
				float alpha = ( 1.0 - exp( depth * cloudDensity * -12.0 ) ) * horizonFade;

				// Occlude the sun disc/glow behind opaque cloud
				texColor -= L0 * 0.04 * alpha;

				// Composite through the atmosphere so distant clouds dissolve into haze
				vec3 cloudAerial = mix( texColor, cloudColor, Fex );
				texColor = mix( texColor, cloudAerial, alpha );

			}

			gl_FragColor = vec4( texColor, 1.0 );

			#include <tonemapping_fragment>
			#include <colorspace_fragment>

		}`};var St=class extends S{constructor(e,t,n,r=128){if(t<=0||n<=0||r<=0)throw Error(`THREE.GroundedSkybox: height, radius, and resolution must be positive.`);let i=new Se(n,2*r,r);i.scale(1,1,-1);let a=i.getAttribute(`position`),o=new H;for(let e=0;e<a.count;++e)if(o.fromBufferAttribute(a,e),o.y<0){let n=-t*3/2,r=o.y<n?-t/o.y:1-o.y*o.y/(3*n*n);o.multiplyScalar(r),o.toArray(a.array,3*e)}a.needsUpdate=!0,super(i,new R({map:e,depthWrite:!1}))}};function Ct(e){return(`/`.endsWith(`/`)?`/`:`//`)+e.replace(/^\//,``)}var wt=`
uniform sampler2D tMap;
uniform float uBlur;
uniform vec3 uFogColor;
uniform vec3 uSunDir;
varying vec2 vUv;
varying vec3 vWorld;

vec3 backdropTap(vec2 uv) {
  vec2 stepUv = vec2(uBlur * 0.085);
  vec3 color = texture2D(tMap, uv).rgb;
  color += texture2D(tMap, uv + vec2(stepUv.x, 0.0)).rgb;
  color += texture2D(tMap, uv - vec2(stepUv.x, 0.0)).rgb;
  color += texture2D(tMap, uv + vec2(0.0, stepUv.y)).rgb;
  color += texture2D(tMap, uv - vec2(0.0, stepUv.y)).rgb;
  return color / 5.0;
}

void main() {
  vec3 color = backdropTap(vUv);
  color = color / (vec3(1.0) + color * 0.45);
  // Sphere v 0.5 is the horizon. A short band, then the Preetham dome.
  float elev = vUv.y - 0.50;
  float ridge = smoothstep(0.0, 0.02, elev) * (1.0 - smoothstep(0.08, 0.16, elev));
  vec3 toward = normalize(vWorld - cameraPosition);
  float sun = pow(max(dot(toward, normalize(uSunDir)), 0.0), 4.0);
  vec3 warm = uFogColor * vec3(1.12, 0.96, 0.78);
  vec3 cool = uFogColor * vec3(0.8, 0.9, 1.02);
  color = mix(color, mix(cool, warm, sun), (1.0 - ridge) * 0.42 + 0.08);
  float alpha = ridge;
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(color, alpha);
}
`,Tt=`
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;function Et(e,t,n,r,i){let a=new xt;a.name=`PreethamSky`,a.scale.setScalar(1e3),a.frustumCulled=!1,a.renderOrder=-20;let o=a.material.uniforms;o.turbidity.value=3.2,o.rayleigh.value=2.1,o.mieCoefficient.value=.004,o.mieDirectionalG.value=.82,o.sunPosition.value.copy(ht).multiplyScalar(400),o.cloudCoverage.value=.28,o.cloudDensity.value=.32;let s=a.material;s.depthWrite=!1,s.fog=!1,s.toneMapped=!1;let c=s.onBeforeCompile;s.onBeforeCompile=(e,t)=>{c?.call(s,e,t),e.fragmentShader=e.fragmentShader.replace(`#include <tonemapping_fragment>`,``).replace(`#include <colorspace_fragment>`,``).replace(`gl_FragColor = vec4( texColor, 1.0 );`,`vec3 skyBody = max(texColor - sundiscColor, vec3(0.0));
        float skyLuma = max(dot(skyBody, vec3(0.2126, 0.7152, 0.0722)), 0.0001);
        float skyMapped = log2(1.0 + skyLuma * 0.72) / log2(10.0);
        skyBody *= skyMapped / skyLuma;
        float zenith = smoothstep(0.05, 0.72, direction.y);
        skyBody = mix(skyBody, skyBody * vec3(0.62, 0.78, 1.08), zenith * 0.55);
        float horizon = 1.0 - smoothstep(0.0, 0.18, direction.y);
        skyBody = mix(skyBody, skyBody * vec3(1.18, 0.92, 0.72), horizon * 0.35);
        float sunGlow = pow(max(dot(direction, vSunDirection), 0.0), 6.0);
        skyBody += vec3(0.55, 0.22, 0.05) * sunGlow;
        gl_FragColor = vec4(skyBody + vec3(sundisc) * vec3(8.0, 5.2, 2.0), 1.0);`)};let l=s.customProgramCacheKey?.bind(s);s.customProgramCacheKey=()=>`golden-sky-v2-${l?l():``}`,n.push(s),t.push(a.geometry),e.add(a);let u=ze().goldenSky;if(u!==`off`){let a=u===`1k`?`hdri/alps_field_1k.hdr`:`hdri/alps_field_2k.hdr`;je.loadAsync(Ct(a)).then(a=>{if(!i()){a.dispose();return}a.colorSpace=we,a.wrapS=N,a.wrapT=N,a.needsUpdate=!0,r.push(a);let o=new St(a,6,430,64);o.name=`AlpsRidge`,o.position.y=6,o.frustumCulled=!1,o.renderOrder=-16,t.push(o.geometry);let s=new j({uniforms:{tMap:{value:a},uBlur:{value:.03},uFogColor:J.color,uSunDir:J.sun},vertexShader:Tt,fragmentShader:wt,transparent:!0,depthWrite:!1,toneMapped:!1,side:1}),c=o.material;o.material=s,Array.isArray(c)||c.dispose(),n.push(s),e.add(o)}).catch(()=>void 0)}return a}function Dt(e){return(`/`.endsWith(`/`)?`/`:`//`)+e.replace(/^\//,``)}var Ot=`
uniform sampler2D tForestC;
uniform sampler2D tForestR;
uniform sampler2D tForestA;
uniform sampler2D tForestN;
uniform sampler2D tMudC;
uniform sampler2D tMudR;
uniform sampler2D tMudA;
uniform sampler2D tMudN;
uniform sampler2D tGrassC;
uniform sampler2D tGrassN;
uniform sampler2D tSoilC;
uniform float uGroundReady;
uniform float uGroundNormal;
uniform float uGroundDetail;
uniform float uGrassReady;
uniform float uSoilReady;
varying vec3 vGroundWorld;
varying vec3 vGroundNormal;
float gGroundRough = 0.92;

float macroHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float macroNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(macroHash(i), macroHash(i + vec2(1.0, 0.0)), u.x),
    mix(macroHash(i + vec2(0.0, 1.0)), macroHash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

vec3 groundSrgb(vec3 color) {
  return pow(max(color, vec3(0.0)), vec3(2.2));
}
vec3 groundTri(sampler2D tex, vec3 pos, vec3 normal, float scale, bool decode) {
  vec3 blend = pow(abs(normal), vec3(4.0));
  blend /= blend.x + blend.y + blend.z + 1e-4;
  vec3 x = texture2D(tex, pos.zy * scale).rgb;
  vec3 y = texture2D(tex, pos.xz * scale).rgb;
  vec3 z = texture2D(tex, pos.xy * scale).rgb;
  vec3 color = x * blend.x + y * blend.y + z * blend.z;
  return decode ? groundSrgb(color) : color;
}
vec3 groundTriBreak(sampler2D tex, vec3 pos, vec3 normal, bool decode) {
  vec3 fine = groundTri(tex, pos, normal, 0.5, decode);
  vec3 broad = groundTri(tex, pos + vec3(1.7, 0.0, 0.4), normal, 0.22, decode);
  float mask = smoothstep(0.32, 0.78, macroNoise(pos.xz * 0.11 + 2.0));
  return mix(fine, broad, mask * 0.55);
}
float groundDense(vec2 p) {
  float radius = length(p);
  float ring = 1.0 - smoothstep(16.0, 46.0, radius);
  float corridor = (1.0 - smoothstep(9.0, 18.0, abs(p.x))) * smoothstep(5.5, 11.0, p.y) * (1.0 - smoothstep(33.0, 41.0, p.y));
  float scatter = 0.34 * (1.0 - smoothstep(28.0, 48.0, radius));
  float density = max(ring, max(corridor, scatter));
  density *= 1.0 - smoothstep(6.0, 15.0, -p.y);
  return clamp(density, 0.0, 1.0);
}
`;function kt(e,t,n,r=!0){let i=new m(170,170,e,e);i.rotateX(-Math.PI/2);let a=i.attributes.position;for(let e=0;e<a.count;e+=1)a.setY(e,G(a.getX(e),a.getZ(e)));i.computeVertexNormals();let c=new o(new Uint8Array([210,198,160,255]),1,1);c.needsUpdate=!0,c.wrapS=s,c.wrapT=s,t.push(c);let l={forestC:c,forestR:c,forestA:c,forestN:c,mudC:c,mudR:c,mudA:c,mudN:c,grassC:c,grassN:c,soilC:c,ready:0,normal:0,detail:0,grassReady:0,soilReady:0},u=new w({color:`#6d7a4e`,roughness:.92,metalness:0});r&&bt(u);let d=u.onBeforeCompile,f=u.customProgramCacheKey.bind(u);u.onBeforeCompile=(e,t)=>{d.call(u,e,t),e.uniforms.tForestC={value:l.forestC},e.uniforms.tForestR={value:l.forestR},e.uniforms.tForestA={value:l.forestA},e.uniforms.tForestN={value:l.forestN},e.uniforms.tMudC={value:l.mudC},e.uniforms.tMudR={value:l.mudR},e.uniforms.tMudA={value:l.mudA},e.uniforms.tMudN={value:l.mudN},e.uniforms.tGrassC={value:l.grassC},e.uniforms.tGrassN={value:l.grassN},e.uniforms.tSoilC={value:l.soilC},e.uniforms.uGroundReady={value:l.ready},e.uniforms.uGroundNormal={value:l.normal},e.uniforms.uGroundDetail={value:l.detail},e.uniforms.uGrassReady={value:l.grassReady},e.uniforms.uSoilReady={value:l.soilReady},u.userData.groundUniforms=e.uniforms,e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
varying vec3 vGroundWorld;
varying vec3 vGroundNormal;`).replace(`#include <begin_vertex>`,`#include <begin_vertex>
vGroundWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vGroundNormal = normalize(mat3(modelMatrix) * objectNormal);`),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>\n${Ot}`).replace(`#include <roughnessmap_fragment>`,`#include <roughnessmap_fragment>
if (uGroundDetail > 0.5) roughnessFactor = mix(roughnessFactor, gGroundRough, step(0.5, uGroundReady));`).replace(`#include <normal_fragment_maps>`,`#include <normal_fragment_maps>
if (uGroundReady > 0.5 && uGroundNormal > 0.5) {
  vec3 nF = texture2D(tForestN, vGroundWorld.xz * 0.5).xyz * 2.0 - 1.0;
  vec3 nM = texture2D(tMudN, vGroundWorld.xz * 0.5).xyz * 2.0 - 1.0;
  float nSlope = clamp((1.0 - vGroundNormal.y) * 1.35, 0.0, 1.0);
  vec3 nTex = mix(nF, nM, nSlope);
  if (uGrassReady > 0.5) {
    vec3 nG = texture2D(tGrassN, vGroundWorld.xz * 0.5).xyz * 2.0 - 1.0;
    nTex = mix(nTex, nG, groundDense(vGroundWorld.xz) * 0.62);
  }
  vec3 worldN = normalize(vGroundNormal + vec3(nTex.x, nTex.z, nTex.y) * 0.55);
  normal = normalize(mat3(viewMatrix) * worldN);
}`).replace(`#include <color_fragment>`,`#include <color_fragment>
if (uGroundReady > 0.5) {
  vec3 forest = groundTriBreak(tForestC, vGroundWorld, vGroundNormal, true);
  vec3 mud = groundTriBreak(tMudC, vGroundWorld, vGroundNormal, true);
  float slope = 1.0 - clamp(vGroundNormal.y, 0.0, 1.0);
  float damp = groundTri(tMudA, vGroundWorld, vGroundNormal, 0.5, false).r;
  float mudAmt = clamp(slope * 1.35 + damp * 0.28, 0.0, 1.0);
  if (uSoilReady > 0.5) {
    vec3 soil = groundTriBreak(tSoilC, vGroundWorld, vGroundNormal, true);
    mud = mix(mud, soil, 0.28);
  }
  vec3 albedo = mix(forest, mud, mudAmt);
  float sward = groundDense(vGroundWorld.xz);
  if (uGrassReady > 0.5) {
    vec3 grass = groundTriBreak(tGrassC, vGroundWorld, vGroundNormal, true);
    albedo = mix(albedo, grass, sward * 0.82);
  }
  float ao = 1.0;
  if (uGroundDetail > 0.5) {
    float roughF = groundTri(tForestR, vGroundWorld, vGroundNormal, 0.5, false).r;
    float roughM = groundTri(tMudR, vGroundWorld, vGroundNormal, 0.5, false).r;
    ao = mix(
      groundTri(tForestA, vGroundWorld, vGroundNormal, 0.5, false).r,
      groundTri(tMudA, vGroundWorld, vGroundNormal, 0.5, false).r,
      mudAmt
    );
    gGroundRough = mix(roughF, roughM, mudAmt);
  }
  albedo *= mix(1.0, 0.84, sward);
  float macroFar = 1.0 - smoothstep(28.0, 90.0, length(vGroundWorld - cameraPosition));
  float macroA = macroNoise(vGroundWorld.xz * 0.045);
  float macroB = macroNoise(vGroundWorld.xz * 0.13 + 4.2);
  albedo *= 1.0 + ((macroA - 0.5) * 0.22 + (macroB - 0.5) * 0.08) * macroFar;
  diffuseColor.rgb = albedo * mix(0.9, 1.0, ao);
}`)},u.customProgramCacheKey=()=>`golden-ground-v3-${f()}`;let p=new S(i,u);p.receiveShadow=!0,p.name=`Terrain`,n.push(u);let h=(e,n)=>Me.loadAsync(Dt(`textures/${e}/${n}.ktx2`)).then(e=>(e.colorSpace=``,e.wrapS=s,e.wrapT=s,e.anisotropy=Fe(),t.push(e),e)),g=()=>{let e=u.userData.groundUniforms;e&&(e.tForestC.value=l.forestC,e.tForestR.value=l.forestR,e.tForestA.value=l.forestA,e.tForestN.value=l.forestN,e.tMudC.value=l.mudC,e.tMudR.value=l.mudR,e.tMudA.value=l.mudA,e.tMudN.value=l.mudN,e.tGrassC.value=l.grassC,e.tGrassN.value=l.grassN,e.tSoilC.value=l.soilC,e.uGroundReady.value=l.ready,e.uGroundNormal.value=l.normal,e.uGroundDetail.value=l.detail,e.uGrassReady.value=l.grassReady,e.uSoilReady.value=l.soilReady)},_=ze().ground===`full`,v=_?[h(`forrest_ground_01`,`diff`),h(`forrest_ground_01`,`rough`),h(`forrest_ground_01`,`ao`),h(`forrest_ground_01`,`nor_gl`),h(`brown_mud_leaves_01`,`diff`),h(`brown_mud_leaves_01`,`rough`),h(`brown_mud_leaves_01`,`ao`),h(`brown_mud_leaves_01`,`nor_gl`)]:[h(`forrest_ground_01`,`diff`),h(`brown_mud_leaves_01`,`diff`)];Ne().then(()=>Promise.all(v)).then(e=>{if(_){let[t,n,r,i,a,o,s,c]=e;l.forestC=t,l.forestR=n,l.forestA=r,l.forestN=i,l.mudC=a,l.mudR=o,l.mudA=s,l.mudN=c,l.normal=1,l.detail=1}else{let[t,n]=e;l.forestC=t,l.mudC=n}l.ready=1,g()}).catch(()=>void 0);let y=new _e,b=e=>y.loadAsync(Dt(e)).then(e=>(e.colorSpace=``,e.wrapS=s,e.wrapT=s,e.anisotropy=Fe(),t.push(e),e)),x=_?[b(`textures/grass004/diff.jpg`),b(`textures/grass004/nor_gl.jpg`)]:[b(`textures/grass004/diff.jpg`)];return Promise.all(x).then(e=>{l.grassC=e[0],e[1]&&(l.grassN=e[1]),l.grassReady=1,g()}).catch(()=>void 0),_&&b(`textures/ground037/diff.jpg`).then(e=>{l.soilC=e,l.soilReady=1,g()}).catch(()=>void 0),p}function At(e,t,n){n[0]=e[0]>t[0]?t[0]:e[0],n[1]=e[1]<t[1]?t[1]:e[1],n[2]=e[2]>t[2]?t[2]:e[2],n[3]=e[3]<t[3]?t[3]:e[3],n[4]=e[4]>t[4]?t[4]:e[4],n[5]=e[5]<t[5]?t[5]:e[5]}function jt(e,t,n){let r=!1,i=e[0]>t[0]?t[0]:e[0],a=e[1]<t[1]?t[1]:e[1],o=e[2]>t[2]?t[2]:e[2],s=e[3]<t[3]?t[3]:e[3],c=e[4]>t[4]?t[4]:e[4],l=e[5]<t[5]?t[5]:e[5];return n[0]>i&&(n[0]=i,r=!0),n[1]<a&&(n[1]=a,r=!0),n[2]>o&&(n[2]=o,r=!0),n[3]<s&&(n[3]=s,r=!0),n[4]>c&&(n[4]=c,r=!0),n[5]<l&&(n[5]=l,r=!0),r}function Mt(e,t){return!(t[0]>e[0]||t[1]<e[1]||t[2]>e[2]||t[3]<e[3]||t[4]>e[4]||t[5]<e[5])}function Nt(e,t){let n=!1;return t[0]>e[0]&&(t[0]=e[0],n=!0),t[1]<e[1]&&(t[1]=e[1],n=!0),t[2]>e[2]&&(t[2]=e[2],n=!0),t[3]<e[3]&&(t[3]=e[3],n=!0),t[4]>e[4]&&(t[4]=e[4],n=!0),t[5]<e[5]&&(t[5]=e[5],n=!0),n}function Pt(e,t){e[0]-=t,e[1]+=t,e[2]-=t,e[3]+=t,e[4]-=t,e[5]+=t}function Ft(e){let t=e[1]-e[0],n=e[3]-e[2],r=e[5]-e[4];return 2*(t*n+n*r+r*t)}function It(e,t){let n=e[0]>t[0]?t[0]:e[0],r=e[1]<t[1]?t[1]:e[1],i=e[2]>t[2]?t[2]:e[2],a=e[3]<t[3]?t[3]:e[3],o=e[4]>t[4]?t[4]:e[4],s=e[5]<t[5]?t[5]:e[5],c=r-n,l=a-i,u=s-o;return 2*(c*l+l*u+u*c)}function Lt(e){let t=e[1]-e[0],n=e[3]-e[2],r=e[5]-e[4];return t>n?t>r?0:2:n>r?1:2}function Rt(e,t){let n=e[0]-t[0],r=t[0]-e[1],i=n>r?n:r;i<0&&(i=0);let a=e[2]-t[1],o=t[1]-e[3],s=a>o?a:o;s<0&&(s=0);let c=e[4]-t[2],l=t[2]-e[5],u=c>l?c:l;return u<0&&(u=0),i*i+s*s+u*u}function zt(e,t){let n,r,i,a,o,s,c=e[0]-t[0],l=t[0]-e[1];c>l?(n=c,r=l):(n=l,r=c),n<0&&(n=0);let u=e[2]-t[1],d=t[1]-e[3];u>d?(i=u,a=d):(i=d,a=u),i<0&&(i=0);let f=e[4]-t[2],p=t[2]-e[5];return f>p?(o=f,s=p):(o=p,s=f),o<0&&(o=0),{min:n*n+i*i+o*o,max:r*r+a*a+s*s}}var Bt=class{constructor(){this.array=[]}clear(){this.array=[]}push(e){let t=this.array,n=e.inheritedCost,r=t.length>6?t.length-6:0,i;for(i=t.length-1;i>=r&&!(n<=t[i].inheritedCost);i--);i>t.length-7&&t.splice(i+1,0,e)}pop(){return this.array.pop()}},Vt=class{constructor(e=!1){this.root=null,this._sortedList=new Bt,this.count=0,this.highPrecision=e,this._typeArray=e?Float64Array:Float32Array}createFromArray(e,t,n,r=0){let i=t.length,a=this._typeArray;a!==(t[0].BYTES_PER_ELEMENT===4?Float32Array:Float64Array)&&console.warn(`Different precision.`);let o=new a(6),s,c;this.root=l(0,i,null);function l(i,a,o){if(a===1){let a=t[i];r>0&&Pt(a,r);let s={box:a,object:e[i],parent:o};return n&&n(s),s}let s=u(i,a);d();let c=f(i,a);(c===i||c===i+a)&&(c=i+(a>>1));let p={box:s,parent:o};return p.left=l(i,c-i,p),p.right=l(c,a-c+i,p),p}function u(e,n){let i=new a(6),s=e+n;i[0]=1/0,i[1]=-1/0,i[2]=1/0,i[3]=-1/0,i[4]=1/0,i[5]=-1/0,o[0]=1/0,o[1]=-1/0,o[2]=1/0,o[3]=-1/0,o[4]=1/0,o[5]=-1/0;for(let n=e;n<s;n++){let e=t[n],r=e[0],a=e[1],s=e[2],c=e[3],l=e[4],u=e[5];i[0]>r&&(i[0]=r),i[1]<a&&(i[1]=a),i[2]>s&&(i[2]=s),i[3]<c&&(i[3]=c),i[4]>l&&(i[4]=l),i[5]<u&&(i[5]=u);let d=(a+r)*.5,f=(c+s)*.5,p=(u+l)*.5;o[0]>d&&(o[0]=d),o[1]<d&&(o[1]=d),o[2]>f&&(o[2]=f),o[3]<f&&(o[3]=f),o[4]>p&&(o[4]=p),o[5]<p&&(o[5]=p)}return i[0]-=r,i[1]+=r,i[2]-=r,i[3]+=r,i[4]-=r,i[5]+=r,i}function d(){s=Lt(o)*2,c=(o[s]+o[s+1])*.5}function f(n,r){let i=n,a=n+r-1;for(;i<=a;){let n=t[i];if((n[s+1]+n[s])*.5>=c)for(;;){let n=t[a];if((n[s+1]+n[s])*.5<c){let n=e[i];e[i]=e[a],e[a]=n;let r=t[i];t[i]=t[a],t[a]=r,a--;break}if(a--,a<=i)return i}i++}return i}}insert(e,t,n){n>0&&Pt(t,n);let r=this.createLeafNode(e,t);return this.root===null?this.root=r:this.insertLeaf(r),this.count++,r}insertRange(e,t,n,r){console.warn(`Method not optimized yet. It just calls 'insert' N times.`);let i=e.length,a=n>0?n:n?null:0;for(let o=0;o<i;o++){let i=this.insert(e[o],t[o],a??n[o]);r&&r(i)}}move(e,t){if(!e.parent||Mt(e.box,e.parent.box)){t>0&&Pt(e.box,t);return}t>0&&Pt(e.box,t);let n=this.delete(e);this.insertLeaf(e,n),this.count++}delete(e){let t=e.parent;if(t===null)return this.root=null,null;let n=t.parent,r=t.left===e?t.right:t.left;return r.parent=n,e.parent=null,n===null?(this.root=r,t):(n.left===t?n.left=r:n.right=r,this.refit(n),this.count--,t)}clear(){this.root=null}insertLeaf(e,t){let n=this.findBestSibling(e.box),r=n.parent;t===void 0?t=this.createInternalNode(r,n,e):(t.parent=r,t.left=n,t.right=e),n.parent=t,e.parent=t,r===null?this.root=t:r.left===n?r.left=t:r.right=t,this.refitAndRotate(e,n)}createLeafNode(e,t){return{box:t,object:e,parent:null}}createInternalNode(e,t,n){return{parent:e,left:t,right:n,box:new this._typeArray(6)}}findBestSibling(e){let t=this.root,n=t,r=It(e,t.box),i=Ft(e);if(t.object!==void 0)return t;let a=this._sortedList;a.clear();let o={node:t,inheritedCost:r-Ft(t.box)};do{let{node:t,inheritedCost:s}=o;if(i+s>=r)break;let c=t.left,l=t.right,u=It(e,c.box)+s,d=u-Ft(c.box),f=It(e,l.box)+s,p=f-Ft(l.box);if(u>f?r>f&&(n=l,r=f):r>u&&(n=c,r=u),p>d){if(i+d>=r||(c.object===void 0&&a.push({node:c,inheritedCost:d}),i+p>=r))continue;l.object===void 0&&a.push({node:l,inheritedCost:p})}else{if(i+p>=r||(l.object===void 0&&a.push({node:l,inheritedCost:p}),i+d>=r))continue;c.object===void 0&&a.push({node:c,inheritedCost:d})}}while(o=a.pop());return n}refit(e){for(At(e.left.box,e.right.box,e.box);e=e.parent;)if(!jt(e.left.box,e.right.box,e.box))return}refitAndRotate(e,t){let n=e.box;e=e.parent;let r=e.box;for(At(n,t.box,r);e=e.parent;){let t=e.box;if(!Nt(n,t))return;let r=e.left,i=e.right,a=r.box,o=i.box,s=null,c=null,l=0;if(i.object===void 0){let e=i.left,t=i.right,n=Ft(i.box),o=n-It(a,e.box),u=n-It(a,t.box);o>u?o>0&&(s=r,c=t,l=o):u>0&&(s=r,c=e,l=u)}if(r.object===void 0){let e=r.left,t=r.right,n=Ft(r.box),a=n-It(o,e.box),u=n-It(o,t.box);a>u?a>l&&(s=i,c=t):u>l&&(s=i,c=e)}s!==null&&this.swap(s,c)}}swap(e,t){let n=e.parent,r=t.parent,i=r.box;n.left===e?n.left=t:n.right=t,r.left===t?r.left=e:r.right=e,e.parent=r,t.parent=n,At(r.left.box,r.right.box,i)}},Ht=class{constructor(e,t){this.coordinateSystem=t,this.array=e?new Float64Array(24):new Float32Array(24)}setFromProjectionMatrix(e){if(this.updatePlane(0,e[3]+e[0],e[7]+e[4],e[11]+e[8],e[15]+e[12]),this.updatePlane(1,e[3]-e[0],e[7]-e[4],e[11]-e[8],e[15]-e[12]),this.updatePlane(2,e[3]-e[1],e[7]-e[5],e[11]-e[9],e[15]-e[13]),this.updatePlane(3,e[3]+e[1],e[7]+e[5],e[11]+e[9],e[15]+e[13]),this.updatePlane(4,e[3]-e[2],e[7]-e[6],e[11]-e[10],e[15]-e[14]),this.coordinateSystem===0)this.updatePlane(5,e[3]+e[2],e[7]+e[6],e[11]+e[10],e[15]+e[14]);else if(this.coordinateSystem===1)this.updatePlane(5,e[2],e[6],e[10],e[14]);else throw Error(`Invalid coordinate system: `+this.coordinateSystem);return this}updatePlane(e,t,n,r,i){let a=this.array,o=e*4,s=Math.sqrt(t*t+n*n+r*r);a[o+0]=t/s,a[o+1]=n/s,a[o+2]=r/s,a[o+3]=i/s}intersectsBoxMask(e,t){let n=this.array,r,i,a,o,s,c;for(let l=0;l<6;l++){if(!(t&32>>l))continue;let u=l*4,d=n[u+0],f=n[u+1],p=n[u+2],m=n[u+3];if(d>0?(r=e[1],o=e[0]):(r=e[0],o=e[1]),f>0?(i=e[3],s=e[2]):(i=e[2],s=e[3]),p>0?(a=e[5],c=e[4]):(a=e[4],c=e[5]),d*r+f*i+p*a<-m)return-1;d*o+f*s+p*c>-m&&(t^=32>>l)}return t}isIntersected(e,t){let n=this.array;for(let r=0;r<6;r++){if(!(t&32>>r))continue;let i=r*4,a=n[i+0],o=n[i+1],s=n[i+2],c=n[i+3],l=a>0?e[1]:e[0],u=o>0?e[3]:e[2],d=s>0?e[5]:e[4];if(a*l+o*u+s*d<-c)return!1}return!0}isIntersectedMargin(e,t,n){if(t===0)return!0;let r=this.array;for(let i=0;i<6;i++){if(!(t&32>>i))continue;let a=i*4,o=r[a+0],s=r[a+1],c=r[a+2],l=r[a+3],u=o>0?e[1]-n:e[0]+n,d=s>0?e[3]-n:e[2]+n,f=c>0?e[5]-n:e[4]+n;if(o*u+s*d+c*f<-l)return!1}return!0}};function Ut(e,t,n,r,i,a){let o=r[0],s=t[0],c=n[0],l=(e[o]-s)*c,u=(e[o^1]-s)*c,d=l>0?l:0,f=u<1/0?u:1/0;return o=r[1],s=t[1],c=n[1],l=(e[o+2]-s)*c,l>f||(u=(e[o^3]-s)*c,d>u)||(d=l>d?l:d,f=u<f?u:f,o=r[2],s=t[2],c=n[2],l=(e[o+4]-s)*c,l>f)||(u=(e[o^5]-s)*c,d>u)?!1:(d=l>d?l:d,f=u<f?u:f,d<=a&&f>=i)}function Wt(e,t){return e[1]>=t[0]&&t[1]>=e[0]&&e[3]>=t[2]&&t[3]>=e[2]&&e[5]>=t[4]&&t[5]>=e[4]}function Gt(e,t,n){return Rt(n,e)<=t*t}var Kt=class{constructor(e,t=0){this._sign=new Uint8Array(3),this.builder=e;let n=e.highPrecision;this.frustum=new Ht(n,t),this._dirInv=n?new Float64Array(3):new Float32Array(3)}get root(){return this.builder.root}createFromArray(e,t,n,r){e?.length>0&&this.builder.createFromArray(e,t,n,r)}insert(e,t,n){return this.builder.insert(e,t,n)}insertRange(e,t,n,r){e?.length>0&&this.builder.insertRange(e,t,n,r)}move(e,t){this.builder.move(e,t)}delete(e){return this.builder.delete(e)}clear(){this.builder.clear()}traverse(e){if(this.root===null)return;t(this.root,0);function t(n,r){if(n.object!==void 0){e(n,r);return}e(n,r)||(t(n.left,r+1),t(n.right,r+1))}}intersectsRay(e,t,n,r=0,i=1/0){if(this.root===null)return!1;let a=this._dirInv,o=this._sign;return a[0]=1/e[0],a[1]=1/e[1],a[2]=1/e[2],o[0]=+(a[0]<0),o[1]=+(a[1]<0),o[2]=+(a[2]<0),s(this.root);function s(e){return Ut(e.box,t,a,o,r,i)?e.object===void 0?s(e.left)||s(e.right):n(e.object):!1}}intersectsBox(e,t){return this.root!==null&&n(this.root);function n(r){return Wt(e,r.box)?r.object===void 0?n(r.left)||n(r.right):t(r.object):!1}}intersectsSphere(e,t,n){return this.root!==null&&r(this.root);function r(i){return Gt(e,t,i.box)?i.object===void 0?r(i.left)||r(i.right):n(i.object):!1}}isNodeIntersected(e,t){let n=e.box,r;for(;r=e.parent;){if(i(r.left===e?r.right:r.left))return!0;e=r}return!1;function i(e){return Wt(n,e.box)?e.object===void 0?i(e.left)||i(e.right):t(e.object):!1}}rayIntersections(e,t,n,r=0,i=1/0){if(this.root===null)return;let a=this._dirInv,o=this._sign;a[0]=1/e[0],a[1]=1/e[1],a[2]=1/e[2],o[0]=+(a[0]<0),o[1]=+(a[1]<0),o[2]=+(a[2]<0),s(this.root);function s(e){if(Ut(e.box,t,a,o,r,i)){if(e.object!==void 0){n(e.object);return}s(e.left),s(e.right)}}}frustumCulling(e,t){if(this.root===null)return;let n=this.frustum.setFromProjectionMatrix(e);r(this.root,63);function r(e,a){if(e.object!==void 0){n.isIntersected(e.box,a)&&t(e,n,a);return}if(a=n.intersectsBoxMask(e.box,a),!(a<0)){if(a===0){i(e.left),i(e.right);return}r(e.left,a),r(e.right,a)}}function i(e){if(e.object!==void 0){t(e,n,0);return}i(e.left),i(e.right)}}frustumCullingLOD(e,t,n,r){if(this.root===null)return;let i=this.frustum.setFromProjectionMatrix(e);a(this.root,63,null);function a(e,t,n){let c=e.box;if(n===null&&(n=s(c)),e.object!==void 0){i.isIntersected(c,t)&&r(e,n,i,t);return}if(t=i.intersectsBoxMask(c,t),!(t<0)){if(t===0){o(e.left,n),o(e.right,n);return}a(e.left,t,n),a(e.right,t,n)}}function o(e,t){if(t===null&&(t=s(e.box)),e.object!==void 0){r(e,t,i,0);return}o(e.left,t),o(e.right,t)}function s(e){let{min:r,max:i}=zt(e,t);for(let e=n.length-1;e>0;e--)if(i>=n[e])return r>=n[e]?e:null;return 0}}closestPointToPoint(e,t){if(this.root===null)return;let n=1/0;return r(this.root),Math.sqrt(n);function r(i){if(i.object!==void 0){if(t){let r=t(i.object)??Rt(i.box,e);r<n&&(n=r)}else n=Rt(i.box,e);return}let a=Rt(i.left.box,e),o=Rt(i.right.box,e);a<o?a<n&&(r(i.left),o<n&&r(i.right)):o<n&&(r(i.right),a<n&&r(i.left))}}};function qt(e,t){return t[0]=e.x,t[1]=e.y,t[2]=e.z,t}function Jt(e,t){let n=e.min,r=e.max;return t[0]=n.x,t[1]=r.x,t[2]=n.y,t[3]=r.y,t[4]=n.z,t[5]=r.z,t}var Yt=class{constructor(e,t,n){if(this.isInstanceEntity=!0,this.position=new H,this.scale=new H(1,1,1),this.quaternion=new te,this.id=t,this.owner=e,n){let e=this.quaternion,t=this.rotation=new Te;t._onChange(()=>e.setFromEuler(t,!1)),e._onChange(()=>t.setFromQuaternion(e,void 0,!1))}}get visible(){return this.owner.getVisibilityAt(this.id)}set visible(e){this.owner.setVisibilityAt(this.id,e)}get active(){return this.owner.getActiveAt(this.id)}set active(e){this.owner.setActiveAt(this.id,e)}get color(){return this.owner.getColorAt(this.id)}set color(e){this.owner.setColorAt(this.id,e)}get opacity(){return this.owner.getOpacityAt(this.id)}set opacity(e){this.owner.setOpacityAt(this.id,e)}get morph(){return this.owner.getMorphAt(this.id)}set morph(e){this.owner.setMorphAt(this.id,e)}get matrix(){return this.owner.getMatrixAt(this.id)}get matrixWorld(){return this.matrix.premultiply(this.owner.matrixWorld)}setMatrixIdentity(){let e=this.owner,t=e.matricesTexture._data,n=this.id,r=n*16;t[r+0]=1,t[r+1]=0,t[r+2]=0,t[r+3]=0,t[r+4]=0,t[r+5]=1,t[r+6]=0,t[r+7]=0,t[r+8]=0,t[r+9]=0,t[r+10]=1,t[r+11]=0,t[r+12]=0,t[r+13]=0,t[r+14]=0,t[r+15]=1,e.matricesTexture.enqueueUpdate(n)}updateMatrix(){let e=this.owner,t=this.position,n=this.quaternion,r=this.scale,i=e.matricesTexture._data,a=this.id,o=a*16,s=n._x,c=n._y,l=n._z,u=n._w,d=s+s,f=c+c,p=l+l,m=s*d,h=s*f,g=s*p,_=c*f,v=c*p,y=l*p,b=u*d,x=u*f,S=u*p,C=r.x,w=r.y,T=r.z;i[o+0]=(1-(_+y))*C,i[o+1]=(h+S)*C,i[o+2]=(g-x)*C,i[o+3]=0,i[o+4]=(h-S)*w,i[o+5]=(1-(m+y))*w,i[o+6]=(v+b)*w,i[o+7]=0,i[o+8]=(g+x)*T,i[o+9]=(v-b)*T,i[o+10]=(1-(m+_))*T,i[o+11]=0,i[o+12]=t.x,i[o+13]=t.y,i[o+14]=t.z,i[o+15]=1,e.matricesTexture.enqueueUpdate(a),e.bvh&&e.autoUpdateBVH&&e.bvh.move(a)}updateMatrixPosition(){let e=this.owner,t=this.position,n=e.matricesTexture._data,r=this.id,i=r*16;n[i+12]=t.x,n[i+13]=t.y,n[i+14]=t.z,e.matricesTexture.enqueueUpdate(r),e.bvh&&e.autoUpdateBVH&&e.bvh.move(r)}getUniform(e,t){return this.owner.getUniformAt(this.id,e,t)}updateBones(e=!0,t){this.owner.setBonesAt(this.id,e,t)}setUniform(e,t){this.owner.setUniformAt(this.id,e,t)}copyTo(e){e.position.copy(this.position),e.scale.copy(this.scale),e.quaternion.copy(this.quaternion),this.rotation&&e.rotation.copy(this.rotation)}applyMatrix4(e){return this.matrix.premultiply(e).decompose(this.position,this.quaternion,this.scale),this}applyQuaternion(e){return this.quaternion.premultiply(e),this}rotateOnAxis(e,t){return Xt.setFromAxisAngle(e,t),this.quaternion.multiply(Xt),this}rotateOnWorldAxis(e,t){return Xt.setFromAxisAngle(e,t),this.quaternion.premultiply(Xt),this}rotateX(e){return this.rotateOnAxis(Qt,e)}rotateY(e){return this.rotateOnAxis($t,e)}rotateZ(e){return this.rotateOnAxis(en,e)}translateOnAxis(e,t){return Zt.copy(e).applyQuaternion(this.quaternion),this.position.add(Zt.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Qt,e)}translateY(e){return this.translateOnAxis($t,e)}translateZ(e){return this.translateOnAxis(en,e)}remove(){return this.owner.removeInstances(this.id),this}},Xt=new te,Zt=new H,Qt=new H(1,0,0),$t=new H(0,1,0),en=new H(0,0,1),tn=class{constructor(e,t=0,n=!1,r=!0){this.nodesMap=new Map,this.LODsMap=new Map,this._geoBoundingSphere=null,this._sphereTarget=null,this.target=e,this.accurateCulling=r,this._margin=t;let i=e._geometry;if(i.boundingBox||i.computeBoundingBox(),this.geoBoundingBox=i.boundingBox,n){i.boundingSphere||i.computeBoundingSphere();let e=i.boundingSphere.center;e.x===0&&e.y===0&&e.z===0?(this._geoBoundingSphere=i.boundingSphere,this._sphereTarget={centerX:0,centerY:0,centerZ:0,maxScale:0}):(console.warn(`"getBoxFromSphere" is ignored because geometry is not centered.`),n=!1)}this.bvh=new Kt(new Vt,0),this._origin=new Float32Array(3),this._dir=new Float32Array(3),this._cameraPos=new Float32Array(3),this._getBoxFromSphere=n}create(){let e=this.target._instancesCount,t=this.target._instancesArrayCount,n=Array(e),r=new Uint32Array(e),i=0;this.clear();for(let e=0;e<t;e++)this.target.getActiveAt(e)&&(n[i]=this.getBox(e,new Float32Array(6)),r[i]=e,i++);this.bvh.createFromArray(r,n,e=>{this.nodesMap.set(e.object,e)},this._margin)}insert(e){let t=this.bvh.insert(e,this.getBox(e,new Float32Array(6)),this._margin);this.nodesMap.set(e,t)}insertRange(e){let t=e.length,n=Array(t);for(let r=0;r<t;r++)n[r]=this.getBox(e[r],new Float32Array(6));this.bvh.insertRange(e,n,this._margin,e=>{this.nodesMap.set(e.object,e)})}move(e){let t=this.nodesMap.get(e);t&&(this.getBox(e,t.box),this.bvh.move(t,this._margin))}delete(e){let t=this.nodesMap.get(e);t&&(this.bvh.delete(t),this.nodesMap.delete(e))}clear(){this.bvh.clear(),this.nodesMap.clear()}frustumCulling(e,t){this._margin>0&&this.accurateCulling?this.bvh.frustumCulling(e.elements,(e,n,r)=>{n.isIntersectedMargin(e.box,r,this._margin)&&t(e)}):this.bvh.frustumCulling(e.elements,t)}frustumCullingLOD(e,t,n,r){this.LODsMap.has(n)||this.LODsMap.set(n,new Float32Array(n.length));let i=this.LODsMap.get(n);for(let e=0;e<n.length;e++)i[e]=n[e].distance;let a=this._cameraPos;a[0]=t.x,a[1]=t.y,a[2]=t.z,this._margin>0&&this.accurateCulling?this.bvh.frustumCullingLOD(e.elements,a,i,(e,t,n,i)=>{n.isIntersectedMargin(e.box,i,this._margin)&&r(e,t)}):this.bvh.frustumCullingLOD(e.elements,a,i,r)}raycast(e,t){let n=e.ray,r=this._origin,i=this._dir;qt(n.origin,r),qt(n.direction,i),this.bvh.rayIntersections(i,r,t,e.near,e.far)}intersectBox(e,t){this._boxArray||=new Float32Array(6);let n=this._boxArray;return Jt(e,n),this.bvh.intersectsBox(n,t)}getBox(e,t){if(this._getBoxFromSphere){let n=this.target.matricesTexture._data,{centerX:r,centerY:i,centerZ:a,maxScale:o}=this.getSphereFromMatrix_centeredGeometry(e,n,this._sphereTarget),s=this._geoBoundingSphere.radius*o;t[0]=r-s,t[1]=r+s,t[2]=i-s,t[3]=i+s,t[4]=a-s,t[5]=a+s}else nn.copy(this.geoBoundingBox).applyMatrix4(this.target.getMatrixAt(e)),Jt(nn,t);return t}getSphereFromMatrix_centeredGeometry(e,t,n){let r=e*16,i=t[r+0],a=t[r+1],o=t[r+2],s=t[r+4],c=t[r+5],l=t[r+6],u=t[r+8],d=t[r+9],f=t[r+10],p=i*i+a*a+o*o,m=s*s+c*c+l*l,h=u*u+d*d+f*f;return n.maxScale=Math.sqrt(Math.max(p,m,h)),n.centerX=t[r+12],n.centerY=t[r+13],n.centerZ=t[r+14],n}},nn=new I,rn=class extends ne{constructor(e,t,n,r,i,a=1){let o=e.createBuffer();super(o,t,n,r,i.length/n),this.isGLInstancedBufferAttribute=!0,this._needsUpdate=!1,this.isInstancedBufferAttribute=!0,this.meshPerAttribute=a,this.array=i,this._cacheArray=i,e.bindBuffer(e.ARRAY_BUFFER,o),e.bufferData(e.ARRAY_BUFFER,i,e.DYNAMIC_DRAW)}update(e,t){if(!this._needsUpdate||t===0)return;let n=e.getContext();n.bindBuffer(n.ARRAY_BUFFER,this.buffer),this.array===this._cacheArray?n.bufferSubData(n.ARRAY_BUFFER,0,this.array,0,t):(n.bufferData(n.ARRAY_BUFFER,this.array,n.DYNAMIC_DRAW),this._cacheArray=this.array),this._needsUpdate=!1}clone(){return this}},an=null,on=null,sn={};function cn(e){return on.get(e)?.()??an(e)}function ln(e){if(on.has(e))return;let t={};on.set(e,()=>{if(e.isMeshDistanceMaterial){let n=an(e);t.light=n.light}return t})}function un(e,t,n){let r=t.properties;an=r.get;let i=`${!!e.colorsTexture}_${e._useOpacity}_${!!e.boneTexture}_${!!e.uniformsTexture}`;sn[i]??=new WeakMap,on=sn[i],r.get=cn,ln(n)}function dn(e){e.properties.get=an}function fn(e,t){return Math.max(t,Math.ceil(Math.sqrt(e/t))*t)}function pn(e,t,n,r){t===3&&(console.warn(`"channels" cannot be 3. Set to 4. More info: https://github.com/mrdoob/three.js/pull/23228`),t=4);let i=fn(r,n),a=new e(i*i*t),o=e.name.includes(`Float`),s=e.name.includes(`Uint`),c=o?p:s?ce:ie,l;switch(t){case 1:l=o?T:Ee;break;case 2:l=o?C:f;break;case 4:l=o?ye:de}return{array:a,size:i,type:c,format:l}}var mn=class extends o{constructor(e,t,n,r,i,a){t===3&&(t=4);let{array:o,format:s,size:c,type:l}=pn(e,t,n,r);super(o,c,c,s,l),this.partialUpdate=!0,this.maxUpdateCalls=1/0,this._utils=null,this._needsUpdate=!0,this._lastWidth=-1,this._data=o,this._channels=t,this._pixelsPerInstance=n,this._stride=n*t,this._rowToUpdate=Array(c),this._uniformMap=i,this._fetchUniformsInFragmentShader=a,this.needsUpdate=!0}resize(e){let t=fn(e,this._pixelsPerInstance);if(t===this.image.width)return;let n=this._data,r=this._channels;this._rowToUpdate.length=t;let i=n.constructor,a=new i(t*t*r),o=Math.min(n.length,a.length);a.set(new i(n.buffer,0,o)),this.dispose(),this.image={data:a,height:t,width:t},this._data=a}enqueueUpdate(e){if(this._needsUpdate=!0,!this.partialUpdate)return;let t=this.image.width/this._pixelsPerInstance,n=Math.floor(e/t);this._rowToUpdate[n]=!0}bindToProgram(e,t,n,r,i){if(!r[i])return;r[i].value=this;let a=this.getSlot(n,i);if(a===void 0)return;let o=e.properties.get(this);e.state.bindTexture(t.TEXTURE_2D,o.__webglTexture,t.TEXTURE0+a)}update(e,t,n){let r=e.properties.get(this),i=r.__version!==this.version;if(!this._needsUpdate&&!i)return;let a=this._lastWidth!==this.image.width;if(!r.__webglTexture||a)e.initTexture(this);else{let i=this.getSlot(t,n)??e.capabilities.maxTextures-1;this.partialUpdate?this.updatePartial(r,e,i):this.updateFull(r,e,i),r.__version=this.version}this._lastWidth=this.image.width,this._needsUpdate=!1}getSlot(e,t){return e[t]?.cache[0]}updateFull(e,t,n){this.updateRows(e,t,[{row:0,count:this.image.height}],n)}updatePartial(e,t,n){let r=this.getUpdateRowsInfo();r.length!==0&&(r.length>this.maxUpdateCalls?this.updateFull(e,t,n):this.updateRows(e,t,r,n),this._rowToUpdate.fill(!1))}getUpdateRowsInfo(){let e=this._rowToUpdate,t=[];for(let n=0,r=e.length;n<r;n++)if(e[n]){let i=n;for(;n<r&&e[n];n++);t.push({row:i,count:n-i})}return t}updateRows(e,t,n,r){let i=t.getContext();this._utils??=new ke(i,t.extensions,t.capabilities);let a=this._utils.convert(this.format),o=this._utils.convert(this.type),{data:s,width:c}=this.image,l=this._channels;t.state.activeTexture(i.TEXTURE0+r),t.state.bindTexture(i.TEXTURE_2D,e.__webglTexture,i.TEXTURE0+r);let u=Ce.getPrimaries(Ce.workingColorSpace),d=this.colorSpace===``?null:Ce.getPrimaries(this.colorSpace),f=this.colorSpace===``||u===d?i.NONE:i.BROWSER_DEFAULT_WEBGL,p=i.getParameter(i.UNPACK_FLIP_Y_WEBGL),m=i.getParameter(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL),h=i.getParameter(i.UNPACK_ALIGNMENT),g=i.getParameter(i.UNPACK_COLORSPACE_CONVERSION_WEBGL);i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,this.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,this.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,this.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,f);for(let{count:e,row:t}of n)i.texSubImage2D(i.TEXTURE_2D,0,0,t,c,e,a,o,s,t*c*l);i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,p),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,m),i.pixelStorei(i.UNPACK_ALIGNMENT,h),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,g),this.onUpdate?.(this)}setUniformAt(e,t,n){let{offset:r,size:i}=this._uniformMap.get(t),a=this._stride;i===1?this._data[e*a+r]=n:n.toArray(this._data,e*a+r)}getUniformAt(e,t,n){let{offset:r,size:i}=this._uniformMap.get(t),a=this._stride;return i===1?this._data[e*a+r]:n.fromArray(this._data,e*a+r)}getUniformsGLSL(e,t,n){return{vertex:this.getUniformsVertexGLSL(e,t,n),fragment:this.getUniformsFragmentGLSL(e,t,n)}}getUniformsVertexGLSL(e,t,n){if(this._fetchUniformsInFragmentShader)return`
        flat varying ${n} ez_v${t}; 
        void main() {
          ez_v${t} = ${t};`;let r=this.texelsFetchGLSL(e,t),i=this.getFromTexelsGLSL(),{assignVarying:a,declareVarying:o}=this.getVarying();return`
      uniform highp sampler2D ${e};  
      ${o}
      void main() {
        ${r}
        ${i}
        ${a}`}getUniformsFragmentGLSL(e,t,n){if(!this._fetchUniformsInFragmentShader){let{declareVarying:e,getVarying:t}=this.getVarying();return`
      ${e}
      void main() {
        ${t}`}return`
      uniform highp sampler2D ${e};  
      flat varying ${n} ez_v${t};
      void main() {
        ${this.texelsFetchGLSL(e,`ez_v${t}`)}
        ${this.getFromTexelsGLSL()}`}texelsFetchGLSL(e,t){let n=this._pixelsPerInstance,r=`
      int size = textureSize(${e}, 0).x;
      int j = int(${t}) * ${n};
      int x = j % size;
      int y = j / size;
    `;for(let t=0;t<n;t++)r+=`vec4 ez_texel${t} = texelFetch(${e}, ivec2(x + ${t}, y), 0);
`;return r}getFromTexelsGLSL(){let e=this._uniformMap,t=``;for(let[n,{type:r,offset:i,size:a}]of e){let e=Math.floor(i/this._channels);if(r===`mat3`)t+=`mat3 ${n} = mat3(ez_texel${e}.rgb, vec3(ez_texel${e}.a, ez_texel${e+1}.rg), vec3(ez_texel${e+1}.ba, ez_texel${e+2}.r));
`;else if(r===`mat4`)t+=`mat4 ${n} = mat4(ez_texel${e}, ez_texel${e+1}, ez_texel${e+2}, ez_texel${e+3});
`;else{let o=this.getUniformComponents(i,a);t+=`${r} ${n} = ez_texel${e}.${o};
`}}return t}getVarying(){let e=this._uniformMap,t=``,n=``,r=``;for(let[i,{type:a}]of e)t+=`flat varying ${a} ez_v${i};
`,n+=`ez_v${i} = ${i};
`,r+=`${a} ${i} = ez_v${i};
`;return{declareVarying:t,assignVarying:n,getVarying:r}}getUniformComponents(e,t){let n=e%this._channels,r=``;for(let e=0;e<t;e++)r+=hn[n+e];return r}copy(e){return super.copy(e),this.partialUpdate=e.partialUpdate,this.maxUpdateCalls=e.maxUpdateCalls,this._channels=e._channels,this._pixelsPerInstance=e._pixelsPerInstance,this._stride=e._stride,this._rowToUpdate=e._rowToUpdate,this._uniformMap=e._uniformMap,this._fetchUniformsInFragmentShader=e._fetchUniformsInFragmentShader,this}},hn=[`r`,`g`,`b`,`a`],Y=class extends S{constructor(e,t,n={},r){if(!e)throw Error(`"geometry" is mandatory.`);if(!t)throw Error(`"material" is mandatory.`);let{allowsEuler:i,renderer:a,createEntities:o}=n;super(e,null),this.type=`InstancedMesh2`,this.isInstancedMesh2=!0,this.instances=null,this.instanceIndex=null,this.colorsTexture=null,this.morphTexture=null,this.boneTexture=null,this.uniformsTexture=null,this.boundingBox=null,this.boundingSphere=null,this.bvh=null,this.customSort=null,this.raycastOnlyFrustum=!1,this.LODinfo=null,this.autoUpdate=!0,this.bindMode=P,this.bindMatrix=null,this.bindMatrixInverse=null,this.skeleton=null,this.autoUpdateBVH=!0,this.onFrustumEnter=null,this._renderer=null,this._instancesCount=0,this._instancesArrayCount=0,this._perObjectFrustumCulled=!0,this._sortObjects=!1,this._indexArrayNeedsUpdate=!1,this._useOpacity=!1,this._currentMaterial=null,this._customProgramCacheKeyBase=null,this._onBeforeCompileBase=null,this._definesBase=null,this._freeIds=[],this.isInstancedMesh=!0,this.instanceMatrix=new z(new Float32Array,16),this.instanceColor=null,this._customProgramCacheKey=()=>`ez_${!!this.colorsTexture}_${this._useOpacity}_${!!this.boneTexture}_${!!this.uniformsTexture}_${this._customProgramCacheKeyBase.call(this._currentMaterial)}`,this._onBeforeCompile=(e,t)=>{if(this._onBeforeCompileBase&&this._onBeforeCompileBase.call(this._currentMaterial,e,t),e.defines={...e.defines},e.defines.USE_INSTANCING_INDIRECT=``,e.uniforms.matricesTexture={value:this.matricesTexture},this.uniformsTexture){e.uniforms.uniformsTexture={value:this.uniformsTexture};let{vertex:t,fragment:n}=this.uniformsTexture.getUniformsGLSL(`uniformsTexture`,`instanceIndex`,`uint`);e.vertexShader=e.vertexShader.replace(`void main() {`,t),e.fragmentShader=e.fragmentShader.replace(`void main() {`,n)}this.colorsTexture&&e.fragmentShader.includes(`#include <color_pars_fragment>`)&&(e.defines.USE_INSTANCING_COLOR_INDIRECT=``,e.uniforms.colorsTexture={value:this.colorsTexture},e.vertexShader=e.vertexShader.replace(`<color_vertex>`,`<instanced_color_vertex>`),e.vertexColors&&(e.defines.USE_VERTEX_COLOR=``),e.defines.USE_COLOR_ALPHA=``),this.boneTexture&&(e.defines.USE_SKINNING=``,e.defines.USE_INSTANCING_SKINNING=``,e.uniforms.bindMatrix={value:this.bindMatrix},e.uniforms.bindMatrixInverse={value:this.bindMatrixInverse},e.uniforms.bonesPerInstance={value:this.skeleton.bones.length},e.uniforms.boneTexture={value:this.boneTexture})};let s=n.capacity>0?n.capacity:gn;this._renderer=a,this._capacity=s,this._parentLOD=r,this._geometry=e,this.material=t,this._allowsEuler=i??!1,this._tempInstance=new Yt(this,-1,i),this.availabilityArray=r?.availabilityArray??Array(s*2),this._createEntities=o,this.initLastRenderInfo(),this.initIndexAttribute(),this.initMatricesTexture()}get capacity(){return this._capacity}get instancesCount(){return this._instancesCount}get perObjectFrustumCulled(){return this._perObjectFrustumCulled}set perObjectFrustumCulled(e){this._perObjectFrustumCulled=e,this._indexArrayNeedsUpdate=!0}get sortObjects(){return this._sortObjects}set sortObjects(e){this._sortObjects=e,this._indexArrayNeedsUpdate=!0}get geometry(){return this._geometry}set geometry(e){this._geometry=e,this.patchGeometry(e)}onBeforeShadow(e,t,n,r,i,a,o){this.patchMaterial(e,a),this.updateTextures(e,a);let s=e.info.render.frame;this.instanceIndex&&this.autoUpdate&&!this.frustumCullingAlreadyPerformed(s,n,r)&&this.performFrustumCulling(r,n),this.count!==0&&(this.instanceIndex.update(this._renderer,this.count),this.bindTextures(e,a))}onBeforeRender(e,t,n,r,i,a){if(this.patchMaterial(e,i),this.updateTextures(e,i),!this.instanceIndex){this._renderer=e;return}let o=e.info.render.frame;this.autoUpdate&&!this.frustumCullingAlreadyPerformed(o,n,null)&&this.performFrustumCulling(n),this.count!==0&&(this.instanceIndex.update(this._renderer,this.count),this.bindTextures(e,i))}onAfterShadow(e,t,n,r,i,a,o){this.unpatchMaterial(e,a)}onAfterRender(e,t,n,r,i,a){this.unpatchMaterial(e,i),!(this.instanceIndex||a&&!this.isLastGroup(a.materialIndex))&&this.initIndexAttribute()}updateTextures(e,t){let n=e.properties.get(t);this.matricesTexture.update(e,n,`matricesTexture`),this.colorsTexture?.update(e,n,`colorsTexture`),this.uniformsTexture?.update(e,n,`uniformsTexture`),this.boneTexture?.update(e,n,`boneTexture`)}bindTextures(e,t){let n=e.properties.get(t),r=n.uniforms;if(!r)return;let i=n.currentProgram,a=i?.program;if(!a)return;let o=e.getContext(),s=i.getUniforms().map,c=o.getParameter(o.CURRENT_PROGRAM);e.state.useProgram(a),this.matricesTexture.bindToProgram(e,o,s,r,`matricesTexture`),this.colorsTexture?.bindToProgram(e,o,s,r,`colorsTexture`),this.uniformsTexture?.bindToProgram(e,o,s,r,`uniformsTexture`),this.boneTexture?.bindToProgram(e,o,s,r,`boneTexture`),e.state.useProgram(c)}isLastGroup(e){let t=this.material;for(let n=t.length-1;n>=e;n--)if(t[n].visible)return n===e}initIndexAttribute(){if(!this._renderer){this.count=0;return}let e=this._renderer.getContext(),t=this._capacity,n=new Uint32Array(t);for(let e=0;e<t;e++)n[e]=e;this.instanceIndex=new rn(e,e.UNSIGNED_INT,1,4,n),this._geometry.setAttribute(`instanceIndex`,this.instanceIndex)}initLastRenderInfo(){this._parentLOD||(this._lastRenderInfo={frame:-1,camera:null,shadowCamera:null})}initMatricesTexture(){this._parentLOD||(this.matricesTexture=new mn(Float32Array,4,4,this._capacity))}initColorsTexture(){this._parentLOD||(this.colorsTexture=new mn(Float32Array,4,1,this._capacity),this.colorsTexture.colorSpace=Ce.workingColorSpace,this.colorsTexture._data.fill(1),this.materialsNeedsUpdate())}materialsNeedsUpdate(){if(this.material.isMaterial){this.material.needsUpdate=!0;return}for(let e of this.material)e.needsUpdate=!0}patchGeometry(e){let t=e.getAttribute(`instanceIndex`);if(t){if(t===this.instanceIndex)return;console.warn(`The geometry has been cloned because it was already used.`),e=e.clone(),e.deleteAttribute(`instanceIndex`)}this.instanceIndex&&e.setAttribute(`instanceIndex`,this.instanceIndex)}patchMaterial(e,t){this._currentMaterial=t,this._customProgramCacheKeyBase=t.customProgramCacheKey,this._onBeforeCompileBase=t.onBeforeCompile,this._definesBase=t.defines,t.customProgramCacheKey=this._customProgramCacheKey,t.onBeforeCompile=this._onBeforeCompile,un(this,e,t)}unpatchMaterial(e,t){this._currentMaterial=null,dn(e),t.defines=this._definesBase,t.onBeforeCompile=this._onBeforeCompileBase,t.customProgramCacheKey=this._customProgramCacheKeyBase,this._onBeforeCompileBase=null,this._customProgramCacheKeyBase=null,this._definesBase=null}computeBVH(e={}){this.bvh||=new tn(this,e.margin,e.getBBoxFromBSphere,e.accurateCulling),this.bvh.clear(),this.bvh.create()}disposeBVH(){this.bvh=null}setMatrixAt(e,t){if(t.toArray(this.matricesTexture._data,e*16),this.instances){let n=this.instances[e];t.decompose(n.position,n.quaternion,n.scale)}this.matricesTexture.enqueueUpdate(e),this.bvh&&this.autoUpdateBVH&&this.bvh.move(e)}getMatrixAt(e,t=yn){return t.fromArray(this.matricesTexture._data,e*16)}getPositionAt(e,t=xn){let n=e*16,r=this.matricesTexture._data;return t.x=r[n+12],t.y=r[n+13],t.z=r[n+14],t}getPositionAndMaxScaleOnAxisAt(e,t){let n=e*16,r=this.matricesTexture._data,i=r[n+0],a=r[n+1],o=r[n+2],s=i*i+a*a+o*o,c=r[n+4],l=r[n+5],u=r[n+6],d=c*c+l*l+u*u,f=r[n+8],p=r[n+9],m=r[n+10],h=f*f+p*p+m*m;return t.x=r[n+12],t.y=r[n+13],t.z=r[n+14],Math.sqrt(Math.max(s,d,h))}applyMatrixAtToSphere(e,t,n,r){let i=e*16,a=this.matricesTexture._data,o=a[i+0],s=a[i+1],c=a[i+2],l=a[i+3],u=a[i+4],d=a[i+5],f=a[i+6],p=a[i+7],m=a[i+8],h=a[i+9],g=a[i+10],_=a[i+11],v=a[i+12],y=a[i+13],b=a[i+14],x=a[i+15],S=t.center,C=n.x,w=n.y,T=n.z,E=1/(l*C+p*w+_*T+x);S.x=(o*C+u*w+m*T+v)*E,S.y=(s*C+d*w+h*T+y)*E,S.z=(c*C+f*w+g*T+b)*E;let D=o*o+s*s+c*c,O=u*u+d*d+f*f,ee=m*m+h*h+g*g;t.radius=r*Math.sqrt(Math.max(D,O,ee))}setVisibilityAt(e,t){this.availabilityArray[e*2]=t,this._indexArrayNeedsUpdate=!0}getVisibilityAt(e){return this.availabilityArray[e*2]}setActiveAt(e,t){this.availabilityArray[e*2+1]=t,this._indexArrayNeedsUpdate=!0}getActiveAt(e){return this.availabilityArray[e*2+1]}getActiveAndVisibilityAt(e){let t=e*2,n=this.availabilityArray;return n[t]&&n[t+1]}setActiveAndVisibilityAt(e,t){let n=e*2,r=this.availabilityArray;r[n]=t,r[n+1]=t,this._indexArrayNeedsUpdate=!0}setColorAt(e,t){this.colorsTexture===null&&this.initColorsTexture(),t.isColor?t.toArray(this.colorsTexture._data,e*4):bn.set(t).toArray(this.colorsTexture._data,e*4),this.colorsTexture.enqueueUpdate(e)}getColorAt(e,t=bn){return t.fromArray(this.colorsTexture._data,e*4)}setOpacityAt(e,t){this._useOpacity||=(this.colorsTexture===null?this.initColorsTexture():this.materialsNeedsUpdate(),!0),this.colorsTexture._data[e*4+3]=t,this.colorsTexture.enqueueUpdate(e)}getOpacityAt(e){return this._useOpacity?this.colorsTexture._data[e*4+3]:1}copyTo(e,t){this.getMatrixAt(e,t.matrix).decompose(t.position,t.quaternion,t.scale)}computeBoundingBox(){let e=this._geometry,t=this._instancesArrayCount;this.boundingBox??=new I,e.boundingBox===null&&e.computeBoundingBox();let n=e.boundingBox,r=this.boundingBox;r.makeEmpty();for(let e=0;e<t;e++)this.getActiveAt(e)&&(_n.copy(n).applyMatrix4(this.getMatrixAt(e)),r.union(_n))}computeBoundingSphere(){let e=this._geometry,t=this._instancesArrayCount;this.boundingSphere??=new L,e.boundingSphere===null&&e.computeBoundingSphere();let n=e.boundingSphere,r=this.boundingSphere;r.makeEmpty();for(let e=0;e<t;e++)this.getActiveAt(e)&&(vn.copy(n).applyMatrix4(this.getMatrixAt(e)),r.union(vn))}clone(e){let t={capacity:this._capacity,renderer:this._renderer,allowsEuler:this._allowsEuler,createEntities:this._createEntities};return new this.constructor(this.geometry,this.material,t).copy(this,e)}copy(e,t){return super.copy(e,t),this.count=e._capacity,this._instancesCount=e._instancesCount,this._instancesArrayCount=e._instancesArrayCount,this._capacity=e._capacity,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this.matricesTexture=e.matricesTexture.clone(),this.matricesTexture.image.data=this.matricesTexture.image.data.slice(),e.colorsTexture!==null&&(this.colorsTexture=e.colorsTexture.clone(),this.colorsTexture.image.data=this.colorsTexture.image.data.slice()),e.uniformsTexture!==null&&(this.uniformsTexture=e.uniformsTexture.clone(),this.uniformsTexture.image.data=this.uniformsTexture.image.data.slice()),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone(),this.morphTexture.image.data=this.morphTexture.image.data.slice()),e.boneTexture!==null&&(this.boneTexture=e.boneTexture.clone(),this.boneTexture.image.data=this.boneTexture.image.data.slice()),this}dispose(){this.dispatchEvent({type:`dispose`}),this.matricesTexture.dispose(),this.colorsTexture?.dispose(),this.morphTexture?.dispose(),this.boneTexture?.dispose(),this.uniformsTexture?.dispose()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMatrixInverse&&(this.bindMode===`attached`?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode===`detached`?this.bindMatrixInverse.copy(this.bindMatrix).invert():console.warn(`Unrecognized bindMode: `+this.bindMode))}},gn=1e3,_n=new I,vn=new L,yn=new d,bn=new V,xn=new H;Y.prototype.resizeBuffers=function(e){let t=this._capacity;this._capacity=e;let n=Math.min(e,t);if(this.instanceIndex){let t=new Uint32Array(e);t.set(new Uint32Array(this.instanceIndex.array.buffer,0,n)),this.instanceIndex.array=t}if(this.LODinfo){for(let t of this.LODinfo.objects)if(t._capacity=e,t.instanceIndex){let r=new Uint32Array(e);r.set(new Uint32Array(t.instanceIndex.array.buffer,0,n)),t.instanceIndex.array=r}}if(this.availabilityArray.length=e*2,this.matricesTexture.resize(e),this.colorsTexture&&(this.colorsTexture.resize(e),e>t&&this.colorsTexture._data.fill(1,t*4)),this.morphTexture){let n=this.morphTexture.image.data,r=n.length/t;this.morphTexture.dispose(),this.morphTexture=new o(new Float32Array(r*e),r,e,T,p),this.morphTexture.image.data.set(n)}return this.uniformsTexture?.resize(e),this},Y.prototype.setInstancesArrayCount=function(e){if(e<this._instancesArrayCount){let t=this.bvh;if(t)for(let n=this._instancesArrayCount-1;n>=e;n--)this.getActiveAt(n)&&t.delete(n);this._instancesArrayCount=e;return}if(e>this._capacity){let t=this._capacity+(this._capacity>>1)+512;for(;t<e;)t+=(t>>1)+512;this.resizeBuffers(t)}let t=this._instancesArrayCount;this._instancesArrayCount=e,this._createEntities&&this.createEntities(t)};function Sn(e,t){return e.depth-t.depth}function Cn(e,t){return t.depth-e.depth}var wn=class{constructor(){this.array=[],this.pool=[]}push(e,t){let n=this.pool,r=this.array,i=r.length;i>=n.length&&n.push({depth:null,index:null,depthSort:null});let a=n[i];a.depth=e,a.index=t,r.push(a)}reset(){this.array.length=0}},Tn=new h,X=new wn,En=new d,Dn=new d,On=new H,kn=new H,An=new H,jn=new H,Z=new L;Y.prototype.performFrustumCulling=function(e,t=e){let n=this._parentLOD??this,r=n.LODinfo,i;if(r){i=e===t?r.render:r.shadowRender??r.render;for(let e of r.objects)e.count=0}else(n._perObjectFrustumCulled||n._sortObjects)&&(n.count=0);n._instancesArrayCount!==0&&(i?.levels.length>0?n.frustumCullingLOD(i,e,t):n.frustumCulling(e))},Y.prototype.updateLastRenderInfo=function(e,t,n){let r=this._lastRenderInfo;r.frame=e,r.camera=t,r.shadowCamera=n},Y.prototype.frustumCullingAlreadyPerformed=function(e,t,n){let r=this._lastRenderInfo;return r.frame===e&&r.camera===t&&r.shadowCamera===n||(this.updateLastRenderInfo(e,t,n),!1)},Y.prototype.frustumCulling=function(e){let t=this._sortObjects,n=this._perObjectFrustumCulled,r=this.instanceIndex.array;if(this.instanceIndex._needsUpdate=!0,!n&&!t){this.updateIndexArray();return}if(t&&(Dn.copy(this.matrixWorld).invert(),kn.setFromMatrixPosition(e.matrixWorld).applyMatrix4(Dn),On.set(0,0,-1).transformDirection(e.matrixWorld).transformDirection(Dn)),n?(En.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse).multiply(this.matrixWorld),this.bvh?this.BVHCulling(e):this.linearCulling(e)):this.updateRenderList(),t){let e=this.customSort;e===null?X.array.sort(this.material?.transparent?Cn:Sn):e(X.array);let t=X.array,n=t.length;for(let e=0;e<n;e++)r[e]=t[e].index;this.count=n,X.reset()}},Y.prototype.updateIndexArray=function(){if(!this._indexArrayNeedsUpdate)return;let e=this.instanceIndex.array,t=this._instancesArrayCount,n=0;for(let r=0;r<t;r++)this.getActiveAndVisibilityAt(r)&&(e[n++]=r);this.count=n,this._indexArrayNeedsUpdate=!1},Y.prototype.updateRenderList=function(){let e=this._instancesArrayCount;for(let t=0;t<e;t++)if(this.getActiveAndVisibilityAt(t)){let e=this.getPositionAt(t).sub(kn).dot(On);X.push(e,t)}},Y.prototype.BVHCulling=function(e){let t=this.instanceIndex.array,n=this._instancesArrayCount,r=this._sortObjects,i=this.onFrustumEnter,a=0;this.bvh.frustumCulling(En,o=>{let s=o.object;if(s<n&&this.getVisibilityAt(s)&&(!i||i(s,e))){if(r){let e=this.getPositionAt(s).sub(kn).dot(On);X.push(e,s)}else t[a++]=s}}),this.count=a},Y.prototype.linearCulling=function(e){let t=this.instanceIndex.array;this.geometry.boundingSphere||this.geometry.computeBoundingSphere();let n=this._geometry.boundingSphere,r=n.radius,i=n.center,a=this._instancesArrayCount,o=i.x===0&&i.y===0&&i.z===0,s=this._sortObjects,c=this.onFrustumEnter,l=0;Tn.setFromProjectionMatrix(En);for(let n=0;n<a;n++)if(this.getActiveAndVisibilityAt(n)&&(o?Z.radius=r*this.getPositionAndMaxScaleOnAxisAt(n,Z.center):this.applyMatrixAtToSphere(n,Z,i,r),Tn.intersectsSphere(Z)&&(!c||c(n,e)))){if(s){let e=jn.subVectors(Z.center,kn).dot(On);X.push(e,n)}else t[l++]=n}this.count=l},Y.prototype.frustumCullingLOD=function(e,t,n){let{count:r,levels:i}=e;for(let e=0;e<i.length;e++){if(!i[e].object.instanceIndex)return;r[e]=0,i[e].object.instanceIndex._needsUpdate=!0}let a=t===n&&this._sortObjects;En.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse).multiply(this.matrixWorld),Dn.copy(this.matrixWorld).invert(),kn.setFromMatrixPosition(t.matrixWorld).applyMatrix4(Dn),An.setFromMatrixPosition(n.matrixWorld).applyMatrix4(Dn);let o=e.levels.map(e=>e.object.instanceIndex.array);if(this.bvh?this.BVHCullingLOD(e,o,a,t,n):this.linearCullingLOD(e,o,a,t,n),a){let e=this.customSort,t=X.array,n=0,a=i[1].distance;e===null?t.sort(i[0].object.material?.transparent?Cn:Sn):e(t);for(let e=0,s=t.length;e<s;e++){let s=t[e];s.depth>a&&(n++,a=i[n+1]?.distance??1/0),o[n][r[n]++]=s.index}X.reset()}for(let e=0;e<i.length;e++){let t=i[e].object;t.count=r[e]}},Y.prototype.BVHCullingLOD=function(e,t,n,r,i){let{count:a,levels:o}=e,s=this._instancesArrayCount,c=this.onFrustumEnter;n?this.bvh.frustumCulling(En,e=>{let t=e.object;if(t<s&&this.getVisibilityAt(t)&&(!c||c(t,r,i))){let e=this.getPositionAt(t).distanceToSquared(An);X.push(e,t)}}):this.bvh.frustumCullingLOD(En,An,o,(e,n)=>{let l=e.object;if(l<s&&this.getVisibilityAt(l)){if(n===null){let e=this.getPositionAt(l).distanceToSquared(An);n=this.getObjectLODIndexForDistance(o,e)}(!c||c(l,r,i,n))&&(t[n][a[n]++]=l)}})},Y.prototype.linearCullingLOD=function(e,t,n,r,i){let{count:a,levels:o}=e;this.geometry.boundingSphere||this.geometry.computeBoundingSphere();let s=this._geometry.boundingSphere,c=s.radius,l=s.center,u=this._instancesArrayCount,d=l.x===0&&l.y===0&&l.z===0,f=this.onFrustumEnter;Tn.setFromProjectionMatrix(En);for(let e=0;e<u;e++)if(this.getActiveAndVisibilityAt(e)&&(d?Z.radius=c*this.getPositionAndMaxScaleOnAxisAt(e,Z.center):this.applyMatrixAtToSphere(e,Z,l,c),Tn.intersectsSphere(Z))){if(n){if(!f||f(e,r,i)){let t=Z.center.distanceToSquared(An);X.push(t,e)}}else{let n=Z.center.distanceToSquared(An),s=this.getObjectLODIndexForDistance(o,n);(!f||f(e,r,i,s))&&(t[s][a[s]++]=e)}}},Y.prototype.clearTempInstance=function(e){let t=this._tempInstance;return t.id=e,this.clearInstance(t)},Y.prototype.clearTempInstancePosition=function(e){let t=this._tempInstance;return t.id=e,t.position.set(0,0,0),t},Y.prototype.clearInstance=function(e){return e.position.set(0,0,0),e.scale.set(1,1,1),e.quaternion.identity(),e},Y.prototype.updateInstances=function(e){let t=this._instancesArrayCount,n=this.instances;for(let r=0;r<t;r++){if(!this.getActiveAt(r))continue;let t=n?n[r]:this.clearTempInstance(r);e(t,r),t.updateMatrix()}return this},Y.prototype.updateInstancesPosition=function(e){let t=this._instancesArrayCount,n=this.instances;for(let r=0;r<t;r++){if(!this.getActiveAt(r))continue;let t=n?n[r]:this.clearTempInstancePosition(r);e(t,r),t.updateMatrixPosition()}return this},Y.prototype.createEntities=function(e){let t=this._instancesArrayCount;if(!this.instances)this.instances=Array(t);else if(this.instances.length<t)this.instances.length=t;else return this;let n=this.instances;for(let r=e;r<t;r++)n[r]||(n[r]=new Yt(this,r,this._allowsEuler));return this},Y.prototype.addInstances=function(e,t){!t&&this.bvh&&console.warn("InstancedMesh2: if `computeBVH()` has already been called, it is better to valorize the instances in the `onCreation` callback for better performance.");let n=this._freeIds;if(n.length>0){let r=-1,i=Math.min(n.length,e),a=n.length-i;for(let e=n.length-1;e>=a;e--){let i=n[e];i>r&&(r=i),this.addInstance(i,t)}n.length-=i,e-=i,this._instancesArrayCount=Math.max(r+1,this._instancesArrayCount)}let r=this._instancesArrayCount,i=r+e;this.setInstancesArrayCount(i);for(let e=r;e<i;e++)this.addInstance(e,t);return this},Y.prototype.addInstance=function(e,t){this._instancesCount++,this.setActiveAndVisibilityAt(e,!0);let n=this.instances?this.clearInstance(this.instances[e]):this.clearTempInstance(e);t?(t(n,e),n.updateMatrix()):n.setMatrixIdentity(),this.bvh?.insert(e)},Y.prototype.removeInstances=function(...e){let t=this._freeIds,n=this.bvh;for(let r of e)r<this._instancesArrayCount&&this.getActiveAt(r)&&(this.setActiveAt(r,!1),t.push(r),n?.delete(r),this._instancesCount--);for(let e=this._instancesArrayCount-1;e>=0&&!this.getActiveAt(e);e--)this._instancesArrayCount--;return this},Y.prototype.clearInstances=function(){if(this._instancesCount=0,this._instancesArrayCount=0,this._freeIds.length=0,this.bvh?.clear(),this.LODinfo)for(let e of this.LODinfo.objects)e.count=0;return this},Y.prototype.getObjectLODIndexForDistance=function(e,t){for(let n=e.length-1;n>0;n--){let r=e[n];if(t>=r.distance-r.distance*r.hysteresis)return n}return 0},Y.prototype.setFirstLODDistance=function(e){if(this._parentLOD)throw Error(`Cannot create LOD for this InstancedMesh2.`);return this.LODinfo||={render:null,shadowRender:null,objects:[this]},this.LODinfo.render||(this.LODinfo.render={levels:[{distance:e,hysteresis:0,object:this}],count:[0]}),this},Y.prototype.addLOD=function(e,t,n=0,r=0){if(this._parentLOD)throw Error(`Cannot create LOD for this InstancedMesh2.`);if(!this.LODinfo?.render&&n===0)throw Error(`Cannot set distance to 0 for the first LOD. Call "setFirstLODDistance" method before use "addLOD".`);return this.setFirstLODDistance(0),this.addLevel(this.LODinfo.render,e,t,n,r),this},Y.prototype.addShadowLOD=function(e,t=0,n=0){if(this._parentLOD)throw Error(`Cannot create LOD for this InstancedMesh2.`);this.LODinfo||={render:null,shadowRender:null,objects:[this]},this.LODinfo.shadowRender||(this.LODinfo.shadowRender={levels:[],count:[]});let r=this.addLevel(this.LODinfo.shadowRender,e,null,t,n);return r.castShadow=!0,this.castShadow=!0,this},Y.prototype.addLevel=function(e,t,n,r,i){let a=this.LODinfo.objects,o=e.levels,s,c;r**=2;let l=a.findIndex(e=>e.geometry===t);if(l===-1){let e={capacity:this._capacity,renderer:this._renderer};c=new Y(t,n??new j,e,this),c.frustumCulled=!1,this.patchLevel(c),a.push(c),this.add(c)}else c=a[l],n&&(c.material=n);for(s=0;s<o.length&&!(r<o[s].distance);s++);return o.splice(s,0,{distance:r,hysteresis:i,object:c}),e.count.push(0),c},Y.prototype.updateLevel=function(e,t,n,r){if(!e)throw Error(`Render list is invalid.`);let i=e.levels[t];if(!i)throw Error(`Cannot update an empty LOD.`);return n!=null&&!Number.isNaN(n)&&(i.distance=n**2),r!=null&&!Number.isNaN(r)&&(i.hysteresis=r),this},Y.prototype.updateLOD=function(e,t,n){let r=this?.LODinfo?.render;if(e===0)throw Error(`Cannot change distance for LOD0. It is the main mesh and must stay at 0.`);return this.updateLevel(r,e,t,n)},Y.prototype.updateShadowLOD=function(e,t,n){return this.updateLevel(this.LODinfo?.shadowRender,e,t,n)},Y.prototype.updateAllLevels=function(e,t,n){if(!e?.levels)throw Error(`Invalid LOD list.`);let r=e.levels,i=this.LODinfo?.render===e,a=+!!i;i&&(r[0].distance=0);let o=t?.length>0,s=[];o&&(s=i&&t[0]===0?t.slice(1,Math.min(r.length,t.length)):t.slice(0,Math.min(r.length-a,t.length)),s.every((e,t)=>{if(t>0&&e<=s[t-1])throw Error(`LOD distances must be strictly increasing: d[${t-1}]=${s[t-1]} < d[${t}]=${e}`);return!0}));let c=o?s.length:r.length-a;for(let t=0;t<c;t++){let r=o?s[t]:void 0,i=Array.isArray(n)?n[t]:n;this.updateLevel(e,a+t,r,i)}return this},Y.prototype.updateAllLOD=function(e,t){return this.updateAllLevels(this.LODinfo?.render,e,t)},Y.prototype.updateAllShadowLOD=function(e,t){return this.updateAllLevels(this.LODinfo?.shadowRender,e,t)},Y.prototype.disposeLOD=function(e){e.geometry.dispose();let t=e.material;if(Array.isArray(t))for(let e of t)e.dispose();else t.dispose()},Y.prototype.removeLOD=function(e,t=!0){let n=this.LODinfo,r=n?.render;if(!r?.levels)throw Error(`Invalid LOD list.`);let i=r.levels.length;if(e<0||e>=i)throw Error(`Level index OOB`);if(i>1&&e===0)throw Error(`Cannot remove LOD0 while others exist`);let[a]=r.levels.splice(e,1);r.count?.splice?.(e,1),r.levels.length<=1&&(n.render=null);let o=a.object,s=this.LODinfo?.shadowRender;if(s?.levels&&e<s.levels.length&&(s.levels.splice(e,1),s.count?.splice?.(e,1),s.levels.length===0&&(this.LODinfo.shadowRender=null)),t&&o!==this)try{this.remove(o);let e=n.objects?.indexOf(o)??-1;e!==-1&&n.objects.splice(e,1),this.disposeLOD(o)}catch(e){console.error(e)}return this},Y.prototype.patchLevel=function(e){Object.defineProperty(e,"renderOrder",{get(){return this._parentLOD.renderOrder}}),Object.defineProperty(e,"_lastRenderInfo",{get(){return this._parentLOD._lastRenderInfo}}),Object.defineProperty(e,"matricesTexture",{get(){return this._parentLOD.matricesTexture}}),Object.defineProperty(e,"colorsTexture",{get(){return this._parentLOD.colorsTexture}}),Object.defineProperty(e,"uniformsTexture",{get(){return this._parentLOD.uniformsTexture}}),Object.defineProperty(e,"morphTexture",{get(){return this._parentLOD.morphTexture}}),Object.defineProperty(e,"boneTexture",{get(){return this._parentLOD.boneTexture}}),Object.defineProperty(e,"skeleton",{get(){return this._parentLOD.skeleton}}),Object.defineProperty(e,"bindMatrixInverse",{get(){return this._parentLOD.bindMatrixInverse}}),Object.defineProperty(e,"bindMatrix",{get(){return this._parentLOD.bindMatrix}})};var Mn=new S;Y.prototype.getMorphAt=function(e,t=Mn){let n=t.morphTargetInfluences,r=this.morphTexture.source.data.data,i=e*(n.length+1)+1;for(let e=0;e<n.length;e++)n[e]=r[i+e];return t},Y.prototype.setMorphAt=function(e,t){let n=t.morphTargetInfluences,r=n.length+1;this.morphTexture===null&&!this._parentLOD&&(this.morphTexture=new o(new Float32Array(r*this._capacity),r,this._capacity,1028,1015));let i=this.morphTexture.source.data.data,a=0;for(let e of n)a+=e;let s=this._geometry.morphTargetsRelative?1:1-a,c=r*e;i[c]=s,i.set(n,c+1),this.morphTexture.needsUpdate=!0};var Nn=[],Pn=new S,Fn=new x,In=new H,Ln=new H,Rn=new d,zn=new L;Y.prototype.raycast=function(e,t){if(this._parentLOD||!this.material||this._instancesArrayCount===0||!this.instanceIndex)return;Pn.geometry=this._geometry,Pn.material=this.material;let n=e.ray,r=e.near,i=e.far;Rn.copy(this.matrixWorld).invert(),Ln.setFromMatrixScale(this.matrixWorld),In.copy(e.ray.direction).multiply(Ln);let a=In.length();e.ray=Fn.copy(e.ray).applyMatrix4(Rn),e.near/=a,e.far/=a,this.raycastInstances(e,t),e.ray=n,e.near=r,e.far=i},Y.prototype.raycastInstances=function(e,t){if(this.bvh)this.bvh.raycast(e,n=>this.checkObjectIntersection(e,n,t));else{if(this.boundingSphere===null&&this.computeBoundingSphere(),zn.copy(this.boundingSphere),!e.ray.intersectsSphere(zn))return;let n=this.instanceIndex.array,r=this.raycastOnlyFrustum&&this._perObjectFrustumCulled?this.count:this._instancesArrayCount;for(let i=0;i<r;i++)this.checkObjectIntersection(e,n[i],t)}},Y.prototype.checkObjectIntersection=function(e,t,n){if(!(t>this._instancesArrayCount||!this.getActiveAndVisibilityAt(t))){this.getMatrixAt(t,Pn.matrixWorld),Pn.raycast(e,Nn);for(let e of Nn)e.instanceId=t,e.object=this,n.push(e);Nn.length=0}},Y.prototype.initSkeleton=function(e,t=!0){if(e&&this.skeleton!==e&&!this._parentLOD){let n=e.bones;if(this.skeleton=e,this.bindMatrix=new d,this.bindMatrixInverse=new d,this.boneTexture=new mn(Float32Array,4,4*n.length,this._capacity),t)for(let e of n)e.matrixAutoUpdate=!1,e.matrixWorldAutoUpdate=!1;this.materialsNeedsUpdate()}},Y.prototype.setBonesAt=function(e,t=!0,n){let r=this.skeleton;if(!r)throw Error(`"setBonesAt" cannot be called before "initSkeleton"`);let i=r.bones,a=r.boneInverses;for(let r=0,o=i.length;r<o;r++){let o=i[r];t&&(n?.has(o.name)||o.updateMatrix(),o.matrixWorld.multiplyMatrices(o.parent.matrixWorld,o.matrix)),this.multiplyBoneMatricesAt(e,r,o.matrixWorld,a[r])}this.boneTexture.enqueueUpdate(e)},Y.prototype.multiplyBoneMatricesAt=function(e,t,n,r){let i=(e*this.skeleton.bones.length+t)*16,a=n.elements,o=r.elements,s=this.boneTexture._data,c=a[0],l=a[4],u=a[8],d=a[12],f=a[1],p=a[5],m=a[9],h=a[13],g=a[2],_=a[6],v=a[10],y=a[14],b=a[3],x=a[7],S=a[11],C=a[15],w=o[0],T=o[4],E=o[8],D=o[12],O=o[1],ee=o[5],k=o[9],A=o[13],te=o[2],ne=o[6],j=o[10],M=o[14],N=o[3],re=o[7],P=o[11],ie=o[15];s[i+0]=c*w+l*O+u*te+d*N,s[i+4]=c*T+l*ee+u*ne+d*re,s[i+8]=c*E+l*k+u*j+d*P,s[i+12]=c*D+l*A+u*M+d*ie,s[i+1]=f*w+p*O+m*te+h*N,s[i+5]=f*T+p*ee+m*ne+h*re,s[i+9]=f*E+p*k+m*j+h*P,s[i+13]=f*D+p*A+m*M+h*ie,s[i+2]=g*w+_*O+v*te+y*N,s[i+6]=g*T+_*ee+v*ne+y*re,s[i+10]=g*E+_*k+v*j+y*P,s[i+14]=g*D+_*A+v*M+y*ie,s[i+3]=b*w+x*O+S*te+C*N,s[i+7]=b*T+x*ee+S*ne+C*re,s[i+11]=b*E+x*k+S*j+C*P,s[i+15]=b*D+x*A+S*M+C*ie},Y.prototype.getUniformAt=function(e,t,n){if(!this.uniformsTexture)throw Error(`Before get/set uniform, it's necessary to use "initUniformsPerInstance".`);return this.uniformsTexture.getUniformAt(e,t,n)},Y.prototype.setUniformAt=function(e,t,n){if(!this.uniformsTexture)throw Error(`Before get/set uniform, it's necessary to use "initUniformsPerInstance".`);this.uniformsTexture.setUniformAt(e,t,n),this.uniformsTexture.enqueueUpdate(e)},Y.prototype.initUniformsPerInstance=function(e){if(!this._parentLOD){let{channels:t,pixelsPerInstance:n,uniformMap:r,fetchInFragmentShader:i}=this.getUniformSchemaResult(e);this.uniformsTexture=new mn(Float32Array,t,n,this._capacity,r,i),this.materialsNeedsUpdate()}},Y.prototype.getUniformSchemaResult=function(e){let t=0,n=new Map,r=[],i=e.vertex??{},a=e.fragment??{},o=!0;for(let e in i){let n=i[e],a=this.getUniformSize(n);t+=a,r.push({name:e,type:n,size:a}),o=!1}for(let e in a)if(!i[e]){let n=a[e],i=this.getUniformSize(n);t+=i,r.push({name:e,type:n,size:i})}r.sort((e,t)=>t.size-e.size);let s=[];for(let{name:e,size:t,type:i}of r){let r=this.getUniformOffset(t,s);n.set(e,{offset:r,size:t,type:i})}let c=Math.ceil(t/4);return{channels:Math.min(t,4),pixelsPerInstance:c,uniformMap:n,fetchInFragmentShader:o}},Y.prototype.getUniformOffset=function(e,t){if(e<4){for(let n=0;n<t.length;n++)if(t[n]+e<=4){let r=n*4+t[n];return t[n]+=e,r}}let n=t.length*4;for(;e>0;e-=4)t.push(e);return n},Y.prototype.getUniformSize=function(e){switch(e){case`float`:return 1;case`vec2`:return 2;case`vec3`:return 3;case`vec4`:return 4;case`mat3`:return 9;case`mat4`:return 16;default:throw Error(`Invalid uniform type: ${e}`)}};var Bn=`#ifdef USE_INSTANCING_INDIRECT\r
  attribute uint instanceIndex;\r
  uniform highp sampler2D matricesTexture;  

  mat4 getInstancedMatrix() {\r
    int size = textureSize( matricesTexture, 0 ).x;\r
    int j = int( instanceIndex ) * 4;\r
    int x = j % size;\r
    int y = j / size;\r
    vec4 v1 = texelFetch( matricesTexture, ivec2( x, y ), 0 );\r
    vec4 v2 = texelFetch( matricesTexture, ivec2( x + 1, y ), 0 );\r
    vec4 v3 = texelFetch( matricesTexture, ivec2( x + 2, y ), 0 );\r
    vec4 v4 = texelFetch( matricesTexture, ivec2( x + 3, y ), 0 );\r
    return mat4( v1, v2, v3, v4 );\r
  }\r
#endif`,Vn=`#ifdef USE_INSTANCING_COLOR_INDIRECT\r
  uniform highp sampler2D colorsTexture;

  vec4 getColorTexture() {\r
    int size = textureSize( colorsTexture, 0 ).x;\r
    int j = int( instanceIndex );\r
    int x = j % size;\r
    int y = j / size;\r
    return texelFetch( colorsTexture, ivec2( x, y ), 0 );\r
  }\r
#endif`,Hn=`#ifdef USE_INSTANCING_INDIRECT\r
  mat4 instanceMatrix = getInstancedMatrix();

  #ifdef USE_INSTANCING_COLOR_INDIRECT\r
    vColor *= getColorTexture();\r
  #endif\r
#endif`,Un=`#ifdef USE_INSTANCING_COLOR_INDIRECT\r
  #ifdef USE_VERTEX_COLOR\r
    vColor = vec4( color );\r
  #else\r
    vColor = vec4( 1.0 );\r
  #endif\r
#endif`,Wn=`#ifdef USE_SKINNING\r
  uniform mat4 bindMatrix;\r
  uniform mat4 bindMatrixInverse;\r
  uniform highp sampler2D boneTexture;

  #ifdef USE_INSTANCING_SKINNING\r
    uniform int bonesPerInstance;\r
  #endif

  mat4 getBoneMatrix( const in float i ) {\r
    int size = textureSize( boneTexture, 0 ).x;

    #ifdef USE_INSTANCING_SKINNING\r
      int j = ( bonesPerInstance * int( instanceIndex ) + int( i ) ) * 4;\r
    #else\r
      int j = int( i ) * 4;\r
    #endif

    int x = j % size;\r
    int y = j / size;\r
    vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );\r
    vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );\r
    vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );\r
    vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );\r
    return mat4( v1, v2, v3, v4 );\r
  }\r
#endif`;U.instanced_pars_vertex=Bn,U.instanced_color_pars_vertex=Vn,U.instanced_vertex=Hn,U.instanced_color_vertex=Un;function Gn(e){return e.replace(`#ifdef USE_INSTANCING`,`#if defined USE_INSTANCING || defined USE_INSTANCING_INDIRECT`)}U.project_vertex=Gn(U.project_vertex),U.worldpos_vertex=Gn(U.worldpos_vertex),U.defaultnormal_vertex=Gn(U.defaultnormal_vertex),U.batching_pars_vertex=U.batching_pars_vertex.concat(`
#include <instanced_pars_vertex>`),U.color_pars_vertex=U.color_pars_vertex.concat(`
#include <instanced_color_pars_vertex>`),U.batching_vertex=U.batching_vertex.concat(`
#include <instanced_vertex>`),U.skinning_pars_vertex=Wn,U.morphinstance_vertex&&(U.morphinstance_vertex=U.morphinstance_vertex.replaceAll(`gl_InstanceID`,`instanceIndex`));var Kn=4,qn=512;function Jn(e,t){let n=e*2-1,r=t*2-1,i=Math.max(1-Math.abs(n)-Math.abs(r),.04);return new H(n,i,r).normalize()}var Yn=`
vec3 impostorCorner = position;
#if defined USE_INSTANCING || defined USE_INSTANCING_INDIRECT
  mat4 impostorMatrix = instanceMatrix;
  vec3 impostorCenter = (modelMatrix * impostorMatrix * vec4(0.0, 0.5, 0.0, 1.0)).xyz;
  float impostorHeight = length(impostorMatrix[1].xyz);
  vec3 impostorX = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 impostorY = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 impostorWorld = impostorCenter + impostorX * impostorCorner.x * impostorHeight + impostorY * impostorCorner.y * impostorHeight;
  vec3 impostorCam = normalize(cameraPosition - impostorCenter);
  vec3 impostorAxisX = normalize(impostorMatrix[0].xyz);
  vec3 impostorAxisY = normalize(impostorMatrix[1].xyz);
  vec3 impostorAxisZ = normalize(impostorMatrix[2].xyz);
  vec3 impostorLocal = vec3(dot(impostorCam, impostorAxisX), dot(impostorCam, impostorAxisY), dot(impostorCam, impostorAxisZ));
  float impostorYUp = max(impostorLocal.y, 0.04);
  vec3 impostorHemi = normalize(vec3(impostorLocal.x, impostorYUp, impostorLocal.z));
  vec2 impostorOct = vec2(impostorHemi.x, impostorHemi.z);
  impostorOct = clamp(impostorOct * 0.5 + 0.5, 0.0, 0.999);
  vec2 impostorCell = floor(impostorOct * uSprites);
  vImpostorUv = (impostorCell + uv) / uSprites;
  vec4 mvPosition = viewMatrix * vec4(impostorWorld, 1.0);
  gl_Position = projectionMatrix * mvPosition;
#else
  #include <project_vertex>
#endif
`;function Xn(e,t){t.updateMatrixWorld(!0);let n=new I().setFromObject(t).getBoundingSphere(new L),r=n.center.clone(),i=Math.max(n.radius,.2),a=new D(qn,qn,{depthBuffer:!0,stencilBuffer:!1});a.texture.colorSpace=y,a.texture.generateMipmaps=!0,a.texture.minFilter=re,a.texture.magFilter=le;let o=new g;o.add(t);let s=new b(`#fff3dd`,2.2);s.position.set(4,6,3),o.add(s,new ge(`#ffffff`,.55));let c=new k(-i,i,i,-i,.05,i*6),l=qn/Kn,u=e.getRenderTarget(),d=new V,f=new E,p=new E;e.getClearColor(d),e.getViewport(f),e.getScissor(p);let h=e.getClearAlpha(),_=e.autoClear,v=e.getScissorTest();e.setRenderTarget(a),e.setClearColor(0,0),e.clear(!0,!0,!0),e.autoClear=!1;for(let t=0;t<Kn;t+=1)for(let n=0;n<Kn;n+=1){let a=Jn((n+.5)/Kn,(t+.5)/Kn);c.position.copy(r).addScaledVector(a,i*2.4),c.up.set(0,1,0),Math.abs(a.y)>.92&&c.up.set(0,0,1),c.lookAt(r),c.updateProjectionMatrix(),e.setViewport(n*l,t*l,l,l),e.setScissor(n*l,t*l,l,l),e.setScissorTest(!0),e.clear(!0,!0,!0),e.render(o,c)}e.setScissorTest(v),e.setViewport(f),e.setScissor(p),e.setRenderTarget(u),e.setClearColor(d,h),e.autoClear=_,o.remove(t);let x=new m(1,1);x.translate(0,0,0);let S=new R({map:a.texture,transparent:!0,alphaTest:.28,depthWrite:!0,side:2,fog:!0});return S.onBeforeCompile=e=>{e.uniforms.uSprites={value:Kn},e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
uniform float uSprites;
varying vec2 vImpostorUv;`).replace(`#include <project_vertex>`,Yn).replace(`#include <uv_vertex>`,`#include <uv_vertex>
#ifdef USE_MAP
  vMapUv = vImpostorUv;
#endif`),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>
varying vec2 vImpostorUv;`)},S.customProgramCacheKey=()=>`hemi-octa-impostor`,{geometry:x,material:S,texture:a.texture,target:a}}var Zn=[`meadow-pine-a`,`meadow-pine-b`,`meadow-spruce-a`,`meadow-spruce-b`,`meadow-aspen-a`,`meadow-aspen-b`],Qn=[5.4,4.6,6.1,5.2,4.8,3.9],$n=[{pos:[-23,0,-14],rotY:.3,scale:1.3},{pos:[20,0,-18],rotY:1.2,scale:1.35},{pos:[-11,0,-24],rotY:2.1,scale:1.5},{pos:[28,0,-8],rotY:.6,scale:1.25},{pos:[-31,0,-4],rotY:2.8,scale:1.4},{pos:[4,0,-26],rotY:5,scale:1.6},{pos:[30,0,-24],rotY:3.4,scale:1.8},{pos:[-33,0,-20],rotY:1.7,scale:1.85},{pos:[-26,0,16],rotY:.9,scale:1.1},{pos:[30,0,14],rotY:5.6,scale:1.15},{pos:[-17,0,-33],rotY:4.1,scale:1.9},{pos:[15,0,-34],rotY:.2,scale:2},{pos:[-13,0,27],rotY:2.4,scale:1.05},{pos:[15,0,28],rotY:3.9,scale:1.1},{pos:[-9,0,33],rotY:1.4,scale:1},{pos:[10,0,34],rotY:4.6,scale:.95},{pos:[-10.5,0,-5],rotY:.4,scale:1},{pos:[9.5,0,-4.5],rotY:1.9,scale:.9},{pos:[-13.5,0,5.5],rotY:3.1,scale:1.1},{pos:[5,0,-10],rotY:2.2,scale:1.05},{pos:[-5.5,0,-11.5],rotY:4.4,scale:.9},{pos:[14.5,0,-10],rotY:5.1,scale:1.2},{pos:[12.5,0,15.5],rotY:1.1,scale:.85},{pos:[-11.5,0,17.5],rotY:4.9,scale:.9},{pos:[-6.5,0,24.5],rotY:2.6,scale:.8},{pos:[9,0,25.5],rotY:5.7,scale:.75},{pos:[-5,0,28.5],rotY:1.3,scale:.85},{pos:[6,0,29.5],rotY:3.8,scale:.7}],er=[{file:`fern_02.glb`,height:.55,pos:[3.4,2.1],rot:.4},{file:`fern_02.glb`,height:.42,pos:[-3.6,.6],rot:2.2},{file:`rock_moss_set_01.glb`,height:.48,pos:[8.3,3.2],rot:1.1},{file:`tree_stump_01.glb`,height:.38,pos:[-3.9,-4.4],rot:.7},{file:`dandelion_01.glb`,height:.22,pos:[2.9,4.7],rot:.2},{file:`dandelion_01.glb`,height:.18,pos:[-2.5,4.9],rot:1.6}];function tr(e){return(`/`.endsWith(`/`)?`/`:`//`)+e.replace(/^\//,``)}function nr(e){e.computeBoundingBox();let t=e.boundingBox;if(!t)return e;let n=new H,r=new H;t.getSize(n),t.getCenter(r),e.translate(-r.x,-t.min.y,-r.z);let i=n.y||1;return e.scale(1/i,1/i,1/i),e.computeBoundingSphere(),e}function rr(e,t){let n=e.getAttribute(t);if(!n||!n.normalized&&n.array instanceof Float32Array)return;let r=new Float32Array(n.count*n.itemSize);for(let e=0;e<n.count;e+=1){let t=e*n.itemSize;r[t]=n.getX(e),r[t+1]=n.getY(e),n.itemSize>2&&(r[t+2]=n.getZ(e)),n.itemSize>3&&(r[t+3]=n.getW(e))}e.setAttribute(t,new B(r,n.itemSize))}function ir(e){let t=e.geometry,n=t.index?t.toNonIndexed():t.clone();rr(n,`position`),rr(n,`normal`);let r=e.material,i=r?.color?r.color:new V(`#6a7a48`),a=n.getAttribute(`position`).count,o=new Float32Array(a*3);for(let e=0;e<a;e+=1)o[e*3]=i.r,o[e*3+1]=i.g,o[e*3+2]=i.b;return n.setAttribute(`color`,new B(o,3)),n}async function ar(e,t){let n=await De(tr(`models/${e}${t}.glb`)),r=[];if(n.scene.updateMatrixWorld(!0),n.scene.traverse(e=>{let t=e;if(!t.isMesh)return;let n=ir(t);n.applyMatrix4(t.matrixWorld),r.push(n)}),!r.length)return null;let i=r.length===1?r[0]:Oe(r,!1);return i?(r.length>1&&r.forEach(e=>e.dispose()),nr(i)):null}function or(){let e=new w({vertexColors:!0,roughness:.86,metalness:0});return bt(e),e}function sr(e,t,n,r,i,a,o=G,s,c=!0){let l=[],u=new Set,d=!1,f=Math.max(6,Math.round($n.length*.85)),p=Zn.map(()=>[]);$n.slice(0,f).forEach((e,t)=>{if(Ie(e.pos[0],e.pos[2])<.35)return;if(s){let t=e.pos[0]-s.x,n=e.pos[2]-s.z;if(t*t+n*n<s.r*s.r)return}let n=t%Zn.length,r=Qn[n]*(e.scale??1);p[n].push({x:e.pos[0],y:o(e.pos[0],e.pos[2]),z:e.pos[2],rot:e.rotY??0,scale:r})});let m=ze().lod;return Promise.all(Zn.map(async(r,a)=>{let o=p[a];if(o.length&&i())try{if(m===`far`){let a=await ar(r,`.lod2`).catch(()=>null);if(!i()||!a)return;t.push(a);let s=or();n.push(s);let c=new Y(a,s,{capacity:o.length});c.castShadow=!0,c.receiveShadow=!0,c.name=r;let u=new H(0,1,0);c.addInstances(o.length,(e,t)=>{let n=o[t];e.position.set(n.x,n.y,n.z),e.quaternion.setFromAxisAngle(u,n.rot),e.scale.setScalar(n.scale)}),e.add(c),l.push({mesh:c,source:new S(a,s)});return}let[a,s,c]=await Promise.all([ar(r,``).catch(()=>null),ar(r,`.lod1`).catch(()=>null),ar(r,`.lod2`).catch(()=>null)]);if(!i()||!a)return;t.push(a),s&&t.push(s),c&&t.push(c);let u=or(),d=or(),f=or();n.push(u,d,f);let p=new Y(a,u,{capacity:o.length});p.castShadow=!0,p.receiveShadow=!0,p.name=r,s&&p.addLOD(s,d,28),c&&p.addLOD(c,f,46);let h=new H(0,1,0);p.addInstances(o.length,(e,t)=>{let n=o[t];e.position.set(n.x,n.y,n.z),e.quaternion.setFromAxisAngle(h,n.rot),e.scale.setScalar(n.scale)}),e.add(p);let g=new S(a,u);l.push({mesh:p,source:g})}catch{return}})).then(()=>{d=!0,i()&&u.size===0&&l.length===0&&a?.()}).catch(()=>{d=!0,i()&&a?.()}),c&&ze().props&&cr(e,t,n,i),{claimRenderer(e){for(let i of l){if(u.has(i.mesh))continue;let a=Xn(e,i.source);t.push(a.geometry),n.push(a.material),r.push(a.texture),bt(a.material),i.mesh.addLOD(a.geometry,a.material,60),a.target.dispose(),u.add(i.mesh)}d&&(l.length=0)}}}function cr(e,t,n,r){for(let t of er)Ie(t.pos[0],t.pos[1])<.4||De(tr(`models/${t.file}`)).then(i=>{if(!r())return;let a=new I().setFromObject(i.scene),o=new H;a.getSize(o);let s=t.height/(o.y||1),c=i.scene.clone(!0);c.traverse(e=>{let t=e;if(!t.isMesh)return;t.castShadow=!0,t.receiveShadow=!0;let r=t.material;if(r?.isMeshStandardMaterial){let e=r.clone();e.roughness=Math.max(r.roughness,.72),bt(e),t.material=e,n.push(e)}});let l=G(t.pos[0],t.pos[1])-a.min.y*s;c.position.set(t.pos[0],l,t.pos[1]),c.scale.setScalar(s),c.rotation.y=t.rot,c.name=t.file,e.add(c)}).catch(()=>void 0)}var Q=e=>Math.min(1,Math.max(0,e)),lr=(e,t,n)=>{let r=Q((n-e)/(t-e));return r*r*(3-2*r)},ur=e=>1-(1-e)**3,dr=[{p:[-2,2.5,31.5],t:[.4,4.7,20],fov:36,ground:1},{p:[-.8,2.4,27.5],t:[.2,4.9,18.5],fov:36,ground:1},{p:[.6,2.6,23.5],t:[0,1.6,0],fov:40,ground:1},{p:[-3.4,2.2,17.4],t:[0,2,.8],fov:41,ground:1},{p:[-5.2,2,12.2],t:[.5,2.6,1.8],fov:41,ground:1},{p:[-1,3,12.6],t:[.4,1.9,1.4],fov:43,ground:1},{p:[7.4,5.6,13.6],t:[0,1.8,1.6],fov:44},{p:[4.4,2.2,9.8],t:[.6,1.8,4.4],fov:42,ground:1},{p:[.8,1.8,8.3],t:[.2,2,3.8],fov:41,ground:1},{p:[.3,2.35,5.7],t:[4.6,1.1,5.3],fov:42},{p:[5.6,2,7.6],t:[.6,2.1,2.8],fov:42},{p:[7.4,2.4,9.4],t:[.4,2.2,1.8],fov:40},{p:[9.4,4.3,13.4],t:[.2,2.2,1.2],fov:37}],fr=[{p:[-1.2,2.5,27.5],t:[.4,1.6,2],fov:38,ground:1},{p:[-4.5,2.3,18],t:[1.2,2.2,4],fov:38,ground:1},{p:[-8.5,2.2,8],t:[2,3.4,8],fov:37,ground:1},{p:[-12.4,2.15,-2],t:[6.8,5.9,11.9],fov:36,ground:1},{p:[-14.2,2.05,-8.4],t:[5.05,5.39,5.53],fov:36,ground:1},{p:[-13.4,1.95,-9.6],t:[5.85,5.29,4.33],fov:35,ground:1}],pr=[{p:[6.4,2.2,12.8],t:[1.5,1.35,2.1],fov:34},{p:[11,7.4,26],t:[.7,1.9,.5],fov:34},{p:[18,18,48],t:[.25,2.8,.15],fov:32},{p:[24,36,86],t:[.15,3.6,.05],fov:28}],mr={p:[9.4,4.3,13.4],t:[.2,2.2,1.2],fov:38},hr=new H(18,16,13).normalize(),gr=[{pos:[-23,0,-14],rotY:.3,scale:1.3},{pos:[20,0,-18],rotY:1.2,scale:1.35},{pos:[-11,0,-24],rotY:2.1,scale:1.5},{pos:[28,0,-8],rotY:.6,scale:1.25},{pos:[-31,0,-4],rotY:2.8,scale:1.4},{pos:[4,0,-26],rotY:5,scale:1.6},{pos:[30,0,-24],rotY:3.4,scale:1.8},{pos:[-33,0,-20],rotY:1.7,scale:1.85},{pos:[-26,0,16],rotY:.9,scale:1.1},{pos:[30,0,14],rotY:5.6,scale:1.15},{pos:[-17,0,-33],rotY:4.1,scale:1.9},{pos:[15,0,-34],rotY:.2,scale:2},{pos:[-13,0,27],rotY:2.4,scale:1.05},{pos:[15,0,28],rotY:3.9,scale:1.1},{pos:[-9,0,33],rotY:1.4,scale:1},{pos:[10,0,34],rotY:4.6,scale:.95}],_r=[{pos:[-10.5,0,-5],rotY:.4,scale:1},{pos:[9.5,0,-4.5],rotY:1.9,scale:.9},{pos:[-13.5,0,5.5],rotY:3.1,scale:1.1},{pos:[5,0,-10],rotY:2.2,scale:1.05},{pos:[-5.5,0,-11.5],rotY:4.4,scale:.9},{pos:[14.5,0,-10],rotY:5.1,scale:1.2},{pos:[12.5,0,15.5],rotY:1.1,scale:.85},{pos:[-11.5,0,17.5],rotY:4.9,scale:.9},{pos:[-6.5,0,24.5],rotY:2.6,scale:.8},{pos:[9,0,25.5],rotY:5.7,scale:.75},{pos:[-5,0,28.5],rotY:1.3,scale:.85},{pos:[6,0,29.5],rotY:3.8,scale:.7}],vr=[{pos:[3.8,0,8.6],rotY:.7,scale:.45},{pos:[-6.4,0,3.4],rotY:2.4,scale:.32},{pos:[7.6,0,-2.6],rotY:1.1,scale:.6},{pos:[-8.6,0,-6.2],rotY:3.8,scale:.85},{pos:[2.1,0,-6.6],rotY:5.2,scale:.4},{pos:[-2.9,0,9.8],rotY:.2,scale:.24},{pos:[4.6,0,11.8],rotY:1.6,scale:.4}],yr=[{pos:[1.15,0,7.15],rotY:.4,scale:1},{pos:[-1.05,0,7.05],rotY:2.2,scale:1},{pos:[1.35,0,8.75],rotY:1.1,scale:1},{pos:[4.75,0,6.9],rotY:5.2,scale:1},{pos:[-2.65,0,30.15],rotY:2.8,scale:1}],br=[{pos:[-10.6,-3.6],w:2.3,len:9.5,o:1,rot:.3},{pos:[-13.4,4.8],w:1.7,len:8,o:.8,rot:1.2},{pos:[9.6,-4.2],w:2.5,len:9,o:.9,rot:-.4},{pos:[5.4,-9.6],w:1.9,len:8.5,o:.7,rot:.8}],xr=[{pos:[-15,1.4,-7],scale:16,speed:.05},{pos:[13,1,-11],scale:14,speed:.035},{pos:[-6,.9,-17],scale:18,speed:.045},{pos:[10,1.6,8],scale:12,speed:.03},{pos:[-17,1.2,9],scale:13,speed:.04}];function $(e){return(`/`.endsWith(`/`)?`/`:`//`)+e.replace(/^\//,``)}function Sr(e,t){let n=Math.sin(e*127.1+t*311.7)*43758.5453;return n-Math.floor(n)}function Cr(e,t){let n=Math.floor(e),r=Math.floor(t),i=e-n,a=t-r,o=i*i*(3-2*i),s=a*a*(3-2*a),c=Sr(n,r),l=Sr(n+1,r),u=Sr(n,r+1),d=Sr(n+1,r+1);return c*(1-o)*(1-s)+l*o*(1-s)+u*(1-o)*s+d*o*s}function wr(e,t,n=5){let r=0,i=1,a=.5,o=1;for(let s=0;s<n;s+=1){let n=Cr(e*i,t*i);n=1-Math.abs(n*2-1),n*=n,n*=o,o=n,r+=n*a,i*=2.07,a*=.5}return r}function Tr(e,t,n){let r=new m(170,170,e,e);r.rotateX(-Math.PI/2);let i=r.attributes.position;for(let e=0;e<i.count;e+=1)i.setY(e,t(i.getX(e),i.getZ(e)));r.computeVertexNormals(),r.getAttribute(`uv`)&&r.setAttribute(`uv2`,r.getAttribute(`uv`));let a=new w({color:n,roughness:.94,metalness:0});K(a);let o=new S(r,a);return o.receiveShadow=!0,o.name=`Terrain`,o}function Er(e,t,n,r){let i=new m(t,n,128,1),a=i.attributes.position;for(let t=0;t<=128;t+=1){let i=t/128,o=Math.sin(i*5.1+e*2.3)*.55,s=Math.sin(i*11.7+e*5.9)*.26,c=Math.sin(i*27.3+e*1.4)*.11,l=Q((o+s+c)*.5+.5)**1.35;a.setY(t,l*n*r),a.setY(t+128+1,-n*.5)}return i.computeVertexNormals(),i}function Dr(e,t,n){let r=[{seed:1.7,z:-250,w:900,h:46,jag:.85,color:`#d7e3ee`,op:.42,y:4},{seed:4.2,z:-175,w:680,h:38,jag:.9,color:`#c3d0dc`,op:.8,y:1},{seed:8.9,z:-128,w:480,h:28,jag:.82,color:`#f4f7f8`,op:1,y:0}],i=new M;i.name=`MountainRange`,i.renderOrder=-10;for(let e of r){let r=Er(e.seed,e.w,e.h,e.jag);t.push(r);let a=new R({name:`RidgeRock`,color:e.color,transparent:!0,opacity:e.op,fog:!1,side:2});a.userData.span=[e.w,e.h],a.userData.ridgeBase=a.color.clone();let o=new R({name:`RidgeSnow`,color:`#f4f8fa`,transparent:!0,opacity:.72,fog:!1,side:2});o.userData.ridgeBase=o.color.clone(),n.push(a,o);let s=new S(r,a);s.position.set(0,e.y,e.z),s.frustumCulled=!1;let c=new S(r,o);c.position.set(0,e.y+e.h*.05,e.z+1.5),c.scale.set(1,.955,1),c.frustumCulled=!1,i.add(s,c)}e.add(i)}function Or(e,t,n,r,i,a,o){let s=new m(t,n,r,i);s.rotateX(-Math.PI/2);let c=s.attributes.position;for(let t=0;t<c.count;t+=1){let r=c.getX(t),i=c.getZ(t),o=(i+n/2)/n,s=wr(r*.0132+11.3+e,i*.014+4.1+e*.7,5),l=.45+.55*Cr(r*.0022+2.7+e,i*.004+9.4),u=Math.min(1,s*l/.78)**1.08*.78*55*a*(.42+o*.9);u*=Math.min(1,Math.max(0,(o-.02)/.22)),c.setY(t,u)}s.computeVertexNormals();let l=s.attributes.normal,u=new V(`#d9e6ee`),d=new V(`#4a5a69`),f=new V(`#6f8090`),p=new V(`#f7fbfd`),h=new V(`#41584c`),g=new V,_=new Float32Array(c.count*3),v=1;for(let e=0;e<c.count;e+=1)v=Math.max(v,c.getY(e));for(let t=0;t<c.count;t+=1){let r=c.getY(t),i=c.getZ(t),a=r/v,s=1-Math.abs(l.getY(t)),m=Q((a-(.42+Cr(c.getX(t)*.02+e,i*.02)*.17))/.13)*Q(1-(s-.34)/.16),y=Q((.16-a)/.22);g.copy(d).lerp(f,Q(a*.9)).lerp(h,y*.8).lerp(p,m);let b=l.getX(t)*hr.x+l.getY(t)*hr.y+l.getZ(t)*hr.z;g.multiplyScalar(.4+Q(b*.66+.4)*.94);let x=Q(o+(1-(i+n/2)/n)*.24+(1-lr(0,.26,a))*.26-a*.22);g.lerp(u,Math.min(.9,x)),_[t*3]=g.r,_[t*3+1]=g.g,_[t*3+2]=g.b}return s.setAttribute(`color`,new B(_,3)),s}function kr(e,t,n){let r=new M;r.name=`SnowRange`;let i=Or(37.4,1150,130,120,40,.72,.22),a=Or(0,900,110,180,36,.55,.12);t.push(i,a);let o=new R({name:`SnowRange`,vertexColors:!0,fog:!1}),s=new R({name:`SnowRange`,vertexColors:!0,fog:!1});n.push(o,s);let c=new S(i,o);c.position.set(70,-22,-250),c.frustumCulled=!1,c.renderOrder=-11;let l=new S(a,s);return l.position.set(0,-16,-190),l.frustumCulled=!1,l.renderOrder=-10,r.add(c,l),r.userData.mats=[o,s],e.add(r),r}function Ar(e,t,n){let r=e.userData.mats;if(!r)return;let i=(1+t*.1)*(1-n*.82),a=(1-t*.03)*(1-n*.78),o=(1-t*.14)*(1-n*.62);for(let e of r)e.color.setRGB(i,a,o)}function jr(e,t){let n=1-t*.84;for(let t of e){if(!(t instanceof R)||t.name!==`RidgeRock`&&t.name!==`RidgeSnow`)continue;let e=t.userData.ridgeBase;if(!e)continue;let r=t.name===`RidgeSnow`?.78:1;t.color.copy(e).multiplyScalar(Math.max(.08,n*r))}}function Mr(e,t,n){let r=new M;r.name=`Clouds`;let i=new V(`#fffdf5`),a=new V(`#eff2f1`),o=new V(`#c0ccd1`),s=new V;for(let e=0;e<6;e+=1){let c=[],l=4+e%3;for(let t=0;t<l;t+=1){let n=new se(1,0),r=.7+Sr(e,t)*.8;n.scale(r*1.3,r*.55,r);let i=t-(l-1)/2;n.translate(i*1.05,-Math.abs(i)*.16,(Sr(t,e)-.5)*.4),c.push(n)}let u=0;for(let e of c)u+=e.attributes.position.count;let d=new Float32Array(u*3),f=new Float32Array(u*3),p=0;for(let e of c){let t=e.attributes.position;d.set(t.array,p),p+=t.count*3,e.dispose()}let m=1/0,h=-1/0;for(let e=1;e<d.length;e+=3)m=Math.min(m,d[e]),h=Math.max(h,d[e]);let g=Math.max(.001,h-m);for(let e=0;e<d.length;e+=3){let t=(d[e+1]-m)/g;s.copy(o).lerp(a,t).lerp(i,t*t);let n=hr.y*.6+.4;s.multiplyScalar(.72+t*n*.45),f[e]=s.r,f[e+1]=s.g,f[e+2]=s.b}let _=new ae;_.setAttribute(`position`,new B(d,3)),_.setAttribute(`color`,new B(f,3)),_.computeVertexNormals(),t.push(_);let v=new R({vertexColors:!0,fog:!1});n.push(v);let y=new S(_,v),b=e*.9;y.position.set(Math.cos(b)*(18+e*6),28+e%3*6,Math.sin(b)*14-6),y.scale.setScalar(3.2+e%2),y.userData.baseX=y.position.x,y.userData.phase=e,r.add(y)}return e.add(r),r}function Nr(e){let t=new Float32Array(2100);for(let e=0;e<700;e+=1){let n=Math.sin(e*91.7)*43758.5453,r=(n-Math.floor(n))*Math.PI*2,i=Math.sin(e*33.1)*43758.5453,a=.08+(i-Math.floor(i))*.72;t[e*3]=Math.cos(r)*Math.cos(a)*190,t[e*3+1]=Math.sin(a)*190,t[e*3+2]=Math.sin(r)*Math.cos(a)*190}let n=new ae;n.setAttribute(`position`,new B(t,3));let r=new _({size:2.4,sizeAttenuation:!1,color:`#f4f7ff`,transparent:!0,opacity:0,depthWrite:!1,fog:!1}),i=new ve(n,r);return i.name=`StarField`,i.renderOrder=-11,i.frustumCulled=!1,e.add(i),{geo:n,mat:r,points:i}}function Pr(){let e=document.createElement(`canvas`);e.width=128,e.height=128;let t=e.getContext(`2d`);if(!t)return null;let n=t.createRadialGradient(64,64,6,64,64,58);n.addColorStop(0,`rgba(255, 250, 236, 1)`),n.addColorStop(.42,`rgba(244, 236, 214, 0.95)`),n.addColorStop(.72,`rgba(232, 224, 204, 0.35)`),n.addColorStop(1,`rgba(232, 224, 204, 0)`),t.fillStyle=n,t.fillRect(0,0,128,128);let r=new he(e);return r.colorSpace=y,r}function Fr(){let e=document.createElement(`canvas`);e.width=128,e.height=128;let t=e.getContext(`2d`);if(!t)return null;let n=t.createRadialGradient(64,64,8,64,64,64);n.addColorStop(0,`rgba(244,250,246,0.55)`),n.addColorStop(.6,`rgba(244,250,246,0.16)`),n.addColorStop(1,`rgba(244,250,246,0)`),t.fillStyle=n,t.fillRect(0,0,128,128);let r=new he(e);return r.colorSpace=y,r}function Ir(){let e=document.createElement(`canvas`);e.width=64,e.height=256;let t=e.getContext(`2d`);if(!t)return null;let n=t.createLinearGradient(0,256,0,0);n.addColorStop(0,`rgba(255,238,200,0.14)`),n.addColorStop(.45,`rgba(255,238,200,0.55)`),n.addColorStop(.85,`rgba(255,238,200,0.10)`),n.addColorStop(1,`rgba(255,238,200,0)`),t.fillStyle=n,t.fillRect(0,0,64,256);let r=t.createLinearGradient(0,0,64,0);r.addColorStop(0,`rgba(0,0,0,0)`),r.addColorStop(.3,`rgba(0,0,0,1)`),r.addColorStop(.7,`rgba(0,0,0,1)`),r.addColorStop(1,`rgba(0,0,0,0)`),t.globalCompositeOperation=`destination-in`,t.fillStyle=r,t.fillRect(0,0,64,256);let i=new he(e);return i.colorSpace=y,i}function Lr(e,t,n,r,i=G){let a=new I().setFromObject(e),o=new H;a.getSize(o);let s=new H;a.getCenter(s);let c=t/(o.y||1),l=new M;for(let t of n){let n=t.scale??1,o=e.clone(!0);o.traverse(e=>{let t=e;if(!t.isMesh)return;t.castShadow=!0,t.receiveShadow=!0;let n=t.material;if(n?.isMeshStandardMaterial){let e=n.clone();e.name===`Green`&&e.color.set(`#356247`),e.name===`Wood`&&e.color.set(`#5d4030`),e.roughness=1,e.metalness=0,e.envMapIntensity=.3,t.material=e}}),o.position.set(-s.x*c*n,-a.min.y*c*n,-s.z*c*n),o.scale.setScalar(c*n);let u=new M;u.add(o);let d=i(t.pos[0],t.pos[2])-.06;u.position.set(t.pos[0],d,t.pos[2]),u.rotation.y=t.rotY??0,l.add(u),r.push(u)}return l}function Rr(e,t,n,r,i,a){let o=[...gr.slice(0,Math.max(4,Math.round(12*i))),..._r.slice(0,Math.max(3,Math.round(9*i)))],d=new l(1,1,6),f=new u(1,1.18,1,6);t.push(d,f);let p=new w({color:`#356247`,roughness:1,flatShading:!0}),m=new w({color:`#5d4030`,roughness:1,flatShading:!0});K(p),K(m),n.push(p,m);let h=Pe([`diff`,`nor_gl`,`rough`]);h.length&&Ne().then(()=>Promise.all(h.map(e=>Me.loadAsync($(`textures/bark_brown_02/${e}.ktx2`))))).then(e=>{if(!a()){for(let t of e)t.dispose();return}let[t,n,i]=e;for(let t of e)t.wrapS=s,t.wrapT=s,t.repeat.set(2,3),t.anisotropy=Fe();t&&(t.colorSpace=y,m.map=t),n&&(n.colorSpace=``,m.normalMap=n),i&&(i.colorSpace=``,m.roughnessMap=i),m.needsUpdate=!0,r.push(...e)}).catch(()=>void 0);let g=new pe(d,p,o.length),_=new pe(f,m,o.length);g.receiveShadow=!0;let v=new c;o.forEach((e,t)=>{let n=e.scale??1,r=(t<12?5.2:4.3)*n,i=G(e.pos[0],e.pos[2]);v.position.set(e.pos[0],i+r*.52,e.pos[2]),v.rotation.set(0,e.rotY??0,0),v.scale.set(1.25*n,r,1.25*n),v.updateMatrix(),g.setMatrixAt(t,v.matrix),v.position.set(e.pos[0],i+r*.14,e.pos[2]),v.scale.set(.16*n,r*.28,.16*n),v.updateMatrix(),_.setMatrixAt(t,v.matrix)});let b=new M;b.name=`LiteForest`,b.add(g,_),e.add(b)}function zr(e,t=G){let n=new M;n.name=`AuraUnitSlot`,n.position.set(Le.x,t(Le.x,Le.z),Le.z);let r=new M;r.name=`HotTubSlot`,r.position.set(q.x,t(q.x,q.z),q.z),e.add(n,r)}function Br(e){return{position:new ue(e.map(e=>new H(e.p[0],e.ground?G(e.p[0],e.p[2])+e.p[1]:e.p[1],e.p[2])),!1,`catmullrom`,.38),target:new ue(e.map(e=>new H(e.t[0],e.t[1],e.t[2])),!1,`catmullrom`,.38)}}function Vr(e,t){if(e.length>=13){let n=t*6,r=Math.min(Math.floor(n),5),i=Q(n-r);return O.lerp(e[r*2].fov,e[Math.min(r+1,6)*2].fov,i)}let n=t*(e.length-1),r=Math.min(Math.floor(n),e.length-2);return O.lerp(e[r].fov,e[r+1].fov,n-r)}function Hr(){return{geometries:[],materials:[],textures:[],winds:[],hero:[],fill:[],heroMat:null,fillMat:null,flowerMat:null,stars:null,mist:[],clouds:[],sway:[],shafts:[],birds:null,snow:null,generation:0,release:null}}var Ur=new o(new Uint8Array([255,255,255,255]),1,1);Ur.wrapS=s,Ur.wrapT=s,Ur.colorSpace=``,Ur.needsUpdate=!0;function Wr(e,t,n){let r=e.onBeforeCompile,i=e.customProgramCacheKey.bind(e);e.onBeforeCompile=(i,a)=>{r.call(e,i,a),i.uniforms.uVeilHaze=t,i.uniforms.tVeilSnow={value:e.userData.veilSnow??Ur},i.uniforms.uVeilOn={value:+!!e.userData.veilSnow},e.userData.veilUniforms=i.uniforms,i.vertexShader.includes(`vVeilWorld`)||(i.vertexShader=i.vertexShader.replace(`#include <common>`,`#include <common>
varying vec3 vVeilWorld;`).replace(`#include <begin_vertex>`,`#include <begin_vertex>
vVeilWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`));let o=n===`range`?`
if (uVeilOn > 0.5) {
  vec3 snow = texture2D(tVeilSnow, vVeilWorld.xz * 0.5).rgb;
  snow = pow(max(snow, vec3(0.0)), vec3(2.2));
  diffuseColor.rgb *= mix(vec3(1.0), snow, 0.22);
}`:`
{
  float luma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  vec3 crushed = mix(vec3(luma), diffuseColor.rgb, 0.4);
  float aerial = smoothstep(90.0, 320.0, length(vVeilWorld - cameraPosition));
  diffuseColor.rgb = mix(crushed, uVeilHaze, aerial * 0.45);
}`;i.fragmentShader.includes(`vVeilWorld`)||(i.fragmentShader=i.fragmentShader.replace(`#include <common>`,`#include <common>
varying vec3 vVeilWorld;
uniform vec3 uVeilHaze;
uniform sampler2D tVeilSnow;
uniform float uVeilOn;`).replace(`#include <color_fragment>`,`#include <color_fragment>\n${o}`))},e.customProgramCacheKey=()=>`veil-v2-${n}-${i()}`}function Gr(e,t){e.release?.(),e.release=null;let n=t.environment,r=t.environmentIntensity;t.clear(),t.environment=n,t.environmentIntensity=r;for(let t of[...e.hero,...e.fill])t.geo.dispose();for(let t of e.geometries)t.dispose();for(let t of e.materials)t.dispose();for(let t of e.textures)t.dispose();e.heroMat?.dispose(),e.fillMat?.dispose(),e.flowerMat?.dispose(),e.stars?.dispose()}function Kr(l,u={}){let d=u.grade===`golden`,f=u.vista===!0,p=u.heightAt??G,h=new g,_=new ee(38,1,.4,d||f?1100:260);_.position.set(-4.5,5.4,17.5);let x=u.ground===`snow`?`#d5e3ee`:u.ground===`rock`?`#c9d3da`:`#d2c2ae`,C=new v(d?`#e4c9a4`:f?x:`#e3ede7`,d||f?48:36,d||f?220:120);h.fog=C,h.background=d||u.hdri?null:C.color;let w=u.spline?.length?u.spline:dr,T=u.timeOfDay??`scroll`,E=u.density??1,D=null,k=!1,A=!1,ne=0,N=Hr(),re=Br(w),P={smooth:0,mx:0,my:0,started:-1,dusk:0,night:0,shotBlend:0,progress:0},ie={x:0,y:0},F=new b(`#fff3dd`,2.6),I=new a(`#eef7ff`,`#94ad8e`,.5),oe=new ge(`#ffffff`,.14),L=new b(`#d8ece6`,.16);L.position.set(-14,9,-16);let se=new H(18,16,13).multiplyScalar(1.5),ce=new H(-18,7,18),ue=new H(-14,30,-10),de=new V(`#fff3dd`),me=new V(`#ffb46b`),he=new V(`#9fb6d8`),z=new V(`#e3ede7`),ve=new V(`#eedcc6`),ye=new V(`#161f2b`),xe=new V,Ce=new V(`#fff3dd`),Te=new V(`#ffc48c`),Ee=new V(`#93b06a`),Oe=new V(`#9aa863`),ke=new H,U=new H,W=new H,K=new H,q=new H,Le=new H,He=null,Ue=null,We=null,Ge=null,Ke=null,qe=null,Xe=null,Ze=null,$e=!1,et=()=>{let e=n().shadowMapSize;if(F.castShadow=e>0,e<=0)return;F.shadow.mapSize.set(e,e),F.shadow.bias=u.product?-45e-5:-25e-5,F.shadow.normalBias=u.product?.025:.012,u.product&&(F.shadow.radius=2.5);let t=F.shadow.camera;t.near=u.product?.6:1,t.far=u.product?48:d?70:90;let r=u.product?9:d?12:24;t.left=-r,t.right=r,t.top=r,t.bottom=-r,t.updateProjectionMatrix()},it=(e,t,n)=>{let r=e.material,i=e=>{if(k||n!==N.generation){for(let t of e)t.dispose();return}let[i,a,o,c]=e;for(let t of e)t.wrapS=s,t.wrapT=s,t.repeat.set(85,85),t.anisotropy=Fe();i&&(i.colorSpace=y,r.map=i),a&&(a.colorSpace=``,r.normalMap=a),o&&(o.colorSpace=``,r.roughnessMap=o),c&&(c.colorSpace=``,r.aoMap=c,r.aoMapIntensity=t===`snow`?.45:.7),r.color.set(`#ffffff`),r.needsUpdate=!0,N.textures.push(...e)};if(t===`rock`){let e=Pe([`diff`,`nor_gl`,`rough`,`ao`]);if(!e.length)return;Ne().then(()=>Promise.all(e.map(e=>Me.loadAsync($(`textures/rocky_terrain_02/${e}.ktx2`))))).then(i).catch(()=>void 0),new _e().loadAsync($(`textures/ground037/diff.jpg`)).then(e=>{if(k||n!==N.generation){e.dispose();return}e.colorSpace=``,e.wrapS=s,e.wrapT=s,e.anisotropy=Fe(),N.textures.push(e),r.userData.macroSoil=e,r.userData.macroSoilAmt=.28;let t=r.userData.macroUniforms;t?.tMacroSoil&&t.uMacroSoil&&(t.tMacroSoil.value=e,t.uMacroSoil.value=.28)}).catch(()=>void 0);return}let a=new _e,o=Pe([`diff`,`nor_gl`,`rough`,`ao`]);o.length&&Promise.all(o.map(e=>a.loadAsync($(`textures/snow_02/${e}.jpg`)))).then(i).catch(()=>void 0)},at=(e,t,n)=>{if(!e)return;let r=e.uniforms;r.uSunCol.value.copy(Ce).lerp(Te,t),r.uColTip&&r.uColTip.value.copy(Ee).lerp(Oe,t*.55),ke.copy(ce).normalize(),r.uSunDir.value.copy(hr).lerp(ke,t).normalize(),r.uSunI.value=(1.15-t*.3)*(1-n*.7),r.uNight.value=n},ot=()=>{et(),d?(F.color.set(`#ffb56a`),F.intensity=2.35,F.position.copy(ht).multiplyScalar(48),F.target.position.set(0,1.2,0),h.add(F.target),I.color.set(`#f3d7b0`),I.groundColor.set(`#6a7348`),I.intensity=.38):F.position.copy(se),u.product&&(L.intensity=0,F.target.position.set(0,1.15,0),h.add(F.target)),h.add(I,oe,F,L);let e=n().tier,t=e===`ultra`||e===`high`?160:Be(e)?64:96,r=u.ground===`rock`||u.ground===`snow`,i=r?Tr(t,p,u.ground===`snow`?`#e7eef2`:`#8d8680`):kt(t,N.textures,N.materials,d||f);if(N.geometries.push(i.geometry),r){let e=i.material;f&&bt(e),N.materials.push(e)}h.add(i),(u.ground===`rock`||u.ground===`snow`)&&it(i,u.ground,N.generation),zr(h,p);let a=[],o=(e,t)=>{if(!t)return;let n=h.getObjectByName(e);if(!(n instanceof M))return;let r=t(n);typeof r==`function`&&a.push(r)};o(`AuraUnitSlot`,u.occupyUnit),o(`HotTubSlot`,u.occupyTub),a.length&&(N.release=()=>{for(let e of a)e()})},st=e=>{De($(`models/pines.glb`)).then(t=>{if(k||A||e!==N.generation)return;t.scene.traverse(e=>{let t=e;if(!t.isMesh)return;let n=t.material;n?.isMeshStandardMaterial&&(n.roughness=1,n.metalness=0)});let n=Math.max(1,Math.ceil(gr.length*Math.min(1,i(E)))),r=Lr(t.scene,5.2,gr.slice(0,n),N.sway);r.name=`Forest`,h.add(r),r.traverse(e=>{let t=e;if(!t.isMesh)return;let n=t.material,r=Array.isArray(n)?n:[n];for(let e of r)e&&(d&&bt(e),N.materials.push(e))})}).catch(()=>{!k&&!A&&e===N.generation&&Rr(h,N.geometries,N.materials,N.textures,i(E),()=>!k&&!A&&e===N.generation)})},ct=()=>{let e=n(),t=ze(e.tier),r=i(E),a=N.generation;if(d){let e=()=>!k&&!A&&a===N.generation;if(t.trees===`pines`){st(a),t.props&&cr(h,N.geometries,N.materials,e);return}He=sr(h,N.geometries,N.materials,N.textures,e,()=>{e()&&st(a)}).claimRenderer;return}if(f){let e=()=>!k&&!A&&a===N.generation;if(t.vista===`pines`){st(a);return}He=sr(h,N.geometries,N.materials,N.textures,e,void 0,p,u.clear,!u.ground&&t.props).claimRenderer;return}if(t.trees===`pines`){st(a);return}let o=e=>{let t=u.clear;if(!t)return e;let n=t.r*t.r;return e.filter(e=>{let r=e.pos[0]-t.x,i=e.pos[2]-t.z;return r*r+i*i>n})},s=e=>{let t=o(e);return t.slice(0,Math.max(1,Math.ceil(t.length*Math.min(1,r))))};Promise.all([De($(`models/pines.glb`)),De($(`models/pine-teal.glb`)),De($(`models/rocks.glb`)),De($(`models/lantern.glb`))]).then(([e,t,n,r])=>{if(k||A||a!==N.generation)return;let i=(e,t=!1)=>{e.traverse(e=>{let n=e;if(!n.isMesh)return;let r=n.material;r?.isMeshStandardMaterial&&(t&&r.color.set(`#828d84`),r.roughness=1,r.metalness=0)})};i(e.scene),i(t.scene),i(n.scene,!0);let o=Lr(e.scene,5.2,s(gr),N.sway,p),c=Lr(t.scene,4.3,s(_r),N.sway,p),l=Lr(n.scene,1.4,s(vr),[],p),d=u.ground?null:Lr(r.scene,.38,s(yr),[],p);o.name=`Forest`,c.name=`TealForest`,h.add(o,c,l),d&&h.add(d);for(let e of[o,c,l,d])e&&e.traverse(e=>{let t=e;if(!t.isMesh)return;let n=t.material,r=Array.isArray(n)?n:[n];for(let e of r)e&&(f&&bt(e),N.materials.push(e))})}).catch(()=>{!f&&!k&&!A&&a===N.generation&&Rr(h,N.geometries,N.materials,N.textures,r,()=>!k&&!A&&a===N.generation)})},lt=e=>{if(!u.hdri||d||u.hdriNight)return;let t={value:C.color.clone()};Ge=t;let n=new o(new Uint8Array([Math.round(C.color.r*255),Math.round(C.color.g*255),Math.round(C.color.b*255),255]),1,1);n.colorSpace=we,n.magFilter=le,n.minFilter=le,n.generateMipmaps=!1,n.needsUpdate=!0,N.textures.push(n);let r=new j({uniforms:{uHdr:{value:n},uHaze:t},vertexShader:`
        varying vec3 vDir;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vDir = world.xyz - cameraPosition;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,fragmentShader:`
        uniform sampler2D uHdr;
        uniform vec3 uHaze;
        varying vec3 vDir;
        void main() {
          vec3 dir = normalize(vDir);
          vec2 uv = vec2(atan(dir.z, dir.x) * 0.15915494 + 0.5, asin(clamp(dir.y, -1.0, 1.0)) * 0.31830989 + 0.5);
          vec3 sky = texture2D(uHdr, uv).rgb;
          float elev = dir.y;
          float hazeAmt = 1.0 - smoothstep(0.02, 0.28, elev);
          sky = mix(sky, uHaze, hazeAmt * 0.42);
          gl_FragColor = vec4(sky, 1.0);
        }
      `,side:1,depthWrite:!1,fog:!1});_.far<525&&(_.far=567,_.updateProjectionMatrix());let i=new Se(420,32,18);N.geometries.push(i),N.materials.push(r);let a=new S(i,r);a.name=`HdriSky`,a.frustumCulled=!1,a.renderOrder=-22,h.add(a),je.load($(u.hdri),t=>{if(k||e!==N.generation){t.dispose();return}t.colorSpace=we,t.wrapS=s,t.magFilter=le,t.minFilter=le,t.generateMipmaps=!1,r.uniforms.uHdr.value=t,N.textures.push(t),h.background=null})},dt=e=>{let t=()=>!k&&!A&&e===N.generation,n={value:C.color.clone()};Ke=n;for(let e of N.materials)(e.name===`RidgeRock`||e.name===`RidgeSnow`)&&Wr(e,n,`ridge`),e.name===`SnowRange`&&Wr(e,n,`range`);Ne().then(()=>Me.loadAsync($(`textures/rocky_terrain_02/diff.ktx2`))).then(e=>{if(!t()){e.dispose();return}e.colorSpace=y,e.wrapS=s,e.wrapT=s,e.anisotropy=Fe(),N.textures.push(e);for(let t of N.materials){if(t.name!==`RidgeRock`||!(t instanceof R))continue;let n=t.userData.span;if(n&&n[0]>520)continue;let r=e.clone();r.repeat.set(n?n[0]/16:24,n?Math.max(2,n[1]/8):6),r.needsUpdate=!0,N.textures.push(r),t.map=r,t.needsUpdate=!0}}).catch(()=>void 0),new _e().loadAsync($(`textures/snow_02/diff.jpg`)).then(e=>{if(!t()){e.dispose();return}e.colorSpace=``,e.wrapS=s,e.wrapT=s,e.anisotropy=Fe(),N.textures.push(e);for(let t of N.materials){if(t.name===`SnowRange`){t.userData.veilSnow=e;let n=t.userData.veilUniforms;n?.tVeilSnow&&n.uVeilOn&&(n.tVeilSnow.value=e,n.uVeilOn.value=1)}if(t.name===`RidgeSnow`&&t instanceof R){let n=e.clone();n.colorSpace=y,n.wrapS=s,n.wrapT=s,n.repeat.set(6,2.4),n.needsUpdate=!0,N.textures.push(n),t.map=n,t.needsUpdate=!0}}}).catch(()=>void 0)},gt=e=>{let t={value:0};We=t;let n=new o(new Uint8Array([4,8,16,255]),1,1);n.colorSpace=we,n.needsUpdate=!0,N.textures.push(n);let r=new j({uniforms:{uFrom:{value:n},uTo:{value:n},uNight:t},vertexShader:`
        varying vec3 vDir;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vDir = world.xyz - cameraPosition;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,fragmentShader:`
        uniform sampler2D uFrom;
        uniform sampler2D uTo;
        uniform float uNight;
        varying vec3 vDir;
        void main() {
          vec3 dir = normalize(vDir);
          vec2 uv = vec2(atan(dir.z, dir.x) * 0.15915494 + 0.5, asin(clamp(dir.y, -1.0, 1.0)) * 0.31830989 + 0.5);
          vec3 day = texture2D(uFrom, uv).rgb;
          vec3 night = texture2D(uTo, uv).rgb;
          float nightAmt = clamp(uNight, 0.0, 1.0);
          vec3 sky = mix(day, night, nightAmt);
          float luma = dot(sky, vec3(0.2126, 0.7152, 0.0722));
          float toe = smoothstep(0.004, 0.16, luma);
          vec3 graded = sky * mix(0.2, 0.62, toe);
          sky = mix(sky, graded, nightAmt);
          if (nightAmt > 0.35 && dir.y > -0.08) {
            vec2 cell = floor(vec2(atan(dir.z, dir.x), asin(clamp(dir.y, -1.0, 1.0))) * 110.0);
            float n = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
            vec2 f = fract(vec2(atan(dir.z, dir.x), asin(clamp(dir.y, -1.0, 1.0))) * 110.0) - 0.5;
            float spark = smoothstep(0.968, 0.992, n) * smoothstep(0.11, 0.0, length(f));
            sky += vec3(1.35, 1.4, 1.5) * spark * nightAmt;
            vec3 moonDir = normalize(vec3(-0.27, -0.08, -0.96));
            float moon = pow(max(dot(dir, moonDir), 0.0), 1400.0);
            sky += vec3(0.96, 0.93, 0.84) * moon * nightAmt;
          }
          gl_FragColor = vec4(sky, 1.0);
        }
      `,side:1,depthWrite:!1,fog:!1}),i=new Se(480,64,36);N.geometries.push(i),N.materials.push(r);let a=new S(i,r);a.name=`NightSky`,a.frustumCulled=!1,a.renderOrder=-20,h.add(a);let c=(t,n)=>{je.load($(t),t=>{if(k||e!==N.generation){t.dispose();return}t.colorSpace=we,t.wrapS=s,t.magFilter=le,t.minFilter=le,t.generateMipmaps=!1,r.uniforms[n].value=t,N.textures.push(t),h.background=null})};u.hdri&&c(u.hdri,`uFrom`),u.hdriNight&&c(u.hdriNight,`uTo`)},_t=()=>{let e=N.generation;d&&Et(h,N.geometries,N.materials,N.textures,()=>!k&&!A&&e===N.generation);let t=new M;Dr(t,N.geometries,N.materials),h.add(t),N.snow=kr(h,N.geometries,N.materials);let r=Mr(h,N.geometries,N.materials);N.clouds=r.children.slice();let i=Nr(h);if(N.geometries.push(i.geo),N.stars=i.mat,u.hdri&&!d&&!u.hdriNight&&lt(e),u.hdriNight&&u.hdri&&gt(e),dt(e),u.nightScroll){let e=Pr();if(e){N.textures.push(e),qe=new fe({map:e,color:`#f4efe4`,transparent:!0,depthWrite:!1,fog:!1,opacity:0}),N.materials.push(qe);let t=new be(qe);t.name=`Moon`,t.position.set(-24,20,-88),t.scale.set(11,11,1),t.renderOrder=-9,t.frustumCulled=!1,h.add(t)}}let a=Fr();if(a){N.textures.push(a);for(let e of xr){let t=new fe({map:a,transparent:!0,depthWrite:!1,opacity:.15});N.materials.push(t);let n=new be(t),r=(u.heightAt||u.ground?p(e.pos[0],e.pos[2]):0)+e.pos[1];n.position.set(e.pos[0],r,e.pos[2]),n.scale.set(e.scale,e.scale*.4,1),n.userData.base=e.pos[0],n.userData.y=r,n.userData.speed=e.speed,n.userData.index=N.mist.length,h.add(n),N.mist.push(n)}}let o=new ae;o.setAttribute(`position`,new B(new Float32Array([0,0,0,-.5,.16,-.22,-.5,0,.02,0,0,0,.5,0,.02,.5,.16,-.22]),3)),N.geometries.push(o);let s=new R({color:`#3d4a45`,transparent:!0,opacity:.55,side:2});N.materials.push(s);let c=new pe(o,s,8);c.frustumCulled=!1,c.name=`Birds`,h.add(c),N.birds=c;let l=n().tier,f=!Be(l)&&(u.ground||u.product?!1:d?l===`medium`:l!==`low`),g=Ir();if(g&&f){N.textures.push(g);let e=new te().setFromUnitVectors(new H(0,1,0),d?ht:hr);for(let t of br){let n=new R({map:g,transparent:!0,opacity:0,blending:2,depthWrite:!1,side:2,fog:!1});N.materials.push(n),N.shafts.push(n);let r=new M;r.position.set(t.pos[0],G(t.pos[0],t.pos[1])+.1,t.pos[1]),r.quaternion.copy(e);let i=new m(t.w,t.len);N.geometries.push(i);let a=new S(i,n);a.position.y=t.len/2,a.rotation.y=t.rot;let o=new S(i,n);o.position.y=t.len/2,o.rotation.y=t.rot+1.25,r.add(a,o),r.userData.gain=t.o,h.add(r)}}},vt=()=>{if(u.meadow===!1)return;let e=n(),t=e.grassScale*E;if(t<=0)return;let r=ft(t);N.hero=r.hero,N.fill=r.fill,N.heroMat=ut(nt),N.fillMat=ut(rt);let i=(e,t)=>{for(let n of e){let e=new S(n.geo,t);n.geo.userData.mesh=e,h.add(e)}};i(N.hero,N.heroMat),i(N.fill,N.fillMat);let a=Qe(Math.round(160*t),e.tier===`high`||e.tier===`ultra`,{ground:G,density:Re,clearance:(e,t)=>Ie(e,t)},d);a&&(N.flowerMat=tt(),N.geometries.push(a.geo),h.add(new S(a.geo,N.flowerMat)));let o=N.generation;Promise.all([fetch($(`textures/meadow-atlas.bin`)).then(e=>e.arrayBuffer()),new _e().loadAsync($(`textures/meadow-atlas.png`))]).then(([e,t])=>{if(k||A||o!==N.generation){t.dispose();return}let n=qr(e,t);if(!n){t.dispose();return}N.geometries.push(n.geo),N.materials.push(n.mat),N.textures.push(t),N.winds.push(n.wind);let r=new S(n.geo,n.mat);r.name=`MeadowAtlasField`,r.frustumCulled=!1,h.add(r)}).catch(()=>void 0)},yt=()=>{We=null,Ge=null,Ke=null,qe=null,Gr(N,h),ne+=1,N=Hr(),N.generation=ne,He=null,h.fog=C,h.background=d||u.hdri?null:C.color,re=Br(w),ot(),window.setTimeout(()=>{k||A||(ct(),window.setTimeout(()=>{k||A||(_t(),window.setTimeout(()=>{k||A||vt()},32))},32))},16)},xt=e=>{ie.x=e.clientX/Math.max(1,window.innerWidth)*2-1,ie.y=-(e.clientY/Math.max(1,window.innerHeight)*2-1)};window.addEventListener(`pointermove`,xt,{passive:!0});let St=Be(),Ct=Ve({element:l,scene:h,camera:_,ao:St?!1:u.ao??!1,exposure:u.exposure??1.02,tone:u.tone??`agx`,hdri:u.hdri,hdriPinned:u.hdriPinned,envIntensity:u.envIntensity,shadow:St?void 0:u.shadow,bloom:St?void 0:u.bloom,godrays:!St&&u.godrays?F:void 0,flare:!St&&u.flare,claimRenderer(e){Ue=e,He?.(e),!$e&&u.hdriNight&&u.hdri&&($e=!0,Ae(e,$(u.hdri)).then(e=>{k||(Xe=e)}).catch(()=>void 0),Ae(e,$(u.hdriNight)).then(e=>{k||(Ze=e)}).catch(()=>void 0))},update(t,n){if(k||A)return;let i=e(),a=Q(u.readProgress?u.readProgress():t),o=Math.min(n,1/20);i?(P.smooth=a,P.mx=0,P.my=0):(P.smooth=O.damp(P.smooth,a,5,o),P.mx=O.damp(P.mx,ie.x,3,o),P.my=O.damp(P.my,ie.y,3,o)),Math.abs(a-P.progress)>.012&&P.shotBlend>.02&&(P.shotBlend=O.damp(P.shotBlend,0,1.4,o)),P.progress=a,D&&P.shotBlend<1&&(P.shotBlend=O.damp(P.shotBlend,1,1.6,o));let s=mt(i,r(performance.now())||5.6),l=Q(P.smooth),m=w.length>=13?lr(4/6,1,l):lr(.45,1,l),g=u.product||T===`day`?0:T===`dusk`||T===`night`?1:m,v=u.product?0:+(T===`night`);if(u.nightScroll&&!u.product&&(g=Math.max(g,lr(0,.42,l)),v=lr(.18,.92,l)),P.dusk=i?g:O.damp(P.dusk,Math.max(g,v),5,o),P.night=i?v:O.damp(P.night,v,2.2,o),u.reducedShot&&i)_.position.set(mr.p[0],mr.p[1],mr.p[2]),_.lookAt(mr.t[0],mr.t[1],mr.t[2]),_.fov=mr.fov,_.updateProjectionMatrix();else if(D&&P.shotBlend>.02)re.position.getPoint(l,K),re.target.getPoint(l,q),U.set(D.p[0],D.p[1],D.p[2]),W.set(D.t[0],D.t[1],D.t[2]),K.lerp(U,P.shotBlend),q.lerp(W,P.shotBlend),_.position.copy(K),_.lookAt(q),_.fov=O.lerp(Vr(w,l),D.fov,P.shotBlend),_.updateProjectionMatrix();else{P.started<0&&(P.started=performance.now());let e=u.intro&&!i?ur(Q((performance.now()-P.started)/2200)):1;re.position.getPoint(l,K),re.target.getPoint(l,q);let t=Vr(w,l),n=Q((1.55-(_.aspect||1))/1);if(n>0&&(Le.subVectors(K,q).normalize(),K.addScaledVector(Le,n*5.5),K.y+=n*.8,t*=1+n*.32),!u.product){let n=1-e;if(K.z+=n*4.2,K.y+=n*.5,t+=n*6,!i&&!u.steady){let e=1-Q(l*6/1.6)*.5;K.x+=P.mx*.5*e,K.y+=P.my*.28*e,q.x-=P.mx*.16*e,q.y-=P.my*.09*e}}let r=p(K.x,K.z)+.7;K.y<r&&(K.y=r),_.position.copy(K),_.lookAt(q),Math.abs(_.fov-t)>.001&&(_.fov=t,_.updateProjectionMatrix())}let y=d?.68:P.dusk,b=d?0:P.night;if(d?(J.color.value.set(`#e4c9a4`),F.position.copy(_.position).addScaledVector(ht,46),F.target.position.copy(_.position),F.target.updateMatrixWorld(),F.color.set(`#ffb56a`),F.intensity=2.35,I.color.set(`#f3d7b0`),I.groundColor.set(`#6a7348`),I.intensity=.38,C.color.copy(J.color.value),J.sun.value.copy(ht),J.near.value=C.near,J.far.value=C.far):(ke.lerpVectors(se,ce,y).lerp(ue,b),F.position.copy(ke),xe.copy(de).lerp(me,y).lerp(he,b),F.color.copy(xe),F.intensity=(2.6-y*.9)*(1-b*.82),I.intensity=(.5-y*.18)*(1-b*.72),xe.copy(z).lerp(ve,y).lerp(ye,b),u.ground===`snow`&&xe.lerp(z,.72),C.color.copy(xe),f&&(J.color.value.copy(C.color),J.falloff.value=u.ground===`rock`?.16:.28,J.near.value=u.ground===`rock`?32:u.ground===`snow`?36:42,J.far.value=u.ground===`rock`?180:u.ground===`snow`?160:220,J.sun.value.copy(F.position).normalize())),u.product&&(F.color.set(`#fff3dd`),F.intensity=2.35,F.position.copy(hr).multiplyScalar(22),F.target.position.set(0,1.15,0),F.target.updateMatrixWorld(),I.intensity=.32,oe.intensity=.08,C.color.set(`#e7eeea`),h.background instanceof V&&h.background.copy(C.color)),N.snow&&Ar(N.snow,y,b),jr(N.materials,b),N.stars&&(N.stars.opacity=b*.95),qe&&(qe.opacity=b*.9),Ge&&Ge.value.copy(C.color),Ke&&Ke.value.copy(C.color),We&&(We.value=b),Xe&&Ze){h.environment=b<.5?Xe:Ze;let e=b<.5?1-b*2:(b-.5)*2;h.environmentIntensity=(u.envIntensity??.45)*(.28+.72*e)*(1-b*.62)}if(at(N.heroMat,y,b),at(N.fillMat,y,b),at(N.flowerMat,y,b),d)for(let e of[N.heroMat,N.fillMat,N.flowerMat])e&&(e.uniforms.uSunDir.value.copy(ht),e.uniforms.uSunCol.value.set(`#ffb56a`),e.uniforms.uSunI.value=1.35,e.uniforms.uHeightFog&&(e.uniforms.uHeightFog.value=1),e.uniforms.uHeightFogSun&&e.uniforms.uHeightFogSun.value.copy(ht),e.uniforms.uHeightFogColor&&e.uniforms.uHeightFogColor.value.copy(J.color.value),e.uniforms.uHeightFogFalloff&&(e.uniforms.uHeightFogFalloff.value=J.falloff.value),e.uniforms.uFogNear.value=52,e.uniforms.uFogFar.value=210,e.uniforms.uHemiSky.value.set(`#f3d7b0`),e.uniforms.uHemiGround.value.set(`#6a7348`));let x=Je(s);for(let e of N.winds)e.uTime.value=s,e.uGust.value=x;for(let e of[N.heroMat,N.fillMat,N.flowerMat])e&&(e.uniforms.uTime.value=s,e.uniforms.uGust.value=x,e.uniforms.uCamPos.value.copy(_.position),e.uniforms.uNight.value=b,e.uniforms.uProjScale&&(e.uniforms.uProjScale.value=1/Math.tan(_.fov*Math.PI/360)),e.uniforms.uFogColor.value.copy(C.color));pt(N.hero,nt,_.position),pt(N.fill,rt,_.position);let S=+!i,E=Math.cos(.62),ee=Math.sin(.62);if(N.sway.forEach((e,t)=>{let n=t*.7,r=Math.sin(s*.42+n)*.5+.5,i=Math.max(0,Math.sin(s*.85-e.position.x*.12-e.position.z*.09))*.55,a=(.007+r*.005+i*.011)*S;e.rotation.z=-a*E,e.rotation.x=a*ee}),N.clouds.forEach(e=>{let t=e.userData.phase;if(e.position.x=e.userData.baseX+Math.sin(s*.05+t)*1.4*S,u.nightScroll){let t=e.material;t?.color&&t.color.setScalar(1-b*.94)}}),N.mist.forEach(e=>{let t=e.userData.index,n=e.userData.speed;e.position.x=e.userData.base+Math.sin(s*n*2+t*1.8)*2.4*!i,e.position.y=e.userData.y+Math.sin(s*n+t)*.3*!i,u.nightScroll&&(e.material.opacity=.15*(1-b))}),u.nightScroll&&N.birds){let e=N.birds.material;e.opacity=.55*(1-b)}if(N.birds){let e=new c;for(let t=0;t<8;t+=1){let n=t/8*Math.PI*2,r=26+t%4*5.5,a=(i?Ye:s)*.055+n;e.position.set(Math.cos(a)*r,17+Math.sin(a*1.7+n)*2.6+t%3*1.4,Math.sin(a)*r*.72-6),e.rotation.set(0,-a+Math.PI/2,Math.sin(a*2.2+n)*.22);let o=i?1:.72+Math.sin(s*6.4+n*3.1)*.28;e.scale.set(1.05*o,1,1.05),e.updateMatrix(),N.birds.setMatrixAt(t,e.matrix)}N.birds.instanceMatrix.needsUpdate=!0}u.onFrame?.({camera:_,dt:o,dusk:P.dusk,night:P.night,reduced:i,renderer:Ue});let te=lr(.55/6,1.3/6,l)*(1-lr(2.6/6,3.4/6,l));N.shafts.forEach((e,t)=>{e.opacity=i?0:te*(1-b)*br[t].o*.32})},suspend(){A=!0,Gr(N,h),N=Hr()},resume(){k||(A=!1,yt())}});yt();let wt=t(e=>{k||e.tier===`off`||A||yt()});return{setProgress(e){Ct.setProgress(e)},setTimeOfDay(e){T=e},setDensity(e){E=e,!k&&!A&&yt()},setShot(e){D=e,e?P.shotBlend=Math.max(P.shotBlend,.15):P.shotBlend=0},destroy(){k||(k=!0,wt(),window.removeEventListener(`pointermove`,xt),Ct.destroy(),Gr(N,h))}}}function qr(e,t){if(e.byteLength<24)return null;let n=new DataView(e),r=new TextDecoder().decode(new Uint8Array(e,0,8)),i=n.getUint32(8,!0),a=n.getUint32(12,!0),o=n.getUint32(16,!0);if(r!==`AURAMDW1`||i!==1||o!==48||e.byteLength!==24+a*o)return null;let s=new Float32Array(a*3),c=new Float32Array(a*2),l=new Float32Array(a),u=new Float32Array(a*4),d=new Float32Array(a);for(let e=0;e<a;e+=1){let t=24+e*o;s[e*3]=n.getFloat32(t,!0),s[e*3+1]=n.getFloat32(t+4,!0),s[e*3+2]=n.getFloat32(t+8,!0),c[e*2]=n.getFloat32(t+12,!0),c[e*2+1]=n.getFloat32(t+16,!0),l[e]=n.getFloat32(t+20,!0);let r=n.getFloat32(t+40,!0),i=n.getFloat32(t+44,!0),a=Math.min(5,Math.floor(i*6));u[e*4]=r===0?n.getFloat32(t+24,!0):a%4/4,u[e*4+1]=r===0?n.getFloat32(t+28,!0):Math.floor(a/4)/2,u[e*4+2]=n.getFloat32(t+32,!0),u[e*4+3]=n.getFloat32(t+36,!0),d[e]=i}let f=new xe;f.setAttribute(`position`,new B(new Float32Array([-.5,0,0,.5,0,0,.5,1,0,-.5,1,0,0,0,-.5,0,0,.5,0,1,.5,0,1,-.5]),3)),f.setAttribute(`uv`,new B(new Float32Array([0,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1]),2)),f.setIndex(new B(new Uint16Array([0,1,2,0,2,3,4,5,6,4,6,7]),1)),f.setAttribute(`aAtlasPos`,new z(s,3)),f.setAttribute(`aAtlasSize`,new z(c,2)),f.setAttribute(`aAtlasYaw`,new z(l,1)),f.setAttribute(`aAtlasUv`,new z(u,4)),f.setAttribute(`aAtlasSeed`,new z(d,1)),f.instanceCount=a,f.boundingSphere=new L(new H(0,1.6,22),76),t.colorSpace=y,t.wrapS=N,t.wrapT=N,t.needsUpdate=!0;let p=new R({map:t,alphaTest:.42,transparent:!1,depthWrite:!0,side:2,fog:!0}),m={uTime:{value:Ye},uWindDir:{value:qe.clone()},uGust:{value:Je(Ye)}};return p.onBeforeCompile=e=>{e.uniforms.uTime=m.uTime,e.uniforms.uWindDir=m.uWindDir,e.uniforms.uGust=m.uGust,e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
attribute vec3 aAtlasPos;
attribute vec2 aAtlasSize;
attribute float aAtlasYaw;
attribute vec4 aAtlasUv;
attribute float aAtlasSeed;
uniform float uTime;
uniform vec2 uWindDir;
uniform float uGust;`).replace(`#include <uv_vertex>`,`#ifdef USE_MAP
  vMapUv = ( mapTransform * vec3( aAtlasUv.xy + uv * aAtlasUv.zw, 1 ) ).xy;
#endif`).replace(`#include <begin_vertex>`,`vec3 atlasLocal = position;
atlasLocal.xz *= aAtlasSize.x;
atlasLocal.y *= aAtlasSize.y;
float atlasTurn = aAtlasYaw + (aAtlasSeed - 0.5) * 0.08;
float atlasCos = cos(atlasTurn);
float atlasSin = sin(atlasTurn);
vec3 transformed = vec3(
  atlasLocal.x * atlasCos - atlasLocal.z * atlasSin,
  atlasLocal.y,
  atlasLocal.x * atlasSin + atlasLocal.z * atlasCos
) + aAtlasPos;
float windPh = aAtlasSeed * 6.2831853;
float windTravelling = sin(uTime * 0.62 - dot(aAtlasPos.xz, uWindDir) * 0.135);
float windSway = windTravelling * 0.7;
float windBendT = position.y * position.y;
float windAmp = (0.34 + 0.66 * uGust) * aAtlasSize.y * 0.16;
transformed.xz += uWindDir * windBendT * windSway * windAmp;
transformed.y -= windBendT * abs(windSway) * windAmp * 0.18;`)},{geo:f,mat:p,wind:m}}export{fr as n,Kr as r,pr as t};