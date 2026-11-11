import{o as e,r as t}from"./motion.CASNhnqH.js";import{c as n,d as r,p as i,r as a,u as o}from"./quality.3Wve-24B.js";import{$ as s,At as c,C as l,Ct as u,D as d,Dt as f,E as p,Et as m,F as h,Ft as g,Gt as _,H as v,It as y,J as b,Jt as x,K as S,Kt as C,L as w,Mt as T,N as E,Nt as D,O,Ot as k,Pt as A,Q as j,R as M,Rt as N,St as P,T as F,Tt as I,V as L,Vt as ee,W as R,Wt as te,X as ne,Y as z,Z as re,_ as B,_t as ie,a as V,at as H,b as ae,bt as oe,c as se,d as ce,et as le,f as ue,ft as de,g as fe,gt as pe,h as U,i as me,it as he,j as ge,jt as _e,k as ve,kt as W,l as G,lt as ye,m as be,mt as xe,n as Se,ot as K,p as Ce,pt as we,q as Te,qt as q,r as Ee,rt as De,s as Oe,st as ke,ut as J,v as Ae,vt as je,w as Y,wt as Me,x as Ne,xt as Pe,yt as Fe,z as Ie,zt as Le}from"./loaders.U2WiPX4Y.js";import{_ as Re,a as ze,c as Be,d as Ve,f as He,g as Ue,h as We,i as Ge,l as Ke,m as qe,n as Je,o as Ye,p as Xe,s as Ze,t as Qe}from"./hot-tub.jx-R0lS8.js";import{n as $e,t as et}from"./tier-assets.Di3YWfMm.js";import{t as tt}from"./stage.B5Fj1bFp.js";import{watchPassage as nt}from"./scene-scheduler.BHEKPvQu.js";var rt=e=>Math.min(1,Math.max(0,e)),it=(e,t,n)=>{let r=rt((n-e)/(t-e));return r*r*(3-2*r)};function at(e,t=0){let n=Math.sin(e*127.1+t*311.7)*43758.5453;return n-Math.floor(n)}function ot(e,t){let n=Math.sin(e*127.1+t*311.7)*43758.5453;return n-Math.floor(n)}function st(e,t){let n=Math.floor(e),r=Math.floor(t),i=e-n,a=t-r,o=i*i*(3-2*i),s=a*a*(3-2*a),c=ot(n,r),l=ot(n+1,r),u=ot(n,r+1),d=ot(n+1,r+1);return c*(1-o)*(1-s)+l*o*(1-s)+u*(1-o)*s+d*o*s}var ct=new _(.82,.57).normalize();function lt(e){let t=e%9/9;return t<.18?it(0,1,t/.18):t<.46?1:t<.78?1-it(0,1,(t-.46)/.32):0}var ut=5.6,dt=new C(18,16,13).normalize();function ft(e){let t=[],n=[],r=[],i=(e,i,a,o,s)=>{let c=t.length/3;t.push(...e,...i,...a,...o),n.push(s,s,s,s),r.push(c,c+1,c+2,c,c+2,c+3)},a=(e,i,a,o)=>{let s=t.length/3;t.push(...e,...i,...a),n.push(o,o,o),r.push(s,s+1,s+2)},o=.03,s=.02;i([-.03,0,0],[o,0,0],[s,1,0],[-.02,1,0],0),i([0,0,o],[0,0,-.03],[0,1,-.02],[0,1,s],0);let c=e?6:5;for(let t=0;t<c;t++){let n=t/c*Math.PI*2,r=Math.cos(n),o=Math.sin(n),s=(e,t,n)=>[r*e-o*n,t,o*e+r*n];e?i(s(.03,1,0),s(.095,1.03,.042),s(.165,1.06,0),s(.095,1.03,-.042),1):a(s(.03,1,-.036),s(.03,1,.036),s(.155,1.045,0),1)}let l=e?1.045:1.02,u=.04;i([-.04,l,-.04],[-.04,l,u],[u,l,u],[u,l,-.04],2);let d=new Ae;return d.setAttribute(`position`,new w(t,3)),d.setIndex(r),d.computeVertexNormals(),{pos:d.attributes.position.array,nrm:d.attributes.normal.array,part:new Float32Array(n),idx:new Uint16Array(r),tris:r.length/3}}function pt(e,t,n,r=!1){let i=ft(t),a=[],o=[],s=0,c=1/0,l=-1/0,u=1/0,d=-1/0,f=1/0,p=-1/0,m=e*60;for(let t=0;t<m&&s<e;t++){let e=-30+at(t,211)*60,i=-6+at(t,212)*46,m=e*.045+i*.012,h=i*.07-e*.018,g=r?it(.6,.8,st(m+2.1,h+4.4)):it(.52,.72,st(e*.13+7.7,i*.13+3.9));if(g<=.01)continue;let _=1-it(8,24,Math.hypot(e,i-4)),v=n.density(e,i)*g*(.25+.75*_);v<.02||at(t,213)>v||n.clearance(e,i)<.45||(a.push(e,n.ground(e,i)-.01,i),o.push(at(t,214)*Math.PI*2,.16+at(t,215)**1.4*.16,ot(Math.floor(e*.35),Math.floor(i*.35)),at(t,216)),c=Math.min(c,e),l=Math.max(l,e),u=Math.min(u,i),d=Math.max(d,i),f=Math.min(f,a[s*3+1]),p=Math.max(p,a[s*3+1]),s++)}if(s<8)return null;let h=new z;h.setAttribute(`position`,new B(i.pos,3)),h.setAttribute(`normal`,new B(i.nrm,3)),h.setAttribute(`aPart`,new B(i.part,1)),h.setIndex(new B(i.idx,1)),h.setAttribute(`aPos`,new b(new Float32Array(a),3)),h.setAttribute(`aInst`,new b(new Float32Array(o),4)),h.instanceCount=s;let g=new Float32Array(s*3);for(let e=0;e<s;e+=1)g[e*3]=a[e*3],g[e*3+1]=a[e*3+1]+o[e*4+1],g[e*3+2]=a[e*3+2];let _=(c+l)/2,v=(u+d)/2,y=(f+p)/2;return h.boundingSphere=new T(new C(_,y+.2,v),Math.hypot(l-_,d-v)+1),{geo:h,heads:g,placed:s,tris:s*i.tris}}var mt=`
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
`,ht=`
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
`;function gt(){return new _e({vertexShader:mt,fragmentShader:ht,side:2,uniforms:{uTime:{value:0},uWindDir:{value:ct.clone()},uGust:{value:.4},uCamPos:{value:new C},uSunDir:{value:dt.clone()},uSunCol:{value:new Y(`#fff3dd`)},uSunI:{value:1.15},uHemiSky:{value:new Y(`#dcecf4`)},uHemiGround:{value:new Y(`#7a8b5e`)},uFogColor:{value:new Y(`#e3ede7`)},uFogNear:{value:30},uFogFar:{value:88},uNight:{value:0},uHeightFog:{value:0},uHeightFogSun:{value:new C(.756,.36,.547).normalize()},uHeightFogColor:{value:new Y(`#e4c9a4`)},uHeightFogFalloff:{value:.38}}})}var _t={near:16,far:34,pmin:.04,band:.16,tile:8,segs:4},vt={near:8,far:16,pmin:0,band:.16,tile:6,segs:1},yt=e=>Math.min(1,Math.max(0,e)),bt=(e,t,n)=>{let r=yt((n-e)/(t-e));return r*r*(3-2*r)},xt=(e,t)=>1+(e.pmin-1)*bt(e.near,e.far,t);function St(e){let t=[],n=[],r=[];if(e===1)return t.push(-.5,0,0,.5,0,0,0,1,0),n.push(0,0,1,0,.5,1),r.push(0,1,2),{pos:new Float32Array(t),uvs:new Float32Array(n),idx:new Uint16Array(r)};for(let r=0;r<=e;r++){let i=r/e;r===e?(t.push(0,i,0),n.push(.5,i)):(t.push(-.5,i,0,.5,i,0),n.push(0,i,1,i))}for(let t=0;t<e-1;t++){let e=t*2;r.push(e,e+1,e+2,e+1,e+3,e+2)}let i=(e-1)*2;return r.push(i,i+1,i+2),{pos:new Float32Array(t),uvs:new Float32Array(n),idx:new Uint16Array(r)}}var Ct=`
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
`,wt=`
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
`;function Tt(e){return new _e({vertexShader:Ct,fragmentShader:wt,side:2,uniforms:{uTime:{value:ut},uLod:{value:new q(e.pmin,e.near,e.far,e.band)},uRichWind:{value:+(e.segs>=4)},uWindDir:{value:ct.clone()},uCamPos:{value:new C},uProjScale:{value:2.7},uGust:{value:lt(ut)},uColTip:{value:new Y(`#93b06a`)},uSunDir:{value:new C(18,16,13).normalize()},uSunCol:{value:new Y(`#fff3dd`)},uSunI:{value:1.15},uHemiSky:{value:new Y(`#dcecf4`)},uHemiGround:{value:new Y(`#7a8b5e`)},uFogColor:{value:new Y(`#e3ede7`)},uFogNear:{value:30},uFogFar:{value:88},uNight:{value:0},uHeightFog:{value:0},uHeightFogSun:{value:new C(.756,.36,.547).normalize()},uHeightFogColor:{value:new Y(`#e4c9a4`)},uHeightFogFalloff:{value:.38}}})}function Et(e,t,n,r,i,a,o){let s=new Float32Array(i*3),c=new Float32Array(i*4),l=new Float32Array(i),u=0,d=1/0,f=-1/0,p=Math.max(1,Math.ceil(Math.sqrt(i)));for(let e=0;e<i;e+=1){let i=Math.floor(e/p),m=e%p,h=a*10007+e,g=n+(m+ze(h,1))/p*t.tile,_=r+(i+ze(h,2))/p*t.tile,v=Ze(g,_);if(v<.015||ze(h,3)>v)continue;let y=Ye(g,_,!o);if(y<.055)continue;let b=Be(g,_)-.02;s[u*3]=g,s[u*3+1]=b,s[u*3+2]=_,c[u*4]=ze(h,4)*Math.PI*2,c[u*4+1]=o?.18+ze(h,5)**1.5*.34:.08+ze(h,5)*.1,c[u*4+2]=o?.026+ze(h,6)*.018:.045+ze(h,6)*.04,c[u*4+3]=ze(h,7),l[u]=o?y:Math.sqrt(y),d=Math.min(d,b),f=Math.max(f,b),u+=1}if(u<4)return null;let m=Array.from({length:u},(e,t)=>t).sort((e,t)=>c[e*4+3]-c[t*4+3]),h=new Float32Array(u*3),g=new Float32Array(u*4),_=new Float32Array(u);m.forEach((e,t)=>{h.set(s.subarray(e*3,e*3+3),t*3),g.set(c.subarray(e*4,e*4+4),t*4),_[t]=l[e]});let v=St(t.segs),y=new z;y.setAttribute(`position`,new B(v.pos,3)),y.setAttribute(`uv`,new B(v.uvs,2)),y.setIndex(new B(v.idx,1)),y.setAttribute(`aPos`,new b(h,3)),y.setAttribute(`aRand`,new b(g,4)),y.setAttribute(`aClear`,new b(_,1)),y.instanceCount=u;let x=n+t.tile/2,S=r+t.tile/2,w=(d+f)/2;return y.boundingSphere=new T(new C(x,w+.25,S),Math.hypot(t.tile,t.tile)/2+.8),{id:e,geo:y,cx:x,cy:w,cz:S,radius:Math.hypot(t.tile,t.tile)/2+.4,n:u}}function Dt(e){let t=[],n=[],r=Math.max(.2,e),i=3;for(let e=-8;e<40;e+=_t.tile)for(let n=-32;n<32;n+=_t.tile){i+=1;let a=Ze(n+4,e+4);if(a<.06)continue;let o=Math.round((a>.35?220:90)*r),s=Et(`h-${n}-${e}`,_t,n,e,o,i,!0);s&&t.push(s)}for(let e=0;e<32;e+=vt.tile)for(let t=-24;t<24;t+=vt.tile){if(i+=1,Ze(t+3,e+3)<.08)continue;let a=Et(`f-${t}-${e}`,vt,t,e,Math.round(160*r),i,!1);a&&n.push(a)}return{hero:t,fill:n}}function Ot(e,t,n){for(let r of e){let e=n.x-r.cx,i=n.y-r.cy,a=n.z-r.cz,o=xt(t,Math.max(0,Math.hypot(e,i,a)-r.radius)),s=r.geo.userData.mesh;if(!s)continue;if(o<=.001){s.visible=!1;continue}let c=Math.ceil(Math.min(1,o+.02)*r.n);c<2?s.visible=!1:(s.visible=!0,r.geo.instanceCount=c)}}function kt(e,t){return e?ut:t}var At=new C(.756,.36,.547).normalize(),X={color:{value:new Y(`#e4c9a4`)},sun:{value:At.clone()},falloff:{value:.38},near:{value:28},far:{value:140}},jt=`
#include <fog_pars_vertex>
varying vec3 vHeightWorld;
`,Mt=`
#include <fog_vertex>
#if defined USE_INSTANCING || defined USE_INSTANCING_INDIRECT
  vec4 heightWorld = instanceMatrix * vec4(transformed, 1.0);
  vHeightWorld = (modelMatrix * heightWorld).xyz;
#else
  vHeightWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif
`,Nt=`
#include <fog_pars_fragment>
varying vec3 vHeightWorld;
uniform vec3 uHeightFogColor;
uniform vec3 uHeightFogSun;
uniform float uHeightFogFalloff;
uniform float uHeightFogNear;
uniform float uHeightFogFar;
`,Pt=`
float heightDist = distance(cameraPosition, vHeightWorld);
float heightBand = smoothstep(uHeightFogNear, uHeightFogFar, heightDist);
float heightValley = exp(-max(vHeightWorld.y - 0.35, 0.0) * uHeightFogFalloff);
float heightAmt = clamp(heightBand * mix(0.32, 1.08, heightValley), 0.0, 0.9);
vec3 heightTo = normalize(vHeightWorld - cameraPosition);
float heightSun = pow(max(dot(heightTo, normalize(uHeightFogSun)), 0.0), 6.0);
vec3 heightWarm = uHeightFogColor * vec3(1.14, 0.97, 0.76);
vec3 heightCool = uHeightFogColor * vec3(0.78, 0.88, 1.03);
gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(heightCool, heightWarm, heightSun), heightAmt);
`;function Ft(e){let t=e.onBeforeCompile,n=e.customProgramCacheKey.bind(e);return e.onBeforeCompile=(n,r)=>{t.call(e,n,r),n.uniforms.uHeightFogColor=X.color,n.uniforms.uHeightFogSun=X.sun,n.uniforms.uHeightFogFalloff=X.falloff,n.uniforms.uHeightFogNear=X.near,n.uniforms.uHeightFogFar=X.far,n.vertexShader=n.vertexShader.replace(`#include <fog_pars_vertex>`,jt).replace(`#include <fog_vertex>`,Mt),n.fragmentShader=n.fragmentShader.replace(`#include <fog_pars_fragment>`,Nt),n.fragmentShader=n.fragmentShader.includes(`#include <tonemapping_fragment>`)?n.fragmentShader.replace(`#include <tonemapping_fragment>`,`${Pt}\n#include <tonemapping_fragment>`).replace(`#include <fog_fragment>`,``):n.fragmentShader.replace(`#include <fog_fragment>`,Pt)},e.customProgramCacheKey=()=>`height-fog-${n()}`,e}var It=class e extends H{constructor(){let t=e.SkyShader,n=new _e({name:t.name,uniforms:ee.clone(t.uniforms),vertexShader:t.vertexShader,fragmentShader:t.fragmentShader,side:1,depthWrite:!1});super(new fe(1,1,1),n),this.isSky=!0}};It.SkyShader={name:`SkyShader`,uniforms:{turbidity:{value:2},rayleigh:{value:1},mieCoefficient:{value:.005},mieDirectionalG:{value:.8},sunPosition:{value:new C},cloudScale:{value:2e-4},cloudSpeed:{value:2e-5},cloudCoverage:{value:.4},cloudDensity:{value:.4},cloudElevation:{value:.5},showSunDisc:{value:1},time:{value:0}},vertexShader:`
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

		}`};var Lt=class extends H{constructor(e,t,n,r=128){if(t<=0||n<=0||r<=0)throw Error(`THREE.GroundedSkybox: height, radius, and resolution must be positive.`);let i=new D(n,2*r,r);i.scale(1,1,-1);let a=i.getAttribute(`position`),o=new C;for(let e=0;e<a.count;++e)if(o.fromBufferAttribute(a,e),o.y<0){let n=-t*3/2,r=o.y<n?-t/o.y:1-o.y*o.y/(3*n*n);o.multiplyScalar(r),o.toArray(a.array,3*e)}a.needsUpdate=!0,super(i,new K({map:e,depthWrite:!1}))}};function Rt(e){return(`/`.endsWith(`/`)?`/`:`//`)+e.replace(/^\//,``)}var zt=`
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
`,Bt=`
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;function Vt(e,t,n,r,i){let a=new It;a.name=`PreethamSky`,a.scale.setScalar(1e3),a.frustumCulled=!1,a.renderOrder=-20;let o=a.material.uniforms;o.turbidity.value=3.2,o.rayleigh.value=2.1,o.mieCoefficient.value=.004,o.mieDirectionalG.value=.82,o.sunPosition.value.copy(At).multiplyScalar(400),o.cloudCoverage.value=.28,o.cloudDensity.value=.32;let s=a.material;s.depthWrite=!1,s.fog=!1,s.toneMapped=!1;let c=s.onBeforeCompile;s.onBeforeCompile=(e,t)=>{c?.call(s,e,t),e.fragmentShader=e.fragmentShader.replace(`#include <tonemapping_fragment>`,``).replace(`#include <colorspace_fragment>`,``).replace(`gl_FragColor = vec4( texColor, 1.0 );`,`vec3 skyBody = max(texColor - sundiscColor, vec3(0.0));
        float skyLuma = max(dot(skyBody, vec3(0.2126, 0.7152, 0.0722)), 0.0001);
        float skyMapped = log2(1.0 + skyLuma * 0.72) / log2(10.0);
        skyBody *= skyMapped / skyLuma;
        float zenith = smoothstep(0.05, 0.72, direction.y);
        skyBody = mix(skyBody, skyBody * vec3(0.62, 0.78, 1.08), zenith * 0.55);
        float horizon = 1.0 - smoothstep(0.0, 0.18, direction.y);
        skyBody = mix(skyBody, skyBody * vec3(1.18, 0.92, 0.72), horizon * 0.35);
        float sunGlow = pow(max(dot(direction, vSunDirection), 0.0), 6.0);
        skyBody += vec3(0.55, 0.22, 0.05) * sunGlow;
        gl_FragColor = vec4(skyBody + vec3(sundisc) * vec3(8.0, 5.2, 2.0), 1.0);`)};let u=s.customProgramCacheKey?.bind(s);s.customProgramCacheKey=()=>`golden-sky-v2-${u?u():``}`,n.push(s),t.push(a.geometry),e.add(a);let d=$e().goldenSky;if(d!==`off`){let a=d===`1k`?`hdri/alps_field_1k.hdr`:`hdri/alps_field_2k.hdr`;Se.loadAsync(Rt(a)).then(a=>{if(!i()){a.dispose();return}a.colorSpace=le,a.wrapS=l,a.wrapT=l,a.needsUpdate=!0,r.push(a);let o=new Lt(a,6,430,64);o.name=`AlpsRidge`,o.position.y=6,o.frustumCulled=!1,o.renderOrder=-16,t.push(o.geometry);let s=new _e({uniforms:{tMap:{value:a},uBlur:{value:.03},uFogColor:X.color,uSunDir:X.sun},vertexShader:Bt,fragmentShader:zt,transparent:!0,depthWrite:!1,toneMapped:!1,side:1}),c=o.material;o.material=s,Array.isArray(c)||c.dispose(),n.push(s),e.add(o)}).catch(()=>void 0)}return a}function Ht(e){return(`/`.endsWith(`/`)?`/`:`//`)+e.replace(/^\//,``)}var Ut=`
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
`;function Wt(e,t,n,r=!0){let i=new pe(170,170,e,e);i.rotateX(-Math.PI/2);let a=i.attributes.position;for(let e=0;e<a.count;e+=1)a.setY(e,Be(a.getX(e),a.getZ(e)));i.computeVertexNormals();let o=new O(new Uint8Array([210,198,160,255]),1,1);o.needsUpdate=!0,o.wrapS=k,o.wrapT=k,t.push(o);let s={forestC:o,forestR:o,forestA:o,forestN:o,mudC:o,mudR:o,mudA:o,mudN:o,grassC:o,grassN:o,soilC:o,ready:0,normal:0,detail:0,grassReady:0,soilReady:0},c=new J({color:`#6d7a4e`,roughness:.92,metalness:0});r&&Ft(c);let l=c.onBeforeCompile,u=c.customProgramCacheKey.bind(c);c.onBeforeCompile=(e,t)=>{l.call(c,e,t),e.uniforms.tForestC={value:s.forestC},e.uniforms.tForestR={value:s.forestR},e.uniforms.tForestA={value:s.forestA},e.uniforms.tForestN={value:s.forestN},e.uniforms.tMudC={value:s.mudC},e.uniforms.tMudR={value:s.mudR},e.uniforms.tMudA={value:s.mudA},e.uniforms.tMudN={value:s.mudN},e.uniforms.tGrassC={value:s.grassC},e.uniforms.tGrassN={value:s.grassN},e.uniforms.tSoilC={value:s.soilC},e.uniforms.uGroundReady={value:s.ready},e.uniforms.uGroundNormal={value:s.normal},e.uniforms.uGroundDetail={value:s.detail},e.uniforms.uGrassReady={value:s.grassReady},e.uniforms.uSoilReady={value:s.soilReady},c.userData.groundUniforms=e.uniforms,e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
varying vec3 vGroundWorld;
varying vec3 vGroundNormal;`).replace(`#include <begin_vertex>`,`#include <begin_vertex>
vGroundWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vGroundNormal = normalize(mat3(modelMatrix) * objectNormal);`),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>\n${Ut}`).replace(`#include <roughnessmap_fragment>`,`#include <roughnessmap_fragment>
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
}`)},c.customProgramCacheKey=()=>`golden-ground-v3-${u()}`;let d=new H(i,c);d.receiveShadow=!0,d.name=`Terrain`,n.push(c);let f=(e,n)=>Ee.loadAsync(Ht(`textures/${e}/${n}.ktx2`)).then(e=>(e.colorSpace=``,e.wrapS=k,e.wrapT=k,e.anisotropy=We(),t.push(e),e)),p=()=>{let e=c.userData.groundUniforms;e&&(e.tForestC.value=s.forestC,e.tForestR.value=s.forestR,e.tForestA.value=s.forestA,e.tForestN.value=s.forestN,e.tMudC.value=s.mudC,e.tMudR.value=s.mudR,e.tMudA.value=s.mudA,e.tMudN.value=s.mudN,e.tGrassC.value=s.grassC,e.tGrassN.value=s.grassN,e.tSoilC.value=s.soilC,e.uGroundReady.value=s.ready,e.uGroundNormal.value=s.normal,e.uGroundDetail.value=s.detail,e.uGrassReady.value=s.grassReady,e.uSoilReady.value=s.soilReady)},m=$e().ground===`full`,h=m?[f(`forrest_ground_01`,`diff`),f(`forrest_ground_01`,`rough`),f(`forrest_ground_01`,`ao`),f(`forrest_ground_01`,`nor_gl`),f(`brown_mud_leaves_01`,`diff`),f(`brown_mud_leaves_01`,`rough`),f(`brown_mud_leaves_01`,`ao`),f(`brown_mud_leaves_01`,`nor_gl`)]:[f(`forrest_ground_01`,`diff`),f(`brown_mud_leaves_01`,`diff`)];Oe().then(()=>Promise.all(h)).then(e=>{if(m){let[t,n,r,i,a,o,c,l]=e;s.forestC=t,s.forestR=n,s.forestA=r,s.forestN=i,s.mudC=a,s.mudR=o,s.mudA=c,s.mudN=l,s.normal=1,s.detail=1}else{let[t,n]=e;s.forestC=t,s.mudC=n}s.ready=1,p()}).catch(()=>void 0);let g=new N,_=e=>g.loadAsync(Ht(e)).then(e=>(e.colorSpace=``,e.wrapS=k,e.wrapT=k,e.anisotropy=We(),t.push(e),e)),v=m?[_(`textures/grass004/diff.jpg`),_(`textures/grass004/nor_gl.jpg`)]:[_(`textures/grass004/diff.jpg`)];return Promise.all(v).then(e=>{s.grassC=e[0],e[1]&&(s.grassN=e[1]),s.grassReady=1,p()}).catch(()=>void 0),m&&_(`textures/ground037/diff.jpg`).then(e=>{s.soilC=e,s.soilReady=1,p()}).catch(()=>void 0),d}function Gt(e,t,n){n[0]=e[0]>t[0]?t[0]:e[0],n[1]=e[1]<t[1]?t[1]:e[1],n[2]=e[2]>t[2]?t[2]:e[2],n[3]=e[3]<t[3]?t[3]:e[3],n[4]=e[4]>t[4]?t[4]:e[4],n[5]=e[5]<t[5]?t[5]:e[5]}function Kt(e,t,n){let r=!1,i=e[0]>t[0]?t[0]:e[0],a=e[1]<t[1]?t[1]:e[1],o=e[2]>t[2]?t[2]:e[2],s=e[3]<t[3]?t[3]:e[3],c=e[4]>t[4]?t[4]:e[4],l=e[5]<t[5]?t[5]:e[5];return n[0]>i&&(n[0]=i,r=!0),n[1]<a&&(n[1]=a,r=!0),n[2]>o&&(n[2]=o,r=!0),n[3]<s&&(n[3]=s,r=!0),n[4]>c&&(n[4]=c,r=!0),n[5]<l&&(n[5]=l,r=!0),r}function qt(e,t){return!(t[0]>e[0]||t[1]<e[1]||t[2]>e[2]||t[3]<e[3]||t[4]>e[4]||t[5]<e[5])}function Jt(e,t){let n=!1;return t[0]>e[0]&&(t[0]=e[0],n=!0),t[1]<e[1]&&(t[1]=e[1],n=!0),t[2]>e[2]&&(t[2]=e[2],n=!0),t[3]<e[3]&&(t[3]=e[3],n=!0),t[4]>e[4]&&(t[4]=e[4],n=!0),t[5]<e[5]&&(t[5]=e[5],n=!0),n}function Yt(e,t){e[0]-=t,e[1]+=t,e[2]-=t,e[3]+=t,e[4]-=t,e[5]+=t}function Xt(e){let t=e[1]-e[0],n=e[3]-e[2],r=e[5]-e[4];return 2*(t*n+n*r+r*t)}function Zt(e,t){let n=e[0]>t[0]?t[0]:e[0],r=e[1]<t[1]?t[1]:e[1],i=e[2]>t[2]?t[2]:e[2],a=e[3]<t[3]?t[3]:e[3],o=e[4]>t[4]?t[4]:e[4],s=e[5]<t[5]?t[5]:e[5],c=r-n,l=a-i,u=s-o;return 2*(c*l+l*u+u*c)}function Qt(e){let t=e[1]-e[0],n=e[3]-e[2],r=e[5]-e[4];return t>n?t>r?0:2:n>r?1:2}function $t(e,t){let n=e[0]-t[0],r=t[0]-e[1],i=n>r?n:r;i<0&&(i=0);let a=e[2]-t[1],o=t[1]-e[3],s=a>o?a:o;s<0&&(s=0);let c=e[4]-t[2],l=t[2]-e[5],u=c>l?c:l;return u<0&&(u=0),i*i+s*s+u*u}function en(e,t){let n,r,i,a,o,s,c=e[0]-t[0],l=t[0]-e[1];c>l?(n=c,r=l):(n=l,r=c),n<0&&(n=0);let u=e[2]-t[1],d=t[1]-e[3];u>d?(i=u,a=d):(i=d,a=u),i<0&&(i=0);let f=e[4]-t[2],p=t[2]-e[5];return f>p?(o=f,s=p):(o=p,s=f),o<0&&(o=0),{min:n*n+i*i+o*o,max:r*r+a*a+s*s}}var tn=class{constructor(){this.array=[]}clear(){this.array=[]}push(e){let t=this.array,n=e.inheritedCost,r=t.length>6?t.length-6:0,i;for(i=t.length-1;i>=r&&!(n<=t[i].inheritedCost);i--);i>t.length-7&&t.splice(i+1,0,e)}pop(){return this.array.pop()}},nn=class{constructor(e=!1){this.root=null,this._sortedList=new tn,this.count=0,this.highPrecision=e,this._typeArray=e?Float64Array:Float32Array}createFromArray(e,t,n,r=0){let i=t.length,a=this._typeArray;a!==(t[0].BYTES_PER_ELEMENT===4?Float32Array:Float64Array)&&console.warn(`Different precision.`);let o=new a(6),s,c;this.root=l(0,i,null);function l(i,a,o){if(a===1){let a=t[i];r>0&&Yt(a,r);let s={box:a,object:e[i],parent:o};return n&&n(s),s}let s=u(i,a);d();let c=f(i,a);(c===i||c===i+a)&&(c=i+(a>>1));let p={box:s,parent:o};return p.left=l(i,c-i,p),p.right=l(c,a-c+i,p),p}function u(e,n){let i=new a(6),s=e+n;i[0]=1/0,i[1]=-1/0,i[2]=1/0,i[3]=-1/0,i[4]=1/0,i[5]=-1/0,o[0]=1/0,o[1]=-1/0,o[2]=1/0,o[3]=-1/0,o[4]=1/0,o[5]=-1/0;for(let n=e;n<s;n++){let e=t[n],r=e[0],a=e[1],s=e[2],c=e[3],l=e[4],u=e[5];i[0]>r&&(i[0]=r),i[1]<a&&(i[1]=a),i[2]>s&&(i[2]=s),i[3]<c&&(i[3]=c),i[4]>l&&(i[4]=l),i[5]<u&&(i[5]=u);let d=(a+r)*.5,f=(c+s)*.5,p=(u+l)*.5;o[0]>d&&(o[0]=d),o[1]<d&&(o[1]=d),o[2]>f&&(o[2]=f),o[3]<f&&(o[3]=f),o[4]>p&&(o[4]=p),o[5]<p&&(o[5]=p)}return i[0]-=r,i[1]+=r,i[2]-=r,i[3]+=r,i[4]-=r,i[5]+=r,i}function d(){s=Qt(o)*2,c=(o[s]+o[s+1])*.5}function f(n,r){let i=n,a=n+r-1;for(;i<=a;){let n=t[i];if((n[s+1]+n[s])*.5>=c)for(;;){let n=t[a];if((n[s+1]+n[s])*.5<c){let n=e[i];e[i]=e[a],e[a]=n;let r=t[i];t[i]=t[a],t[a]=r,a--;break}if(a--,a<=i)return i}i++}return i}}insert(e,t,n){n>0&&Yt(t,n);let r=this.createLeafNode(e,t);return this.root===null?this.root=r:this.insertLeaf(r),this.count++,r}insertRange(e,t,n,r){console.warn(`Method not optimized yet. It just calls 'insert' N times.`);let i=e.length,a=n>0?n:n?null:0;for(let o=0;o<i;o++){let i=this.insert(e[o],t[o],a??n[o]);r&&r(i)}}move(e,t){if(!e.parent||qt(e.box,e.parent.box)){t>0&&Yt(e.box,t);return}t>0&&Yt(e.box,t);let n=this.delete(e);this.insertLeaf(e,n),this.count++}delete(e){let t=e.parent;if(t===null)return this.root=null,null;let n=t.parent,r=t.left===e?t.right:t.left;return r.parent=n,e.parent=null,n===null?(this.root=r,t):(n.left===t?n.left=r:n.right=r,this.refit(n),this.count--,t)}clear(){this.root=null}insertLeaf(e,t){let n=this.findBestSibling(e.box),r=n.parent;t===void 0?t=this.createInternalNode(r,n,e):(t.parent=r,t.left=n,t.right=e),n.parent=t,e.parent=t,r===null?this.root=t:r.left===n?r.left=t:r.right=t,this.refitAndRotate(e,n)}createLeafNode(e,t){return{box:t,object:e,parent:null}}createInternalNode(e,t,n){return{parent:e,left:t,right:n,box:new this._typeArray(6)}}findBestSibling(e){let t=this.root,n=t,r=Zt(e,t.box),i=Xt(e);if(t.object!==void 0)return t;let a=this._sortedList;a.clear();let o={node:t,inheritedCost:r-Xt(t.box)};do{let{node:t,inheritedCost:s}=o;if(i+s>=r)break;let c=t.left,l=t.right,u=Zt(e,c.box)+s,d=u-Xt(c.box),f=Zt(e,l.box)+s,p=f-Xt(l.box);if(u>f?r>f&&(n=l,r=f):r>u&&(n=c,r=u),p>d){if(i+d>=r||(c.object===void 0&&a.push({node:c,inheritedCost:d}),i+p>=r))continue;l.object===void 0&&a.push({node:l,inheritedCost:p})}else{if(i+p>=r||(l.object===void 0&&a.push({node:l,inheritedCost:p}),i+d>=r))continue;c.object===void 0&&a.push({node:c,inheritedCost:d})}}while(o=a.pop());return n}refit(e){for(Gt(e.left.box,e.right.box,e.box);e=e.parent;)if(!Kt(e.left.box,e.right.box,e.box))return}refitAndRotate(e,t){let n=e.box;e=e.parent;let r=e.box;for(Gt(n,t.box,r);e=e.parent;){let t=e.box;if(!Jt(n,t))return;let r=e.left,i=e.right,a=r.box,o=i.box,s=null,c=null,l=0;if(i.object===void 0){let e=i.left,t=i.right,n=Xt(i.box),o=n-Zt(a,e.box),u=n-Zt(a,t.box);o>u?o>0&&(s=r,c=t,l=o):u>0&&(s=r,c=e,l=u)}if(r.object===void 0){let e=r.left,t=r.right,n=Xt(r.box),a=n-Zt(o,e.box),u=n-Zt(o,t.box);a>u?a>l&&(s=i,c=t):u>l&&(s=i,c=e)}s!==null&&this.swap(s,c)}}swap(e,t){let n=e.parent,r=t.parent,i=r.box;n.left===e?n.left=t:n.right=t,r.left===t?r.left=e:r.right=e,e.parent=r,t.parent=n,Gt(r.left.box,r.right.box,i)}},rn=class{constructor(e,t){this.coordinateSystem=t,this.array=e?new Float64Array(24):new Float32Array(24)}setFromProjectionMatrix(e){if(this.updatePlane(0,e[3]+e[0],e[7]+e[4],e[11]+e[8],e[15]+e[12]),this.updatePlane(1,e[3]-e[0],e[7]-e[4],e[11]-e[8],e[15]-e[12]),this.updatePlane(2,e[3]-e[1],e[7]-e[5],e[11]-e[9],e[15]-e[13]),this.updatePlane(3,e[3]+e[1],e[7]+e[5],e[11]+e[9],e[15]+e[13]),this.updatePlane(4,e[3]-e[2],e[7]-e[6],e[11]-e[10],e[15]-e[14]),this.coordinateSystem===0)this.updatePlane(5,e[3]+e[2],e[7]+e[6],e[11]+e[10],e[15]+e[14]);else if(this.coordinateSystem===1)this.updatePlane(5,e[2],e[6],e[10],e[14]);else throw Error(`Invalid coordinate system: `+this.coordinateSystem);return this}updatePlane(e,t,n,r,i){let a=this.array,o=e*4,s=Math.sqrt(t*t+n*n+r*r);a[o+0]=t/s,a[o+1]=n/s,a[o+2]=r/s,a[o+3]=i/s}intersectsBoxMask(e,t){let n=this.array,r,i,a,o,s,c;for(let l=0;l<6;l++){if(!(t&32>>l))continue;let u=l*4,d=n[u+0],f=n[u+1],p=n[u+2],m=n[u+3];if(d>0?(r=e[1],o=e[0]):(r=e[0],o=e[1]),f>0?(i=e[3],s=e[2]):(i=e[2],s=e[3]),p>0?(a=e[5],c=e[4]):(a=e[4],c=e[5]),d*r+f*i+p*a<-m)return-1;d*o+f*s+p*c>-m&&(t^=32>>l)}return t}isIntersected(e,t){let n=this.array;for(let r=0;r<6;r++){if(!(t&32>>r))continue;let i=r*4,a=n[i+0],o=n[i+1],s=n[i+2],c=n[i+3],l=a>0?e[1]:e[0],u=o>0?e[3]:e[2],d=s>0?e[5]:e[4];if(a*l+o*u+s*d<-c)return!1}return!0}isIntersectedMargin(e,t,n){if(t===0)return!0;let r=this.array;for(let i=0;i<6;i++){if(!(t&32>>i))continue;let a=i*4,o=r[a+0],s=r[a+1],c=r[a+2],l=r[a+3],u=o>0?e[1]-n:e[0]+n,d=s>0?e[3]-n:e[2]+n,f=c>0?e[5]-n:e[4]+n;if(o*u+s*d+c*f<-l)return!1}return!0}};function an(e,t,n,r,i,a){let o=r[0],s=t[0],c=n[0],l=(e[o]-s)*c,u=(e[o^1]-s)*c,d=l>0?l:0,f=u<1/0?u:1/0;return o=r[1],s=t[1],c=n[1],l=(e[o+2]-s)*c,l>f||(u=(e[o^3]-s)*c,d>u)||(d=l>d?l:d,f=u<f?u:f,o=r[2],s=t[2],c=n[2],l=(e[o+4]-s)*c,l>f)||(u=(e[o^5]-s)*c,d>u)?!1:(d=l>d?l:d,f=u<f?u:f,d<=a&&f>=i)}function on(e,t){return e[1]>=t[0]&&t[1]>=e[0]&&e[3]>=t[2]&&t[3]>=e[2]&&e[5]>=t[4]&&t[5]>=e[4]}function sn(e,t,n){return $t(n,e)<=t*t}var cn=class{constructor(e,t=0){this._sign=new Uint8Array(3),this.builder=e;let n=e.highPrecision;this.frustum=new rn(n,t),this._dirInv=n?new Float64Array(3):new Float32Array(3)}get root(){return this.builder.root}createFromArray(e,t,n,r){e?.length>0&&this.builder.createFromArray(e,t,n,r)}insert(e,t,n){return this.builder.insert(e,t,n)}insertRange(e,t,n,r){e?.length>0&&this.builder.insertRange(e,t,n,r)}move(e,t){this.builder.move(e,t)}delete(e){return this.builder.delete(e)}clear(){this.builder.clear()}traverse(e){if(this.root===null)return;t(this.root,0);function t(n,r){if(n.object!==void 0){e(n,r);return}e(n,r)||(t(n.left,r+1),t(n.right,r+1))}}intersectsRay(e,t,n,r=0,i=1/0){if(this.root===null)return!1;let a=this._dirInv,o=this._sign;return a[0]=1/e[0],a[1]=1/e[1],a[2]=1/e[2],o[0]=+(a[0]<0),o[1]=+(a[1]<0),o[2]=+(a[2]<0),s(this.root);function s(e){return an(e.box,t,a,o,r,i)?e.object===void 0?s(e.left)||s(e.right):n(e.object):!1}}intersectsBox(e,t){return this.root!==null&&n(this.root);function n(r){return on(e,r.box)?r.object===void 0?n(r.left)||n(r.right):t(r.object):!1}}intersectsSphere(e,t,n){return this.root!==null&&r(this.root);function r(i){return sn(e,t,i.box)?i.object===void 0?r(i.left)||r(i.right):n(i.object):!1}}isNodeIntersected(e,t){let n=e.box,r;for(;r=e.parent;){if(i(r.left===e?r.right:r.left))return!0;e=r}return!1;function i(e){return on(n,e.box)?e.object===void 0?i(e.left)||i(e.right):t(e.object):!1}}rayIntersections(e,t,n,r=0,i=1/0){if(this.root===null)return;let a=this._dirInv,o=this._sign;a[0]=1/e[0],a[1]=1/e[1],a[2]=1/e[2],o[0]=+(a[0]<0),o[1]=+(a[1]<0),o[2]=+(a[2]<0),s(this.root);function s(e){if(an(e.box,t,a,o,r,i)){if(e.object!==void 0){n(e.object);return}s(e.left),s(e.right)}}}frustumCulling(e,t){if(this.root===null)return;let n=this.frustum.setFromProjectionMatrix(e);r(this.root,63);function r(e,a){if(e.object!==void 0){n.isIntersected(e.box,a)&&t(e,n,a);return}if(a=n.intersectsBoxMask(e.box,a),!(a<0)){if(a===0){i(e.left),i(e.right);return}r(e.left,a),r(e.right,a)}}function i(e){if(e.object!==void 0){t(e,n,0);return}i(e.left),i(e.right)}}frustumCullingLOD(e,t,n,r){if(this.root===null)return;let i=this.frustum.setFromProjectionMatrix(e);a(this.root,63,null);function a(e,t,n){let c=e.box;if(n===null&&(n=s(c)),e.object!==void 0){i.isIntersected(c,t)&&r(e,n,i,t);return}if(t=i.intersectsBoxMask(c,t),!(t<0)){if(t===0){o(e.left,n),o(e.right,n);return}a(e.left,t,n),a(e.right,t,n)}}function o(e,t){if(t===null&&(t=s(e.box)),e.object!==void 0){r(e,t,i,0);return}o(e.left,t),o(e.right,t)}function s(e){let{min:r,max:i}=en(e,t);for(let e=n.length-1;e>0;e--)if(i>=n[e])return r>=n[e]?e:null;return 0}}closestPointToPoint(e,t){if(this.root===null)return;let n=1/0;return r(this.root),Math.sqrt(n);function r(i){if(i.object!==void 0){if(t){let r=t(i.object)??$t(i.box,e);r<n&&(n=r)}else n=$t(i.box,e);return}let a=$t(i.left.box,e),o=$t(i.right.box,e);a<o?a<n&&(r(i.left),o<n&&r(i.right)):o<n&&(r(i.right),a<n&&r(i.left))}}};function ln(e,t){return t[0]=e.x,t[1]=e.y,t[2]=e.z,t}function un(e,t){let n=e.min,r=e.max;return t[0]=n.x,t[1]=r.x,t[2]=n.y,t[3]=r.y,t[4]=n.z,t[5]=r.z,t}var dn=class{constructor(e,t,n){if(this.isInstanceEntity=!0,this.position=new C,this.scale=new C(1,1,1),this.quaternion=new oe,this.id=t,this.owner=e,n){let e=this.quaternion,t=this.rotation=new h;t._onChange(()=>e.setFromEuler(t,!1)),e._onChange(()=>t.setFromQuaternion(e,void 0,!1))}}get visible(){return this.owner.getVisibilityAt(this.id)}set visible(e){this.owner.setVisibilityAt(this.id,e)}get active(){return this.owner.getActiveAt(this.id)}set active(e){this.owner.setActiveAt(this.id,e)}get color(){return this.owner.getColorAt(this.id)}set color(e){this.owner.setColorAt(this.id,e)}get opacity(){return this.owner.getOpacityAt(this.id)}set opacity(e){this.owner.setOpacityAt(this.id,e)}get morph(){return this.owner.getMorphAt(this.id)}set morph(e){this.owner.setMorphAt(this.id,e)}get matrix(){return this.owner.getMatrixAt(this.id)}get matrixWorld(){return this.matrix.premultiply(this.owner.matrixWorld)}setMatrixIdentity(){let e=this.owner,t=e.matricesTexture._data,n=this.id,r=n*16;t[r+0]=1,t[r+1]=0,t[r+2]=0,t[r+3]=0,t[r+4]=0,t[r+5]=1,t[r+6]=0,t[r+7]=0,t[r+8]=0,t[r+9]=0,t[r+10]=1,t[r+11]=0,t[r+12]=0,t[r+13]=0,t[r+14]=0,t[r+15]=1,e.matricesTexture.enqueueUpdate(n)}updateMatrix(){let e=this.owner,t=this.position,n=this.quaternion,r=this.scale,i=e.matricesTexture._data,a=this.id,o=a*16,s=n._x,c=n._y,l=n._z,u=n._w,d=s+s,f=c+c,p=l+l,m=s*d,h=s*f,g=s*p,_=c*f,v=c*p,y=l*p,b=u*d,x=u*f,S=u*p,C=r.x,w=r.y,T=r.z;i[o+0]=(1-(_+y))*C,i[o+1]=(h+S)*C,i[o+2]=(g-x)*C,i[o+3]=0,i[o+4]=(h-S)*w,i[o+5]=(1-(m+y))*w,i[o+6]=(v+b)*w,i[o+7]=0,i[o+8]=(g+x)*T,i[o+9]=(v-b)*T,i[o+10]=(1-(m+_))*T,i[o+11]=0,i[o+12]=t.x,i[o+13]=t.y,i[o+14]=t.z,i[o+15]=1,e.matricesTexture.enqueueUpdate(a),e.bvh&&e.autoUpdateBVH&&e.bvh.move(a)}updateMatrixPosition(){let e=this.owner,t=this.position,n=e.matricesTexture._data,r=this.id,i=r*16;n[i+12]=t.x,n[i+13]=t.y,n[i+14]=t.z,e.matricesTexture.enqueueUpdate(r),e.bvh&&e.autoUpdateBVH&&e.bvh.move(r)}getUniform(e,t){return this.owner.getUniformAt(this.id,e,t)}updateBones(e=!0,t){this.owner.setBonesAt(this.id,e,t)}setUniform(e,t){this.owner.setUniformAt(this.id,e,t)}copyTo(e){e.position.copy(this.position),e.scale.copy(this.scale),e.quaternion.copy(this.quaternion),this.rotation&&e.rotation.copy(this.rotation)}applyMatrix4(e){return this.matrix.premultiply(e).decompose(this.position,this.quaternion,this.scale),this}applyQuaternion(e){return this.quaternion.premultiply(e),this}rotateOnAxis(e,t){return fn.setFromAxisAngle(e,t),this.quaternion.multiply(fn),this}rotateOnWorldAxis(e,t){return fn.setFromAxisAngle(e,t),this.quaternion.premultiply(fn),this}rotateX(e){return this.rotateOnAxis(mn,e)}rotateY(e){return this.rotateOnAxis(hn,e)}rotateZ(e){return this.rotateOnAxis(gn,e)}translateOnAxis(e,t){return pn.copy(e).applyQuaternion(this.quaternion),this.position.add(pn.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(mn,e)}translateY(e){return this.translateOnAxis(hn,e)}translateZ(e){return this.translateOnAxis(gn,e)}remove(){return this.owner.removeInstances(this.id),this}},fn=new oe,pn=new C,mn=new C(1,0,0),hn=new C(0,1,0),gn=new C(0,0,1),_n=class{constructor(e,t=0,n=!1,r=!0){this.nodesMap=new Map,this.LODsMap=new Map,this._geoBoundingSphere=null,this._sphereTarget=null,this.target=e,this.accurateCulling=r,this._margin=t;let i=e._geometry;if(i.boundingBox||i.computeBoundingBox(),this.geoBoundingBox=i.boundingBox,n){i.boundingSphere||i.computeBoundingSphere();let e=i.boundingSphere.center;e.x===0&&e.y===0&&e.z===0?(this._geoBoundingSphere=i.boundingSphere,this._sphereTarget={centerX:0,centerY:0,centerZ:0,maxScale:0}):(console.warn(`"getBoxFromSphere" is ignored because geometry is not centered.`),n=!1)}this.bvh=new cn(new nn,0),this._origin=new Float32Array(3),this._dir=new Float32Array(3),this._cameraPos=new Float32Array(3),this._getBoxFromSphere=n}create(){let e=this.target._instancesCount,t=this.target._instancesArrayCount,n=Array(e),r=new Uint32Array(e),i=0;this.clear();for(let e=0;e<t;e++)this.target.getActiveAt(e)&&(n[i]=this.getBox(e,new Float32Array(6)),r[i]=e,i++);this.bvh.createFromArray(r,n,e=>{this.nodesMap.set(e.object,e)},this._margin)}insert(e){let t=this.bvh.insert(e,this.getBox(e,new Float32Array(6)),this._margin);this.nodesMap.set(e,t)}insertRange(e){let t=e.length,n=Array(t);for(let r=0;r<t;r++)n[r]=this.getBox(e[r],new Float32Array(6));this.bvh.insertRange(e,n,this._margin,e=>{this.nodesMap.set(e.object,e)})}move(e){let t=this.nodesMap.get(e);t&&(this.getBox(e,t.box),this.bvh.move(t,this._margin))}delete(e){let t=this.nodesMap.get(e);t&&(this.bvh.delete(t),this.nodesMap.delete(e))}clear(){this.bvh.clear(),this.nodesMap.clear()}frustumCulling(e,t){this._margin>0&&this.accurateCulling?this.bvh.frustumCulling(e.elements,(e,n,r)=>{n.isIntersectedMargin(e.box,r,this._margin)&&t(e)}):this.bvh.frustumCulling(e.elements,t)}frustumCullingLOD(e,t,n,r){this.LODsMap.has(n)||this.LODsMap.set(n,new Float32Array(n.length));let i=this.LODsMap.get(n);for(let e=0;e<n.length;e++)i[e]=n[e].distance;let a=this._cameraPos;a[0]=t.x,a[1]=t.y,a[2]=t.z,this._margin>0&&this.accurateCulling?this.bvh.frustumCullingLOD(e.elements,a,i,(e,t,n,i)=>{n.isIntersectedMargin(e.box,i,this._margin)&&r(e,t)}):this.bvh.frustumCullingLOD(e.elements,a,i,r)}raycast(e,t){let n=e.ray,r=this._origin,i=this._dir;ln(n.origin,r),ln(n.direction,i),this.bvh.rayIntersections(i,r,t,e.near,e.far)}intersectBox(e,t){this._boxArray||=new Float32Array(6);let n=this._boxArray;return un(e,n),this.bvh.intersectsBox(n,t)}getBox(e,t){if(this._getBoxFromSphere){let n=this.target.matricesTexture._data,{centerX:r,centerY:i,centerZ:a,maxScale:o}=this.getSphereFromMatrix_centeredGeometry(e,n,this._sphereTarget),s=this._geoBoundingSphere.radius*o;t[0]=r-s,t[1]=r+s,t[2]=i-s,t[3]=i+s,t[4]=a-s,t[5]=a+s}else vn.copy(this.geoBoundingBox).applyMatrix4(this.target.getMatrixAt(e)),un(vn,t);return t}getSphereFromMatrix_centeredGeometry(e,t,n){let r=e*16,i=t[r+0],a=t[r+1],o=t[r+2],s=t[r+4],c=t[r+5],l=t[r+6],u=t[r+8],d=t[r+9],f=t[r+10],p=i*i+a*a+o*o,m=s*s+c*c+l*l,h=u*u+d*d+f*f;return n.maxScale=Math.sqrt(Math.max(p,m,h)),n.centerX=t[r+12],n.centerY=t[r+13],n.centerZ=t[r+14],n}},vn=new U,yn=class extends v{constructor(e,t,n,r,i,a=1){let o=e.createBuffer();super(o,t,n,r,i.length/n),this.isGLInstancedBufferAttribute=!0,this._needsUpdate=!1,this.isInstancedBufferAttribute=!0,this.meshPerAttribute=a,this.array=i,this._cacheArray=i,e.bindBuffer(e.ARRAY_BUFFER,o),e.bufferData(e.ARRAY_BUFFER,i,e.DYNAMIC_DRAW)}update(e,t){if(!this._needsUpdate||t===0)return;let n=e.getContext();n.bindBuffer(n.ARRAY_BUFFER,this.buffer),this.array===this._cacheArray?n.bufferSubData(n.ARRAY_BUFFER,0,this.array,0,t):(n.bufferData(n.ARRAY_BUFFER,this.array,n.DYNAMIC_DRAW),this._cacheArray=this.array),this._needsUpdate=!1}clone(){return this}},bn=null,xn=null,Sn={};function Cn(e){return xn.get(e)?.()??bn(e)}function wn(e){if(xn.has(e))return;let t={};xn.set(e,()=>{if(e.isMeshDistanceMaterial){let n=bn(e);t.light=n.light}return t})}function Tn(e,t,n){let r=t.properties;bn=r.get;let i=`${!!e.colorsTexture}_${e._useOpacity}_${!!e.boneTexture}_${!!e.uniformsTexture}`;Sn[i]??=new WeakMap,xn=Sn[i],r.get=Cn,wn(n)}function En(e){e.properties.get=bn}function Dn(e,t){return Math.max(t,Math.ceil(Math.sqrt(e/t))*t)}function On(e,t,n,r){t===3&&(console.warn(`"channels" cannot be 3. Set to 4. More info: https://github.com/mrdoob/three.js/pull/23228`),t=4);let i=Dn(r,n),a=new e(i*i*t),o=e.name.includes(`Float`),s=e.name.includes(`Uint`),c=o?M:s?te:re,l;switch(t){case 1:l=o?m:f;break;case 2:l=o?u:Me;break;case 4:l=o?Pe:P}return{array:a,size:i,type:c,format:l}}var kn=class extends O{constructor(e,t,n,r,i,a){t===3&&(t=4);let{array:o,format:s,size:c,type:l}=On(e,t,n,r);super(o,c,c,s,l),this.partialUpdate=!0,this.maxUpdateCalls=1/0,this._utils=null,this._needsUpdate=!0,this._lastWidth=-1,this._data=o,this._channels=t,this._pixelsPerInstance=n,this._stride=n*t,this._rowToUpdate=Array(c),this._uniformMap=i,this._fetchUniformsInFragmentShader=a,this.needsUpdate=!0}resize(e){let t=Dn(e,this._pixelsPerInstance);if(t===this.image.width)return;let n=this._data,r=this._channels;this._rowToUpdate.length=t;let i=n.constructor,a=new i(t*t*r),o=Math.min(n.length,a.length);a.set(new i(n.buffer,0,o)),this.dispose(),this.image={data:a,height:t,width:t},this._data=a}enqueueUpdate(e){if(this._needsUpdate=!0,!this.partialUpdate)return;let t=this.image.width/this._pixelsPerInstance,n=Math.floor(e/t);this._rowToUpdate[n]=!0}bindToProgram(e,t,n,r,i){if(!r[i])return;r[i].value=this;let a=this.getSlot(n,i);if(a===void 0)return;let o=e.properties.get(this);e.state.bindTexture(t.TEXTURE_2D,o.__webglTexture,t.TEXTURE0+a)}update(e,t,n){let r=e.properties.get(this),i=r.__version!==this.version;if(!this._needsUpdate&&!i)return;let a=this._lastWidth!==this.image.width;if(!r.__webglTexture||a)e.initTexture(this);else{let i=this.getSlot(t,n)??e.capabilities.maxTextures-1;this.partialUpdate?this.updatePartial(r,e,i):this.updateFull(r,e,i),r.__version=this.version}this._lastWidth=this.image.width,this._needsUpdate=!1}getSlot(e,t){return e[t]?.cache[0]}updateFull(e,t,n){this.updateRows(e,t,[{row:0,count:this.image.height}],n)}updatePartial(e,t,n){let r=this.getUpdateRowsInfo();r.length!==0&&(r.length>this.maxUpdateCalls?this.updateFull(e,t,n):this.updateRows(e,t,r,n),this._rowToUpdate.fill(!1))}getUpdateRowsInfo(){let e=this._rowToUpdate,t=[];for(let n=0,r=e.length;n<r;n++)if(e[n]){let i=n;for(;n<r&&e[n];n++);t.push({row:i,count:n-i})}return t}updateRows(e,t,n,r){let i=t.getContext();this._utils??=new ce(i,t.extensions,t.capabilities);let a=this._utils.convert(this.format),o=this._utils.convert(this.type),{data:s,width:c}=this.image,l=this._channels;t.state.activeTexture(i.TEXTURE0+r),t.state.bindTexture(i.TEXTURE_2D,e.__webglTexture,i.TEXTURE0+r);let u=F.getPrimaries(F.workingColorSpace),d=this.colorSpace===``?null:F.getPrimaries(this.colorSpace),f=this.colorSpace===``||u===d?i.NONE:i.BROWSER_DEFAULT_WEBGL,p=i.getParameter(i.UNPACK_FLIP_Y_WEBGL),m=i.getParameter(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL),h=i.getParameter(i.UNPACK_ALIGNMENT),g=i.getParameter(i.UNPACK_COLORSPACE_CONVERSION_WEBGL);i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,this.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,this.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,this.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,f);for(let{count:e,row:t}of n)i.texSubImage2D(i.TEXTURE_2D,0,0,t,c,e,a,o,s,t*c*l);i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,p),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,m),i.pixelStorei(i.UNPACK_ALIGNMENT,h),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,g),this.onUpdate?.(this)}setUniformAt(e,t,n){let{offset:r,size:i}=this._uniformMap.get(t),a=this._stride;i===1?this._data[e*a+r]=n:n.toArray(this._data,e*a+r)}getUniformAt(e,t,n){let{offset:r,size:i}=this._uniformMap.get(t),a=this._stride;return i===1?this._data[e*a+r]:n.fromArray(this._data,e*a+r)}getUniformsGLSL(e,t,n){return{vertex:this.getUniformsVertexGLSL(e,t,n),fragment:this.getUniformsFragmentGLSL(e,t,n)}}getUniformsVertexGLSL(e,t,n){if(this._fetchUniformsInFragmentShader)return`
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
`;return{declareVarying:t,assignVarying:n,getVarying:r}}getUniformComponents(e,t){let n=e%this._channels,r=``;for(let e=0;e<t;e++)r+=An[n+e];return r}copy(e){return super.copy(e),this.partialUpdate=e.partialUpdate,this.maxUpdateCalls=e.maxUpdateCalls,this._channels=e._channels,this._pixelsPerInstance=e._pixelsPerInstance,this._stride=e._stride,this._rowToUpdate=e._rowToUpdate,this._uniformMap=e._uniformMap,this._fetchUniformsInFragmentShader=e._fetchUniformsInFragmentShader,this}},An=[`r`,`g`,`b`,`a`],Z=class extends H{constructor(e,t,n={},r){if(!e)throw Error(`"geometry" is mandatory.`);if(!t)throw Error(`"material" is mandatory.`);let{allowsEuler:i,renderer:a,createEntities:o}=n;super(e,null),this.type=`InstancedMesh2`,this.isInstancedMesh2=!0,this.instances=null,this.instanceIndex=null,this.colorsTexture=null,this.morphTexture=null,this.boneTexture=null,this.uniformsTexture=null,this.boundingBox=null,this.boundingSphere=null,this.bvh=null,this.customSort=null,this.raycastOnlyFrustum=!1,this.LODinfo=null,this.autoUpdate=!0,this.bindMode=Ce,this.bindMatrix=null,this.bindMatrixInverse=null,this.skeleton=null,this.autoUpdateBVH=!0,this.onFrustumEnter=null,this._renderer=null,this._instancesCount=0,this._instancesArrayCount=0,this._perObjectFrustumCulled=!0,this._sortObjects=!1,this._indexArrayNeedsUpdate=!1,this._useOpacity=!1,this._currentMaterial=null,this._customProgramCacheKeyBase=null,this._onBeforeCompileBase=null,this._definesBase=null,this._freeIds=[],this.isInstancedMesh=!0,this.instanceMatrix=new b(new Float32Array,16),this.instanceColor=null,this._customProgramCacheKey=()=>`ez_${!!this.colorsTexture}_${this._useOpacity}_${!!this.boneTexture}_${!!this.uniformsTexture}_${this._customProgramCacheKeyBase.call(this._currentMaterial)}`,this._onBeforeCompile=(e,t)=>{if(this._onBeforeCompileBase&&this._onBeforeCompileBase.call(this._currentMaterial,e,t),e.defines={...e.defines},e.defines.USE_INSTANCING_INDIRECT=``,e.uniforms.matricesTexture={value:this.matricesTexture},this.uniformsTexture){e.uniforms.uniformsTexture={value:this.uniformsTexture};let{vertex:t,fragment:n}=this.uniformsTexture.getUniformsGLSL(`uniformsTexture`,`instanceIndex`,`uint`);e.vertexShader=e.vertexShader.replace(`void main() {`,t),e.fragmentShader=e.fragmentShader.replace(`void main() {`,n)}this.colorsTexture&&e.fragmentShader.includes(`#include <color_pars_fragment>`)&&(e.defines.USE_INSTANCING_COLOR_INDIRECT=``,e.uniforms.colorsTexture={value:this.colorsTexture},e.vertexShader=e.vertexShader.replace(`<color_vertex>`,`<instanced_color_vertex>`),e.vertexColors&&(e.defines.USE_VERTEX_COLOR=``),e.defines.USE_COLOR_ALPHA=``),this.boneTexture&&(e.defines.USE_SKINNING=``,e.defines.USE_INSTANCING_SKINNING=``,e.uniforms.bindMatrix={value:this.bindMatrix},e.uniforms.bindMatrixInverse={value:this.bindMatrixInverse},e.uniforms.bonesPerInstance={value:this.skeleton.bones.length},e.uniforms.boneTexture={value:this.boneTexture})};let s=n.capacity>0?n.capacity:jn;this._renderer=a,this._capacity=s,this._parentLOD=r,this._geometry=e,this.material=t,this._allowsEuler=i??!1,this._tempInstance=new dn(this,-1,i),this.availabilityArray=r?.availabilityArray??Array(s*2),this._createEntities=o,this.initLastRenderInfo(),this.initIndexAttribute(),this.initMatricesTexture()}get capacity(){return this._capacity}get instancesCount(){return this._instancesCount}get perObjectFrustumCulled(){return this._perObjectFrustumCulled}set perObjectFrustumCulled(e){this._perObjectFrustumCulled=e,this._indexArrayNeedsUpdate=!0}get sortObjects(){return this._sortObjects}set sortObjects(e){this._sortObjects=e,this._indexArrayNeedsUpdate=!0}get geometry(){return this._geometry}set geometry(e){this._geometry=e,this.patchGeometry(e)}onBeforeShadow(e,t,n,r,i,a,o){this.patchMaterial(e,a),this.updateTextures(e,a);let s=e.info.render.frame;this.instanceIndex&&this.autoUpdate&&!this.frustumCullingAlreadyPerformed(s,n,r)&&this.performFrustumCulling(r,n),this.count!==0&&(this.instanceIndex.update(this._renderer,this.count),this.bindTextures(e,a))}onBeforeRender(e,t,n,r,i,a){if(this.patchMaterial(e,i),this.updateTextures(e,i),!this.instanceIndex){this._renderer=e;return}let o=e.info.render.frame;this.autoUpdate&&!this.frustumCullingAlreadyPerformed(o,n,null)&&this.performFrustumCulling(n),this.count!==0&&(this.instanceIndex.update(this._renderer,this.count),this.bindTextures(e,i))}onAfterShadow(e,t,n,r,i,a,o){this.unpatchMaterial(e,a)}onAfterRender(e,t,n,r,i,a){this.unpatchMaterial(e,i),!(this.instanceIndex||a&&!this.isLastGroup(a.materialIndex))&&this.initIndexAttribute()}updateTextures(e,t){let n=e.properties.get(t);this.matricesTexture.update(e,n,`matricesTexture`),this.colorsTexture?.update(e,n,`colorsTexture`),this.uniformsTexture?.update(e,n,`uniformsTexture`),this.boneTexture?.update(e,n,`boneTexture`)}bindTextures(e,t){let n=e.properties.get(t),r=n.uniforms;if(!r)return;let i=n.currentProgram,a=i?.program;if(!a)return;let o=e.getContext(),s=i.getUniforms().map,c=o.getParameter(o.CURRENT_PROGRAM);e.state.useProgram(a),this.matricesTexture.bindToProgram(e,o,s,r,`matricesTexture`),this.colorsTexture?.bindToProgram(e,o,s,r,`colorsTexture`),this.uniformsTexture?.bindToProgram(e,o,s,r,`uniformsTexture`),this.boneTexture?.bindToProgram(e,o,s,r,`boneTexture`),e.state.useProgram(c)}isLastGroup(e){let t=this.material;for(let n=t.length-1;n>=e;n--)if(t[n].visible)return n===e}initIndexAttribute(){if(!this._renderer){this.count=0;return}let e=this._renderer.getContext(),t=this._capacity,n=new Uint32Array(t);for(let e=0;e<t;e++)n[e]=e;this.instanceIndex=new yn(e,e.UNSIGNED_INT,1,4,n),this._geometry.setAttribute(`instanceIndex`,this.instanceIndex)}initLastRenderInfo(){this._parentLOD||(this._lastRenderInfo={frame:-1,camera:null,shadowCamera:null})}initMatricesTexture(){this._parentLOD||(this.matricesTexture=new kn(Float32Array,4,4,this._capacity))}initColorsTexture(){this._parentLOD||(this.colorsTexture=new kn(Float32Array,4,1,this._capacity),this.colorsTexture.colorSpace=F.workingColorSpace,this.colorsTexture._data.fill(1),this.materialsNeedsUpdate())}materialsNeedsUpdate(){if(this.material.isMaterial){this.material.needsUpdate=!0;return}for(let e of this.material)e.needsUpdate=!0}patchGeometry(e){let t=e.getAttribute(`instanceIndex`);if(t){if(t===this.instanceIndex)return;console.warn(`The geometry has been cloned because it was already used.`),e=e.clone(),e.deleteAttribute(`instanceIndex`)}this.instanceIndex&&e.setAttribute(`instanceIndex`,this.instanceIndex)}patchMaterial(e,t){this._currentMaterial=t,this._customProgramCacheKeyBase=t.customProgramCacheKey,this._onBeforeCompileBase=t.onBeforeCompile,this._definesBase=t.defines,t.customProgramCacheKey=this._customProgramCacheKey,t.onBeforeCompile=this._onBeforeCompile,Tn(this,e,t)}unpatchMaterial(e,t){this._currentMaterial=null,En(e),t.defines=this._definesBase,t.onBeforeCompile=this._onBeforeCompileBase,t.customProgramCacheKey=this._customProgramCacheKeyBase,this._onBeforeCompileBase=null,this._customProgramCacheKeyBase=null,this._definesBase=null}computeBVH(e={}){this.bvh||=new _n(this,e.margin,e.getBBoxFromBSphere,e.accurateCulling),this.bvh.clear(),this.bvh.create()}disposeBVH(){this.bvh=null}setMatrixAt(e,t){if(t.toArray(this.matricesTexture._data,e*16),this.instances){let n=this.instances[e];t.decompose(n.position,n.quaternion,n.scale)}this.matricesTexture.enqueueUpdate(e),this.bvh&&this.autoUpdateBVH&&this.bvh.move(e)}getMatrixAt(e,t=Pn){return t.fromArray(this.matricesTexture._data,e*16)}getPositionAt(e,t=In){let n=e*16,r=this.matricesTexture._data;return t.x=r[n+12],t.y=r[n+13],t.z=r[n+14],t}getPositionAndMaxScaleOnAxisAt(e,t){let n=e*16,r=this.matricesTexture._data,i=r[n+0],a=r[n+1],o=r[n+2],s=i*i+a*a+o*o,c=r[n+4],l=r[n+5],u=r[n+6],d=c*c+l*l+u*u,f=r[n+8],p=r[n+9],m=r[n+10],h=f*f+p*p+m*m;return t.x=r[n+12],t.y=r[n+13],t.z=r[n+14],Math.sqrt(Math.max(s,d,h))}applyMatrixAtToSphere(e,t,n,r){let i=e*16,a=this.matricesTexture._data,o=a[i+0],s=a[i+1],c=a[i+2],l=a[i+3],u=a[i+4],d=a[i+5],f=a[i+6],p=a[i+7],m=a[i+8],h=a[i+9],g=a[i+10],_=a[i+11],v=a[i+12],y=a[i+13],b=a[i+14],x=a[i+15],S=t.center,C=n.x,w=n.y,T=n.z,E=1/(l*C+p*w+_*T+x);S.x=(o*C+u*w+m*T+v)*E,S.y=(s*C+d*w+h*T+y)*E,S.z=(c*C+f*w+g*T+b)*E;let D=o*o+s*s+c*c,O=u*u+d*d+f*f,k=m*m+h*h+g*g;t.radius=r*Math.sqrt(Math.max(D,O,k))}setVisibilityAt(e,t){this.availabilityArray[e*2]=t,this._indexArrayNeedsUpdate=!0}getVisibilityAt(e){return this.availabilityArray[e*2]}setActiveAt(e,t){this.availabilityArray[e*2+1]=t,this._indexArrayNeedsUpdate=!0}getActiveAt(e){return this.availabilityArray[e*2+1]}getActiveAndVisibilityAt(e){let t=e*2,n=this.availabilityArray;return n[t]&&n[t+1]}setActiveAndVisibilityAt(e,t){let n=e*2,r=this.availabilityArray;r[n]=t,r[n+1]=t,this._indexArrayNeedsUpdate=!0}setColorAt(e,t){this.colorsTexture===null&&this.initColorsTexture(),t.isColor?t.toArray(this.colorsTexture._data,e*4):Fn.set(t).toArray(this.colorsTexture._data,e*4),this.colorsTexture.enqueueUpdate(e)}getColorAt(e,t=Fn){return t.fromArray(this.colorsTexture._data,e*4)}setOpacityAt(e,t){this._useOpacity||=(this.colorsTexture===null?this.initColorsTexture():this.materialsNeedsUpdate(),!0),this.colorsTexture._data[e*4+3]=t,this.colorsTexture.enqueueUpdate(e)}getOpacityAt(e){return this._useOpacity?this.colorsTexture._data[e*4+3]:1}copyTo(e,t){this.getMatrixAt(e,t.matrix).decompose(t.position,t.quaternion,t.scale)}computeBoundingBox(){let e=this._geometry,t=this._instancesArrayCount;this.boundingBox??=new U,e.boundingBox===null&&e.computeBoundingBox();let n=e.boundingBox,r=this.boundingBox;r.makeEmpty();for(let e=0;e<t;e++)this.getActiveAt(e)&&(Mn.copy(n).applyMatrix4(this.getMatrixAt(e)),r.union(Mn))}computeBoundingSphere(){let e=this._geometry,t=this._instancesArrayCount;this.boundingSphere??=new T,e.boundingSphere===null&&e.computeBoundingSphere();let n=e.boundingSphere,r=this.boundingSphere;r.makeEmpty();for(let e=0;e<t;e++)this.getActiveAt(e)&&(Nn.copy(n).applyMatrix4(this.getMatrixAt(e)),r.union(Nn))}clone(e){let t={capacity:this._capacity,renderer:this._renderer,allowsEuler:this._allowsEuler,createEntities:this._createEntities};return new this.constructor(this.geometry,this.material,t).copy(this,e)}copy(e,t){return super.copy(e,t),this.count=e._capacity,this._instancesCount=e._instancesCount,this._instancesArrayCount=e._instancesArrayCount,this._capacity=e._capacity,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this.matricesTexture=e.matricesTexture.clone(),this.matricesTexture.image.data=this.matricesTexture.image.data.slice(),e.colorsTexture!==null&&(this.colorsTexture=e.colorsTexture.clone(),this.colorsTexture.image.data=this.colorsTexture.image.data.slice()),e.uniformsTexture!==null&&(this.uniformsTexture=e.uniformsTexture.clone(),this.uniformsTexture.image.data=this.uniformsTexture.image.data.slice()),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone(),this.morphTexture.image.data=this.morphTexture.image.data.slice()),e.boneTexture!==null&&(this.boneTexture=e.boneTexture.clone(),this.boneTexture.image.data=this.boneTexture.image.data.slice()),this}dispose(){this.dispatchEvent({type:`dispose`}),this.matricesTexture.dispose(),this.colorsTexture?.dispose(),this.morphTexture?.dispose(),this.boneTexture?.dispose(),this.uniformsTexture?.dispose()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMatrixInverse&&(this.bindMode===`attached`?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode===`detached`?this.bindMatrixInverse.copy(this.bindMatrix).invert():console.warn(`Unrecognized bindMode: `+this.bindMode))}},jn=1e3,Mn=new U,Nn=new T,Pn=new he,Fn=new Y,In=new C;Z.prototype.resizeBuffers=function(e){let t=this._capacity;this._capacity=e;let n=Math.min(e,t);if(this.instanceIndex){let t=new Uint32Array(e);t.set(new Uint32Array(this.instanceIndex.array.buffer,0,n)),this.instanceIndex.array=t}if(this.LODinfo){for(let t of this.LODinfo.objects)if(t._capacity=e,t.instanceIndex){let r=new Uint32Array(e);r.set(new Uint32Array(t.instanceIndex.array.buffer,0,n)),t.instanceIndex.array=r}}if(this.availabilityArray.length=e*2,this.matricesTexture.resize(e),this.colorsTexture&&(this.colorsTexture.resize(e),e>t&&this.colorsTexture._data.fill(1,t*4)),this.morphTexture){let n=this.morphTexture.image.data,r=n.length/t;this.morphTexture.dispose(),this.morphTexture=new O(new Float32Array(r*e),r,e,m,M),this.morphTexture.image.data.set(n)}return this.uniformsTexture?.resize(e),this},Z.prototype.setInstancesArrayCount=function(e){if(e<this._instancesArrayCount){let t=this.bvh;if(t)for(let n=this._instancesArrayCount-1;n>=e;n--)this.getActiveAt(n)&&t.delete(n);this._instancesArrayCount=e;return}if(e>this._capacity){let t=this._capacity+(this._capacity>>1)+512;for(;t<e;)t+=(t>>1)+512;this.resizeBuffers(t)}let t=this._instancesArrayCount;this._instancesArrayCount=e,this._createEntities&&this.createEntities(t)};function Ln(e,t){return e.depth-t.depth}function Rn(e,t){return t.depth-e.depth}var zn=class{constructor(){this.array=[],this.pool=[]}push(e,t){let n=this.pool,r=this.array,i=r.length;i>=n.length&&n.push({depth:null,index:null,depthSort:null});let a=n[i];a.depth=e,a.index=t,r.push(a)}reset(){this.array.length=0}},Bn=new L,Vn=new zn,Hn=new he,Un=new he,Wn=new C,Gn=new C,Kn=new C,qn=new C,Jn=new T;Z.prototype.performFrustumCulling=function(e,t=e){let n=this._parentLOD??this,r=n.LODinfo,i;if(r){i=e===t?r.render:r.shadowRender??r.render;for(let e of r.objects)e.count=0}else(n._perObjectFrustumCulled||n._sortObjects)&&(n.count=0);n._instancesArrayCount!==0&&(i?.levels.length>0?n.frustumCullingLOD(i,e,t):n.frustumCulling(e))},Z.prototype.updateLastRenderInfo=function(e,t,n){let r=this._lastRenderInfo;r.frame=e,r.camera=t,r.shadowCamera=n},Z.prototype.frustumCullingAlreadyPerformed=function(e,t,n){let r=this._lastRenderInfo;return r.frame===e&&r.camera===t&&r.shadowCamera===n||(this.updateLastRenderInfo(e,t,n),!1)},Z.prototype.frustumCulling=function(e){let t=this._sortObjects,n=this._perObjectFrustumCulled,r=this.instanceIndex.array;if(this.instanceIndex._needsUpdate=!0,!n&&!t){this.updateIndexArray();return}if(t&&(Un.copy(this.matrixWorld).invert(),Gn.setFromMatrixPosition(e.matrixWorld).applyMatrix4(Un),Wn.set(0,0,-1).transformDirection(e.matrixWorld).transformDirection(Un)),n?(Hn.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse).multiply(this.matrixWorld),this.bvh?this.BVHCulling(e):this.linearCulling(e)):this.updateRenderList(),t){let e=this.customSort;e===null?Vn.array.sort(this.material?.transparent?Rn:Ln):e(Vn.array);let t=Vn.array,n=t.length;for(let e=0;e<n;e++)r[e]=t[e].index;this.count=n,Vn.reset()}},Z.prototype.updateIndexArray=function(){if(!this._indexArrayNeedsUpdate)return;let e=this.instanceIndex.array,t=this._instancesArrayCount,n=0;for(let r=0;r<t;r++)this.getActiveAndVisibilityAt(r)&&(e[n++]=r);this.count=n,this._indexArrayNeedsUpdate=!1},Z.prototype.updateRenderList=function(){let e=this._instancesArrayCount;for(let t=0;t<e;t++)if(this.getActiveAndVisibilityAt(t)){let e=this.getPositionAt(t).sub(Gn).dot(Wn);Vn.push(e,t)}},Z.prototype.BVHCulling=function(e){let t=this.instanceIndex.array,n=this._instancesArrayCount,r=this._sortObjects,i=this.onFrustumEnter,a=0;this.bvh.frustumCulling(Hn,o=>{let s=o.object;if(s<n&&this.getVisibilityAt(s)&&(!i||i(s,e))){if(r){let e=this.getPositionAt(s).sub(Gn).dot(Wn);Vn.push(e,s)}else t[a++]=s}}),this.count=a},Z.prototype.linearCulling=function(e){let t=this.instanceIndex.array;this.geometry.boundingSphere||this.geometry.computeBoundingSphere();let n=this._geometry.boundingSphere,r=n.radius,i=n.center,a=this._instancesArrayCount,o=i.x===0&&i.y===0&&i.z===0,s=this._sortObjects,c=this.onFrustumEnter,l=0;Bn.setFromProjectionMatrix(Hn);for(let n=0;n<a;n++)if(this.getActiveAndVisibilityAt(n)&&(o?Jn.radius=r*this.getPositionAndMaxScaleOnAxisAt(n,Jn.center):this.applyMatrixAtToSphere(n,Jn,i,r),Bn.intersectsSphere(Jn)&&(!c||c(n,e)))){if(s){let e=qn.subVectors(Jn.center,Gn).dot(Wn);Vn.push(e,n)}else t[l++]=n}this.count=l},Z.prototype.frustumCullingLOD=function(e,t,n){let{count:r,levels:i}=e;for(let e=0;e<i.length;e++){if(!i[e].object.instanceIndex)return;r[e]=0,i[e].object.instanceIndex._needsUpdate=!0}let a=t===n&&this._sortObjects;Hn.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse).multiply(this.matrixWorld),Un.copy(this.matrixWorld).invert(),Gn.setFromMatrixPosition(t.matrixWorld).applyMatrix4(Un),Kn.setFromMatrixPosition(n.matrixWorld).applyMatrix4(Un);let o=e.levels.map(e=>e.object.instanceIndex.array);if(this.bvh?this.BVHCullingLOD(e,o,a,t,n):this.linearCullingLOD(e,o,a,t,n),a){let e=this.customSort,t=Vn.array,n=0,a=i[1].distance;e===null?t.sort(i[0].object.material?.transparent?Rn:Ln):e(t);for(let e=0,s=t.length;e<s;e++){let s=t[e];s.depth>a&&(n++,a=i[n+1]?.distance??1/0),o[n][r[n]++]=s.index}Vn.reset()}for(let e=0;e<i.length;e++){let t=i[e].object;t.count=r[e]}},Z.prototype.BVHCullingLOD=function(e,t,n,r,i){let{count:a,levels:o}=e,s=this._instancesArrayCount,c=this.onFrustumEnter;n?this.bvh.frustumCulling(Hn,e=>{let t=e.object;if(t<s&&this.getVisibilityAt(t)&&(!c||c(t,r,i))){let e=this.getPositionAt(t).distanceToSquared(Kn);Vn.push(e,t)}}):this.bvh.frustumCullingLOD(Hn,Kn,o,(e,n)=>{let l=e.object;if(l<s&&this.getVisibilityAt(l)){if(n===null){let e=this.getPositionAt(l).distanceToSquared(Kn);n=this.getObjectLODIndexForDistance(o,e)}(!c||c(l,r,i,n))&&(t[n][a[n]++]=l)}})},Z.prototype.linearCullingLOD=function(e,t,n,r,i){let{count:a,levels:o}=e;this.geometry.boundingSphere||this.geometry.computeBoundingSphere();let s=this._geometry.boundingSphere,c=s.radius,l=s.center,u=this._instancesArrayCount,d=l.x===0&&l.y===0&&l.z===0,f=this.onFrustumEnter;Bn.setFromProjectionMatrix(Hn);for(let e=0;e<u;e++)if(this.getActiveAndVisibilityAt(e)&&(d?Jn.radius=c*this.getPositionAndMaxScaleOnAxisAt(e,Jn.center):this.applyMatrixAtToSphere(e,Jn,l,c),Bn.intersectsSphere(Jn))){if(n){if(!f||f(e,r,i)){let t=Jn.center.distanceToSquared(Kn);Vn.push(t,e)}}else{let n=Jn.center.distanceToSquared(Kn),s=this.getObjectLODIndexForDistance(o,n);(!f||f(e,r,i,s))&&(t[s][a[s]++]=e)}}},Z.prototype.clearTempInstance=function(e){let t=this._tempInstance;return t.id=e,this.clearInstance(t)},Z.prototype.clearTempInstancePosition=function(e){let t=this._tempInstance;return t.id=e,t.position.set(0,0,0),t},Z.prototype.clearInstance=function(e){return e.position.set(0,0,0),e.scale.set(1,1,1),e.quaternion.identity(),e},Z.prototype.updateInstances=function(e){let t=this._instancesArrayCount,n=this.instances;for(let r=0;r<t;r++){if(!this.getActiveAt(r))continue;let t=n?n[r]:this.clearTempInstance(r);e(t,r),t.updateMatrix()}return this},Z.prototype.updateInstancesPosition=function(e){let t=this._instancesArrayCount,n=this.instances;for(let r=0;r<t;r++){if(!this.getActiveAt(r))continue;let t=n?n[r]:this.clearTempInstancePosition(r);e(t,r),t.updateMatrixPosition()}return this},Z.prototype.createEntities=function(e){let t=this._instancesArrayCount;if(!this.instances)this.instances=Array(t);else if(this.instances.length<t)this.instances.length=t;else return this;let n=this.instances;for(let r=e;r<t;r++)n[r]||(n[r]=new dn(this,r,this._allowsEuler));return this},Z.prototype.addInstances=function(e,t){!t&&this.bvh&&console.warn("InstancedMesh2: if `computeBVH()` has already been called, it is better to valorize the instances in the `onCreation` callback for better performance.");let n=this._freeIds;if(n.length>0){let r=-1,i=Math.min(n.length,e),a=n.length-i;for(let e=n.length-1;e>=a;e--){let i=n[e];i>r&&(r=i),this.addInstance(i,t)}n.length-=i,e-=i,this._instancesArrayCount=Math.max(r+1,this._instancesArrayCount)}let r=this._instancesArrayCount,i=r+e;this.setInstancesArrayCount(i);for(let e=r;e<i;e++)this.addInstance(e,t);return this},Z.prototype.addInstance=function(e,t){this._instancesCount++,this.setActiveAndVisibilityAt(e,!0);let n=this.instances?this.clearInstance(this.instances[e]):this.clearTempInstance(e);t?(t(n,e),n.updateMatrix()):n.setMatrixIdentity(),this.bvh?.insert(e)},Z.prototype.removeInstances=function(...e){let t=this._freeIds,n=this.bvh;for(let r of e)r<this._instancesArrayCount&&this.getActiveAt(r)&&(this.setActiveAt(r,!1),t.push(r),n?.delete(r),this._instancesCount--);for(let e=this._instancesArrayCount-1;e>=0&&!this.getActiveAt(e);e--)this._instancesArrayCount--;return this},Z.prototype.clearInstances=function(){if(this._instancesCount=0,this._instancesArrayCount=0,this._freeIds.length=0,this.bvh?.clear(),this.LODinfo)for(let e of this.LODinfo.objects)e.count=0;return this},Z.prototype.getObjectLODIndexForDistance=function(e,t){for(let n=e.length-1;n>0;n--){let r=e[n];if(t>=r.distance-r.distance*r.hysteresis)return n}return 0},Z.prototype.setFirstLODDistance=function(e){if(this._parentLOD)throw Error(`Cannot create LOD for this InstancedMesh2.`);return this.LODinfo||={render:null,shadowRender:null,objects:[this]},this.LODinfo.render||(this.LODinfo.render={levels:[{distance:e,hysteresis:0,object:this}],count:[0]}),this},Z.prototype.addLOD=function(e,t,n=0,r=0){if(this._parentLOD)throw Error(`Cannot create LOD for this InstancedMesh2.`);if(!this.LODinfo?.render&&n===0)throw Error(`Cannot set distance to 0 for the first LOD. Call "setFirstLODDistance" method before use "addLOD".`);return this.setFirstLODDistance(0),this.addLevel(this.LODinfo.render,e,t,n,r),this},Z.prototype.addShadowLOD=function(e,t=0,n=0){if(this._parentLOD)throw Error(`Cannot create LOD for this InstancedMesh2.`);this.LODinfo||={render:null,shadowRender:null,objects:[this]},this.LODinfo.shadowRender||(this.LODinfo.shadowRender={levels:[],count:[]});let r=this.addLevel(this.LODinfo.shadowRender,e,null,t,n);return r.castShadow=!0,this.castShadow=!0,this},Z.prototype.addLevel=function(e,t,n,r,i){let a=this.LODinfo.objects,o=e.levels,s,c;r**=2;let l=a.findIndex(e=>e.geometry===t);if(l===-1){let e={capacity:this._capacity,renderer:this._renderer};c=new Z(t,n??new _e,e,this),c.frustumCulled=!1,this.patchLevel(c),a.push(c),this.add(c)}else c=a[l],n&&(c.material=n);for(s=0;s<o.length&&!(r<o[s].distance);s++);return o.splice(s,0,{distance:r,hysteresis:i,object:c}),e.count.push(0),c},Z.prototype.updateLevel=function(e,t,n,r){if(!e)throw Error(`Render list is invalid.`);let i=e.levels[t];if(!i)throw Error(`Cannot update an empty LOD.`);return n!=null&&!Number.isNaN(n)&&(i.distance=n**2),r!=null&&!Number.isNaN(r)&&(i.hysteresis=r),this},Z.prototype.updateLOD=function(e,t,n){let r=this?.LODinfo?.render;if(e===0)throw Error(`Cannot change distance for LOD0. It is the main mesh and must stay at 0.`);return this.updateLevel(r,e,t,n)},Z.prototype.updateShadowLOD=function(e,t,n){return this.updateLevel(this.LODinfo?.shadowRender,e,t,n)},Z.prototype.updateAllLevels=function(e,t,n){if(!e?.levels)throw Error(`Invalid LOD list.`);let r=e.levels,i=this.LODinfo?.render===e,a=+!!i;i&&(r[0].distance=0);let o=t?.length>0,s=[];o&&(s=i&&t[0]===0?t.slice(1,Math.min(r.length,t.length)):t.slice(0,Math.min(r.length-a,t.length)),s.every((e,t)=>{if(t>0&&e<=s[t-1])throw Error(`LOD distances must be strictly increasing: d[${t-1}]=${s[t-1]} < d[${t}]=${e}`);return!0}));let c=o?s.length:r.length-a;for(let t=0;t<c;t++){let r=o?s[t]:void 0,i=Array.isArray(n)?n[t]:n;this.updateLevel(e,a+t,r,i)}return this},Z.prototype.updateAllLOD=function(e,t){return this.updateAllLevels(this.LODinfo?.render,e,t)},Z.prototype.updateAllShadowLOD=function(e,t){return this.updateAllLevels(this.LODinfo?.shadowRender,e,t)},Z.prototype.disposeLOD=function(e){e.geometry.dispose();let t=e.material;if(Array.isArray(t))for(let e of t)e.dispose();else t.dispose()},Z.prototype.removeLOD=function(e,t=!0){let n=this.LODinfo,r=n?.render;if(!r?.levels)throw Error(`Invalid LOD list.`);let i=r.levels.length;if(e<0||e>=i)throw Error(`Level index OOB`);if(i>1&&e===0)throw Error(`Cannot remove LOD0 while others exist`);let[a]=r.levels.splice(e,1);r.count?.splice?.(e,1),r.levels.length<=1&&(n.render=null);let o=a.object,s=this.LODinfo?.shadowRender;if(s?.levels&&e<s.levels.length&&(s.levels.splice(e,1),s.count?.splice?.(e,1),s.levels.length===0&&(this.LODinfo.shadowRender=null)),t&&o!==this)try{this.remove(o);let e=n.objects?.indexOf(o)??-1;e!==-1&&n.objects.splice(e,1),this.disposeLOD(o)}catch(e){console.error(e)}return this},Z.prototype.patchLevel=function(e){Object.defineProperty(e,"renderOrder",{get(){return this._parentLOD.renderOrder}}),Object.defineProperty(e,"_lastRenderInfo",{get(){return this._parentLOD._lastRenderInfo}}),Object.defineProperty(e,"matricesTexture",{get(){return this._parentLOD.matricesTexture}}),Object.defineProperty(e,"colorsTexture",{get(){return this._parentLOD.colorsTexture}}),Object.defineProperty(e,"uniformsTexture",{get(){return this._parentLOD.uniformsTexture}}),Object.defineProperty(e,"morphTexture",{get(){return this._parentLOD.morphTexture}}),Object.defineProperty(e,"boneTexture",{get(){return this._parentLOD.boneTexture}}),Object.defineProperty(e,"skeleton",{get(){return this._parentLOD.skeleton}}),Object.defineProperty(e,"bindMatrixInverse",{get(){return this._parentLOD.bindMatrixInverse}}),Object.defineProperty(e,"bindMatrix",{get(){return this._parentLOD.bindMatrix}})};var Yn=new H;Z.prototype.getMorphAt=function(e,t=Yn){let n=t.morphTargetInfluences,r=this.morphTexture.source.data.data,i=e*(n.length+1)+1;for(let e=0;e<n.length;e++)n[e]=r[i+e];return t},Z.prototype.setMorphAt=function(e,t){let n=t.morphTargetInfluences,r=n.length+1;this.morphTexture===null&&!this._parentLOD&&(this.morphTexture=new O(new Float32Array(r*this._capacity),r,this._capacity,1028,1015));let i=this.morphTexture.source.data.data,a=0;for(let e of n)a+=e;let o=this._geometry.morphTargetsRelative?1:1-a,s=r*e;i[s]=o,i.set(n,s+1),this.morphTexture.needsUpdate=!0};var Xn=[],Zn=new H,Qn=new I,$n=new C,er=new C,tr=new he,nr=new T;Z.prototype.raycast=function(e,t){if(this._parentLOD||!this.material||this._instancesArrayCount===0||!this.instanceIndex)return;Zn.geometry=this._geometry,Zn.material=this.material;let n=e.ray,r=e.near,i=e.far;tr.copy(this.matrixWorld).invert(),er.setFromMatrixScale(this.matrixWorld),$n.copy(e.ray.direction).multiply(er);let a=$n.length();e.ray=Qn.copy(e.ray).applyMatrix4(tr),e.near/=a,e.far/=a,this.raycastInstances(e,t),e.ray=n,e.near=r,e.far=i},Z.prototype.raycastInstances=function(e,t){if(this.bvh)this.bvh.raycast(e,n=>this.checkObjectIntersection(e,n,t));else{if(this.boundingSphere===null&&this.computeBoundingSphere(),nr.copy(this.boundingSphere),!e.ray.intersectsSphere(nr))return;let n=this.instanceIndex.array,r=this.raycastOnlyFrustum&&this._perObjectFrustumCulled?this.count:this._instancesArrayCount;for(let i=0;i<r;i++)this.checkObjectIntersection(e,n[i],t)}},Z.prototype.checkObjectIntersection=function(e,t,n){if(!(t>this._instancesArrayCount||!this.getActiveAndVisibilityAt(t))){this.getMatrixAt(t,Zn.matrixWorld),Zn.raycast(e,Xn);for(let e of Xn)e.instanceId=t,e.object=this,n.push(e);Xn.length=0}},Z.prototype.initSkeleton=function(e,t=!0){if(e&&this.skeleton!==e&&!this._parentLOD){let n=e.bones;if(this.skeleton=e,this.bindMatrix=new he,this.bindMatrixInverse=new he,this.boneTexture=new kn(Float32Array,4,4*n.length,this._capacity),t)for(let e of n)e.matrixAutoUpdate=!1,e.matrixWorldAutoUpdate=!1;this.materialsNeedsUpdate()}},Z.prototype.setBonesAt=function(e,t=!0,n){let r=this.skeleton;if(!r)throw Error(`"setBonesAt" cannot be called before "initSkeleton"`);let i=r.bones,a=r.boneInverses;for(let r=0,o=i.length;r<o;r++){let o=i[r];t&&(n?.has(o.name)||o.updateMatrix(),o.matrixWorld.multiplyMatrices(o.parent.matrixWorld,o.matrix)),this.multiplyBoneMatricesAt(e,r,o.matrixWorld,a[r])}this.boneTexture.enqueueUpdate(e)},Z.prototype.multiplyBoneMatricesAt=function(e,t,n,r){let i=(e*this.skeleton.bones.length+t)*16,a=n.elements,o=r.elements,s=this.boneTexture._data,c=a[0],l=a[4],u=a[8],d=a[12],f=a[1],p=a[5],m=a[9],h=a[13],g=a[2],_=a[6],v=a[10],y=a[14],b=a[3],x=a[7],S=a[11],C=a[15],w=o[0],T=o[4],E=o[8],D=o[12],O=o[1],k=o[5],A=o[9],j=o[13],M=o[2],N=o[6],P=o[10],F=o[14],I=o[3],L=o[7],ee=o[11],R=o[15];s[i+0]=c*w+l*O+u*M+d*I,s[i+4]=c*T+l*k+u*N+d*L,s[i+8]=c*E+l*A+u*P+d*ee,s[i+12]=c*D+l*j+u*F+d*R,s[i+1]=f*w+p*O+m*M+h*I,s[i+5]=f*T+p*k+m*N+h*L,s[i+9]=f*E+p*A+m*P+h*ee,s[i+13]=f*D+p*j+m*F+h*R,s[i+2]=g*w+_*O+v*M+y*I,s[i+6]=g*T+_*k+v*N+y*L,s[i+10]=g*E+_*A+v*P+y*ee,s[i+14]=g*D+_*j+v*F+y*R,s[i+3]=b*w+x*O+S*M+C*I,s[i+7]=b*T+x*k+S*N+C*L,s[i+11]=b*E+x*A+S*P+C*ee,s[i+15]=b*D+x*j+S*F+C*R},Z.prototype.getUniformAt=function(e,t,n){if(!this.uniformsTexture)throw Error(`Before get/set uniform, it's necessary to use "initUniformsPerInstance".`);return this.uniformsTexture.getUniformAt(e,t,n)},Z.prototype.setUniformAt=function(e,t,n){if(!this.uniformsTexture)throw Error(`Before get/set uniform, it's necessary to use "initUniformsPerInstance".`);this.uniformsTexture.setUniformAt(e,t,n),this.uniformsTexture.enqueueUpdate(e)},Z.prototype.initUniformsPerInstance=function(e){if(!this._parentLOD){let{channels:t,pixelsPerInstance:n,uniformMap:r,fetchInFragmentShader:i}=this.getUniformSchemaResult(e);this.uniformsTexture=new kn(Float32Array,t,n,this._capacity,r,i),this.materialsNeedsUpdate()}},Z.prototype.getUniformSchemaResult=function(e){let t=0,n=new Map,r=[],i=e.vertex??{},a=e.fragment??{},o=!0;for(let e in i){let n=i[e],a=this.getUniformSize(n);t+=a,r.push({name:e,type:n,size:a}),o=!1}for(let e in a)if(!i[e]){let n=a[e],i=this.getUniformSize(n);t+=i,r.push({name:e,type:n,size:i})}r.sort((e,t)=>t.size-e.size);let s=[];for(let{name:e,size:t,type:i}of r){let r=this.getUniformOffset(t,s);n.set(e,{offset:r,size:t,type:i})}let c=Math.ceil(t/4);return{channels:Math.min(t,4),pixelsPerInstance:c,uniformMap:n,fetchInFragmentShader:o}},Z.prototype.getUniformOffset=function(e,t){if(e<4){for(let n=0;n<t.length;n++)if(t[n]+e<=4){let r=n*4+t[n];return t[n]+=e,r}}let n=t.length*4;for(;e>0;e-=4)t.push(e);return n},Z.prototype.getUniformSize=function(e){switch(e){case`float`:return 1;case`vec2`:return 2;case`vec3`:return 3;case`vec4`:return 4;case`mat3`:return 9;case`mat4`:return 16;default:throw Error(`Invalid uniform type: ${e}`)}};var rr=`#ifdef USE_INSTANCING_INDIRECT\r
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
#endif`,ir=`#ifdef USE_INSTANCING_COLOR_INDIRECT\r
  uniform highp sampler2D colorsTexture;

  vec4 getColorTexture() {\r
    int size = textureSize( colorsTexture, 0 ).x;\r
    int j = int( instanceIndex );\r
    int x = j % size;\r
    int y = j / size;\r
    return texelFetch( colorsTexture, ivec2( x, y ), 0 );\r
  }\r
#endif`,ar=`#ifdef USE_INSTANCING_INDIRECT\r
  mat4 instanceMatrix = getInstancedMatrix();

  #ifdef USE_INSTANCING_COLOR_INDIRECT\r
    vColor *= getColorTexture();\r
  #endif\r
#endif`,or=`#ifdef USE_INSTANCING_COLOR_INDIRECT\r
  #ifdef USE_VERTEX_COLOR\r
    vColor = vec4( color );\r
  #else\r
    vColor = vec4( 1.0 );\r
  #endif\r
#endif`,sr=`#ifdef USE_SKINNING\r
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
#endif`;G.instanced_pars_vertex=rr,G.instanced_color_pars_vertex=ir,G.instanced_vertex=ar,G.instanced_color_vertex=or;function cr(e){return e.replace(`#ifdef USE_INSTANCING`,`#if defined USE_INSTANCING || defined USE_INSTANCING_INDIRECT`)}G.project_vertex=cr(G.project_vertex),G.worldpos_vertex=cr(G.worldpos_vertex),G.defaultnormal_vertex=cr(G.defaultnormal_vertex),G.batching_pars_vertex=G.batching_pars_vertex.concat(`
#include <instanced_pars_vertex>`),G.color_pars_vertex=G.color_pars_vertex.concat(`
#include <instanced_color_pars_vertex>`),G.batching_vertex=G.batching_vertex.concat(`
#include <instanced_vertex>`),G.skinning_pars_vertex=sr,G.morphinstance_vertex&&(G.morphinstance_vertex=G.morphinstance_vertex.replaceAll(`gl_InstanceID`,`instanceIndex`));var lr=4,ur=512;function dr(e,t){let n=e*2-1,r=t*2-1,i=Math.max(1-Math.abs(n)-Math.abs(r),.04);return new C(n,i,r).normalize()}var fr=`
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
`;function pr(e,t){t.updateMatrixWorld(!0);let n=new U().setFromObject(t).getBoundingSphere(new T),r=n.center.clone(),i=Math.max(n.radius,.2),a=new x(ur,ur,{depthBuffer:!0,stencilBuffer:!1});a.texture.colorSpace=W,a.texture.generateMipmaps=!0,a.texture.minFilter=s,a.texture.magFilter=j;let o=new c;o.add(t);let l=new E(`#fff3dd`,2.2);l.position.set(4,6,3),o.add(l,new ue(`#ffffff`,.55));let u=new we(-i,i,i,-i,.05,i*6),d=ur/lr,f=e.getRenderTarget(),p=new Y,m=new q,h=new q;e.getClearColor(p),e.getViewport(m),e.getScissor(h);let g=e.getClearAlpha(),_=e.autoClear,v=e.getScissorTest();e.setRenderTarget(a),e.setClearColor(0,0),e.clear(!0,!0,!0),e.autoClear=!1;for(let t=0;t<lr;t+=1)for(let n=0;n<lr;n+=1){let a=dr((n+.5)/lr,(t+.5)/lr);u.position.copy(r).addScaledVector(a,i*2.4),u.up.set(0,1,0),Math.abs(a.y)>.92&&u.up.set(0,0,1),u.lookAt(r),u.updateProjectionMatrix(),e.setViewport(n*d,t*d,d,d),e.setScissor(n*d,t*d,d,d),e.setScissorTest(!0),e.clear(!0,!0,!0),e.render(o,u)}e.setScissorTest(v),e.setViewport(m),e.setScissor(h),e.setRenderTarget(f),e.setClearColor(p,g),e.autoClear=_,o.remove(t);let y=new pe(1,1);y.translate(0,0,0);let b=new K({map:a.texture,transparent:!0,alphaTest:.28,depthWrite:!0,side:2,fog:!0});return b.onBeforeCompile=e=>{e.uniforms.uSprites={value:lr},e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
uniform float uSprites;
varying vec2 vImpostorUv;`).replace(`#include <project_vertex>`,fr).replace(`#include <uv_vertex>`,`#include <uv_vertex>
#ifdef USE_MAP
  vMapUv = vImpostorUv;
#endif`),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>
varying vec2 vImpostorUv;`)},b.customProgramCacheKey=()=>`hemi-octa-impostor`,{geometry:y,material:b,texture:a.texture,target:a}}var mr=[`meadow-pine-a`,`meadow-pine-b`,`meadow-spruce-a`,`meadow-spruce-b`,`meadow-aspen-a`,`meadow-aspen-b`],hr=[5.4,4.6,6.1,5.2,4.8,3.9],gr=[{pos:[-23,0,-14],rotY:.3,scale:1.3},{pos:[20,0,-18],rotY:1.2,scale:1.35},{pos:[-11,0,-24],rotY:2.1,scale:1.5},{pos:[28,0,-8],rotY:.6,scale:1.25},{pos:[-31,0,-4],rotY:2.8,scale:1.4},{pos:[4,0,-26],rotY:5,scale:1.6},{pos:[30,0,-24],rotY:3.4,scale:1.8},{pos:[-33,0,-20],rotY:1.7,scale:1.85},{pos:[-26,0,16],rotY:.9,scale:1.1},{pos:[30,0,14],rotY:5.6,scale:1.15},{pos:[-17,0,-33],rotY:4.1,scale:1.9},{pos:[15,0,-34],rotY:.2,scale:2},{pos:[-13,0,27],rotY:2.4,scale:1.05},{pos:[15,0,28],rotY:3.9,scale:1.1},{pos:[-9,0,33],rotY:1.4,scale:1},{pos:[10,0,34],rotY:4.6,scale:.95},{pos:[-10.5,0,-5],rotY:.4,scale:1},{pos:[9.5,0,-4.5],rotY:1.9,scale:.9},{pos:[-13.5,0,5.5],rotY:3.1,scale:1.1},{pos:[5,0,-10],rotY:2.2,scale:1.05},{pos:[-5.5,0,-11.5],rotY:4.4,scale:.9},{pos:[14.5,0,-10],rotY:5.1,scale:1.2},{pos:[12.5,0,15.5],rotY:1.1,scale:.85},{pos:[-11.5,0,17.5],rotY:4.9,scale:.9},{pos:[-6.5,0,24.5],rotY:2.6,scale:.8},{pos:[9,0,25.5],rotY:5.7,scale:.75},{pos:[-5,0,28.5],rotY:1.3,scale:.85},{pos:[6,0,29.5],rotY:3.8,scale:.7}],_r=[{file:`fern_02.glb`,height:.55,pos:[3.4,2.1],rot:.4},{file:`fern_02.glb`,height:.42,pos:[-3.6,.6],rot:2.2},{file:`rock_moss_set_01.glb`,height:.48,pos:[8.3,3.2],rot:1.1},{file:`tree_stump_01.glb`,height:.38,pos:[-3.9,-4.4],rot:.7},{file:`dandelion_01.glb`,height:.22,pos:[2.9,4.7],rot:.2},{file:`dandelion_01.glb`,height:.18,pos:[-2.5,4.9],rot:1.6}];function vr(e){return(`/`.endsWith(`/`)?`/`:`//`)+e.replace(/^\//,``)}function yr(e){e.computeBoundingBox();let t=e.boundingBox;if(!t)return e;let n=new C,r=new C;t.getSize(n),t.getCenter(r),e.translate(-r.x,-t.min.y,-r.z);let i=n.y||1;return e.scale(1/i,1/i,1/i),e.computeBoundingSphere(),e}function br(e,t){let n=e.getAttribute(t);if(!n||!n.normalized&&n.array instanceof Float32Array)return;let r=new Float32Array(n.count*n.itemSize);for(let e=0;e<n.count;e+=1){let t=e*n.itemSize;r[t]=n.getX(e),r[t+1]=n.getY(e),n.itemSize>2&&(r[t+2]=n.getZ(e)),n.itemSize>3&&(r[t+3]=n.getW(e))}e.setAttribute(t,new B(r,n.itemSize))}function xr(e){let t=e.geometry,n=t.index?t.toNonIndexed():t.clone();br(n,`position`),br(n,`normal`);let r=e.material,i=r?.color?r.color:new Y(`#6a7a48`),a=n.getAttribute(`position`).count,o=new Float32Array(a*3);for(let e=0;e<a;e+=1)o[e*3]=i.r,o[e*3+1]=i.g,o[e*3+2]=i.b;return n.setAttribute(`color`,new B(o,3)),n}async function Sr(e,t){let n=await V(vr(`models/${e}${t}.glb`)),r=[];if(n.scene.updateMatrixWorld(!0),n.scene.traverse(e=>{let t=e;if(!t.isMesh)return;let n=xr(t);n.applyMatrix4(t.matrixWorld),r.push(n)}),!r.length)return null;let i=r.length===1?r[0]:se(r,!1);return i?(r.length>1&&r.forEach(e=>e.dispose()),yr(i)):null}function Cr(){let e=new J({vertexColors:!0,roughness:.86,metalness:0});return Ft(e),e}function wr(e,t,n,r,i,a,o=Be,s,c=!0){let l=[],u=new Set,d=!1,f=Math.max(6,Math.round(gr.length*.85)),p=mr.map(()=>[]);gr.slice(0,f).forEach((e,t)=>{if(Ye(e.pos[0],e.pos[2])<.35)return;if(s){let t=e.pos[0]-s.x,n=e.pos[2]-s.z;if(t*t+n*n<s.r*s.r)return}let n=t%mr.length,r=hr[n]*(e.scale??1);p[n].push({x:e.pos[0],y:o(e.pos[0],e.pos[2]),z:e.pos[2],rot:e.rotY??0,scale:r})});let m=$e().lod;return Promise.all(mr.map(async(r,a)=>{let o=p[a];if(o.length&&i())try{if(m===`far`){let a=await Sr(r,`.lod2`).catch(()=>null);if(!i()||!a)return;t.push(a);let s=Cr();n.push(s);let c=new Z(a,s,{capacity:o.length});c.castShadow=!0,c.receiveShadow=!0,c.name=r;let u=new C(0,1,0);c.addInstances(o.length,(e,t)=>{let n=o[t];e.position.set(n.x,n.y,n.z),e.quaternion.setFromAxisAngle(u,n.rot),e.scale.setScalar(n.scale)}),e.add(c),l.push({mesh:c,source:new H(a,s)});return}let[a,s,c]=await Promise.all([Sr(r,``).catch(()=>null),Sr(r,`.lod1`).catch(()=>null),Sr(r,`.lod2`).catch(()=>null)]);if(!i()||!a)return;t.push(a),s&&t.push(s),c&&t.push(c);let u=Cr(),d=Cr(),f=Cr();n.push(u,d,f);let p=new Z(a,u,{capacity:o.length});p.castShadow=!0,p.receiveShadow=!0,p.name=r,s&&p.addLOD(s,d,28),c&&p.addLOD(c,f,46);let h=new C(0,1,0);p.addInstances(o.length,(e,t)=>{let n=o[t];e.position.set(n.x,n.y,n.z),e.quaternion.setFromAxisAngle(h,n.rot),e.scale.setScalar(n.scale)}),e.add(p);let g=new H(a,u);l.push({mesh:p,source:g})}catch{return}})).then(()=>{d=!0,i()&&u.size===0&&l.length===0&&a?.()}).catch(()=>{d=!0,i()&&a?.()}),c&&$e().props&&Tr(e,t,n,i),{claimRenderer(e){for(let i of l){if(u.has(i.mesh))continue;let a=pr(e,i.source);t.push(a.geometry),n.push(a.material),r.push(a.texture),Ft(a.material),i.mesh.addLOD(a.geometry,a.material,60),a.target.dispose(),u.add(i.mesh)}d&&(l.length=0)}}}function Tr(e,t,n,r){for(let t of _r)Ye(t.pos[0],t.pos[1])<.4||V(vr(`models/${t.file}`)).then(i=>{if(!r())return;let a=new U().setFromObject(i.scene),o=new C;a.getSize(o);let s=t.height/(o.y||1),c=i.scene.clone(!0);c.traverse(e=>{let t=e;if(!t.isMesh)return;t.castShadow=!0,t.receiveShadow=!0;let r=t.material;if(r?.isMeshStandardMaterial){let e=r.clone();e.roughness=Math.max(r.roughness,.72),Ft(e),t.material=e,n.push(e)}});let l=Be(t.pos[0],t.pos[1])-a.min.y*s;c.position.set(t.pos[0],l,t.pos[1]),c.scale.setScalar(s),c.rotation.y=t.rot,c.name=t.file,e.add(c)}).catch(()=>void 0)}var Q=e=>Math.min(1,Math.max(0,e)),Er=(e,t,n)=>{let r=Q((n-e)/(t-e));return r*r*(3-2*r)},Dr=e=>1-(1-e)**3,Or=[{p:[-2,2.5,31.5],t:[.4,4.7,20],fov:36,ground:1},{p:[-.8,2.4,27.5],t:[.2,4.9,18.5],fov:36,ground:1},{p:[.6,2.6,23.5],t:[0,1.6,0],fov:40,ground:1},{p:[-3.4,2.2,17.4],t:[0,2,.8],fov:41,ground:1},{p:[-5.2,2,12.2],t:[.5,2.6,1.8],fov:41,ground:1},{p:[-1,3,12.6],t:[.4,1.9,1.4],fov:43,ground:1},{p:[7.4,5.6,13.6],t:[0,1.8,1.6],fov:44},{p:[4.4,2.2,9.8],t:[.6,1.8,4.4],fov:42,ground:1},{p:[.8,1.8,8.3],t:[.2,2,3.8],fov:41,ground:1},{p:[.3,2.35,5.7],t:[4.6,1.1,5.3],fov:42},{p:[5.6,2,7.6],t:[.6,2.1,2.8],fov:42},{p:[7.4,2.4,9.4],t:[.4,2.2,1.8],fov:40},{p:[9.4,4.3,13.4],t:[.2,2.2,1.2],fov:37}],kr=[{p:[-.4,2.45,22.5],t:[1.6,1.5,2.6],fov:38,ground:1},{p:[3,2.4,19],t:[2.1,1.5,2.9],fov:38,ground:1},{p:[6.8,2.3,15.4],t:[2.4,1.45,2.8],fov:37,ground:1},{p:[9.8,2.2,12.2],t:[2.5,1.4,2.6],fov:36,ground:1},{p:[11.6,2.1,9.6],t:[2.4,1.4,2.4],fov:36,ground:1},{p:[12.4,2,8],t:[2.3,1.35,2.2],fov:35,ground:1}],Ar=[{p:[6.4,2.2,12.8],t:[1.5,1.35,2.1],fov:34},{p:[11,7.4,26],t:[.7,1.9,.5],fov:34},{p:[18,18,48],t:[.25,2.8,.15],fov:32},{p:[24,36,86],t:[.15,3.6,.05],fov:28}],jr={p:[9.4,4.3,13.4],t:[.2,2.2,1.2],fov:38},Mr=new C(18,16,13).normalize(),Nr=[{pos:[-23,0,-14],rotY:.3,scale:1.3},{pos:[20,0,-18],rotY:1.2,scale:1.35},{pos:[-11,0,-24],rotY:2.1,scale:1.5},{pos:[28,0,-8],rotY:.6,scale:1.25},{pos:[-31,0,-4],rotY:2.8,scale:1.4},{pos:[4,0,-26],rotY:5,scale:1.6},{pos:[30,0,-24],rotY:3.4,scale:1.8},{pos:[-33,0,-20],rotY:1.7,scale:1.85},{pos:[-26,0,16],rotY:.9,scale:1.1},{pos:[30,0,14],rotY:5.6,scale:1.15},{pos:[-17,0,-33],rotY:4.1,scale:1.9},{pos:[15,0,-34],rotY:.2,scale:2},{pos:[-13,0,27],rotY:2.4,scale:1.05},{pos:[15,0,28],rotY:3.9,scale:1.1},{pos:[-9,0,33],rotY:1.4,scale:1},{pos:[10,0,34],rotY:4.6,scale:.95}],Pr=[{pos:[-10.5,0,-5],rotY:.4,scale:1},{pos:[9.5,0,-4.5],rotY:1.9,scale:.9},{pos:[-13.5,0,5.5],rotY:3.1,scale:1.1},{pos:[5,0,-10],rotY:2.2,scale:1.05},{pos:[-5.5,0,-11.5],rotY:4.4,scale:.9},{pos:[14.5,0,-10],rotY:5.1,scale:1.2},{pos:[12.5,0,15.5],rotY:1.1,scale:.85},{pos:[-11.5,0,17.5],rotY:4.9,scale:.9},{pos:[-6.5,0,24.5],rotY:2.6,scale:.8},{pos:[9,0,25.5],rotY:5.7,scale:.75},{pos:[-5,0,28.5],rotY:1.3,scale:.85},{pos:[6,0,29.5],rotY:3.8,scale:.7}],Fr=[{pos:[3.8,0,8.6],rotY:.7,scale:.45},{pos:[-6.4,0,3.4],rotY:2.4,scale:.32},{pos:[7.6,0,-2.6],rotY:1.1,scale:.6},{pos:[-8.6,0,-6.2],rotY:3.8,scale:.85},{pos:[2.1,0,-6.6],rotY:5.2,scale:.4},{pos:[-2.9,0,9.8],rotY:.2,scale:.24},{pos:[4.6,0,11.8],rotY:1.6,scale:.4}],Ir=[{pos:[1.15,0,7.15],rotY:.4,scale:1},{pos:[-1.05,0,7.05],rotY:2.2,scale:1},{pos:[1.35,0,8.75],rotY:1.1,scale:1},{pos:[4.75,0,6.9],rotY:5.2,scale:1},{pos:[-2.65,0,30.15],rotY:2.8,scale:1}],Lr=[{pos:[-10.6,-3.6],w:2.3,len:9.5,o:1,rot:.3},{pos:[-13.4,4.8],w:1.7,len:8,o:.8,rot:1.2},{pos:[9.6,-4.2],w:2.5,len:9,o:.9,rot:-.4},{pos:[5.4,-9.6],w:1.9,len:8.5,o:.7,rot:.8}],Rr=[{pos:[-15,1.4,-7],scale:16,speed:.05},{pos:[13,1,-11],scale:14,speed:.035},{pos:[-6,.9,-17],scale:18,speed:.045},{pos:[10,1.6,8],scale:12,speed:.03},{pos:[-17,1.2,9],scale:13,speed:.04}];function $(e){return(`/`.endsWith(`/`)?`/`:`//`)+e.replace(/^\//,``)}function zr(e,t){let n=Math.sin(e*127.1+t*311.7)*43758.5453;return n-Math.floor(n)}function Br(e,t){let n=Math.floor(e),r=Math.floor(t),i=e-n,a=t-r,o=i*i*(3-2*i),s=a*a*(3-2*a),c=zr(n,r),l=zr(n+1,r),u=zr(n,r+1),d=zr(n+1,r+1);return c*(1-o)*(1-s)+l*o*(1-s)+u*(1-o)*s+d*o*s}function Vr(e,t,n=5){let r=0,i=1,a=.5,o=1;for(let s=0;s<n;s+=1){let n=Br(e*i,t*i);n=1-Math.abs(n*2-1),n*=n,n*=o,o=n,r+=n*a,i*=2.07,a*=.5}return r}function Hr(e,t,n){let r=new pe(170,170,e,e);r.rotateX(-Math.PI/2);let i=r.attributes.position;for(let e=0;e<i.count;e+=1)i.setY(e,t(i.getX(e),i.getZ(e)));r.computeVertexNormals(),r.getAttribute(`uv`)&&r.setAttribute(`uv2`,r.getAttribute(`uv`));let a=new J({color:n,roughness:.94,metalness:0});Ue(a);let o=new H(r,a);return o.receiveShadow=!0,o.name=`Terrain`,o}function Ur(e,t,n,r){let i=new pe(t,n,128,1),a=i.attributes.position;for(let t=0;t<=128;t+=1){let i=t/128,o=Math.sin(i*5.1+e*2.3)*.55,s=Math.sin(i*11.7+e*5.9)*.26,c=Math.sin(i*27.3+e*1.4)*.11,l=Q((o+s+c)*.5+.5)**1.35;a.setY(t,l*n*r),a.setY(t+128+1,-n*.5)}return i.computeVertexNormals(),i}function Wr(e,t,n){let r=[{seed:1.7,z:-250,w:900,h:46,jag:.85,color:`#d7e3ee`,op:.42,y:4},{seed:4.2,z:-175,w:680,h:38,jag:.9,color:`#c3d0dc`,op:.8,y:1},{seed:8.9,z:-128,w:480,h:28,jag:.82,color:`#f4f7f8`,op:1,y:0}],i=new R;i.name=`MountainRange`,i.renderOrder=-10;for(let e of r){let r=Ur(e.seed,e.w,e.h,e.jag);t.push(r);let a=new K({name:`RidgeRock`,color:e.color,transparent:!0,opacity:e.op,fog:!1,side:2});a.userData.span=[e.w,e.h],a.userData.ridgeBase=a.color.clone();let o=new K({name:`RidgeSnow`,color:`#f4f8fa`,transparent:!0,opacity:.72,fog:!1,side:2});o.userData.ridgeBase=o.color.clone(),n.push(a,o);let s=new H(r,a);s.position.set(0,e.y,e.z),s.frustumCulled=!1;let c=new H(r,o);c.position.set(0,e.y+e.h*.05,e.z+1.5),c.scale.set(1,.955,1),c.frustumCulled=!1,i.add(s,c)}e.add(i)}function Gr(e,t,n,r,i,a,o){let s=new pe(t,n,r,i);s.rotateX(-Math.PI/2);let c=s.attributes.position;for(let t=0;t<c.count;t+=1){let r=c.getX(t),i=c.getZ(t),o=(i+n/2)/n,s=Vr(r*.0132+11.3+e,i*.014+4.1+e*.7,5),l=.45+.55*Br(r*.0022+2.7+e,i*.004+9.4),u=Math.min(1,s*l/.78)**1.08*.78*55*a*(.42+o*.9);u*=Math.min(1,Math.max(0,(o-.02)/.22)),c.setY(t,u)}s.computeVertexNormals();let l=s.attributes.normal,u=new Y(`#d9e6ee`),d=new Y(`#4a5a69`),f=new Y(`#6f8090`),p=new Y(`#f7fbfd`),m=new Y(`#41584c`),h=new Y,g=new Float32Array(c.count*3),_=1;for(let e=0;e<c.count;e+=1)_=Math.max(_,c.getY(e));for(let t=0;t<c.count;t+=1){let r=c.getY(t),i=c.getZ(t),a=r/_,s=1-Math.abs(l.getY(t)),v=Q((a-(.42+Br(c.getX(t)*.02+e,i*.02)*.17))/.13)*Q(1-(s-.34)/.16),y=Q((.16-a)/.22);h.copy(d).lerp(f,Q(a*.9)).lerp(m,y*.8).lerp(p,v);let b=l.getX(t)*Mr.x+l.getY(t)*Mr.y+l.getZ(t)*Mr.z;h.multiplyScalar(.4+Q(b*.66+.4)*.94);let x=Q(o+(1-(i+n/2)/n)*.24+(1-Er(0,.26,a))*.26-a*.22);h.lerp(u,Math.min(.9,x)),g[t*3]=h.r,g[t*3+1]=h.g,g[t*3+2]=h.b}return s.setAttribute(`color`,new B(g,3)),s}function Kr(e,t,n){let r=new R;r.name=`SnowRange`;let i=Gr(37.4,1150,130,120,40,.72,.22),a=Gr(0,900,110,180,36,.55,.12);t.push(i,a);let o=new K({name:`SnowRange`,vertexColors:!0,fog:!1}),s=new K({name:`SnowRange`,vertexColors:!0,fog:!1});n.push(o,s);let c=new H(i,o);c.position.set(70,-22,-250),c.frustumCulled=!1,c.renderOrder=-11;let l=new H(a,s);return l.position.set(0,-16,-190),l.frustumCulled=!1,l.renderOrder=-10,r.add(c,l),r.userData.mats=[o,s],e.add(r),r}function qr(e,t,n){let r=e.userData.mats;if(!r)return;let i=(1+t*.1)*(1-n*.82),a=(1-t*.03)*(1-n*.78),o=(1-t*.14)*(1-n*.62);for(let e of r)e.color.setRGB(i,a,o)}function Jr(e,t){let n=1-t*.84;for(let t of e){if(!(t instanceof K)||t.name!==`RidgeRock`&&t.name!==`RidgeSnow`)continue;let e=t.userData.ridgeBase;if(!e)continue;let r=t.name===`RidgeSnow`?.78:1;t.color.copy(e).multiplyScalar(Math.max(.08,n*r))}}function Yr(e,t,n){let r=new R;r.name=`Clouds`;let i=new Y(`#fffdf5`),a=new Y(`#eff2f1`),o=new Y(`#c0ccd1`),s=new Y;for(let e=0;e<6;e+=1){let c=[],l=4+e%3;for(let t=0;t<l;t+=1){let n=new Te(1,0),r=.7+zr(e,t)*.8;n.scale(r*1.3,r*.55,r);let i=t-(l-1)/2;n.translate(i*1.05,-Math.abs(i)*.16,(zr(t,e)-.5)*.4),c.push(n)}let u=0;for(let e of c)u+=e.attributes.position.count;let d=new Float32Array(u*3),f=new Float32Array(u*3),p=0;for(let e of c){let t=e.attributes.position;d.set(t.array,p),p+=t.count*3,e.dispose()}let m=1/0,h=-1/0;for(let e=1;e<d.length;e+=3)m=Math.min(m,d[e]),h=Math.max(h,d[e]);let g=Math.max(.001,h-m);for(let e=0;e<d.length;e+=3){let t=(d[e+1]-m)/g;s.copy(o).lerp(a,t).lerp(i,t*t);let n=Mr.y*.6+.4;s.multiplyScalar(.72+t*n*.45),f[e]=s.r,f[e+1]=s.g,f[e+2]=s.b}let _=new Ae;_.setAttribute(`position`,new B(d,3)),_.setAttribute(`color`,new B(f,3)),_.computeVertexNormals(),t.push(_);let v=new K({vertexColors:!0,fog:!1});n.push(v);let y=new H(_,v),b=e*.9;y.position.set(Math.cos(b)*(18+e*6),28+e%3*6,Math.sin(b)*14-6),y.scale.setScalar(3.2+e%2),y.userData.baseX=y.position.x,y.userData.phase=e,r.add(y)}return e.add(r),r}function Xr(e){let t=new Float32Array(2100);for(let e=0;e<700;e+=1){let n=Math.sin(e*91.7)*43758.5453,r=(n-Math.floor(n))*Math.PI*2,i=Math.sin(e*33.1)*43758.5453,a=.08+(i-Math.floor(i))*.72;t[e*3]=Math.cos(r)*Math.cos(a)*190,t[e*3+1]=Math.sin(a)*190,t[e*3+2]=Math.sin(r)*Math.cos(a)*190}let n=new Ae;n.setAttribute(`position`,new B(t,3));let r=new Fe({size:2.4,sizeAttenuation:!1,color:`#f4f7ff`,transparent:!0,opacity:0,depthWrite:!1,fog:!1}),i=new je(n,r);return i.name=`StarField`,i.renderOrder=-11,i.frustumCulled=!1,e.add(i),{geo:n,mat:r,points:i}}function Zr(){let e=document.createElement(`canvas`);e.width=128,e.height=128;let t=e.getContext(`2d`);if(!t)return null;let n=t.createRadialGradient(64,64,6,64,64,58);n.addColorStop(0,`rgba(255, 250, 236, 1)`),n.addColorStop(.42,`rgba(244, 236, 214, 0.95)`),n.addColorStop(.72,`rgba(232, 224, 204, 0.35)`),n.addColorStop(1,`rgba(232, 224, 204, 0)`),t.fillStyle=n,t.fillRect(0,0,128,128);let r=new ae(e);return r.colorSpace=W,r}function Qr(){let e=document.createElement(`canvas`);e.width=128,e.height=128;let t=e.getContext(`2d`);if(!t)return null;let n=t.createRadialGradient(64,64,8,64,64,64);n.addColorStop(0,`rgba(244,250,246,0.55)`),n.addColorStop(.6,`rgba(244,250,246,0.16)`),n.addColorStop(1,`rgba(244,250,246,0)`),t.fillStyle=n,t.fillRect(0,0,128,128);let r=new ae(e);return r.colorSpace=W,r}function $r(){let e=document.createElement(`canvas`);e.width=64,e.height=256;let t=e.getContext(`2d`);if(!t)return null;let n=t.createLinearGradient(0,256,0,0);n.addColorStop(0,`rgba(255,238,200,0.14)`),n.addColorStop(.45,`rgba(255,238,200,0.55)`),n.addColorStop(.85,`rgba(255,238,200,0.10)`),n.addColorStop(1,`rgba(255,238,200,0)`),t.fillStyle=n,t.fillRect(0,0,64,256);let r=t.createLinearGradient(0,0,64,0);r.addColorStop(0,`rgba(0,0,0,0)`),r.addColorStop(.3,`rgba(0,0,0,1)`),r.addColorStop(.7,`rgba(0,0,0,1)`),r.addColorStop(1,`rgba(0,0,0,0)`),t.globalCompositeOperation=`destination-in`,t.fillStyle=r,t.fillRect(0,0,64,256);let i=new ae(e);return i.colorSpace=W,i}function ei(e,t,n,r,i=Be){let a=new U().setFromObject(e),o=new C;a.getSize(o);let s=new C;a.getCenter(s);let c=t/(o.y||1),l=new R;for(let t of n){let n=t.scale??1,o=e.clone(!0);o.traverse(e=>{let t=e;if(!t.isMesh)return;t.castShadow=!0,t.receiveShadow=!0;let n=t.material;if(n?.isMeshStandardMaterial){let e=n.clone();e.name===`Green`&&e.color.set(`#356247`),e.name===`Wood`&&e.color.set(`#5d4030`),e.roughness=1,e.metalness=0,e.envMapIntensity=.3,t.material=e}}),o.position.set(-s.x*c*n,-a.min.y*c*n,-s.z*c*n),o.scale.setScalar(c*n);let u=new R;u.add(o);let d=i(t.pos[0],t.pos[2])-.06;u.position.set(t.pos[0],d,t.pos[2]),u.rotation.y=t.rotY??0,l.add(u),r.push(u)}return l}function ti(e,t,n,r,i,a){let o=[...Nr.slice(0,Math.max(4,Math.round(12*i))),...Pr.slice(0,Math.max(3,Math.round(9*i)))],s=new p(1,1,6),c=new d(1,1.18,1,6);t.push(s,c);let l=new J({color:`#356247`,roughness:1,flatShading:!0}),u=new J({color:`#5d4030`,roughness:1,flatShading:!0});Ue(l),Ue(u),n.push(l,u);let f=Re([`diff`,`nor_gl`,`rough`]);f.length&&Oe().then(()=>Promise.all(f.map(e=>Ee.loadAsync($(`textures/bark_brown_02/${e}.ktx2`))))).then(e=>{if(!a()){for(let t of e)t.dispose();return}let[t,n,i]=e;for(let t of e)t.wrapS=k,t.wrapT=k,t.repeat.set(2,3),t.anisotropy=We();t&&(t.colorSpace=W,u.map=t),n&&(n.colorSpace=``,u.normalMap=n),i&&(i.colorSpace=``,u.roughnessMap=i),u.needsUpdate=!0,r.push(...e)}).catch(()=>void 0);let m=new ne(s,l,o.length),h=new ne(c,u,o.length);m.receiveShadow=!0;let g=new de;o.forEach((e,t)=>{let n=e.scale??1,r=(t<12?5.2:4.3)*n,i=Be(e.pos[0],e.pos[2]);g.position.set(e.pos[0],i+r*.52,e.pos[2]),g.rotation.set(0,e.rotY??0,0),g.scale.set(1.25*n,r,1.25*n),g.updateMatrix(),m.setMatrixAt(t,g.matrix),g.position.set(e.pos[0],i+r*.14,e.pos[2]),g.scale.set(.16*n,r*.28,.16*n),g.updateMatrix(),h.setMatrixAt(t,g.matrix)});let _=new R;_.name=`LiteForest`,_.add(m,h),e.add(_)}function ni(e,t=Be){let n=new R;n.name=`AuraUnitSlot`,n.position.set(He.x,t(He.x,He.z),He.z);let r=new R;r.name=`HotTubSlot`,r.position.set(Xe.x,t(Xe.x,Xe.z),Xe.z),e.add(n,r)}function ri(e){return{position:new Ne(e.map(e=>new C(e.p[0],e.ground?Be(e.p[0],e.p[2])+e.p[1]:e.p[1],e.p[2])),!1,`catmullrom`,.38),target:new Ne(e.map(e=>new C(e.t[0],e.t[1],e.t[2])),!1,`catmullrom`,.38)}}function ii(e,t){if(e.length>=13){let n=t*6,r=Math.min(Math.floor(n),5),i=Q(n-r);return De.lerp(e[r*2].fov,e[Math.min(r+1,6)*2].fov,i)}let n=t*(e.length-1),r=Math.min(Math.floor(n),e.length-2);return De.lerp(e[r].fov,e[r+1].fov,n-r)}function ai(){return{geometries:[],materials:[],textures:[],winds:[],hero:[],fill:[],heroMat:null,fillMat:null,flowerMat:null,stars:null,mist:[],clouds:[],sway:[],shafts:[],birds:null,snow:null,generation:0,release:null}}var oi=new O(new Uint8Array([255,255,255,255]),1,1);oi.wrapS=k,oi.wrapT=k,oi.colorSpace=``,oi.needsUpdate=!0;function si(e,t,n){let r=e.onBeforeCompile,i=e.customProgramCacheKey.bind(e);e.onBeforeCompile=(i,a)=>{r.call(e,i,a),i.uniforms.uVeilHaze=t,i.uniforms.tVeilSnow={value:e.userData.veilSnow??oi},i.uniforms.uVeilOn={value:+!!e.userData.veilSnow},e.userData.veilUniforms=i.uniforms,i.vertexShader.includes(`vVeilWorld`)||(i.vertexShader=i.vertexShader.replace(`#include <common>`,`#include <common>
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
uniform float uVeilOn;`).replace(`#include <color_fragment>`,`#include <color_fragment>\n${o}`))},e.customProgramCacheKey=()=>`veil-v2-${n}-${i()}`}function ci(e,t){e.release?.(),e.release=null;let n=t.environment,r=t.environmentIntensity;t.clear(),t.environment=n,t.environmentIntensity=r;for(let t of[...e.hero,...e.fill])t.geo.dispose();for(let t of e.geometries)t.dispose();for(let t of e.materials)t.dispose();for(let t of e.textures)t.dispose();e.heroMat?.dispose(),e.fillMat?.dispose(),e.flowerMat?.dispose(),e.stars?.dispose()}function li(t,i={}){let s=i.grade===`golden`,l=i.vista===!0,u=i.heightAt??Be,d=new c,f=new xe(38,1,i.near??.4,s||l?1100:260);f.position.set(-4.5,5.4,17.5);let p=i.ground===`snow`?`#d5e3ee`:i.ground===`rock`?`#c9d3da`:`#d2c2ae`,m=new Ie(s?`#e4c9a4`:l?p:`#e3ede7`,s||l?48:36,s||l?220:120);d.fog=m,d.background=s||i.hdri?null:m.color;let h=i.spline?.length?i.spline:Or,_=i.timeOfDay??`scroll`,v=i.density??1,b=null,x=!1,w=!1,T=0,A=ai(),M=ri(h),P={smooth:0,mx:0,my:0,started:-1,dusk:0,night:0,shotBlend:0,progress:0},F={x:0,y:0},I=new E(`#fff3dd`,2.6),L=new S(`#eef7ff`,`#94ad8e`,.5),ee=new ue(`#ffffff`,.14),te=new E(`#d8ece6`,.16);te.position.set(-14,9,-16);let z=new C(18,16,13).multiplyScalar(1.5),re=new C(-18,7,18),ie=new C(-14,30,-10),ae=new Y(`#fff3dd`),se=new Y(`#ffb46b`),ce=new Y(`#9fb6d8`),fe=new Y(`#e3ede7`),U=new Y(`#eedcc6`),he=new Y(`#161f2b`),ge=new Y,ve=new Y(`#fff3dd`),G=new Y(`#ffc48c`),ye=new Y(`#93b06a`),be=new Y(`#9aa863`),Ce=new C,we=new C,Te=new C,q=new C,ke=new C,J=new C,je=null,Me=null,Ne=null,Pe=null,Fe=null,Le=null,ze=null,Ve=null,He=!1,Ue=()=>{let e=r().shadowMapSize;if(I.castShadow=e>0,e<=0)return;I.shadow.mapSize.set(e,e),I.shadow.bias=i.product?-45e-5:-25e-5,I.shadow.normalBias=i.product?.025:.012,i.product&&(I.shadow.radius=2.5);let t=I.shadow.camera;t.near=i.product?.6:1,t.far=i.product?48:s?70:90;let n=i.product?9:s?12:24;t.left=-n,t.right=n,t.top=n,t.bottom=-n,t.updateProjectionMatrix()},Ge=(e,t,n)=>{let r=e.material,i=e=>{if(x||n!==A.generation){for(let t of e)t.dispose();return}let[i,a,o,s]=e;for(let t of e)t.wrapS=k,t.wrapT=k,t.repeat.set(85,85),t.anisotropy=We();i&&(i.colorSpace=W,r.map=i),a&&(a.colorSpace=``,r.normalMap=a),o&&(o.colorSpace=``,r.roughnessMap=o),s&&(s.colorSpace=``,r.aoMap=s,r.aoMapIntensity=t===`snow`?.45:.7),r.color.set(`#ffffff`),r.needsUpdate=!0,A.textures.push(...e)};if(t===`rock`){let e=Re([`diff`,`nor_gl`,`rough`,`ao`]);if(!e.length)return;Oe().then(()=>Promise.all(e.map(e=>Ee.loadAsync($(`textures/rocky_terrain_02/${e}.ktx2`))))).then(i).catch(()=>void 0),new N().loadAsync($(`textures/ground037/diff.jpg`)).then(e=>{if(x||n!==A.generation){e.dispose();return}e.colorSpace=``,e.wrapS=k,e.wrapT=k,e.anisotropy=We(),A.textures.push(e),r.userData.macroSoil=e,r.userData.macroSoilAmt=.28;let t=r.userData.macroUniforms;t?.tMacroSoil&&t.uMacroSoil&&(t.tMacroSoil.value=e,t.uMacroSoil.value=.28)}).catch(()=>void 0);return}let a=new N,o=Re([`diff`,`nor_gl`,`rough`,`ao`]);o.length&&Promise.all(o.map(e=>a.loadAsync($(`textures/snow_02/${e}.jpg`)))).then(i).catch(()=>void 0)},Ke=(e,t,n)=>{if(!e)return;let r=e.uniforms;r.uSunCol.value.copy(ve).lerp(G,t),r.uColTip&&r.uColTip.value.copy(ye).lerp(be,t*.55),Ce.copy(re).normalize(),r.uSunDir.value.copy(Mr).lerp(Ce,t).normalize(),r.uSunI.value=(1.15-t*.3)*(1-n*.7),r.uNight.value=n},qe=()=>{Ue(),s?(I.color.set(`#ffb56a`),I.intensity=2.35,I.position.copy(At).multiplyScalar(48),I.target.position.set(0,1.2,0),d.add(I.target),L.color.set(`#f3d7b0`),L.groundColor.set(`#6a7348`),L.intensity=.38):I.position.copy(z),i.product&&(te.intensity=0,I.target.position.set(0,1.15,0),d.add(I.target)),d.add(L,ee,I,te);let e=r().tier,t=e===`ultra`||e===`high`?160:et(e)?64:96,n=i.ground===`rock`||i.ground===`snow`,a=n?Hr(t,u,i.ground===`snow`?`#e7eef2`:`#8d8680`):Wt(t,A.textures,A.materials,s||l);if(A.geometries.push(a.geometry),n){let e=a.material;l&&Ft(e),A.materials.push(e)}d.add(a),(i.ground===`rock`||i.ground===`snow`)&&Ge(a,i.ground,A.generation),ni(d,u);let o=[],c=(e,t)=>{if(!t)return;let n=d.getObjectByName(e);if(!(n instanceof R))return;let r=t(n);typeof r==`function`&&o.push(r)};c(`AuraUnitSlot`,i.occupyUnit),c(`HotTubSlot`,i.occupyTub),o.length&&(A.release=()=>{for(let e of o)e()})},Je=e=>{V($(`models/pines.glb`)).then(t=>{if(x||w||e!==A.generation)return;t.scene.traverse(e=>{let t=e;if(!t.isMesh)return;let n=t.material;n?.isMeshStandardMaterial&&(n.roughness=1,n.metalness=0)});let n=Math.max(1,Math.ceil(Nr.length*Math.min(1,a(v)))),r=ei(t.scene,5.2,Nr.slice(0,n),A.sway);r.name=`Forest`,d.add(r),r.traverse(e=>{let t=e;if(!t.isMesh)return;let n=t.material,r=Array.isArray(n)?n:[n];for(let e of r)e&&(s&&Ft(e),A.materials.push(e))})}).catch(()=>{!x&&!w&&e===A.generation&&ti(d,A.geometries,A.materials,A.textures,a(v),()=>!x&&!w&&e===A.generation)})},Xe=()=>{let e=r(),t=$e(e.tier),n=a(v),o=A.generation;if(s){let e=()=>!x&&!w&&o===A.generation;if(t.trees===`pines`){Je(o),t.props&&Tr(d,A.geometries,A.materials,e);return}je=wr(d,A.geometries,A.materials,A.textures,e,()=>{e()&&Je(o)}).claimRenderer;return}if(l){let e=()=>!x&&!w&&o===A.generation;if(t.vista===`pines`){Je(o);return}je=wr(d,A.geometries,A.materials,A.textures,e,void 0,u,i.clear,!i.ground&&t.props).claimRenderer;return}if(t.trees===`pines`){Je(o);return}let c=e=>{let t=i.clear;if(!t)return e;let n=t.r*t.r;return e.filter(e=>{let r=e.pos[0]-t.x,i=e.pos[2]-t.z;return r*r+i*i>n})},f=e=>{let t=c(e);return t.slice(0,Math.max(1,Math.ceil(t.length*Math.min(1,n))))};Promise.all([V($(`models/pines.glb`)),V($(`models/pine-teal.glb`)),V($(`models/rocks.glb`)),V($(`models/lantern.glb`))]).then(([e,t,n,r])=>{if(x||w||o!==A.generation)return;let a=(e,t=!1)=>{e.traverse(e=>{let n=e;if(!n.isMesh)return;let r=n.material;r?.isMeshStandardMaterial&&(t&&r.color.set(`#828d84`),r.roughness=1,r.metalness=0)})};a(e.scene),a(t.scene),a(n.scene,!0);let s=ei(e.scene,5.2,f(Nr),A.sway,u),c=ei(t.scene,4.3,f(Pr),A.sway,u),p=ei(n.scene,1.4,f(Fr),[],u),m=i.ground?null:ei(r.scene,.38,f(Ir),[],u);s.name=`Forest`,c.name=`TealForest`,d.add(s,c,p),m&&d.add(m);for(let e of[s,c,p,m])e&&e.traverse(e=>{let t=e;if(!t.isMesh)return;let n=t.material,r=Array.isArray(n)?n:[n];for(let e of r)e&&(l&&Ft(e),A.materials.push(e))})}).catch(()=>{!l&&!x&&!w&&o===A.generation&&ti(d,A.geometries,A.materials,A.textures,n,()=>!x&&!w&&o===A.generation)})},Qe=e=>{if(!i.hdri||s||i.hdriNight)return;let t={value:m.color.clone()};Pe=t;let n=new O(new Uint8Array([Math.round(m.color.r*255),Math.round(m.color.g*255),Math.round(m.color.b*255),255]),1,1);n.colorSpace=le,n.magFilter=j,n.minFilter=j,n.generateMipmaps=!1,n.needsUpdate=!0,A.textures.push(n);let r=new _e({uniforms:{uHdr:{value:n},uHaze:t},vertexShader:`
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
      `,side:1,depthWrite:!1,fog:!1});f.far<525&&(f.far=567,f.updateProjectionMatrix());let a=new D(420,32,18);A.geometries.push(a),A.materials.push(r);let o=new H(a,r);o.name=`HdriSky`,o.frustumCulled=!1,o.renderOrder=-22,d.add(o),Se.load($(i.hdri),t=>{if(x||e!==A.generation){t.dispose();return}t.colorSpace=le,t.wrapS=k,t.magFilter=j,t.minFilter=j,t.generateMipmaps=!1,r.uniforms.uHdr.value=t,A.textures.push(t),d.background=null})},nt=e=>{let t=()=>!x&&!w&&e===A.generation,n={value:m.color.clone()};Fe=n;for(let e of A.materials)(e.name===`RidgeRock`||e.name===`RidgeSnow`)&&si(e,n,`ridge`),e.name===`SnowRange`&&si(e,n,`range`);Oe().then(()=>Ee.loadAsync($(`textures/rocky_terrain_02/diff.ktx2`))).then(e=>{if(!t()){e.dispose();return}e.colorSpace=W,e.wrapS=k,e.wrapT=k,e.anisotropy=We(),A.textures.push(e);for(let t of A.materials){if(t.name!==`RidgeRock`||!(t instanceof K))continue;let n=t.userData.span;if(n&&n[0]>520)continue;let r=e.clone();r.repeat.set(n?n[0]/16:24,n?Math.max(2,n[1]/8):6),r.needsUpdate=!0,A.textures.push(r),t.map=r,t.needsUpdate=!0}}).catch(()=>void 0),new N().loadAsync($(`textures/snow_02/diff.jpg`)).then(e=>{if(!t()){e.dispose();return}e.colorSpace=``,e.wrapS=k,e.wrapT=k,e.anisotropy=We(),A.textures.push(e);for(let t of A.materials){if(t.name===`SnowRange`){t.userData.veilSnow=e;let n=t.userData.veilUniforms;n?.tVeilSnow&&n.uVeilOn&&(n.tVeilSnow.value=e,n.uVeilOn.value=1)}if(t.name===`RidgeSnow`&&t instanceof K){let n=e.clone();n.colorSpace=W,n.wrapS=k,n.wrapT=k,n.repeat.set(6,2.4),n.needsUpdate=!0,A.textures.push(n),t.map=n,t.needsUpdate=!0}}}).catch(()=>void 0)},rt=e=>{let t={value:0};Ne=t;let n=new O(new Uint8Array([4,8,16,255]),1,1);n.colorSpace=le,n.needsUpdate=!0,A.textures.push(n);let r=new _e({uniforms:{uFrom:{value:n},uTo:{value:n},uNight:t},vertexShader:`
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
      `,side:1,depthWrite:!1,fog:!1}),a=new D(480,64,36);A.geometries.push(a),A.materials.push(r);let o=new H(a,r);o.name=`NightSky`,o.frustumCulled=!1,o.renderOrder=-20,d.add(o);let s=(t,n)=>{Se.load($(t),t=>{if(x||e!==A.generation){t.dispose();return}t.colorSpace=le,t.wrapS=k,t.magFilter=j,t.minFilter=j,t.generateMipmaps=!1,r.uniforms[n].value=t,A.textures.push(t),d.background=null})};i.hdri&&s(i.hdri,`uFrom`),i.hdriNight&&s(i.hdriNight,`uTo`)},it=()=>{let e=A.generation;s&&Vt(d,A.geometries,A.materials,A.textures,()=>!x&&!w&&e===A.generation);let t=new R;Wr(t,A.geometries,A.materials),d.add(t),A.snow=Kr(d,A.geometries,A.materials);let n=Yr(d,A.geometries,A.materials);A.clouds=n.children.slice();let a=Xr(d);if(A.geometries.push(a.geo),A.stars=a.mat,i.hdri&&!s&&!i.hdriNight&&Qe(e),i.hdriNight&&i.hdri&&rt(e),nt(e),i.nightScroll){let e=Zr();if(e){A.textures.push(e),Le=new y({map:e,color:`#f4efe4`,transparent:!0,depthWrite:!1,fog:!1,opacity:0}),A.materials.push(Le);let t=new g(Le);t.name=`Moon`,t.position.set(-24,20,-88),t.scale.set(11,11,1),t.renderOrder=-9,t.frustumCulled=!1,d.add(t)}}let o=Qr();if(o){A.textures.push(o);for(let e of Rr){let t=new y({map:o,transparent:!0,depthWrite:!1,opacity:.15});A.materials.push(t);let n=new g(t),r=(i.heightAt||i.ground?u(e.pos[0],e.pos[2]):0)+e.pos[1];n.position.set(e.pos[0],r,e.pos[2]),n.scale.set(e.scale,e.scale*.4,1),n.userData.base=e.pos[0],n.userData.y=r,n.userData.speed=e.speed,n.userData.index=A.mist.length,d.add(n),A.mist.push(n)}}let c=new Ae;c.setAttribute(`position`,new B(new Float32Array([0,0,0,-.5,.16,-.22,-.5,0,.02,0,0,0,.5,0,.02,.5,.16,-.22]),3)),A.geometries.push(c);let l=new K({color:`#3d4a45`,transparent:!0,opacity:.55,side:2});A.materials.push(l);let f=new ne(c,l,8);f.frustumCulled=!1,f.name=`Birds`,d.add(f),A.birds=f;let p=r().tier,m=!et(p)&&(i.ground||i.product?!1:s?p===`medium`:p!==`low`),h=$r();if(h&&m){A.textures.push(h);let e=new oe().setFromUnitVectors(new C(0,1,0),s?At:Mr);for(let t of Lr){let n=new K({map:h,transparent:!0,opacity:0,blending:2,depthWrite:!1,side:2,fog:!1});A.materials.push(n),A.shafts.push(n);let r=new R;r.position.set(t.pos[0],Be(t.pos[0],t.pos[1])+.1,t.pos[1]),r.quaternion.copy(e);let i=new pe(t.w,t.len);A.geometries.push(i);let a=new H(i,n);a.position.y=t.len/2,a.rotation.y=t.rot;let o=new H(i,n);o.position.y=t.len/2,o.rotation.y=t.rot+1.25,r.add(a,o),r.userData.gain=t.o,d.add(r)}}},at=()=>{if(i.meadow===!1)return;let e=r(),t=e.grassScale*v;if(t<=0)return;let n=Dt(t);A.hero=n.hero,A.fill=n.fill,A.heroMat=Tt(_t),A.fillMat=Tt(vt);let a=(e,t)=>{for(let n of e){let e=new H(n.geo,t);n.geo.userData.mesh=e,d.add(e)}};a(A.hero,A.heroMat),a(A.fill,A.fillMat);let o=pt(Math.round(160*t),e.tier===`high`||e.tier===`ultra`,{ground:Be,density:Ze,clearance:(e,t)=>Ye(e,t)},s);o&&(A.flowerMat=gt(),A.geometries.push(o.geo),d.add(new H(o.geo,A.flowerMat)));let c=A.generation;Promise.all([fetch($(`textures/meadow-atlas.bin`)).then(e=>e.arrayBuffer()),new N().loadAsync($(`textures/meadow-atlas.png`))]).then(([e,t])=>{if(x||w||c!==A.generation){t.dispose();return}let n=ui(e,t);if(!n){t.dispose();return}A.geometries.push(n.geo),A.materials.push(n.mat),A.textures.push(t),A.winds.push(n.wind);let r=new H(n.geo,n.mat);r.name=`MeadowAtlasField`,r.frustumCulled=!1,d.add(r)}).catch(()=>void 0)},ot=()=>{Ne=null,Pe=null,Fe=null,Le=null,ci(A,d),T+=1,A=ai(),A.generation=T,je=null,d.fog=m,d.background=s||i.hdri?null:m.color,M=ri(h),qe(),window.setTimeout(()=>{x||w||(Xe(),window.setTimeout(()=>{x||w||(it(),window.setTimeout(()=>{x||w||at()},32))},32))},16)},st=e=>{F.x=e.clientX/Math.max(1,window.innerWidth)*2-1,F.y=-(e.clientY/Math.max(1,window.innerHeight)*2-1)};window.addEventListener(`pointermove`,st,{passive:!0});let ct=et(),dt=tt({element:t,scene:d,camera:f,ao:ct?!1:i.ao??!1,exposure:i.exposure??1.02,tone:i.tone??`agx`,hdri:i.hdri,hdriPinned:i.hdriPinned,envIntensity:i.envIntensity,shadow:ct?void 0:i.shadow,bloom:ct?void 0:i.bloom,godrays:!ct&&i.godrays?I:void 0,flare:!ct&&i.flare,claimRenderer(e){Me=e,je?.(e),!He&&i.hdriNight&&i.hdri&&(He=!0,me(e,$(i.hdri)).then(e=>{x||(ze=e)}).catch(()=>void 0),me(e,$(i.hdriNight)).then(e=>{x||(Ve=e)}).catch(()=>void 0))},update(t,r){if(x||w)return;let a=e(),o=Q(i.readProgress?i.readProgress():t),c=Math.min(r,1/20);a?(P.smooth=o,P.mx=0,P.my=0):(P.smooth=De.damp(P.smooth,o,5,c),P.mx=De.damp(P.mx,F.x,3,c),P.my=De.damp(P.my,F.y,3,c)),Math.abs(o-P.progress)>.012&&P.shotBlend>.02&&(P.shotBlend=De.damp(P.shotBlend,0,1.4,c)),P.progress=o,b&&P.shotBlend<1&&(P.shotBlend=De.damp(P.shotBlend,1,1.6,c));let p=kt(a,n(performance.now())||5.6),g=Q(P.smooth),v=h.length>=13?Er(4/6,1,g):Er(.45,1,g),y=i.product||_===`day`?0:_===`dusk`||_===`night`?1:v,S=i.product?0:+(_===`night`);if(i.nightScroll&&!i.product&&(y=Math.max(y,Er(0,.42,g)),S=Er(.18,.92,g)),P.dusk=a?y:De.damp(P.dusk,Math.max(y,S),5,c),P.night=a?S:De.damp(P.night,S,2.2,c),i.reducedShot&&a)f.position.set(jr.p[0],jr.p[1],jr.p[2]),f.lookAt(jr.t[0],jr.t[1],jr.t[2]),f.fov=jr.fov,f.updateProjectionMatrix();else if(b&&P.shotBlend>.02)M.position.getPoint(g,q),M.target.getPoint(g,ke),we.set(b.p[0],b.p[1],b.p[2]),Te.set(b.t[0],b.t[1],b.t[2]),q.lerp(we,P.shotBlend),ke.lerp(Te,P.shotBlend),f.position.copy(q),f.lookAt(ke),f.fov=De.lerp(ii(h,g),b.fov,P.shotBlend),f.updateProjectionMatrix();else{P.started<0&&(P.started=performance.now());let e=i.intro&&!a?Dr(Q((performance.now()-P.started)/2200)):1;M.position.getPoint(g,q),M.target.getPoint(g,ke);let t=ii(h,g),n=Q((1.55-(f.aspect||1))/1);if(n>0&&(J.subVectors(q,ke).normalize(),q.addScaledVector(J,n*5.5),q.y+=n*.8,t*=1+n*.32),!i.product){let n=1-e;if(q.z+=n*4.2,q.y+=n*.5,t+=n*6,!a&&!i.steady){let e=1-Q(g*6/1.6)*.5;q.x+=P.mx*.5*e,q.y+=P.my*.28*e,ke.x-=P.mx*.16*e,ke.y-=P.my*.09*e}}let r=u(q.x,q.z)+.7;q.y<r&&(q.y=r),f.position.copy(q),f.lookAt(ke),Math.abs(f.fov-t)>.001&&(f.fov=t,f.updateProjectionMatrix())}let C=s?.68:P.dusk,T=s?0:P.night;if(s?(X.color.value.set(`#e4c9a4`),I.position.copy(f.position).addScaledVector(At,46),I.target.position.copy(f.position),I.target.updateMatrixWorld(),I.color.set(`#ffb56a`),I.intensity=2.35,L.color.set(`#f3d7b0`),L.groundColor.set(`#6a7348`),L.intensity=.38,m.color.copy(X.color.value),X.sun.value.copy(At),X.near.value=m.near,X.far.value=m.far):(Ce.lerpVectors(z,re,C).lerp(ie,T),I.position.copy(Ce),ge.copy(ae).lerp(se,C).lerp(ce,T),I.color.copy(ge),I.intensity=(2.6-C*.9)*(1-T*.82),L.intensity=(.5-C*.18)*(1-T*.72),ge.copy(fe).lerp(U,C).lerp(he,T),i.ground===`snow`&&ge.lerp(fe,.72),m.color.copy(ge),l&&(X.color.value.copy(m.color),X.falloff.value=i.ground===`rock`?.16:.28,X.near.value=i.ground===`rock`?32:i.ground===`snow`?36:42,X.far.value=i.ground===`rock`?180:i.ground===`snow`?160:220,X.sun.value.copy(I.position).normalize())),i.product&&(I.color.set(`#fff3dd`),I.intensity=2.35,I.position.copy(Mr).multiplyScalar(22),I.target.position.set(0,1.15,0),I.target.updateMatrixWorld(),L.intensity=.32,ee.intensity=.08,m.color.set(`#e7eeea`),d.background instanceof Y&&d.background.copy(m.color)),A.snow&&qr(A.snow,C,T),Jr(A.materials,T),A.stars&&(A.stars.opacity=T*.95),Le&&(Le.opacity=T*.9),Pe&&Pe.value.copy(m.color),Fe&&Fe.value.copy(m.color),Ne&&(Ne.value=T),ze&&Ve){d.environment=T<.5?ze:Ve;let e=T<.5?1-T*2:(T-.5)*2;d.environmentIntensity=(i.envIntensity??.45)*(.28+.72*e)*(1-T*.62)}if(Ke(A.heroMat,C,T),Ke(A.fillMat,C,T),Ke(A.flowerMat,C,T),s)for(let e of[A.heroMat,A.fillMat,A.flowerMat])e&&(e.uniforms.uSunDir.value.copy(At),e.uniforms.uSunCol.value.set(`#ffb56a`),e.uniforms.uSunI.value=1.35,e.uniforms.uHeightFog&&(e.uniforms.uHeightFog.value=1),e.uniforms.uHeightFogSun&&e.uniforms.uHeightFogSun.value.copy(At),e.uniforms.uHeightFogColor&&e.uniforms.uHeightFogColor.value.copy(X.color.value),e.uniforms.uHeightFogFalloff&&(e.uniforms.uHeightFogFalloff.value=X.falloff.value),e.uniforms.uFogNear.value=52,e.uniforms.uFogFar.value=210,e.uniforms.uHemiSky.value.set(`#f3d7b0`),e.uniforms.uHemiGround.value.set(`#6a7348`));let E=lt(p);for(let e of A.winds)e.uTime.value=p,e.uGust.value=E;for(let e of[A.heroMat,A.fillMat,A.flowerMat])e&&(e.uniforms.uTime.value=p,e.uniforms.uGust.value=E,e.uniforms.uCamPos.value.copy(f.position),e.uniforms.uNight.value=T,e.uniforms.uProjScale&&(e.uniforms.uProjScale.value=1/Math.tan(f.fov*Math.PI/360)),e.uniforms.uFogColor.value.copy(m.color));Ot(A.hero,_t,f.position),Ot(A.fill,vt,f.position);let D=+!a,O=Math.cos(.62),k=Math.sin(.62);if(A.sway.forEach((e,t)=>{let n=t*.7,r=Math.sin(p*.42+n)*.5+.5,i=Math.max(0,Math.sin(p*.85-e.position.x*.12-e.position.z*.09))*.55,a=(.007+r*.005+i*.011)*D;e.rotation.z=-a*O,e.rotation.x=a*k}),A.clouds.forEach(e=>{let t=e.userData.phase;if(e.position.x=e.userData.baseX+Math.sin(p*.05+t)*1.4*D,i.nightScroll){let t=e.material;t?.color&&t.color.setScalar(1-T*.94)}}),A.mist.forEach(e=>{let t=e.userData.index,n=e.userData.speed;e.position.x=e.userData.base+Math.sin(p*n*2+t*1.8)*2.4*!a,e.position.y=e.userData.y+Math.sin(p*n+t)*.3*!a,i.nightScroll&&(e.material.opacity=.15*(1-T))}),i.nightScroll&&A.birds){let e=A.birds.material;e.opacity=.55*(1-T)}if(A.birds){let e=new de;for(let t=0;t<8;t+=1){let n=t/8*Math.PI*2,r=26+t%4*5.5,i=(a?ut:p)*.055+n;e.position.set(Math.cos(i)*r,17+Math.sin(i*1.7+n)*2.6+t%3*1.4,Math.sin(i)*r*.72-6),e.rotation.set(0,-i+Math.PI/2,Math.sin(i*2.2+n)*.22);let o=a?1:.72+Math.sin(p*6.4+n*3.1)*.28;e.scale.set(1.05*o,1,1.05),e.updateMatrix(),A.birds.setMatrixAt(t,e.matrix)}A.birds.instanceMatrix.needsUpdate=!0}i.onFrame?.({camera:f,dt:c,dusk:P.dusk,night:P.night,reduced:a,renderer:Me});let j=Er(.55/6,1.3/6,g)*(1-Er(2.6/6,3.4/6,g));A.shafts.forEach((e,t)=>{e.opacity=a?0:j*(1-T)*Lr[t].o*.32})},suspend(){w=!0,ci(A,d),A=ai()},resume(){x||(w=!1,ot())}});ot();let ft=o(e=>{x||e.tier===`off`||w||ot()});return{setProgress(e){dt.setProgress(e)},setTimeOfDay(e){_=e},setDensity(e){v=e,!x&&!w&&ot()},setShot(e){b=e,e?P.shotBlend=Math.max(P.shotBlend,.15):P.shotBlend=0},destroy(){x||(x=!0,ft(),window.removeEventListener(`pointermove`,st),dt.destroy(),ci(A,d))}}}function ui(e,t){if(e.byteLength<24)return null;let n=new DataView(e),r=new TextDecoder().decode(new Uint8Array(e,0,8)),i=n.getUint32(8,!0),a=n.getUint32(12,!0),o=n.getUint32(16,!0);if(r!==`AURAMDW1`||i!==1||o!==48||e.byteLength!==24+a*o)return null;let s=new Float32Array(a*3),c=new Float32Array(a*2),u=new Float32Array(a),d=new Float32Array(a*4),f=new Float32Array(a);for(let e=0;e<a;e+=1){let t=24+e*o;s[e*3]=n.getFloat32(t,!0),s[e*3+1]=n.getFloat32(t+4,!0),s[e*3+2]=n.getFloat32(t+8,!0),c[e*2]=n.getFloat32(t+12,!0),c[e*2+1]=n.getFloat32(t+16,!0),u[e]=n.getFloat32(t+20,!0);let r=n.getFloat32(t+40,!0),i=n.getFloat32(t+44,!0),a=Math.min(5,Math.floor(i*6));d[e*4]=r===0?n.getFloat32(t+24,!0):a%4/4,d[e*4+1]=r===0?n.getFloat32(t+28,!0):Math.floor(a/4)/2,d[e*4+2]=n.getFloat32(t+32,!0),d[e*4+3]=n.getFloat32(t+36,!0),f[e]=i}let p=new z;p.setAttribute(`position`,new B(new Float32Array([-.5,0,0,.5,0,0,.5,1,0,-.5,1,0,0,0,-.5,0,0,.5,0,1,.5,0,1,-.5]),3)),p.setAttribute(`uv`,new B(new Float32Array([0,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1]),2)),p.setIndex(new B(new Uint16Array([0,1,2,0,2,3,4,5,6,4,6,7]),1)),p.setAttribute(`aAtlasPos`,new b(s,3)),p.setAttribute(`aAtlasSize`,new b(c,2)),p.setAttribute(`aAtlasYaw`,new b(u,1)),p.setAttribute(`aAtlasUv`,new b(d,4)),p.setAttribute(`aAtlasSeed`,new b(f,1)),p.instanceCount=a,p.boundingSphere=new T(new C(0,1.6,22),76),t.colorSpace=W,t.wrapS=l,t.wrapT=l,t.needsUpdate=!0;let m=new K({map:t,alphaTest:.42,transparent:!1,depthWrite:!0,side:2,fog:!0}),h={uTime:{value:ut},uWindDir:{value:ct.clone()},uGust:{value:lt(ut)}};return m.onBeforeCompile=e=>{e.uniforms.uTime=h.uTime,e.uniforms.uWindDir=h.uWindDir,e.uniforms.uGust=h.uGust,e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
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
transformed.y -= windBendT * abs(windSway) * windAmp * 0.18;`)},{geo:p,mat:m,wind:h}}var di=`#0c0d0e`,fi=`#9c7a55`,pi=`#c4a07a`,mi=qe+.1,hi=5.7,gi=2.9,_i=2.7199999999999998;function vi(e,t,n){let r=document.createElement(`canvas`);r.width=256,r.height=512;let i=r.getContext(`2d`);if(!i)return null;for(let r=0;r<48;r+=1){let a=r/47,o=De.lerp(t,e,a)*128;i.fillStyle=`rgba(0,0,0,${n/48*2.2})`;let s=Math.max(4,60*(1-a)),c=o,l=o,u=256-o*2,d=512-o*2;i.beginPath(),i.roundRect(c,l,u,d,s),i.fill()}let a=new ae(r);return a.colorSpace=W,a}function yi(){let e=document.createElement(`canvas`);e.width=64,e.height=256;let t=e.getContext(`2d`);if(!t)return null;t.fillStyle=`#9a9a9a`,t.fillRect(0,0,64,256);for(let e=0;e<90;e+=1){let n=e*37%64,r=120+e*53%90;t.fillStyle=`rgb(${r},${r},${r})`,t.fillRect(n,0,1+e%2,256)}let n=new ae(e);return n.colorSpace=``,n.wrapS=k,n.wrapT=k,n}function bi(e){let t=new ye({color:`#0a0b0c`,metalness:0,roughness:.035,ior:1.9,specularIntensity:1,clearcoat:1,clearcoatRoughness:.04,envMapIntensity:4.5,transparent:!0,depthWrite:!1,side:0});return t.blending=5,t.blendSrc=201,t.blendDst=205,t.blendSrcAlpha=201,t.blendDstAlpha=205,t.name=`aura-obsidian-glass`,t.customProgramCacheKey=()=>`aura-obsidian-glass-${e}`,t.onBeforeCompile=t=>{t.fragmentShader=t.fragmentShader.replace(`#include <opaque_fragment>`,`${Si(`0.32`)}
float auraNV = clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);
float auraF = pow(1.0 - auraNV, 3.0);
float auraA = mix(${e.toFixed(3)}, 1.0, auraF);
gl_FragColor = vec4(outgoingLight, auraA);`)},t}function xi(){let e=document.createElement(`canvas`);e.width=256,e.height=256;let t=e.getContext(`2d`);if(!t)return null;let n=t.createLinearGradient(0,0,0,256);n.addColorStop(0,`#f1c48c`),n.addColorStop(.35,`#c98f58`),n.addColorStop(1,`#5a3b22`),t.fillStyle=n,t.fillRect(0,0,256,256);for(let e=0;e<16;e+=1){let n=e*16;t.fillStyle=`rgba(40,22,10,${.18+e*7%5*.03})`,t.fillRect(n,0,1.5,256),t.fillStyle=`rgba(255,220,170,${.04+e*3%4*.02})`,t.fillRect(n+3,0,9,256)}let r=new ae(e);return r.colorSpace=W,r}var Si=e=>`
vec3 auraV = normalize(vViewPosition);
vec3 auraR = inverseTransformDirection(reflect(-auraV, normalize(normal)), viewMatrix);
float auraUp = smoothstep(-0.04, 0.32, auraR.y);
float auraFr = 0.18 + 0.82 * pow(1.0 - clamp(abs(dot(normalize(normal), auraV)), 0.0, 1.0), 2.0);
outgoingLight = outgoingLight * mix(0.32, 1.0, auraUp) * mix(1.0, 0.7, auraFr * (1.0 - auraUp)) + vec3(0.62, 0.68, 0.78) * auraUp * auraFr * ${e};
`;function Ci(){let e=new R;e.name=`AuraObsidianUnit`;let t=[],n=[],r=[],i=yi();i&&r.push(i);let a=new ye({color:`#060708`,metalness:.05,roughness:.035,ior:2,clearcoat:1,clearcoatRoughness:.02,envMapIntensity:2.8});a.customProgramCacheKey=()=>`aura-obsidian-facade`,a.onBeforeCompile=e=>{e.fragmentShader=e.fragmentShader.replace(`#include <opaque_fragment>`,`${Si(`0.42`)}
#include <opaque_fragment>`)};let o=new J({color:di,metalness:.1,roughness:.5,envMapIntensity:.45});i&&(o.roughnessMap=i);let s=new J({color:`#08090a`,metalness:.3,roughness:.35,envMapIntensity:.7}),c=new J({color:`#101113`,metalness:.4,roughness:.5,envMapIntensity:.9}),l=new J({color:fi,metalness:1,roughness:.28,envMapIntensity:1.6,emissive:pi,emissiveIntensity:.08}),u=new J({color:`#080706`,metalness:0,roughness:.95,envMapIntensity:.12}),d=new J({color:`#0a0a0a`,roughness:.9,metalness:0});d.polygonOffset=!0,d.polygonOffsetFactor=2,d.polygonOffsetUnits=2;let f=xi();f&&(f.wrapS=k,f.repeat.set(2,1),r.push(f));let p=new J({color:`#3a2717`,map:f??void 0,roughness:.75,metalness:0,emissive:`#ffffff`,emissiveMap:f??void 0,emissiveIntensity:.85,side:1}),m=new J({color:`#5e5144`,roughness:.95,emissive:`#9c7a55`,emissiveIntensity:.3}),h=new K({color:new Y(`#ffd9a8`).multiplyScalar(4),toneMapped:!0}),g=bi(.6);n.push(a,o,s,c,l,u,d,p,m,h,g);let _=(n,r,i,a,o,s,c,l,u={})=>{let d=new fe(r,i,a);t.push(d);let f=new H(d,o);return f.name=n,f.position.set(s,c,l),f.castShadow=u.cast??!0,f.receiveShadow=u.receive??!0,e.add(f),f},v=mi/2,y=hi/2,b=.07,x=3.08/2,S=mi+.5,C=hi+1.3,w=.45,T=.145,E=[];for(let e=-S/2+T/2;e<=S/2-T/2+1e-4;e+=.157){let t=new fe(T,.05,C);t.translate(e,.135,w),E.push(t)}let D=se(E,!1);for(let e of E)e.dispose();if(D){t.push(D);let n=new H(D,u);n.name=`deck`,n.castShadow=!0,n.receiveShadow=!0,e.add(n)}_(`deck-skirt`,S-.04,.5,C-.04,d,0,-.14,w,{cast:!1}),_(`plinth`,mi-.12,.06,hi-.12,d,0,.21,0,{cast:!1});let O=(()=>{let e=document.createElement(`canvas`);e.width=256,e.height=512;let t=e.getContext(`2d`);if(!t)return null;t.filter=`blur(10px)`,t.strokeStyle=`rgba(255,255,255,1)`,t.lineWidth=14,t.beginPath(),t.roundRect(38,38,180,436,10),t.stroke();let n=new ae(e);return n.colorSpace=W,n})();if(O){r.push(O);let i=S/(180/256),a=C/(436/512),o=new pe(i,a);o.rotateX(-Math.PI/2),t.push(o);let s=new K({map:O,color:new Y(pi).multiplyScalar(.55),transparent:!0,blending:2,depthWrite:!1,toneMapped:!0});n.push(s);let c=new H(o,s);c.name=`HaloWash`,c.position.set(0,.035,w),c.renderOrder=2,e.add(c)}_(`roof`,mi+.14,.2,hi+.14,c,0,3.018,0),_(`bronze-reveal`,mi+.002,.03,hi+.002,l,0,2.916,0,{cast:!1});let j=.1;for(let e of[-1,1])for(let t of[-1,1])_(`corner`,j,_i,j,s,e*(v-j/2),x,t*(y-j/2));let M=.14,N=2.38,P=3.1399999999999997/2,F=-y+j,I=y-j,L=[{z0:F,z1:-1.15,kind:`mirror`},{z0:-1.15,z1:.2,kind:`mirror`},{z0:.2,z1:2.15,kind:`clear`},{z0:2.15,z1:I,kind:`mirror`}],ee=[{z0:F,z1:-.6,kind:`mirror`},{z0:-.6,z1:1.1,kind:`clear`},{z0:1.1,z1:I,kind:`mirror`}],te=.03,ne=(e,t)=>{let n=e*(v-b/2);_(`sill`,.08,.12,hi-j*2,s,n,.32,0),_(`head`,.08,M,hi-j*2,s,n,gi-M/2,0);for(let r of t){let t=r.z1-r.z0-te,i=(r.z0+r.z1)/2;if(r.kind===`mirror`)_(`facade`,b,N,t,a,n,P,i);else{let r=_(`glazing`,.024,N,t,g,e*(v-b*.7),P,i,{cast:!1,receive:!1});r.renderOrder=10,_(`mullion`,b*.9,N,.04,s,n,P,i)}_(`seam`,.082,N,te,s,n,P,r.z1)}};ne(-1,L),ne(1,ee);let z=y,re=.34,B=.12;_(`portal-top`,mi,B,re,s,0,gi-B/2,z+re/2-.06),_(`portal-bottom`,mi,B,re,s,0,.24,z+re/2-.06),_(`portal-side`,B,_i,re,s,-v+B/2,x,z+re/2-.06),_(`portal-side`,B,_i,re,s,v-B/2,x,z+re/2-.06);let V=.012,oe=z+re-.06-.03;_(`portal-bronze`,mi-B*2,V,.05,l,0,2.78-V/2,oe,{cast:!1}),_(`portal-bronze`,mi-B*2,V,.05,l,0,.306,oe,{cast:!1}),_(`portal-bronze`,V,_i-B*2,.05,l,-v+B+V/2,x,oe,{cast:!1}),_(`portal-bronze`,V,_i-B*2,.05,l,v-B-V/2,x,oe,{cast:!1});let ce=mi-B*2,le=_i-B*2,ue=_(`glazing-end`,ce,le,.024,g,0,x,z-.02,{cast:!1,receive:!1});ue.renderOrder=10,_(`slider-stile`,.045,le,.05,s,ce*.08,x,z-0),_(`pull`,.018,.5,.03,l,ce*.08+.05,x,z+.03,{cast:!1});let de=[],U=.05,me={x0:-.55,x1:.55};for(let e=-v+j+U/2;e<=v-j-U/2+1e-4;e+=.1){if(e>me.x0-U&&e<me.x1+U)continue;let t=new fe(U,2.6399999999999997,.035);t.translate(e,1.58,-y-.0175),de.push(t)}let he=se(de,!1);for(let e of de)e.dispose();if(he){t.push(he);let n=new H(he,o);n.name=`battens`,n.castShadow=!0,n.receiveShadow=!0,e.add(n)}let ge=-v+j,_e=v-j;_(`end-backing`,me.x0-ge,_i,b,s,(ge+me.x0)/2,x,-y+b/2),_(`end-backing`,_e-me.x1,_i,b,s,(me.x1+_e)/2,x,-y+b/2);let ve=me.x1-me.x0,G=(me.x0+me.x1)/2;_(`end-backing`,ve,.2,b,s,G,.56/2,-y+b/2),_(`end-backing`,ve,.14000000000000012,b,s,G,5.66/2,-y+b/2);let be=_(`glazing-slot`,ve,N,.02,g,G,P,-y-.03,{cast:!1,receive:!1});be.renderOrder=10;let xe=p.clone();xe.side=0,xe.emissiveIntensity=.8,n.push(xe);let Se=mi-b*2-.04,Ce=hi-j*2-.04,we=_(`interior`,Se,2.6199999999999997,Ce,p,0,1.5699999999999998,0,{cast:!1,receive:!1});we.renderOrder=0,_(`cove`,.03,.03,Ce-.1,h,-Se/2+.06,2.6999999999999997,0,{cast:!1,receive:!1}),_(`cove`,.03,.03,Ce-.1,h,Se/2-.06,2.6999999999999997,0,{cast:!1,receive:!1}),_(`cove`,Se-.1,.03,.03,h,0,2.6999999999999997,-Ce/2+.06,{cast:!1,receive:!1}),_(`bed`,Se-.4,.42,1.9,m,0,.47,-Ce/2+1.1,{cast:!1}),_(`bed-head`,Se-.2,.9,.08,xe,0,.71,-Ce/2+.06,{cast:!1}),_(`bench`,.5,.3,1.5,m,-Se/2+.3,.41000000000000003,1.2,{cast:!1}),_(`bench-strip`,.02,.02,1.5,h,-Se/2+.56,.31,1.2,{cast:!1,receive:!1});let Te=new ie(`#ffc98a`,7,5.5,1.6);Te.name=`ObsidianGlow`,Te.position.set(0,2.4,.8),Te.castShadow=!1,e.add(Te);let q=new A(`#ffcf98`,9,6,Math.PI/3.2,.8,1.6);q.position.set(0,2.6,y-.3),q.target.position.set(0,0,y+1.6),q.castShadow=!1,e.add(q,q.target);let Ee=(i,a,o,s,c,l,u)=>{let d=vi(s,c,l);if(!d)return;r.push(d);let f=new pe(i,a);f.rotateX(-Math.PI/2),t.push(f);let p=new K({map:d,transparent:!0,depthWrite:!1,toneMapped:!1,fog:!0});n.push(p);let m=new H(f,p);m.name=`ContactShadow`,m.position.set(0,u,o),m.renderOrder=1,e.add(m)};return Ee(S+3.2,C+3.6,w,.32,0,.7,.02),Ee(S+.5,C+.5,w,.12,0,.85,.025),{object:e,dispose(){e.removeFromParent();for(let e of t)e.dispose();for(let e of n)e.dispose();for(let e of r)e.dispose();t.length=0,n.length=0,r.length=0}}}var wi=4.55,Ti=-7;function Ei(e,t){let n=Be(e,t)*.25,r=Math.max(0,-t-1.5);return n+Math.min(14,r*.42)*Math.exp(-(e*e)/260)}function Di(){return[{p:[8.4,3.4,5.2],t:[.1,4.1,-7],fov:34},{p:[5.2,4.15,1.4],t:[0,4.35,-7.2],fov:32},{p:[2.4,4.7,-2.2],t:[0,4.5,-7.4],fov:30}]}function Oi(e){return(`/`.endsWith(`/`)?`/`:`//`)+e.replace(/^\//,``)}function ki(e){return e.wrapS=k,e.wrapT=k,e.repeat.set(1.4,2.2),e.anisotropy=We(),e}function Ai(){let e=new R;e.name=`SlopePlace`;let t=[],n=[],r=[],i=!0,a=new J({color:`#2a3036`,roughness:.58,metalness:.86,envMapIntensity:.45}),o=new J({color:`#b88862`,roughness:.72,metalness:.02,envMapIntensity:.25});n.push(a,o),Ue(a),Ue(o);let s=e=>{let n=new R,r=new d(.042,.05,e,12);t.push(r);let i=new H(r,a);i.position.y=e/2,i.castShadow=!0,n.add(i);for(let e=0;e<4;e+=1){let r=new Le(.14,.012,6,16,Math.PI*1.7);t.push(r);let i=new H(r,a);i.rotation.x=Math.PI/2,i.rotation.z=e*.85,i.position.y=.16+e*.15,i.castShadow=!0,n.add(i)}let o=new d(.1,.1,.045,12);t.push(o);let s=new H(o,a);return s.position.y=e,s.castShadow=!0,n.add(s),n};for(let[t,n]of[[-2.05,-3.05],[2.05,-3.05],[-2.05,3.05],[2.05,3.05],[-2.05,0],[2.05,0]]){let r=Ei(t,Ti+n),i=s(Math.max(.4,wi-r));i.position.set(t,r,Ti+n),e.add(i)}let c=new fe(4.5,.16,6.7),l=c.getAttribute(`uv`);l&&c.setAttribute(`uv2`,l),t.push(c);let u=new H(c,o);u.name=`CedarDeck`,u.position.set(0,wi,Ti),u.castShadow=!0,u.receiveShadow=!0,e.add(u);let f=Ke();f.object.position.set(0,4.63,Ti),f.setMood(.42),e.add(f.object);let p=e=>{for(let t of e)t.dispose()},m=e=>{let t=Re([`diff`,`nor_gl`,`rough`,`ao`]);return t.length?Oe().then(()=>Promise.all(t.map(t=>Ee.loadAsync(Oi(`textures/${e}/${t}.ktx2`))))):Promise.resolve([])};return m(`metal_plate`).then(e=>{if(!i){p(e);return}let[t,n,o,s]=e;for(let t of e)ki(t);t&&(t.colorSpace=W),n&&(n.colorSpace=``),o&&(o.colorSpace=``),s&&(s.colorSpace=``),r.push(...e),t&&(a.map=t),n&&(a.normalMap=n),o&&(a.roughnessMap=o),s&&(a.aoMap=s,a.aoMapIntensity=.55),a.needsUpdate=!0}).catch(()=>void 0),m(`weathered_brown_planks`).then(e=>{if(!i){p(e);return}let[t,n,a,s]=e;for(let t of e)ki(t),t.repeat.set(2.25,3.35);t&&(t.colorSpace=W),n&&(n.colorSpace=``),a&&(a.colorSpace=``),s&&(s.colorSpace=``),r.push(...e),t&&(o.map=t),n&&(o.normalMap=n),a&&(o.roughnessMap=a),s&&(o.aoMap=s,o.aoMapIntensity=.28),o.color.setRGB(1.45,1.02,.68),o.needsUpdate=!0}).catch(()=>void 0),{object:e,dispose(){if(i){i=!1,f.dispose(),e.removeFromParent();for(let e of t)e.dispose();for(let e of n)e.dispose();for(let e of r)e.dispose()}}}}var ji=`
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
`,Mi=`
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
`,Ni=`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,Pi=`
uniform sampler2D tSnow;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(tSnow, vUv);
}
`;function Fi(e){return(`/`.endsWith(`/`)?`/`:`//`)+e.replace(/^\//,``)}function Ii(e){let t=Math.sin(e*127.1+311.7)*43758.5453;return t-Math.floor(t)}function Li(){let e=r().tier;return e===`ultra`?200:e===`high`?160:e===`medium`?100:e===`low`?56:0}function Ri(e){let t=Li(),r=new Float32Array(Math.max(1,t)*4);for(let e=0;e<t;e+=1)r[e*4]=(Ii(e+1)-.5)*46,r[e*4+1]=Ii(e+2),r[e*4+2]=(Ii(e+3)-.5)*46,r[e*4+3]=Ii(e+4);let i=new pe(1,1);i.setAttribute(`aSeed`,new b(r,4));let a=new N().load(Fi(`textures/fx/cloud.png`));a.colorSpace=``,a.wrapS=k,a.wrapT=k,a.magFilter=j,a.minFilter=s;let o=new x(4,4,{depthBuffer:!0,stencilBuffer:!1});o.depthTexture=new ge(4,4),o.depthTexture.format=ve,o.depthTexture.type=te;let l=new ke({depthPacking:be}),u=new x(4,4,{format:Pe,depthBuffer:!1,stencilBuffer:!1});u.texture.generateMipmaps=!1,u.texture.minFilter=j,u.texture.magFilter=j,u.texture.colorSpace=le;let d=new _(4,4),f=new _e({uniforms:{uTime:{value:0},tCloud:{value:a},tDepth:{value:o.depthTexture},uSoft:{value:0},uResolution:{value:d},uNear:{value:.4},uFar:{value:260}},vertexShader:ji,fragmentShader:Mi,transparent:!0,depthWrite:!1,depthTest:!1,side:2,blending:5,blendSrc:201,blendDst:205,blendEquation:100,blendSrcAlpha:201,blendDstAlpha:205}),p=new ne(i,f,Math.max(1,t));p.name=`Snowfall`,p.count=t,p.frustumCulled=!1,p.renderOrder=2;let m=new he;for(let e=0;e<p.count;e+=1)p.setMatrixAt(e,m);p.instanceMatrix.needsUpdate=!0;let h=new c;t>0&&h.add(p);let g=new _e({uniforms:{tSnow:{value:u.texture}},vertexShader:Ni,fragmentShader:Pi,transparent:!0,depthTest:!1,depthWrite:!1,toneMapped:!1,blending:5,blendSrc:201,blendDst:205,blendEquation:100,blendSrcAlpha:201,blendDstAlpha:205}),v=new pe(1,1),y=new H(v,g);y.name=`SnowCard`,y.frustumCulled=!1,y.renderOrder=8,y.visible=!1,t>0&&e.add(y);let S=0,w=0,T=!0,E=new C,D=new C,O=new oe,A=new oe,M=(e,t)=>{(e!==S||t!==w)&&(S=e,w=t,o.setSize(e,t),u.setSize(e,t),d.set(e,t))},P=t=>{e.updateWorldMatrix(!0,!1);let n=Math.max(t.near*2.2,.35);t.getWorldDirection(E),D.copy(t.position).addScaledVector(E,n),e.worldToLocal(D),y.position.copy(D),e.getWorldQuaternion(O),A.copy(t.quaternion),y.quaternion.copy(A).premultiply(O.invert());let r=t.fov*Math.PI/180,i=2*Math.tan(r*.5)*n,a=i*(t.aspect>0?t.aspect:1);y.scale.set(a,i,1)},F=(n,r)=>{let i=r.aspect>0?r.aspect:1,a=Math.max(2,i>=1?640:Math.floor(640*i)),s=Math.max(2,i>=1?Math.floor(640/i):640);M(a,s);let d=n.getRenderTarget(),p=n.autoClear,m=n.getScissorTest(),g=n.getViewport(new q),_=n.getScissor(new q),v=n.getClearColor(new Y),b=n.getClearAlpha(),x=e,S=x instanceof c?x.overrideMaterial:null,C=[];try{if(n.autoClear=!0,n.setScissorTest(!1),x instanceof c){let e=new Set([`Terrain`,`AuraUnitSlot`,`HotTubSlot`,`SlopePlace`]);for(let t of x.children)!e.has(t.name)&&t.visible&&(t.visible=!1,C.push(t));x.overrideMaterial=l,n.setRenderTarget(o),n.setViewport(0,0,a,s),n.setClearColor(0,1),n.clear(!0,!0,!0),n.render(x,r),x.overrideMaterial=S,f.uniforms.uSoft.value=1}n.setRenderTarget(u),n.setViewport(0,0,a,s),n.setClearColor(0,0),n.clear(!0,!0,!0),n.render(h,r),y.visible=t>0}finally{for(let e of C)e.visible=!0;x instanceof c&&(x.overrideMaterial=S),n.setRenderTarget(d),n.setViewport(g),n.setScissor(_),n.setScissorTest(m),n.setClearColor(v,b),n.autoClear=p}};return{update(e){if(!T||t===0)return;f.uniforms.uTime.value=e.reduced?0:n(performance.now());let r=e.camera;if(r.isPerspectiveCamera){if(f.uniforms.uNear.value=r.near,f.uniforms.uFar.value=r.far,!e.renderer){f.uniforms.uSoft.value=0,y.visible=!1;return}try{F(e.renderer,r),P(r)}catch{f.uniforms.uSoft.value=0,y.visible=t>0}}},dispose(){T&&(T=!1,p.removeFromParent(),y.removeFromParent(),i.dispose(),v.dispose(),f.dispose(),g.dispose(),a.dispose(),l.dispose(),o.dispose(),u.dispose())}}}var zi=.32,Bi=1.12,Vi=[-1.3,-.5],Hi=[`grass`,`glass`,`steam`,`far`,`snow`,`slope`];function Ui(e){let t=e.dataset.scene;return Hi.includes(t)?t:`grass`}var Wi={grass:{exposure:1.06,tone:`agx`,hdri:`/hdri/evening_meadow_1k.hdr`,env:.42,ao:!1},far:{exposure:1,tone:`agx`,hdri:`/hdri/qwantani_dusk_2_puresky_1k.hdr`,env:.55,ao:!0},slope:{exposure:1.02,tone:`agx`,hdri:`/hdri/alps_field_1k.hdr`,env:.7,ao:!0},snow:{exposure:1.05,tone:`agx`,hdri:`/hdri/snowy_field_1k.hdr`,env:.85,ao:!0},glass:{exposure:1,tone:`neutral`,hdri:`/hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr`,env:1,ao:!0},steam:{exposure:1.08,tone:`agx`,hdri:`/hdri/qwantani_dusk_2_puresky_1k.hdr`,env:.2,ao:!0}},Gi=[{p:[2.6,2.7,13.2],t:[2.4,1.25,2.6],fov:38},{p:[1.2,2.3,9.2],t:[1.8,1.2,1.6],fov:34},{p:[-.2,1.85,6.2],t:[1.1,1.15,.4],fov:32}];function Ki(t,n){let r=t.ownerDocument,i=(e,t)=>{(e===`clear`||e===`mirror`||e===`tinted`)&&n.setFinish(e,t)},a=t=>{let n=t.target;n instanceof HTMLInputElement&&n.name===`glazing`&&n.closest(`.materials-swatches`)&&i(n.value,e()?0:1.2)};r.addEventListener(`change`,a);let o=r.querySelector(`.materials-swatches input[name="glazing"]:checked`);return o&&i(o.value,0),()=>r.removeEventListener(`change`,a)}function qi(e,t){let n=Ui(e);e.dataset.sceneLive=n;let r=Wi[n],i=(e,n)=>(e.setProgress(t()),{setProgress(t){e.setProgress(t)},destroy(){n?.(),e.destroy()}});if(n===`grass`){let t=null,n=null;return i(li(e,{spline:kr,timeOfDay:`day`,density:1,grade:`golden`,exposure:r.exposure,tone:r.tone,hdri:r.hdri,hdriPinned:!0,envIntensity:r.env,near:.75,ao:!1,shadow:`soft`,bloom:{threshold:.8,intensity:.28},godrays:!0,flare:!0,occupyUnit(e){t?.dispose();let n=Ci();return n.object.rotation.y=zi,n.object.scale.setScalar(Bi),t=n,e.add(n.object),()=>{n.dispose(),t===n&&(t=null)}},occupyTub(e){let t=Qe({warmWater:!0});return n=t,t.object.position.set(Vi[0],0,Vi[1]),e.add(t.object),()=>{t.dispose(),n===t&&(n=null)}},onFrame(e){n?.update({camera:e.camera,renderer:e.renderer,dusk:.6,night:0,reduced:e.reduced})}}),()=>{t?.dispose(),t=null})}if(n===`far`){let t=null,n=null;return i(li(e,{spline:Ar,timeOfDay:`scroll`,density:1,nightScroll:!0,vista:!0,exposure:r.exposure,tone:r.tone,hdri:r.hdri,hdriPinned:!0,hdriNight:`/hdri/rogland_clear_night_1k.hdr`,envIntensity:r.env,ao:!0,shadow:`soft`,bloom:{threshold:.9,intensity:.42},steady:!0,occupyUnit(e){let n=Ke({rising:!0});return t=n,e.add(n.object),()=>{n.dispose(),t===n&&(t=null)}},occupyTub(e){let t=Qe();return n=t,e.add(t.object),()=>{t.dispose(),n===t&&(n=null)}},onFrame(e){t?.setMood(e.night),n?.update(e)}}))}if(n===`glass`){let t=()=>{};return i(li(e,{spline:Ve(),timeOfDay:`day`,density:1,exposure:r.exposure,tone:r.tone,hdri:r.hdri,hdriPinned:!0,envIntensity:r.env,ao:!0,product:!0,occupyUnit(n){t();let r=Ke();n.add(r.object);let i=new URLSearchParams(window.location.search).get(`glaze`);return(i===`clear`||i===`mirror`||i===`tinted`)&&r.setFinish(i,0),t=Ki(e,r),()=>{t(),t=()=>{},r.dispose()}}}),()=>t())}if(n===`steam`){let t=null;return i(li(e,{spline:Ge(),timeOfDay:`dusk`,density:1,exposure:1.02,tone:r.tone,hdri:r.hdri,hdriPinned:!0,envIntensity:.72,ao:!0,shadow:`soft`,bloom:{threshold:.9,intensity:.42},steady:!0,occupyUnit(e){let t=Ke();return e.add(t.object),()=>t.dispose()},occupyTub(e){t?.dispose(),t=Je(),e.add(t.object);let n=t;return()=>{n.dispose(),t===n&&(t=null)}},onFrame(e){t?.update(e)}}))}if(n===`slope`)return i(li(e,{spline:Di(),timeOfDay:`day`,density:1,vista:!0,meadow:!1,ground:`rock`,heightAt:Ei,clear:{x:0,z:-7,r:4.2},exposure:r.exposure,tone:r.tone,hdri:r.hdri,hdriPinned:!0,envIntensity:r.env,ao:!0,shadow:`soft`,bloom:{threshold:.9,intensity:.28},steady:!0,occupyUnit(e){let t=e.parent;if(!t)return;let n=Ai();return t.add(n.object),()=>n.dispose()}}));let a=null,o=null,s=null;return i(li(e,{spline:Gi,timeOfDay:`day`,density:1,vista:!0,meadow:!1,ground:`snow`,exposure:r.exposure,tone:r.tone,hdri:r.hdri,hdriPinned:!0,envIntensity:r.env,ao:!0,shadow:`soft`,bloom:{threshold:.9,intensity:.36},steady:!0,occupyUnit(e){let t=Ke({frost:!0});t.setMood(.72),a=t,e.add(t.object);let n=e.parent,r=n?Ri(n):null;return s=r,()=>{t.dispose(),r?.dispose(),a===t&&(a=null),s===r&&(s=null)}},occupyTub(e){let t=Qe();return o=t,e.add(t.object),()=>{t.dispose(),o===t&&(o=null)}},onFrame(e){a?.setMood(Math.max(.72,e.night)),o?.update({camera:e.camera,renderer:e.renderer,dusk:.75,night:0,reduced:e.reduced}),s?.update(e)}}))}function Ji(n){let a=!1,s=null,c=0,l=nt(n,()=>{if(a||s)return null;if(r().tier===`off`||e())return i(n),null;try{s=qi(n,()=>c),s.setProgress(c)}catch(e){return s=null,i(n),console.warn(`meadow mount failed`,e),null}return{destroy(){s?.destroy(),s=null}}}),u=o(e=>{a||e.tier===`off`&&(s?.destroy(),s=null,i(n))}),d={setProgress(e){c=e,s?.setProgress(e)},destroy(){a||(a=!0,u(),l(),s?.destroy(),s=null)}};return t(d.destroy),d}export{Ji as mountMeadow};