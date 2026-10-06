import{a as e,c as t}from"./quality.CTYOUeGs.js";import{A as n,At as r,Bn as i,Bt as a,D as o,Dt as s,F as c,Gt as l,Jn as u,Jt as d,Kn as f,Kt as p,N as m,Nt as h,Ot as g,Pt as _,Q as ee,R as te,Sr as v,Tr as y,Tt as ne,Xt as b,Yn as re,Z as x,_t as S,br as C,c as w,d as T,g as E,gr as ie,gt as ae,it as oe,kt as se,l as D,m as O,nt as k,o as A,or as ce,qt as j,rn as le,sr as ue,u as de,v as M,xr as N,yt as P}from"./three.core.aYj4cLSI.js";import{a as fe,r as F,s as I}from"./loaders.DL6deg2S.js";var pe=[`aura-unit`,`hot-tub`,`gazebo`,`a-frame`],me=8388608,he=2048,L={"aura-unit":{meters:6,measure:`length`},"hot-tub":{meters:1.8,measure:`width`},gazebo:{meters:3,measure:`span`},"a-frame":{meters:6,measure:`length`}},R={"aura-unit":{tint:[1.42,1.02,.66],ao:.42},"hot-tub":{tint:[1.62,1.08,.68],ao:.18},gazebo:{tint:[1.32,.9,.58],ao:.35},"a-frame":{tint:[1.42,1.02,.66],ao:.42}},z={off:[`.lod2`,`.lod1`,``],low:[`.lod2`,`.lod1`,``],medium:[`.lod1`,``,`.lod2`],high:[``,`.lod1`,`.lod2`],ultra:[``,`.lod1`,`.lod2`]},ge=/polycarbonate|glass/i,B=/water/i,_e=/cedar|wood|oak|timber/i,V=/steel|metal|iron/i;function ve(e){return pe.includes(e)}function H(e){return(`/`.endsWith(`/`)?`/`:`//`)+e.replace(/^\//,``)}function ye(e,t){return H(`models/custom/${e}${t}.glb`)}var U=new Map;function W(e){let t=U.get(e);if(t)return t;let n=fetch(e,{method:`HEAD`,cache:`no-store`}).then(e=>{let t=Number(e.headers.get(`content-length`));return{ok:e.ok,bytes:Number.isFinite(t)&&t>=0?t:null}}).catch(()=>({ok:!1,bytes:null}));return U.set(e,n),n}async function be(e,n=`quality`){let r=n===`full`?[``,`.lod1`,`.lod2`]:z[t().tier];for(let t of r){let n=ye(e,t),r=await W(n);if(r.ok)return{url:n,bytes:r.bytes,level:t===``?`full`:t.slice(1)}}return null}async function xe(e,t=`quality`){let n=await be(e,t);if(!n)return null;try{return(await fe(n.url)).scene.clone(!0)}catch{return null}}function G(e,t){return t===`width`?e.x>.05?e.x:Math.max(e.x,e.z):t===`length`&&e.z>.05?e.z:Math.max(e.x,e.z)}function K(e,t){e.position.set(0,0,0),e.updateMatrixWorld(!0);let n=L[t],r=new w().setFromObject(e),i=G(r.getSize(new N),n.measure);i>1e-4&&(e.scale.multiplyScalar(n.meters/i),e.updateMatrixWorld(!0),r=new w().setFromObject(e));let a=r.getCenter(new N);e.position.x-=a.x,e.position.z-=a.z,e.position.y-=r.min.y,e.updateMatrixWorld(!0)}var Se=new Map;function q(e){let t=Se.get(e);if(t)return t;let n=I().then(()=>Promise.all([F.loadAsync(H(`textures/${e}/diff.ktx2`)),F.loadAsync(H(`textures/${e}/nor_gl.ktx2`)),F.loadAsync(H(`textures/${e}/rough.ktx2`)),F.loadAsync(H(`textures/${e}/ao.ktx2`))])).then(([e,t,n,r])=>{let a=(e,t)=>(e.colorSpace=t,e.wrapS=i,e.wrapT=i,e.repeat.set(2,2),e.anisotropy=8,e);return a(e,f),a(t,``),a(n,``),a(r,``),{diff:e,nor:t,rough:n,ao:r}});return Se.set(e,n),n.catch(()=>{Se.get(e)===n&&Se.delete(e)}),n}function Ce(e){let t=e.geometry;t&&!t.getAttribute(`uv2`)&&t.getAttribute(`uv`)&&t.setAttribute(`uv2`,t.getAttribute(`uv`))}function we(e,t){let n=e;if(n.map)return null;if(n.isMeshStandardMaterial){let e=n.clone();e.vertexColors=!1;let r=e;return r.isMeshPhysicalMaterial&&(r.transmission=0,r.thickness=0),t.push(e),e}let r=e;if(!r.isMeshBasicMaterial&&!e.isMeshLambertMaterial)return null;let i=new _({color:r.color});return t.push(i),i}function Te(e,t,n={}){K(e,t),e.name=t===`aura-unit`?`AuraUnitModel`:`Custom${t}`;let r=[],i=[],a=[],o=[],s=!0;e.traverse(e=>{let t=e;if(!t.isMesh)return;let s=Array.isArray(t.material)?t.material:[t.material],c=!1,l=!1,u=s.map(e=>{if(!e)return e;let s=`${t.name} ${e.name}`;if(ge.test(s)&&(c=!0,n.polycarbonate))return n.polycarbonate();if(B.test(s)&&(l=!0,n.water))return n.water();if(_e.test(s)){let n=we(e,r);if(n)return i.push(n),o.push(t),n}if(V.test(s)){let n=we(e,r);if(n)return a.push(n),o.push(t),n}return e});t.material=Array.isArray(t.material)?u:u[0];let d=c||l;t.castShadow=!d,t.receiveShadow=!d,c?t.renderOrder=10:l&&(t.renderOrder=4)});for(let e of o)Ce(e);let c=(e,t,n,r,i,a,o,c)=>{if(s)for(let s of e)s.map=t.diff,s.normalMap=t.nor,s.roughnessMap=t.rough,s.aoMap=t.ao,s.aoMapIntensity=r,s.normalScale.set(o,o),s.color.setRGB(n[0],n[1],n[2]),s.metalness=i,s.roughness=a,s.envMapIntensity=c,s.vertexColors=!1,s.needsUpdate=!0};if(i.length){let e=R[t];q(`fine_grained_wood`).then(t=>c(i,t,e.tint,e.ao,.02,.68,.55,.22)).catch(()=>void 0)}return a.length&&q(`metal_plate`).then(e=>c(a,e,[1,1,1],.8,.86,.62,1,.45)).catch(()=>void 0),{object:e,materials:r,release(){s=!1;for(let e of r)e.dispose();r.length=0}}}var Ee=new N;function J(e,t,n,r,i,a){let o=2*Math.PI*i/4,s=Math.max(a-2*i,0),c=Math.PI/4;Ee.copy(t),Ee[r]=0,Ee.normalize();let l=.5*o/(o+s),u=1-Ee.angleTo(e)/c;return Math.sign(Ee[n])===1?u*l:s/(o+s)+l+l*(1-u)}var De=class e extends D{constructor(e=1,t=1,n=1,r=2,i=.1){let a=r*2+1;if(i=Math.min(e/2,t/2,n/2,i),super(1,1,1,a,a,a),this.type=`RoundedBoxGeometry`,this.parameters={width:e,height:t,depth:n,segments:r,radius:i},a===1)return;let o=this.toNonIndexed();this.index=null,this.attributes.position=o.attributes.position,this.attributes.normal=o.attributes.normal,this.attributes.uv=o.attributes.uv;let s=new N,c=new N,l=new N(e,t,n).divideScalar(2).subScalar(i),u=this.attributes.position.array,d=this.attributes.normal.array,f=this.attributes.uv.array,p=u.length/6,m=new N,h=.5/a;for(let r=0,a=0;r<u.length;r+=3,a+=2)switch(s.fromArray(u,r),c.copy(s),c.x-=Math.sign(c.x)*h,c.y-=Math.sign(c.y)*h,c.z-=Math.sign(c.z)*h,c.normalize(),u[r+0]=l.x*Math.sign(s.x)+c.x*i,u[r+1]=l.y*Math.sign(s.y)+c.y*i,u[r+2]=l.z*Math.sign(s.z)+c.z*i,d[r+0]=c.x,d[r+1]=c.y,d[r+2]=c.z,Math.floor(r/p)){case 0:m.set(1,0,0),f[a+0]=J(m,c,`z`,`y`,i,n),f[a+1]=1-J(m,c,`y`,`z`,i,t);break;case 1:m.set(-1,0,0),f[a+0]=1-J(m,c,`z`,`y`,i,n),f[a+1]=1-J(m,c,`y`,`z`,i,t);break;case 2:m.set(0,1,0),f[a+0]=1-J(m,c,`x`,`z`,i,e),f[a+1]=J(m,c,`z`,`x`,i,n);break;case 3:m.set(0,-1,0),f[a+0]=1-J(m,c,`x`,`z`,i,e),f[a+1]=1-J(m,c,`z`,`x`,i,n);break;case 4:m.set(0,0,1),f[a+0]=1-J(m,c,`x`,`y`,i,e),f[a+1]=1-J(m,c,`y`,`x`,i,t);break;case 5:m.set(0,0,-1),f[a+0]=J(m,c,`x`,`y`,i,e),f[a+1]=1-J(m,c,`y`,`x`,i,t)}}static fromJSON(t){return new e(t.width,t.height,t.depth,t.segments,t.radius)}};function Oe(){let e=t().tier;return e===`high`||e===`ultra`?8:e===`medium`?4:2}var ke=`
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
`,Ae=`
{
  float macroFar = 1.0 - smoothstep(28.0, 90.0, length(vMacroWorld - cameraPosition));
  float macroA = macroNoise(vMacroWorld.xz * 0.045);
  float macroB = macroNoise(vMacroWorld.xz * 0.13 + 4.2);
  float macroLift = (macroA - 0.5) * 0.22 + (macroB - 0.5) * 0.08;
  diffuseColor.rgb *= 1.0 + macroLift * macroFar;
  if (uMacroSoil > 0.001) {
    vec3 soil = texture2D(tMacroSoil, vMacroWorld.xz * 0.5).rgb;
    soil = pow(max(soil, vec3(0.0)), vec3(2.2));
    float soilMask = smoothstep(0.32, 0.72, macroNoise(vMacroWorld.xz * 0.07 + 9.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, soil, soilMask * uMacroSoil * macroFar);
  }
}
`,je=new n(new Uint8Array([255,255,255,255]),1,1);je.wrapS=i,je.wrapT=i,je.colorSpace=``,je.needsUpdate=!0;function Y(e){let t=e.onBeforeCompile,n=e.customProgramCacheKey.bind(e);return e.onBeforeCompile=(n,r)=>{t.call(e,n,r),n.vertexShader.includes(`vMacroWorld`)||(n.vertexShader=n.vertexShader.replace(`#include <common>`,`#include <common>
varying vec3 vMacroWorld;`).replace(`#include <begin_vertex>`,`#include <begin_vertex>
vMacroWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`).replace(`#include <uv_vertex>`,`#include <uv_vertex>
#ifdef USE_MAP
  vec2 seamP = position.xz * 0.11;
  float seamA = sin(dot(seamP, vec2(1.7, 2.3)));
  float seamB = sin(dot(seamP, vec2(2.9, 1.1)) + 1.7);
  vMapUv += vec2(seamA, seamB) * 0.28;
#endif`)),n.uniforms.tMacroSoil={value:e.userData.macroSoil??je},n.uniforms.uMacroSoil={value:e.userData.macroSoilAmt??0},e.userData.macroUniforms=n.uniforms,n.fragmentShader.includes(`macroNoise`)||(n.fragmentShader=n.fragmentShader.replace(`#include <common>`,`#include <common>\nvarying vec3 vMacroWorld;\nuniform sampler2D tMacroSoil;\nuniform float uMacroSoil;\n${ke}`).replace(`#include <color_fragment>`,`#include <color_fragment>\n${Ae}`))},e.customProgramCacheKey=()=>`macro-v2-${n()}`,e}var X=2.4,Me={x0:-2.4/2,z0:-3,x1:X/2,z1:3},Ne={x:0,z:0},Pe=1.8/2,Fe={x:5.9,z:5.4},Ie=Fe,Le=.008,Re=.07,ze=.012,Be=.04,Ve=()=>({transmission:1,metalness:0,roughness:.04,thickness:Le,ior:1.586,specularIntensity:1,clearcoat:.3,envMapIntensity:1,attenuationDistance:2,color:new M(`#ffffff`),attenuation:new M(`#eef6f7`)}),He={clear:Ve(),tinted:{...Ve(),attenuationDistance:.25,attenuation:new M(`#4b5560`)},mirror:{...Ve(),transmission:.15,metalness:.9,roughness:.05,color:new M(`#c9d3d6`)}};function Ue(){return[{p:[-5.5,2.2,6.8],t:[.15,1.18,-.4],fov:28},{p:[-2.2,1.9,9.2],t:[.1,1.2,-.15],fov:27},{p:[6.5,1.7,5.5],t:[0,1.24,-.05],fov:26},{p:[11.2,1.58,0],t:[0,1.24,0],fov:24}]}function We(e){return(`/`.endsWith(`/`)?`/`:`//`)+e.replace(/^\//,``)}function Ge(e,t,n,r){let i=new De(e,t,n,2,r),a=i.getAttribute(`uv`);return a&&i.setAttribute(`uv2`,a),i}function Ke(){let e=document.createElement(`canvas`);e.width=256,e.height=256;let t=e.getContext(`2d`);if(!t)return null;t.fillStyle=`#f7f7f7`,t.fillRect(0,0,256,256),t.strokeStyle=`#ffffff`,t.lineWidth=1,t.globalAlpha=1;for(let e=0;e<7;e+=1){let n=18+e*47%220;t.beginPath(),t.moveTo(8,n),t.lineTo(240,n+(e%3-1)*6),t.stroke()}let n=new O(e);return n.colorSpace=``,n.wrapS=i,n.wrapT=i,n.repeat.set(2,1),n}var qe;function Je(){qe===void 0&&(qe=Ke());let e=new h({color:`#ffffff`,metalness:0,roughness:.04,roughnessMap:qe??void 0,transmission:1,thickness:Le,ior:1.586,specularIntensity:1,clearcoat:.3,clearcoatRoughness:.12,envMapIntensity:1,attenuationColor:`#eef6f7`,attenuationDistance:2,transparent:!0,opacity:1,depthWrite:!1,side:2});return e.name=`polycarbonate`,e}function Ye(e,t){let n=He[t];e.transmission=n.transmission,e.metalness=n.metalness,e.roughness=n.roughness,e.thickness=n.thickness,e.ior=n.ior,e.specularIntensity=n.specularIntensity,e.clearcoat=n.clearcoat,e.envMapIntensity=n.envMapIntensity,e.attenuationDistance=n.attenuationDistance,e.color.copy(n.color),e.attenuationColor.copy(n.attenuation)}function Xe(){let e=document.createElement(`canvas`);e.width=512,e.height=256;let t=e.getContext(`2d`);if(!t)return null;let n=t.createRadialGradient(256,128,24,256,128,220);n.addColorStop(0,`rgba(0,0,0,0.62)`),n.addColorStop(.45,`rgba(0,0,0,0.28)`),n.addColorStop(1,`rgba(0,0,0,0)`),t.fillStyle=n,t.beginPath(),t.ellipse(256,128,236,108,0,0,Math.PI*2),t.fill();let r=new O(e);return r.colorSpace=f,r}function Ze(e,t,n){return e.wrapS=i,e.wrapT=i,e.repeat.set(t,n),e.anisotropy=Oe(),e}function Qe(e){return e===`clear`||e===`mirror`||e===`tinted`}function $e(e={}){let t=new x;t.name=`AuraUnit`;let n=new x;n.name=`AuraUnitShell`,t.add(n);let r=[],a=[],o=[],s=[],c=!0,u=()=>{},d=He.clear,m=He.clear,h=0,ee=0,te=new M,v=new M,y=t=>{for(let n of s)n.transmission=t.transmission,n.metalness=t.metalness,n.roughness=t.roughness,n.thickness=t.thickness,n.ior=t.ior,n.specularIntensity=t.specularIntensity,n.clearcoat=t.clearcoat,n.envMapIntensity=t.envMapIntensity,n.attenuationDistance=t.attenuationDistance,n.color.copy(t.color),n.attenuationColor.copy(t.attenuation),e.frost&&(n.roughness=Math.max(n.roughness,.3),n.clearcoat=.12,n.clearcoatRoughness=.64,n.thickness=.016,n.attenuationDistance=Math.min(n.attenuationDistance,.7),n.attenuationColor.lerp(new M(`#d5e4ea`),.7))},b=e=>{if(!c||s.length===0||ee<=h)return;let t=Math.min(1,(e-h)/(ee-h)),n=t*t*(3-2*t),r=(e,t)=>e+(t-e)*n;te.copy(d.color).lerp(m.color,n),v.copy(d.attenuation).lerp(m.attenuation,n);for(let e of s)e.transmission=r(d.transmission,m.transmission),e.metalness=r(d.metalness,m.metalness),e.roughness=r(d.roughness,m.roughness),e.attenuationDistance=r(d.attenuationDistance,m.attenuationDistance),e.color.copy(te),e.attenuationColor.copy(v);t>=1&&y(m)},re=(e,t=1.2)=>{if(!Qe(e))return;let n=He[e],r=performance.now();b(r),d={...m,transmission:s[0]?.transmission??m.transmission,metalness:s[0]?.metalness??m.metalness,roughness:s[0]?.roughness??m.roughness,attenuationDistance:s[0]?.attenuationDistance??m.attenuationDistance,color:te.clone().copy(s[0]?.color??m.color),attenuation:v.clone().copy(s[0]?.attenuationColor??m.attenuation)},m=n;let i=Math.max(0,t);h=r,ee=r+i*1e3,i===0&&y(n)},S=new _({color:`#1a1d21`,roughness:.62,metalness:.88,envMapIntensity:.45}),C=new _({color:`#c9956a`,roughness:.68,metalness:.02,envMapIntensity:.22}),w=new _({color:`#e4c7a4`,roughness:.52,metalness:.02,envMapIntensity:.2}),T=w.clone();T.color.setRGB(1.55,1.32,1.05);let E=new _({color:`#e4ddd2`,roughness:.92,metalness:0});Y(S),Y(C),Y(w),Y(T),Y(E);let ie=new ce().load(We(`textures/paper-linen.webp`),e=>{c&&(e.colorSpace=f,e.wrapS=i,e.wrapT=i,e.repeat.set(5,3),e.anisotropy=Oe(),E.map=e,E.needsUpdate=!0)});o.push(ie);let ae=new _({color:`#f3e2c4`,roughness:.7,emissive:`#ffc98a`,emissiveIntensity:1.35}),oe=new _({color:`#1b1c1a`,roughness:.46,metalness:.2}),D=new _({color:`#14181c`,roughness:.32,metalness:.08,emissive:`#1c2830`,emissiveIntensity:.45});a.push(S,C,w,T,E,ae,oe,D);let O=()=>{let t=Je();return e.frost&&(t.customProgramCacheKey=()=>`aura-frost`,t.onBeforeCompile=e=>{e.fragmentShader=e.fragmentShader.replace(`#include <tonemapping_fragment>`,`float auraEdge = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.0);
gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.9, 0.94, 0.96), auraEdge * 0.62);
#include <tonemapping_fragment>`)}),a.push(t),s.push(t),t},k=(e,t,n,i,a,o,s,c,l,u=.01)=>{let d=Ge(n,i,a,u);r.push(d);let f=new g(d,o);return f.name=t,f.position.set(s,c,l),f.castShadow=!0,f.receiveShadow=!0,e.add(f),f},A=X/2,j=A-Re/2,le=3-Re/2,ue=j-Re/2,de=le-Re/2,N=ue-ze-Le/2,P=2.14,fe=2.7399999999999998/2,pe=[-1,1],me=.02,he=[-de+me,...pe.flatMap(e=>[e-Be/2,e+Be/2]),de-me],L=[];for(let e=0;e<he.length;e+=2){let t=he[e]+ze,n=he[e+1]-ze;L.push({center:(t+n)/2,length:n-t})}let R=(e,t,i,a)=>{let o=a===`x`?Ge(Le,P,i,.0015):Ge(i,P,Le,.0015);r.push(o);let s=new g(o,O());return s.name=`polycarbonate`,s.position.set(e,fe,t),s.castShadow=!1,s.receiveShadow=!1,s.renderOrder=10,n.add(s),s};for(let e of L)R(N,e.center,e.length,`x`);let z=L[L.length-1];for(let e=0;e<L.length-1;e+=1)R(-N,L[e].center,L[e].length,`x`);let ge=R(-(j-.01+.045/2+ze+Le/2),z.center,z.length,`x`);ge.position.z=z.center-z.length*.94,k(n,`door-pull`,.014,.32,.016,S,ge.position.x-.018,1.2899999999999998,ge.position.z+z.length*.42,.004);let B=(N-ze)*2;R(0,de-ze-Le/2,B,`z`),R(0,-(de-ze-Le/2),B,`z`);for(let e of[-j,j])for(let t of[-le,le])k(n,`frame`,Re,2.36,Re,S,e,1.3399999999999999,t,.012);for(let e of pe)k(n,`frame`,.045,P,Be,S,j-.01,fe,e,.008),k(n,`frame`,.045,P,Be,S,-(j-.01),fe,e,.008);k(n,`frame`,X,.08,.06,S,0,.24,2.96,.01),k(n,`frame`,X,.08,.06,S,0,.24,-2.96,.01),k(n,`frame`,.06,.08,5.86,S,A-.04,.24,0,.01),k(n,`frame`,.06,.08,5.86,S,-(A-.04),.24,0,.01),k(n,`frame`,X+.02,.06,.06,S,0,2.5,2.98,.01),k(n,`frame`,X+.02,.06,.06,S,0,2.5,-2.98,.01),k(n,`frame`,.06,.06,6,S,A-.02,2.5,0,.01),k(n,`frame`,.06,.06,6,S,-(A-.02),2.5,0,.01);for(let e of[-.86,.86])k(n,`skid`,.12,.16,5.72,S,e,.11,0,.02);for(let e of[-2.55,-.85,.85,2.55])k(n,`skid`,1.7,.08,.1,S,0,.1,e,.016);let _e=k(n,`floor`,X-.28,.045,5.72,T,0,.2,0,.008);_e.castShadow=!1,_e.onBeforeRender=()=>b(performance.now());let V=k(n,`roof`,X+.1,.05,6.1,S,0,2.575,0,.012);V.castShadow=!0,k(n,`fascia`,.02,.11,6.1,S,A+.05,2.49,0,.006),k(n,`fascia`,.02,.11,6.1,S,-(A+.05),2.49,0,.006),k(n,`fascia`,X+.14,.11,.02,S,0,2.49,3.05,.006),k(n,`fascia`,X+.14,.11,.02,S,0,2.49,-3.05,.006);let ve=z.center;k(n,`step`,.28,.1,z.length*.92,C,-(A+.02),.05,ve,.012);let H=k(n,`sofa`,.72,.38,1.72,E,-.38,.42,-.85,.04);H.castShadow=!0,k(n,`sofa`,.18,.36,1.72,E,-.64,.72,-.85,.03);let ye=k(n,`desk`,.56,.045,1.05,w,.42,.74,.2,.008);ye.castShadow=!0;for(let[e,t]of[[.22,-.22],[.62,-.22],[.22,.62],[.62,.62]])k(n,`desk`,.045,.5,.045,w,e,.48,t,.008);let U=new x;U.name=`laptop`,U.position.set(.42,.77,.16);let W=Ge(.34,.014,.24,.003),be=Ge(.34,.2,.008,.002);r.push(W,be);let G=new g(W,oe);G.position.y=.007,G.castShadow=!0;let K=new g(be,D);K.position.set(0,.12,-.1),K.rotation.x=-.42,K.castShadow=!0,U.add(G,K),n.add(U),k(n,`lamp`,.025,.72,.025,oe,.08,.6,-1.9,.006);let Se=k(n,`lamp`,.16,.1,.16,ae,.08,1.05,-1.9,.02);Se.castShadow=!1;let q=new p(`#ffc98a`,18,10,1.15);q.name=`InteriorLamp`,q.position.set(.08,1.02,-1.9),q.castShadow=!1,t.add(q),e.rising&&(q.intensity=2.4,ae.emissiveIntensity=.22);let Ce=t=>{let n=ne.clamp(t,0,1),r=e.frost?9:2.4;q.intensity=ne.lerp(r,28,n),ae.emissiveIntensity=ne.lerp(e.frost?.85:.22,2.35,n)},we=Xe();if(we){o.push(we);let e=new l(X+.9,6.7);e.rotateX(-Math.PI/2),r.push(e);let n=new se({map:we,transparent:!0,depthWrite:!1,toneMapped:!0});a.push(n);let i=new g(e,n);i.name=`ContactShadow`,i.position.y=.012,i.renderOrder=1,i.receiveShadow=!1,i.castShadow=!1,i.onBeforeRender=()=>b(performance.now()),t.add(i)}y(He.clear);let Ee=e=>I().then(()=>Promise.all([F.loadAsync(We(`textures/${e}/diff.ktx2`)),F.loadAsync(We(`textures/${e}/nor_gl.ktx2`)),F.loadAsync(We(`textures/${e}/rough.ktx2`)),F.loadAsync(We(`textures/${e}/ao.ktx2`))])),J=e=>{for(let t of e)t.dispose()};Ee(`metal_plate`).then(e=>{if(!c){J(e);return}let[t,n,r,i]=e;Ze(t,2.4,1.4),Ze(n,2.4,1.4),Ze(r,2.4,1.4),Ze(i,2.4,1.4),o.push(t,n,r,i),S.map=t,S.normalMap=n,S.roughnessMap=r,S.aoMap=i,S.aoMapIntensity=.8,S.needsUpdate=!0}).catch(()=>void 0),Ee(`fine_grained_wood`).then(e=>{if(!c){J(e);return}let[t,n,r,i]=e;t.colorSpace=f,n.colorSpace=``,r.colorSpace=``,i.colorSpace=``,Ze(t,2.2,1.6),Ze(n,2.2,1.6),Ze(r,2.2,1.6),Ze(i,2.2,1.6);let a=[t,n,r,i],s=a.map(e=>{let t=e.clone();return t.repeat.set(2.4,6.2),t.needsUpdate=!0,t});o.push(...a,...s);let l=(e,t,n,r)=>{let[i,a,o,s]=t;e.map=i,e.normalMap=a,e.roughnessMap=o,e.aoMap=s,e.aoMapIntensity=r,e.normalScale.set(.55,.55),e.color.setRGB(n[0],n[1],n[2]),e.needsUpdate=!0};l(C,a,[1.42,1.02,.66],.42),l(w,a,[1.28,1.1,.88],.38),l(T,s,[1.72,1.46,1.14],.3)}).catch(()=>void 0);let De=e=>{if(!c)return;let i=new Set(s),o=Te(e,`aura-unit`,{polycarbonate:()=>O()}),l=s.filter(e=>!i.has(e));n.traverse(e=>{let t=e;if(!t.isMesh||!t.geometry)return;let n=r.indexOf(t.geometry);n>=0&&r.splice(n,1),t.geometry.dispose()}),n.removeFromParent(),s=l;for(let e of i){let t=a.indexOf(e);t>=0&&a.splice(t,1),e.dispose()}for(let e of o.materials)a.push(e);t.add(o.object),u=o.release;let d=new Set;t.traverse(e=>{let t=e;if(!t.isMesh)return;let n=Array.isArray(t.material)?t.material:[t.material];for(let e of n)e&&d.add(e)});for(let e=a.length-1;e>=0;--e)d.has(a[e])||(a[e].dispose(),a.splice(e,1));y(m)};return xe(`aura-unit`).then(e=>{e&&c&&De(e)}),{object:t,setFinish:re,setMood:Ce,dispose(){if(c){c=!1,u(),t.removeFromParent();for(let e of r)e.dispose();for(let e of a)e.dispose();for(let e of o)e.dispose();r.length=0,a.length=0,o.length=0,s=[]}}}}var et=e=>Math.min(1,Math.max(0,e)),tt=(e,t,n)=>{let r=et((n-e)/(t-e));return r*r*(3-2*r)};function nt(e,t=0){let n=Math.sin(e*127.1+t*311.7)*43758.5453;return n-Math.floor(n)}function rt(e,t){let n=Math.hypot(e,t),r=4.6*Math.exp(-((t-25)**2)/60.5)*(1-et((Math.abs(e)-16)/24)*.75),i=et((n-13)/30),a=i*i*(Math.sin(e*.16+1.7)*Math.cos(t*.13-.6)+.5*Math.sin(e*.31-2.2)*Math.sin(t*.27+1.1))*1.5;return a*=1-et(r/1.2)*.85,r+a}function it(e,t,n,r,i,a){return Math.hypot(Math.max(n-e,0,e-i),Math.max(r-t,0,t-a))}var at=(e,t,n)=>it(e,t,n.x0,n.z0,n.x1,n.z1);function ot(e,t,n=!1){let r=(e,t,n)=>et((e-t)/n),i=n?[.08,.28]:[.22,.85],a=n?[Pe+.45,.4]:[Pe+.7,.55],o=r(at(e,t,Me),i[0],i[1]),s=r(Math.hypot(e-Fe.x,t-Fe.z),a[0],a[1]);return Math.min(o,s)}function st(e,t){let n=Math.hypot(e,t),r=1-tt(16,35,n),i=(1-tt(9,18,Math.abs(e)))*tt(5.5,11,t)*(1-tt(33,41,t)),a=.34*(1-tt(28,48,n));return et(Math.max(r,i,a)*(1-tt(6,15,-t)))}var ct=`
attribute vec4 aSeed;
uniform float uTime;
uniform mat4 uTub;

varying vec2 vUv;
varying float vAlpha;
varying float vWisp;
varying vec3 vWorld;

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

vec3 curlNoise(vec3 p) {
  float e = 0.18;
  float n1 = snoise(p);
  float n2 = snoise(p + vec3(e, 0.0, 0.0));
  float n3 = snoise(p + vec3(0.0, e, 0.0));
  float n4 = snoise(p + vec3(0.0, 0.0, e));
  float n5 = snoise(p + vec3(9.2, 2.8, 1.1));
  float n6 = snoise(p + vec3(9.2 + e, 2.8, 1.1));
  float n7 = snoise(p + vec3(9.2, 2.8 + e, 1.1));
  float n8 = snoise(p + vec3(9.2, 2.8, 1.1 + e));
  vec3 a = vec3(n2 - n1, n3 - n1, n4 - n1) / e;
  vec3 b = vec3(n6 - n5, n7 - n5, n8 - n5) / e;
  return vec3(a.y - b.z, a.z - b.x, a.x - b.y);
}

void main() {
  vUv = uv;
  vWisp = aSeed.z;
  float speed = aSeed.z > 0.5 ? 0.24 : 0.065;
  float life = fract(aSeed.y + uTime * speed);
  float fadeIn = smoothstep(0.0, 0.1, life);
  float fadeOut = 1.0 - smoothstep(0.4, 1.0, life);
  vAlpha = fadeIn * fadeOut;

  float rise = aSeed.z > 0.5
    ? life * 0.07
    : (1.0 - pow(1.0 - life, 1.7)) * 1.45;
  vec3 curl = curlNoise(vec3(aSeed.x * 3.4, rise * 0.85, aSeed.w * 2.0)) * life * 0.34;
  if (aSeed.z > 0.5) curl *= 0.22;

  vec3 local = (instanceMatrix * vec4(aSeed.x, 0.78 + rise, aSeed.w, 1.0)).xyz + curl;
  vec3 world = (uTub * vec4(local, 1.0)).xyz;
  vWorld = world;

  float grow = mix(1.0, 3.0, life);
  vec2 size = aSeed.z > 0.5 ? vec2(0.78, 0.05) : vec2(0.22, 0.28) * grow;
  float spin = aSeed.y * 6.28318 + life * (aSeed.z > 0.5 ? 0.2 : 0.7);
  float cs = cos(spin);
  float sn = sin(spin);
  vec2 corner = vec2(cs * position.x - sn * position.y, sn * position.x + cs * position.y);
  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  world += camRight * corner.x * size.x + camUp * corner.y * size.y;

  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`,lt=`
uniform sampler2D tCloud;
uniform sampler2D tDepth;
uniform float uTime;
uniform float uMood;
uniform float uSoft;
uniform vec2 uResolution;
uniform vec3 uStove;
uniform float uNear;
uniform float uFar;

varying vec2 vUv;
varying float vAlpha;
varying float vWisp;
varying vec3 vWorld;

float eyeDist(float depth) {
  float z = depth * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}

void main() {
  vec2 flowA = vUv * vec2(1.35, 2.15) + vec2(uTime * 0.018, -uTime * 0.046);
  vec2 flowB = vUv * vec2(2.6, 3.3) + vec2(-uTime * 0.027, uTime * 0.033);
  float n1 = texture2D(tCloud, flowA).r;
  float n2 = texture2D(tCloud, flowB).r;
  float noise = smoothstep(0.04, 0.38, n1 * n2);
  float vertical = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.46, vUv.y);
  float side = vWisp > 0.5
    ? smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x)
    : smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
  float alpha = vAlpha * noise * vertical * side;
  alpha *= vWisp > 0.5 ? 0.72 : 0.9;
  alpha *= mix(0.42, 1.0, uMood);

  if (uSoft > 0.5) {
    vec2 duv = gl_FragCoord.xy / uResolution;
    float sceneDepth = texture2D(tDepth, duv).r;
    float fade = smoothstep(0.0, 0.3, eyeDist(sceneDepth) - eyeDist(gl_FragCoord.z));
    alpha *= fade;
  }

  if (alpha < 0.004) discard;

  float warm = clamp(1.0 - length(vWorld - uStove) / 1.7, 0.0, 1.0);
  warm *= mix(0.35, 1.0, uMood);
  vec3 col = mix(vec3(0.74, 0.77, 0.79), vec3(1.0, 0.64, 0.4), warm * 0.72);
  gl_FragColor = vec4(col * alpha, alpha);
}
`,ut=`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,dt=`
uniform sampler2D tSteam;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(tSteam, vUv);
}
`;function ft(e){return(`/`.endsWith(`/`)?`/`:`//`)+e.replace(/^\//,``)}function pt(e){let t=Math.sin(e*127.1+19.19)*43758.5453;return t-Math.floor(t)}function mt(t,n,a){let o=Math.max(0,Math.floor(t)),d=o===0?0:Math.min(6,Math.max(3,Math.round(o*.05))),f=[];for(let e=0;e<o;e+=1){let t=+(e>=o-d),n=pt(e+2)*Math.PI*2,r=t?.18+pt(e+5)*.42:.05+pt(e+4)*.5;f.push({x:Math.cos(n)*r,z:Math.sin(n)*r,phase:pt(e+8),spin:pt(e+11),wisp:t,dist:0})}let p=new Float32Array(Math.max(1,o)*4),h=new k(p,4);h.setUsage(te);let _=new l(1,1,1,1);_.setAttribute(`aSeed`,h);let x=new ce().load(ft(`textures/fx/cloud.png`));x.colorSpace=``,x.wrapS=i,x.wrapT=i,x.magFilter=ae,x.minFilter=S;let w=new y(4,4,{depthBuffer:!0,stencilBuffer:!1});w.depthTexture=new c(4,4),w.depthTexture.format=m,w.depthTexture.type=ie;let T=new y(4,4,{type:ee,format:le,depthBuffer:!1,stencilBuffer:!1});T.texture.generateMipmaps=!1,T.texture.minFilter=ae,T.texture.magFilter=ae,T.texture.colorSpace=P;let E=new r({depthPacking:A,side:2}),se=new C(4,4),D=new s,O=new re({uniforms:{uTime:{value:0},uTub:{value:D},uCameraPos:{value:new N},tCloud:{value:x},tDepth:{value:w.depthTexture},uMood:{value:1},uSoft:{value:0},uResolution:{value:se},uStove:{value:new N},uNear:{value:.4},uFar:{value:80}},vertexShader:ct,fragmentShader:lt,transparent:!0,depthWrite:!1,depthTest:!1,side:2,toneMapped:!1,blending:5,blendSrc:201,blendDst:205,blendEquation:100,blendSrcAlpha:201,blendDstAlpha:205}),j=new oe(_,O,Math.max(1,o));j.count=o,j.frustumCulled=!1,j.instanceMatrix.setUsage(te);let ue=new s;for(let e=0;e<j.count;e+=1)j.setMatrixAt(e,ue);j.instanceMatrix.needsUpdate=!0;let de=new u;de.add(j);let fe=new u,F=new re({uniforms:{tSteam:{value:T.texture}},vertexShader:ut,fragmentShader:dt,transparent:!0,depthTest:!1,depthWrite:!1,toneMapped:!1,blending:5,blendSrc:201,blendDst:205,blendEquation:100,blendSrcAlpha:201,blendDstAlpha:205}),I=new g(new l(1,1),F);I.name=`SteamCard`,I.frustumCulled=!1,I.renderOrder=30,I.visible=!1,n.add(I);let pe=f.map((e,t)=>t),me=new N,he=new N,L=new N,R=new b,z=new b,ge=0,B=0,_e=!0,V=e=>{let t=e=>e.wisp>.5?.24:.065;for(let n=0;n<f.length;n+=1){let r=f[n],i=(r.phase+e*t(r))%1,a=r.wisp>.5?i*.07:(1-(1-i)**1.7)*1.45;me.set(r.x,.78+a,r.z),me.applyMatrix4(D),r.dist=me.distanceToSquared(O.uniforms.uCameraPos.value)}pe.sort((e,t)=>f[t].dist-f[e].dist);for(let e=0;e<pe.length;e+=1){let t=f[pe[e]],n=e*4;p[n]=t.x,p[n+1]=t.phase,p[n+2]=t.wisp,p[n+3]=t.z}h.needsUpdate=!0},ve=(e,t)=>{(e!==ge||t!==B)&&(ge=e,B=t,w.setSize(e,t),T.setSize(e,t),se.set(e,t))},H=e=>{n.updateWorldMatrix(!0,!1);let t=Math.max(e.near*2.4,.42);e.getWorldDirection(he),L.copy(e.position).addScaledVector(he,t),n.worldToLocal(L),I.position.copy(L),n.getWorldQuaternion(R),z.copy(e.quaternion),I.quaternion.copy(z).premultiply(R.invert());let r=e.fov*Math.PI/180,i=2*Math.tan(r*.5)*t,a=i*(e.aspect>0?e.aspect:1);I.scale.set(a,i,1)},ye=(e,t)=>{let n=t.aspect>0?t.aspect:1,r=Math.max(2,n>=1?480:Math.floor(480*n)),i=Math.max(2,n>=1?Math.floor(480/n):480);ve(r,i);let s=e.getRenderTarget(),c=e.autoClear,l=e.getScissorTest(),u=e.getViewport(new v),d=e.getScissor(new v),f=e.getClearColor(new M),p=e.getClearAlpha(),m=a.parent,h=[];a.traverse(e=>{e!==a&&(e.name!==`Water`&&e.name!==`DoorGlow`&&e.name!==`DoorFlame`&&e.name!==`Embers`&&e.name!==`ContactShadow`||!e.visible||(e.visible=!1,h.push(e)))});try{e.autoClear=!0,e.setScissorTest(!1),m&&(a.updateWorldMatrix(!0,!0),fe.attach(a),fe.overrideMaterial=E,e.setRenderTarget(w),e.setViewport(0,0,r,i),e.setClearColor(0,1),e.clear(!0,!0,!0),e.render(fe,t),fe.overrideMaterial=null,m.attach(a)),O.uniforms.uSoft.value=+!!m,e.setRenderTarget(T),e.setViewport(0,0,r,i),e.setClearColor(0,0),e.clear(!0,!0,!0),e.render(de,t),I.visible=o>0}finally{for(let e of h)e.visible=!0;fe.overrideMaterial=null,a.parent!==m&&m&&m.attach(a),e.setRenderTarget(s),e.setViewport(u),e.setScissor(d),e.setScissorTest(l),e.setClearColor(f,p),e.autoClear=c}};return{card:I,update(t){if(!_e||o===0)return;let r=t.reduced?0:e(performance.now());n.updateWorldMatrix(!0,!1),D.copy(n.matrixWorld),O.uniforms.uCameraPos.value.copy(t.camera.position),O.uniforms.uTime.value=r,O.uniforms.uMood.value=ne.clamp(Math.max(t.dusk,t.night),0,1),O.uniforms.uStove.value.copy(t.stoveWorld);let i=t.camera;if(i.isPerspectiveCamera&&(O.uniforms.uNear.value=i.near,O.uniforms.uFar.value=i.far,H(i)),V(r),!t.renderer||!i.isPerspectiveCamera){I.visible=!1;return}try{ye(t.renderer,i)}catch{I.visible=!1}},dispose(){_e&&(_e=!1,I.removeFromParent(),_.dispose(),O.dispose(),F.dispose(),I.geometry.dispose(),x.dispose(),E.dispose(),w.dispose(),T.dispose(),w.depthTexture.dispose())}}}var ht=40,gt=1,_t=.78,vt=.08,yt=new M(`#ff7a2a`),bt=new M(`#ffb060`);function Z(e){return(`/`.endsWith(`/`)?`/`:`//`)+e.replace(/^\//,``)}function Q(e){let t=Math.sin(e*127.1+311.7)*43758.5453;return t-Math.floor(t)}function xt(e,t,n,r){let i=new De(e,t,n,2,r),a=i.getAttribute(`uv`);return a&&i.setAttribute(`uv2`,a),i}function St(e){let t=e.getAttribute(`position`);for(let e=0;e<t.count;e+=1){let n=1-(t.getY(e)/gt+.5)*.12;t.setX(e,t.getX(e)*n)}t.needsUpdate=!0,e.computeVertexNormals()}function $(e,t,n){return e.wrapS=i,e.wrapT=i,e.repeat.set(t,n),e.anisotropy=Oe(),e}function Ct(){let e=document.createElement(`canvas`);e.width=256,e.height=256;let t=e.getContext(`2d`);if(!t)return null;t.fillStyle=`#000000`,t.fillRect(0,0,256,256),t.globalCompositeOperation=`lighter`;for(let e=0;e<70;e+=1){let n=Q(e)*220+18,r=Q(e+40)*220+18,i=10+Q(e+9)*22,a=t.createRadialGradient(n,r,0,n,r,i);a.addColorStop(0,`rgba(210, 255, 236, 0.7)`),a.addColorStop(1,`rgba(0, 0, 0, 0)`),t.fillStyle=a,t.beginPath(),t.arc(n,r,i,0,Math.PI*2),t.fill()}let n=new O(e);return n.colorSpace=f,n.wrapS=i,n.wrapT=i,n}function wt(){let e=document.createElement(`canvas`);e.width=256,e.height=256;let t=e.getContext(`2d`);if(!t)return null;let n=t.createRadialGradient(128,128,20,128,128,120);n.addColorStop(0,`rgba(0,0,0,0.55)`),n.addColorStop(.55,`rgba(0,0,0,0.22)`),n.addColorStop(1,`rgba(0,0,0,0)`),t.fillStyle=n,t.beginPath(),t.arc(128,128,120,0,Math.PI*2),t.fill();let r=new O(e);return r.colorSpace=f,r}var Tt=`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,Et=`
varying vec2 vUv;
uniform vec3 uColor;
uniform float uIntensity;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float glow = pow(1.0 - clamp(length(p), 0.0, 1.0), 3.6);
  if (glow < 0.02) discard;
  gl_FragColor = vec4(uColor * uIntensity, glow);
}
`,Dt=`
varying vec2 vUv;
uniform float uTime;
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash2(i);
  float b = hash2(i + vec2(1.0, 0.0));
  float c = hash2(i + vec2(0.0, 1.0));
  float d = hash2(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
void main() {
  float n = noise(vec2(vUv.x * 4.0, vUv.y * 6.0 - uTime * 1.5));
  n += 0.5 * noise(vec2(vUv.x * 8.0 + 2.2, vUv.y * 11.0 - uTime * 2.1));
  float flame = smoothstep(0.42, 0.9, n + (1.0 - vUv.y) * 0.55);
  float mask = smoothstep(0.0, 0.28, vUv.x) * smoothstep(1.0, 0.72, vUv.x);
  mask *= smoothstep(0.0, 0.04, vUv.y) * smoothstep(1.0, 0.62, vUv.y);
  float alpha = flame * mask;
  if (alpha < 0.04) discard;
  vec3 col = mix(vec3(0.85, 0.16, 0.02), vec3(1.0, 0.62, 0.18), pow(clamp(flame, 0.0, 1.0), 1.5));
  float hot = smoothstep(0.78, 1.0, flame) * smoothstep(0.15, 0.0, abs(vUv.x - 0.5));
  gl_FragColor = vec4(col * mix(0.65, 2.1, hot), alpha);
}
`,Ot=`
float tubR = length(vEmissiveMapUv - vec2(0.5)) * 2.0;
diffuseColor.rgb *= mix(vec3(0.22, 0.36, 0.34), vec3(1.0, 0.92, 0.82), smoothstep(0.12, 0.92, tubR));
`;function kt(e){return .86+Math.sin(e*3.1)*.07+Math.sin(e*7.4+1.7)*.04+Math.sin(e*12.8+.4)*.02}function At(){let e=Ie.x,t=Ie.z,n=rt(e,t)+vt+_t;return[{p:[e+2.4,n+2.35,t+7.4],t:[e-.4,n+.35,t-.2],fov:34},{p:[e+3.6,n+1.75,t+3.4],t:[e-.15,n+.22,t],fov:32},{p:[e+1.35,n+1.15,t+.7],t:[e-.1,n+.1,t],fov:34},{p:[e+.62,n+.42,t+.22],t:[e-.25,n+.02,t-.02],fov:46}]}function jt(){let e=new ce().load(Z(`textures/water/Water_1_M_Normal.jpg`)),t=new ce().load(Z(`textures/water/Water_2_M_Normal.jpg`)),n=[];for(let r of[e,t])r.colorSpace=``,r.wrapS=i,r.wrapT=i,n.push(r);let r=new h({color:`#e4f0ee`,metalness:0,roughness:.05,transmission:.9,thickness:.2,ior:1.333,specularIntensity:1,envMapIntensity:1.15,attenuationColor:`#2f4a48`,attenuationDistance:.6,normalMap:e,normalScale:new C(.16,.16),transparent:!0,side:2});r.name=`water`;let a={uWaterTime:{value:0}};return r.onBeforeCompile=e=>{e.uniforms.tWater2={value:t},e.uniforms.uWaterTime=a.uWaterTime,e.fragmentShader=`uniform sampler2D tWater2;\nuniform float uWaterTime;\n${e.fragmentShader}`,e.fragmentShader=e.fragmentShader.replace(`#include <normal_fragment_maps>`,`
        vec3 mapN = texture2D(normalMap, vNormalMapUv + vec2(uWaterTime * 0.012, uWaterTime * 0.007)).xyz * 2.0 - 1.0;
        vec3 mapN2 = texture2D(tWater2, vNormalMapUv * 1.35 + vec2(-uWaterTime * 0.009, uWaterTime * 0.014)).xyz * 2.0 - 1.0;
        mapN = normalize(vec3(mapN.xy + mapN2.xy * 0.65, mapN.z));
        mapN.xy *= normalScale;
        normal = normalize(tbn * mapN);
      `),e.fragmentShader=e.fragmentShader.replace(`#include <output_fragment>`,`
        float auraFres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 4.0);
        outgoingLight += auraFres * vec3(0.22, 0.28, 0.3);
        #include <output_fragment>
      `)},{material:r,uniforms:a,textures:n}}function Mt(){let n=new x;n.name=`HotTub`;let r=new x;r.name=`HotTubBody`,n.add(r);let i=[],s=[],c=[],u=[],m=[],h=!0,ee=()=>{},v=new _({color:`#ffffff`,roughness:.64,metalness:.02,envMapIntensity:.28});v.color.setRGB(1.62,1.08,.68),v.vertexColors=!0;let y=new _({color:`#ffffff`,roughness:.36,metalness:.04,envMapIntensity:.4});y.color.setRGB(.78,.62,.5);let b=new _({color:`#2c3238`,roughness:.62,metalness:.84,envMapIntensity:.5});u.push(v,y),m.push(b),s.push(v,y,b);let S=xt(.152,gt,.04,.004);St(S),i.push(S);let C=new oe(S,v,ht);C.name=`Staves`,C.castShadow=!0,C.receiveShadow=!0;let ie=new a,ae=new M;for(let e=0;e<ht;e+=1){let t=e/ht*Math.PI*2,n=(Q(e)-.5)*.012;ie.position.set(Math.cos(t)*.872,gt/2,Math.sin(t)*.872),ie.rotation.set((Q(e+3)-.5)*.02,Math.PI/2-t+n,(Q(e+6)-.5)*.015),ie.updateMatrix(),C.setMatrixAt(e,ie.matrix),ae.setRGB(.96+Q(e+1)*.06,.94+Q(e+2)*.06,.9+Q(e+4)*.08),C.setColorAt(e,ae)}C.instanceMatrix.needsUpdate=!0,C.instanceColor&&(C.instanceColor.needsUpdate=!0),r.add(C);let D=(e,t,n,a,o,s,c=!0)=>{let l=t.getAttribute(`uv`);l&&!t.getAttribute(`uv2`)&&t.setAttribute(`uv2`,l),i.push(t);let u=new g(t,n);return u.name=e,u.position.set(a,o,s),u.castShadow=c,u.receiveShadow=!0,r.add(u),u},O=D(`Rim`,new ue(.905,.05,10,48),v,0,.98,0);O.rotation.x=Math.PI/2;let k=D(`FloorRing`,new ue(.8,.028,8,36),v,0,.06,0);k.rotation.x=Math.PI/2;for(let e of[.28,.7]){let t=D(`Band`,new ue(.908,.016,8,40),b,0,e,0);t.rotation.x=Math.PI/2}let A=D(`Floor`,new E(.8,40),v,0,.045,0,!1);A.rotation.x=-Math.PI/2,A.castShadow=!1;let ce=Ct();if(ce){c.push(ce),A.material=v.clone();let e=A.material;e.vertexColors=!1,e.emissive=new M(`#8fd4c8`),e.emissiveMap=ce,e.emissiveIntensity=.55,u.push(e),s.push(e),e.onBeforeCompile=e=>{e.fragmentShader=e.fragmentShader.replace(`#include <color_fragment>`,`#include <color_fragment>\n${Ot}`)}}let le=D(`WetBand`,new o(.82,.82,.07,40,1,!0),y,0,_t,0,!1);le.castShadow=!1;let P=v.clone();P.vertexColors=!1,u.push(P),s.push(P),Y(v),Y(y),Y(b),Y(P),D(`Step`,xt(.46,.1,.28,.012),P,.05,.05,1.08),D(`Step`,xt(.42,.1,.24,.012),P,.02,.16,.9);let pe=jt(),me=pe.material,he=pe.uniforms;c.push(...pe.textures),s.push(me);let L=D(`Water`,new E(.8,48),me,0,_t,0,!1);L.rotation.x=-Math.PI/2,L.castShadow=!1,L.renderOrder=4;let R=new x;R.name=`WoodStove`,r.add(R);let z=D(`StoveFallback`,new o(.16,.17,.42,20),b,0,0,0);z.castShadow=!0,R.add(z),R.position.set(-.78,_t,0);let ge=new _({color:`#1a100c`,emissive:yt.clone(),emissiveIntensity:2.4,roughness:.4,metalness:.1,toneMapped:!1});s.push(ge);let B=new g(xt(.012,.16,.09,.002),ge);B.name=`DoorSlit`,B.position.set(.17,-.02,0),R.add(B),i.push(B.geometry);let _e=new re({uniforms:{uColor:{value:yt.clone()},uIntensity:{value:.9}},vertexShader:Tt,fragmentShader:Et,transparent:!0,depthWrite:!1,blending:2,toneMapped:!1,side:2});s.push(_e);let V=new g(new l(.16,.16),_e);V.name=`DoorGlow`,V.position.set(.2,-.02,0),V.rotation.y=Math.PI/2,V.renderOrder=6,R.add(V),i.push(V.geometry);let ve={uTime:{value:0}},H=null,ye=t().tier;if(ye===`high`||ye===`ultra`){let e=new re({uniforms:ve,vertexShader:Tt,fragmentShader:Dt,transparent:!0,depthWrite:!1,blending:2,toneMapped:!1,side:2});s.push(e),H=new g(new l(.1,.34),e),H.name=`DoorFlame`,H.position.set(.185,.01,0),H.rotation.y=Math.PI/2,H.renderOrder=7,R.add(H),i.push(H.geometry)}let U=b.clone();U.color.set(`#14171a`),U.roughness=.48,m.push(U),s.push(U);let W=new g(new o(.04,.046,.82,12),U);W.name=`Chimney`,W.position.set(.02,.58,0),W.castShadow=!0,R.add(W),i.push(W.geometry);let be=new g(new o(.09,.07,.04,12),U);be.name=`ChimneyCap`,be.position.set(.02,1.02,0),R.add(be),i.push(be.geometry);let G=new p(yt.clone(),8,3.4,2);G.name=`StoveLight`,G.position.set(.12,.02,0),R.add(G);let K=new x;K.name=`BarrelStove`,R.add(K);let Se=(e,t)=>{B.position.set(e*.98,-t*.08,0),V.position.set(e+.02,-t*.08,0),H&&H.position.set(e+.035,.06,0),G.position.set(e*.55,.02,0),W.position.set(-e*.05,t+.36,0),be.position.set(-e*.05,t+.78,0)};fe(Z(`models/barrel_stove.glb`)).then(e=>{if(!h)return;let t=e.scene.clone(!0);t.traverse(e=>{let t=e;t.isMesh&&(t.castShadow=!0,t.receiveShadow=!0)});let n=new w().setFromObject(t),r=n.getSize(new N),i=n.getCenter(new N),a=.5/Math.max(r.y,.001);t.position.copy(i).multiplyScalar(-1),K.scale.setScalar(a),K.rotation.y=Math.PI/2,K.add(t);let o=r.z*a/2,s=r.y*a/2;R.position.set(-(.84-o*.35),_t,0),Se(o,s),z.visible=!1}).catch(()=>void 0);let q=new T,Ce=new Float32Array(144),we=new de(Ce,3);we.setUsage(te),q.setAttribute(`position`,we),i.push(q);let Ee=new d({color:yt.clone(),size:.026,transparent:!0,opacity:0,depthWrite:!1,blending:2,toneMapped:!1,sizeAttenuation:!0});s.push(Ee);let J=new j(q,Ee);J.name=`Embers`,J.frustumCulled=!1,J.renderOrder=8,R.add(J);let De=Array.from({length:48},(e,t)=>({phase:Q(t+20),drift:(Q(t+21)-.5)*.12,sway:Q(t+22)*Math.PI*2})),Oe=t().steamParticles,ke=mt(Oe,n,r),Ae=new N,je=wt();if(je){c.push(je);let e=new l(2.2,2.2);e.rotateX(-Math.PI/2),i.push(e);let t=new se({map:je,transparent:!0,depthWrite:!1});s.push(t);let r=new g(e,t);r.name=`ContactShadow`,r.position.y=.008,r.renderOrder=1,n.add(r)}let X=e=>{for(let t of e)t.dispose()},Me=e=>I().then(()=>Promise.all([F.loadAsync(Z(`textures/${e}/diff.ktx2`)),F.loadAsync(Z(`textures/${e}/nor_gl.ktx2`)),F.loadAsync(Z(`textures/${e}/rough.ktx2`)),F.loadAsync(Z(`textures/${e}/ao.ktx2`))]));return Me(`fine_grained_wood`).then(e=>{if(!h){X(e);return}let[t,n,r,i]=e;t.colorSpace=f,n.colorSpace=``,r.colorSpace=``,i.colorSpace=``,$(t,2.4,1.2),$(n,2.4,1.2),$(r,2.4,1.2),$(i,2.4,1.2),c.push(t,n,r,i);for(let e of u)e.map=t,e.normalMap=n,e.roughnessMap=r,e.aoMap=i,e.aoMapIntensity=.18,e.normalScale.set(.45,.45),e.needsUpdate=!0}).catch(()=>void 0),Me(`metal_plate`).then(e=>{if(!h){X(e);return}let[t,n,r,i]=e;$(t,3,.4),$(n,3,.4),$(r,3,.4),$(i,3,.4),c.push(t,n,r,i);for(let e of m)e.map=t,e.normalMap=n,e.roughnessMap=r,e.aoMap=i,e.aoMapIntensity=.7,e.needsUpdate=!0}).catch(()=>void 0),xe(`hot-tub`).then(e=>{if(!e||!h)return;let t=Te(e,`hot-tub`,{polycarbonate:()=>{let e=Je();return s.push(e),e},water:()=>me});if(!h){t.release();return}for(let e of[...r.children])e.name!==`WoodStove`&&e.name!==`Gazebo`&&(e.visible=!1);for(let e of t.materials)s.push(e);r.add(t.object),ee=t.release}),{object:n,body:r,update(t){if(!h)return;let n=t.reduced?0:e(performance.now()),r=kt(n);ge.emissiveIntensity=1.35*r,_e.uniforms.uIntensity.value=.32+r*.1,G.intensity=7.2*r,G.color.copy(yt).lerp(bt,ne.clamp((r-.8)*1.5,0,1)),ve.uTime.value=n,he.uWaterTime.value=n,ce&&ce.offset.set(n*.018,n*.012);let i=ne.clamp(t.night,0,1);Ee.opacity=i,J.visible=i>.04;let a=W.position.y+.52;for(let e=0;e<48;e+=1){let t=De[e],r=(t.phase+n*.11)%1,i=r*1.35;Ce[e*3]=W.position.x+Math.cos(t.sway+r*2.4)*t.drift*r,Ce[e*3+1]=a+i,Ce[e*3+2]=W.position.z+Math.sin(t.sway+r*1.8)*t.drift*r}we.needsUpdate=!0,R.getWorldPosition(Ae),ke.update({...t,stoveWorld:Ae})},dispose(){if(h){h=!1,ee(),ke.dispose(),n.removeFromParent();for(let e of i)e.dispose();for(let e of s)e.dispose();for(let e of c)e.dispose()}}}}function Nt(){let e=new x;e.name=`TubPlace`;let t=Mt();t.object.position.y=vt,e.add(t.object);let n=[],r=[],i=new _({color:`#ffffff`,roughness:.68,metalness:.02});i.color.setRGB(1.32,.9,.58);let a=new _({color:`#1a1d21`,roughness:.6,metalness:.86,envMapIntensity:.45});r.push(i,a);let s=new o(1.38,1.38,vt,48),c=s.getAttribute(`uv`);c&&s.setAttribute(`uv2`,c),n.push(s),Y(i),Y(a);let l=new g(s,i);l.name=`Deck`,l.position.y=vt/2,l.receiveShadow=!0,l.castShadow=!0,e.add(l);let u=new x;u.name=`Gazebo`,e.add(u);let d=xt(.055,2.08,.055,.008);n.push(d);for(let[e,t]of[[1.02,1.02],[1.02,-1.02],[-1.02,1.02],[-1.02,-1.02]]){let n=new g(d,a);n.name=`GazeboPost`,n.position.set(e,1.12,t),n.castShadow=!0,n.receiveShadow=!0,u.add(n)}let p=xt(2.1,.045,.045,.006);n.push(p);for(let e of[1.02,-1.02]){let t=new g(p,a);t.position.set(0,2.14,e),t.castShadow=!0,u.add(t)}let m=xt(.045,.045,2.1,.006);n.push(m);for(let e of[1.02,-1.02]){let t=new g(m,a);t.position.set(e,2.14,0),t.castShadow=!0,u.add(t)}let h=(e,t,i,a,o,s)=>{let c=xt(e,t,i,.0015);n.push(c);let l=Je();r.push(l);let d=new g(c,l);d.name=`GazeboPane`,d.position.set(a,o,s),d.castShadow=!1,d.receiveShadow=!1,d.renderOrder=10,u.add(d)};h(1.9,1.78,.008,0,1.16,.99),h(1.9,1.78,.008,0,1.16,-.99),h(2.12,.008,2.12,0,2.2,0),e.updateMatrixWorld(!0),t.body.attach(u);let ee=()=>{};return xe(`gazebo`).then(e=>{if(!e||!u.parent)return;let t=Te(e,`gazebo`,{polycarbonate:()=>{let e=Je();return r.push(e),e}});if(!u.parent){t.release();return}for(let e of[...u.children])e.removeFromParent();for(let e of t.materials)r.push(e);u.add(t.object),ee=t.release}),I().then(()=>Promise.all([F.loadAsync(Z(`textures/weathered_brown_planks/diff.ktx2`)),F.loadAsync(Z(`textures/weathered_brown_planks/nor_gl.ktx2`)),F.loadAsync(Z(`textures/weathered_brown_planks/rough.ktx2`)),F.loadAsync(Z(`textures/weathered_brown_planks/ao.ktx2`))])).then(e=>{let[t,n,r,a]=e;if(!l.parent){e.forEach(e=>e.dispose());return}t.colorSpace=f,n.colorSpace=``,r.colorSpace=``,a.colorSpace=``,$(t,1.4,1.4),$(n,1.4,1.4),$(r,1.4,1.4),$(a,1.4,1.4),i.map=t,i.normalMap=n,i.roughnessMap=r,i.aoMap=a,i.aoMapIntensity=.35,i.needsUpdate=!0}).catch(()=>void 0),I().then(()=>Promise.all([F.loadAsync(Z(`textures/metal_plate/diff.ktx2`)),F.loadAsync(Z(`textures/metal_plate/nor_gl.ktx2`)),F.loadAsync(Z(`textures/metal_plate/rough.ktx2`))])).then(e=>{if(!l.parent){e.forEach(e=>e.dispose());return}let[t,n,r]=e;$(t,1.5,2),$(n,1.5,2),$(r,1.5,2),a.map=t,a.normalMap=n,a.roughnessMap=r,a.needsUpdate=!0}).catch(()=>void 0),{object:e,update(e){t.update(e)},dispose(){ee(),t.dispose(),e.removeFromParent();for(let e of n)e.dispose();for(let e of r)e.dispose();i.map?.dispose(),i.normalMap?.dispose(),i.roughnessMap?.dispose(),i.aoMap?.dispose(),a.map?.dispose(),a.normalMap?.dispose(),a.roughnessMap?.dispose()}}}export{be as S,me as _,nt as a,xe as b,rt as c,Je as d,Ue as f,Y as g,Oe as h,At as i,Ye as l,Ie as m,Nt as n,ot as o,Ne as p,jt as r,st as s,Mt as t,$e as u,he as v,Te as x,ve as y};