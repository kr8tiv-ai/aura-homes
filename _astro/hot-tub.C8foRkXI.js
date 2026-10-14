import{c as e,d as t}from"./quality.3Wve-24B.js";import{$ as n,At as r,D as i,G as a,Gt as o,J as s,Jt as c,Kt as l,O as u,Ot as d,P as f,Q as p,Rt as m,S as h,W as g,Wt as _,X as ee,_ as v,_t as te,a as ne,at as y,b,bt as re,et as x,ft as S,g as C,gt as ie,h as w,it as ae,j as T,jt as oe,k as se,kt as E,lt as D,m as O,ot as ce,qt as k,r as A,rt as le,s as j,st as ue,ut as M,v as de,vt as N,w as P,xt as F,yt as fe,zt as I}from"./loaders.U2WiPX4Y.js";import{n as pe,t as me}from"./tier-assets.Di3YWfMm.js";var he=[],L=[`aura-unit`,`hot-tub`,`gazebo`,`a-frame`],R=8388608,z=2048,ge={"aura-unit":{meters:6,measure:`length`},"hot-tub":{meters:1.8,measure:`width`},gazebo:{meters:3,measure:`span`},"a-frame":{meters:6,measure:`length`}},B={"aura-unit":{tint:[1.42,1.02,.66],ao:.42},"hot-tub":{tint:[1.62,1.08,.68],ao:.18},gazebo:{tint:[1.32,.9,.58],ao:.35},"a-frame":{tint:[1.42,1.02,.66],ao:.42}},V={off:[`.lod2`,`.lod1`,``],low:[`.lod2`,`.lod1`,``],medium:[`.lod1`,``,`.lod2`],high:[``,`.lod1`,`.lod2`],ultra:[``,`.lod1`,`.lod2`]},H=/polycarbonate|glass/i,_e=/water/i,U=/cedar|wood|oak|timber/i,ve=/steel|metal|iron/i;function W(e){return L.includes(e)}function G(e){return(`/`.endsWith(`/`)?`/`:`//`)+e.replace(/^\//,``)}function ye(e,t){return G(`models/custom/${e}${t}.glb`)}var K=new Map(he.map(e=>[e.file,e.bytes]));async function q(e,n=`quality`){let r=n===`full`?[``,`.lod1`,`.lod2`]:me()?[`.lod2`,`.lod1`,``]:V[t().tier];for(let t of r){let n=`${e}${t}.glb`;if(K.has(n))return{url:ye(e,t),bytes:K.get(n)??null,level:t===``?`full`:t.slice(1)}}return null}async function be(e,t=`quality`){let n=await q(e,t);if(!n)return null;try{return(await ne(n.url)).scene.clone(!0)}catch{return null}}function xe(e,t){return t===`width`?e.x>.05?e.x:Math.max(e.x,e.z):t===`length`&&e.z>.05?e.z:Math.max(e.x,e.z)}function J(e,t){e.position.set(0,0,0),e.updateMatrixWorld(!0);let n=ge[t],r=new w().setFromObject(e),i=xe(r.getSize(new l),n.measure);i>1e-4&&(e.scale.multiplyScalar(n.meters/i),e.updateMatrixWorld(!0),r=new w().setFromObject(e));let a=r.getCenter(new l);e.position.x-=a.x,e.position.z-=a.z,e.position.y-=r.min.y,e.updateMatrixWorld(!0)}var Se=new Map;function Ce(e){let t=Se.get(e);if(t)return t;let n=j().then(()=>Promise.all([A.loadAsync(G(`textures/${e}/diff.ktx2`)),A.loadAsync(G(`textures/${e}/nor_gl.ktx2`)),A.loadAsync(G(`textures/${e}/rough.ktx2`)),A.loadAsync(G(`textures/${e}/ao.ktx2`))])).then(([e,t,n,r])=>{let i=(e,t)=>(e.colorSpace=t,e.wrapS=d,e.wrapT=d,e.repeat.set(2,2),e.anisotropy=8,e);return i(e,E),i(t,``),i(n,``),i(r,``),{diff:e,nor:t,rough:n,ao:r}});return Se.set(e,n),n.catch(()=>{Se.get(e)===n&&Se.delete(e)}),n}function we(e){let t=e.geometry;t&&!t.getAttribute(`uv2`)&&t.getAttribute(`uv`)&&t.setAttribute(`uv2`,t.getAttribute(`uv`))}function Te(e,t){let n=e;if(n.map)return null;if(n.isMeshStandardMaterial){let e=n.clone();e.vertexColors=!1;let r=e;return r.isMeshPhysicalMaterial&&(r.transmission=0,r.thickness=0),t.push(e),e}let r=e;if(!r.isMeshBasicMaterial&&!e.isMeshLambertMaterial)return null;let i=new M({color:r.color});return t.push(i),i}function Ee(e,t,n={}){J(e,t),e.name=t===`aura-unit`?`AuraUnitModel`:`Custom${t}`;let r=[],i=[],a=[],o=[],s=!0;e.traverse(e=>{let t=e;if(!t.isMesh)return;let s=Array.isArray(t.material)?t.material:[t.material],c=!1,l=!1,u=s.map(e=>{if(!e)return e;let s=`${t.name} ${e.name}`;if(H.test(s)&&(c=!0,n.polycarbonate))return n.polycarbonate();if(_e.test(s)&&(l=!0,n.water))return n.water();if(U.test(s)){let n=Te(e,r);if(n)return i.push(n),o.push(t),n}if(ve.test(s)){let n=Te(e,r);if(n)return a.push(n),o.push(t),n}return e});t.material=Array.isArray(t.material)?u:u[0];let d=c||l;t.castShadow=!d,t.receiveShadow=!d,c?t.renderOrder=10:l&&(t.renderOrder=4)});for(let e of o)we(e);let c=(e,t,n,r,i,a,o,c)=>{if(s)for(let s of e)s.map=t.diff,s.normalMap=t.nor,s.roughnessMap=t.rough,s.aoMap=t.ao,s.aoMapIntensity=r,s.normalScale.set(o,o),s.color.setRGB(n[0],n[1],n[2]),s.metalness=i,s.roughness=a,s.envMapIntensity=c,s.vertexColors=!1,s.needsUpdate=!0};if(i.length){let e=B[t];Ce(`fine_grained_wood`).then(t=>c(i,t,e.tint,e.ao,.02,.68,.55,.22)).catch(()=>void 0)}return a.length&&Ce(`metal_plate`).then(e=>c(a,e,[1,1,1],.8,.86,.62,1,.45)).catch(()=>void 0),{object:e,materials:r,release(){s=!1;for(let e of r)e.dispose();r.length=0}}}var De=new l;function Y(e,t,n,r,i,a){let o=2*Math.PI*i/4,s=Math.max(a-2*i,0),c=Math.PI/4;De.copy(t),De[r]=0,De.normalize();let l=.5*o/(o+s),u=1-De.angleTo(e)/c;return Math.sign(De[n])===1?u*l:s/(o+s)+l+l*(1-u)}var Oe=class e extends C{constructor(e=1,t=1,n=1,r=2,i=.1){let a=r*2+1;if(i=Math.min(e/2,t/2,n/2,i),super(1,1,1,a,a,a),this.type=`RoundedBoxGeometry`,this.parameters={width:e,height:t,depth:n,segments:r,radius:i},a===1)return;let o=this.toNonIndexed();this.index=null,this.attributes.position=o.attributes.position,this.attributes.normal=o.attributes.normal,this.attributes.uv=o.attributes.uv;let s=new l,c=new l,u=new l(e,t,n).divideScalar(2).subScalar(i),d=this.attributes.position.array,f=this.attributes.normal.array,p=this.attributes.uv.array,m=d.length/6,h=new l,g=.5/a;for(let r=0,a=0;r<d.length;r+=3,a+=2)switch(s.fromArray(d,r),c.copy(s),c.x-=Math.sign(c.x)*g,c.y-=Math.sign(c.y)*g,c.z-=Math.sign(c.z)*g,c.normalize(),d[r+0]=u.x*Math.sign(s.x)+c.x*i,d[r+1]=u.y*Math.sign(s.y)+c.y*i,d[r+2]=u.z*Math.sign(s.z)+c.z*i,f[r+0]=c.x,f[r+1]=c.y,f[r+2]=c.z,Math.floor(r/m)){case 0:h.set(1,0,0),p[a+0]=Y(h,c,`z`,`y`,i,n),p[a+1]=1-Y(h,c,`y`,`z`,i,t);break;case 1:h.set(-1,0,0),p[a+0]=1-Y(h,c,`z`,`y`,i,n),p[a+1]=1-Y(h,c,`y`,`z`,i,t);break;case 2:h.set(0,1,0),p[a+0]=1-Y(h,c,`x`,`z`,i,e),p[a+1]=Y(h,c,`z`,`x`,i,n);break;case 3:h.set(0,-1,0),p[a+0]=1-Y(h,c,`x`,`z`,i,e),p[a+1]=1-Y(h,c,`z`,`x`,i,n);break;case 4:h.set(0,0,1),p[a+0]=1-Y(h,c,`x`,`y`,i,e),p[a+1]=1-Y(h,c,`y`,`x`,i,t);break;case 5:h.set(0,0,-1),p[a+0]=Y(h,c,`x`,`y`,i,e),p[a+1]=1-Y(h,c,`y`,`x`,i,t)}}static fromJSON(t){return new e(t.width,t.height,t.depth,t.segments,t.radius)}};function ke(e){let t=pe().surfaces;return t===`off`?[]:t===`full`?[...e]:e.filter(e=>e===`diff`)}function Ae(){let e=t().tier;return e===`high`||e===`ultra`?8:e===`medium`?4:2}var je=`
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
`,Me=`
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
`,Ne=new u(new Uint8Array([255,255,255,255]),1,1);Ne.wrapS=d,Ne.wrapT=d,Ne.colorSpace=``,Ne.needsUpdate=!0;function X(e){let t=e.onBeforeCompile,n=e.customProgramCacheKey.bind(e);return e.onBeforeCompile=(n,r)=>{t.call(e,n,r),n.vertexShader.includes(`vMacroWorld`)||(n.vertexShader=n.vertexShader.replace(`#include <common>`,`#include <common>
varying vec3 vMacroWorld;`).replace(`#include <begin_vertex>`,`#include <begin_vertex>
vMacroWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`).replace(`#include <uv_vertex>`,`#include <uv_vertex>
#ifdef USE_MAP
  vec2 seamP = position.xz * 0.11;
  float seamA = sin(dot(seamP, vec2(1.7, 2.3)));
  float seamB = sin(dot(seamP, vec2(2.9, 1.1)) + 1.7);
  vMapUv += vec2(seamA, seamB) * 0.28;
#endif`)),n.uniforms.tMacroSoil={value:e.userData.macroSoil??Ne},n.uniforms.uMacroSoil={value:e.userData.macroSoilAmt??0},e.userData.macroUniforms=n.uniforms,n.fragmentShader.includes(`macroNoise`)||(n.fragmentShader=n.fragmentShader.replace(`#include <common>`,`#include <common>\nvarying vec3 vMacroWorld;\nuniform sampler2D tMacroSoil;\nuniform float uMacroSoil;\n${je}`).replace(`#include <color_fragment>`,`#include <color_fragment>\n${Me}`))},e.customProgramCacheKey=()=>`macro-v2-${n()}`,e}var Z=2.4,Pe={x0:-2.4/2,z0:-3,x1:Z/2,z1:3},Fe={x:0,z:0},Ie=1.8/2,Le={x:5.9,z:5.4},Re=Le,ze=.008,Be=.07,Ve=.012,He=.04,Ue=()=>({transmission:1,metalness:0,roughness:.04,thickness:ze,ior:1.586,specularIntensity:1,clearcoat:.3,envMapIntensity:1,attenuationDistance:2,color:new P(`#ffffff`),attenuation:new P(`#eef6f7`)}),We={clear:Ue(),tinted:{...Ue(),attenuationDistance:.25,attenuation:new P(`#4b5560`)},mirror:{...Ue(),transmission:.15,metalness:.9,roughness:.05,color:new P(`#c9d3d6`)}};function Ge(){return[{p:[-5.5,2.2,6.8],t:[.15,1.18,-.4],fov:28},{p:[-2.2,1.9,9.2],t:[.1,1.2,-.15],fov:27},{p:[6.5,1.7,5.5],t:[0,1.24,-.05],fov:26},{p:[11.2,1.58,0],t:[0,1.24,0],fov:24}]}function Ke(e){return(`/`.endsWith(`/`)?`/`:`//`)+e.replace(/^\//,``)}function qe(e,t,n,r){let i=new Oe(e,t,n,2,r),a=i.getAttribute(`uv`);return a&&i.setAttribute(`uv2`,a),i}function Je(){let e=document.createElement(`canvas`);e.width=256,e.height=256;let t=e.getContext(`2d`);if(!t)return null;t.fillStyle=`#f7f7f7`,t.fillRect(0,0,256,256),t.strokeStyle=`#ffffff`,t.lineWidth=1,t.globalAlpha=1;for(let e=0;e<7;e+=1){let n=18+e*47%220;t.beginPath(),t.moveTo(8,n),t.lineTo(240,n+(e%3-1)*6),t.stroke()}let n=new b(e);return n.colorSpace=``,n.wrapS=d,n.wrapT=d,n.repeat.set(2,1),n}var Ye;function Xe(){Ye===void 0&&(Ye=Je());let e=new D({color:`#ffffff`,metalness:0,roughness:.04,roughnessMap:Ye??void 0,transmission:1,thickness:ze,ior:1.586,specularIntensity:1,clearcoat:.3,clearcoatRoughness:.12,envMapIntensity:1,attenuationColor:`#eef6f7`,attenuationDistance:2,transparent:!0,opacity:1,depthWrite:!1,side:2});return e.name=`polycarbonate`,e}function Ze(){let e=document.createElement(`canvas`);e.width=512,e.height=256;let t=e.getContext(`2d`);if(!t)return null;let n=t.createRadialGradient(256,128,24,256,128,220);n.addColorStop(0,`rgba(0,0,0,0.62)`),n.addColorStop(.45,`rgba(0,0,0,0.28)`),n.addColorStop(1,`rgba(0,0,0,0)`),t.fillStyle=n,t.beginPath(),t.ellipse(256,128,236,108,0,0,Math.PI*2),t.fill();let r=new b(e);return r.colorSpace=E,r}function Qe(e,t,n){return e.wrapS=d,e.wrapT=d,e.repeat.set(t,n),e.anisotropy=Ae(),e}function $e(e){return e===`clear`||e===`mirror`||e===`tinted`}function et(e={}){let t=new g;t.name=`AuraUnit`;let n=new g;n.name=`AuraUnitShell`,t.add(n);let r=[],i=[],a=[],o=[],s=!0,c=()=>{},l=We.clear,u=We.clear,f=0,p=0,h=new P,_=new P,ee=t=>{for(let n of o)n.transmission=t.transmission,n.metalness=t.metalness,n.roughness=t.roughness,n.thickness=t.thickness,n.ior=t.ior,n.specularIntensity=t.specularIntensity,n.clearcoat=t.clearcoat,n.envMapIntensity=t.envMapIntensity,n.attenuationDistance=t.attenuationDistance,n.color.copy(t.color),n.attenuationColor.copy(t.attenuation),e.frost&&(n.roughness=Math.max(n.roughness,.3),n.clearcoat=.12,n.clearcoatRoughness=.64,n.thickness=.016,n.attenuationDistance=Math.min(n.attenuationDistance,.7),n.attenuationColor.lerp(new P(`#d5e4ea`),.7))},v=e=>{if(!s||o.length===0||p<=f)return;let t=Math.min(1,(e-f)/(p-f)),n=t*t*(3-2*t),r=(e,t)=>e+(t-e)*n;h.copy(l.color).lerp(u.color,n),_.copy(l.attenuation).lerp(u.attenuation,n);for(let e of o)e.transmission=r(l.transmission,u.transmission),e.metalness=r(l.metalness,u.metalness),e.roughness=r(l.roughness,u.roughness),e.attenuationDistance=r(l.attenuationDistance,u.attenuationDistance),e.color.copy(h),e.attenuationColor.copy(_);t>=1&&ee(u)},ne=(e,t=1.2)=>{if(!$e(e))return;let n=We[e],r=performance.now();v(r),l={...u,transmission:o[0]?.transmission??u.transmission,metalness:o[0]?.metalness??u.metalness,roughness:o[0]?.roughness??u.roughness,attenuationDistance:o[0]?.attenuationDistance??u.attenuationDistance,color:h.clone().copy(o[0]?.color??u.color),attenuation:_.clone().copy(o[0]?.attenuationColor??u.attenuation)},u=n;let i=Math.max(0,t);f=r,p=r+i*1e3,i===0&&ee(n)},b=new M({color:`#1a1d21`,roughness:.62,metalness:.88,envMapIntensity:.45}),re=new M({color:`#c9956a`,roughness:.68,metalness:.02,envMapIntensity:.22}),x=new M({color:`#e4c7a4`,roughness:.52,metalness:.02,envMapIntensity:.2}),S=x.clone();S.color.setRGB(1.55,1.32,1.05);let C=new M({color:`#e4ddd2`,roughness:.92,metalness:0});X(b),X(re),X(x),X(S),X(C);let w=new m().load(Ke(`textures/paper-linen.webp`),e=>{s&&(e.colorSpace=E,e.wrapS=d,e.wrapT=d,e.repeat.set(5,3),e.anisotropy=Ae(),C.map=e,C.needsUpdate=!0)});a.push(w);let ae=new M({color:`#f3e2c4`,roughness:.7,emissive:`#ffc98a`,emissiveIntensity:1.35}),T=new M({color:`#1b1c1a`,roughness:.46,metalness:.2}),oe=new M({color:`#14181c`,roughness:.32,metalness:.08,emissive:`#1c2830`,emissiveIntensity:.45});i.push(b,re,x,S,C,ae,T,oe);let se=()=>{let t=Xe();return e.frost&&(t.customProgramCacheKey=()=>`aura-frost`,t.onBeforeCompile=e=>{e.fragmentShader=e.fragmentShader.replace(`#include <tonemapping_fragment>`,`float auraEdge = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.0);
gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.9, 0.94, 0.96), auraEdge * 0.62);
#include <tonemapping_fragment>`)}),i.push(t),o.push(t),t},D=(e,t,n,i,a,o,s,c,l,u=.01)=>{let d=qe(n,i,a,u);r.push(d);let f=new y(d,o);return f.name=t,f.position.set(s,c,l),f.castShadow=!0,f.receiveShadow=!0,e.add(f),f},O=Z/2,k=O-Be/2,ue=3-Be/2,de=k-Be/2,N=ue-Be/2,F=de-Ve-ze/2,fe=2.14,I=2.7399999999999998/2,pe=[-1,1],me=.02,he=[-N+me,...pe.flatMap(e=>[e-He/2,e+He/2]),N-me],L=[];for(let e=0;e<he.length;e+=2){let t=he[e]+Ve,n=he[e+1]-Ve;L.push({center:(t+n)/2,length:n-t})}let R=(e,t,i,a)=>{let o=a===`x`?qe(ze,fe,i,.0015):qe(i,fe,ze,.0015);r.push(o);let s=new y(o,se());return s.name=`polycarbonate`,s.position.set(e,I,t),s.castShadow=!1,s.receiveShadow=!1,s.renderOrder=10,n.add(s),s};for(let e of L)R(F,e.center,e.length,`x`);let z=L[L.length-1];for(let e=0;e<L.length-1;e+=1)R(-F,L[e].center,L[e].length,`x`);let ge=R(-(k-.01+.045/2+Ve+ze/2),z.center,z.length,`x`);ge.position.z=z.center-z.length*.94,D(n,`door-pull`,.014,.32,.016,b,ge.position.x-.018,1.2899999999999998,ge.position.z+z.length*.42,.004);let B=(F-Ve)*2;R(0,N-Ve-ze/2,B,`z`),R(0,-(N-Ve-ze/2),B,`z`);for(let e of[-k,k])for(let t of[-ue,ue])D(n,`frame`,Be,2.36,Be,b,e,1.3399999999999999,t,.012);for(let e of pe)D(n,`frame`,.045,fe,He,b,k-.01,I,e,.008),D(n,`frame`,.045,fe,He,b,-(k-.01),I,e,.008);D(n,`frame`,Z,.08,.06,b,0,.24,2.96,.01),D(n,`frame`,Z,.08,.06,b,0,.24,-2.96,.01),D(n,`frame`,.06,.08,5.86,b,O-.04,.24,0,.01),D(n,`frame`,.06,.08,5.86,b,-(O-.04),.24,0,.01),D(n,`frame`,Z+.02,.06,.06,b,0,2.5,2.98,.01),D(n,`frame`,Z+.02,.06,.06,b,0,2.5,-2.98,.01),D(n,`frame`,.06,.06,6,b,O-.02,2.5,0,.01),D(n,`frame`,.06,.06,6,b,-(O-.02),2.5,0,.01);for(let e of[-.86,.86])D(n,`skid`,.12,.16,5.72,b,e,.11,0,.02);for(let e of[-2.55,-.85,.85,2.55])D(n,`skid`,1.7,.08,.1,b,0,.1,e,.016);let V=D(n,`floor`,Z-.28,.045,5.72,S,0,.2,0,.008);V.castShadow=!1,V.onBeforeRender=()=>v(performance.now());let H=D(n,`roof`,Z+.1,.05,6.1,b,0,2.575,0,.012);H.castShadow=!0,D(n,`fascia`,.02,.11,6.1,b,O+.05,2.49,0,.006),D(n,`fascia`,.02,.11,6.1,b,-(O+.05),2.49,0,.006),D(n,`fascia`,Z+.14,.11,.02,b,0,2.49,3.05,.006),D(n,`fascia`,Z+.14,.11,.02,b,0,2.49,-3.05,.006);let _e=z.center;D(n,`step`,.28,.1,z.length*.92,re,-(O+.02),.05,_e,.012);let U=D(n,`sofa`,.72,.38,1.72,C,-.38,.42,-.85,.04);U.castShadow=!0,D(n,`sofa`,.18,.36,1.72,C,-.64,.72,-.85,.03);let ve=D(n,`desk`,.56,.045,1.05,x,.42,.74,.2,.008);ve.castShadow=!0;for(let[e,t]of[[.22,-.22],[.62,-.22],[.22,.62],[.62,.62]])D(n,`desk`,.045,.5,.045,x,e,.48,t,.008);let W=new g;W.name=`laptop`,W.position.set(.42,.77,.16);let G=qe(.34,.014,.24,.003),ye=qe(.34,.2,.008,.002);r.push(G,ye);let K=new y(G,T);K.position.y=.007,K.castShadow=!0;let q=new y(ye,oe);q.position.set(0,.12,-.1),q.rotation.x=-.42,q.castShadow=!0,W.add(K,q),n.add(W),D(n,`lamp`,.025,.72,.025,T,.08,.6,-1.9,.006);let xe=D(n,`lamp`,.16,.1,.16,ae,.08,1.05,-1.9,.02);xe.castShadow=!1;let J=new te(`#ffc98a`,18,10,1.15);J.name=`InteriorLamp`,J.position.set(.08,1.02,-1.9),J.castShadow=!1,t.add(J),e.rising&&(J.intensity=2.4,ae.emissiveIntensity=.22);let Se=t=>{let n=le.clamp(t,0,1),r=e.frost?9:2.4;J.intensity=le.lerp(r,28,n),ae.emissiveIntensity=le.lerp(e.frost?.85:.22,2.35,n)},Ce=Ze();if(Ce){a.push(Ce);let e=new ie(Z+.9,6.7);e.rotateX(-Math.PI/2),r.push(e);let n=new ce({map:Ce,transparent:!0,depthWrite:!1,toneMapped:!0});i.push(n);let o=new y(e,n);o.name=`ContactShadow`,o.position.y=.012,o.renderOrder=1,o.receiveShadow=!1,o.castShadow=!1,o.onBeforeRender=()=>v(performance.now()),t.add(o)}ee(We.clear);let we=e=>{let t=ke([`diff`,`nor_gl`,`rough`,`ao`]);return t.length?j().then(()=>Promise.all(t.map(t=>A.loadAsync(Ke(`textures/${e}/${t}.ktx2`))))):Promise.resolve([])},Te=e=>{for(let t of e)t.dispose()};we(`metal_plate`).then(e=>{if(!s){Te(e);return}let[t,n,r,i]=e;t&&(Qe(t,2.4,1.4),a.push(t),b.map=t),n&&(Qe(n,2.4,1.4),a.push(n),b.normalMap=n),r&&(Qe(r,2.4,1.4),a.push(r),b.roughnessMap=r),i&&(Qe(i,2.4,1.4),a.push(i),b.aoMap=i,b.aoMapIntensity=.8),b.needsUpdate=!0}).catch(()=>void 0),we(`fine_grained_wood`).then(e=>{if(!s){Te(e);return}let[t,n,r,i]=e,o=[t,n,r,i].filter(e=>!!e);t&&(t.colorSpace=E),n&&(n.colorSpace=``),r&&(r.colorSpace=``),i&&(i.colorSpace=``),t&&Qe(t,2.2,1.6),n&&Qe(n,2.2,1.6),r&&Qe(r,2.2,1.6),i&&Qe(i,2.2,1.6);let c=o.map(e=>{let t=e.clone();return t.repeat.set(2.4,6.2),t.needsUpdate=!0,t});a.push(...o,...c);let l=(e,t,n,r)=>{let[i,a,o,s]=t;i&&(e.map=i),a&&(e.normalMap=a),o&&(e.roughnessMap=o),s&&(e.aoMap=s,e.aoMapIntensity=r),a&&e.normalScale.set(.55,.55),e.color.setRGB(n[0],n[1],n[2]),e.needsUpdate=!0};l(re,o,[1.42,1.02,.66],.42),l(x,o,[1.28,1.1,.88],.38),l(S,c,[1.72,1.46,1.14],.3)}).catch(()=>void 0);let De=e=>{if(!s)return;let a=new Set(o),l=Ee(e,`aura-unit`,{polycarbonate:()=>se()}),d=o.filter(e=>!a.has(e));n.traverse(e=>{let t=e;if(!t.isMesh||!t.geometry)return;let n=r.indexOf(t.geometry);n>=0&&r.splice(n,1),t.geometry.dispose()}),n.removeFromParent(),o=d;for(let e of a){let t=i.indexOf(e);t>=0&&i.splice(t,1),e.dispose()}for(let e of l.materials)i.push(e);t.add(l.object),c=l.release;let f=new Set;t.traverse(e=>{let t=e;if(!t.isMesh)return;let n=Array.isArray(t.material)?t.material:[t.material];for(let e of n)e&&f.add(e)});for(let e=i.length-1;e>=0;--e)f.has(i[e])||(i[e].dispose(),i.splice(e,1));ee(u)};return be(`aura-unit`).then(e=>{e&&s&&De(e)}),{object:t,setFinish:ne,setMood:Se,dispose(){if(s){s=!1,c(),t.removeFromParent();for(let e of r)e.dispose();for(let e of i)e.dispose();for(let e of a)e.dispose();r.length=0,i.length=0,a.length=0,o=[]}}}}var tt=e=>Math.min(1,Math.max(0,e)),nt=(e,t,n)=>{let r=tt((n-e)/(t-e));return r*r*(3-2*r)};function rt(e,t=0){let n=Math.sin(e*127.1+t*311.7)*43758.5453;return n-Math.floor(n)}function it(e,t){let n=Math.hypot(e,t),r=4.6*Math.exp(-((t-25)**2)/60.5)*(1-tt((Math.abs(e)-16)/24)*.75),i=tt((n-13)/30),a=i*i*(Math.sin(e*.16+1.7)*Math.cos(t*.13-.6)+.5*Math.sin(e*.31-2.2)*Math.sin(t*.27+1.1))*1.5;return a*=1-tt(r/1.2)*.85,r+a}function at(e,t,n,r,i,a){return Math.hypot(Math.max(n-e,0,e-i),Math.max(r-t,0,t-a))}var ot=(e,t,n)=>at(e,t,n.x0,n.z0,n.x1,n.z1);function st(e,t,n=!1){let r=(e,t,n)=>tt((e-t)/n),i=n?[.08,.28]:[.22,.85],a=n?[Ie+.45,.4]:[Ie+.7,.55],o=r(ot(e,t,Pe),i[0],i[1]),s=r(Math.hypot(e-Le.x,t-Le.z),a[0],a[1]);return Math.min(o,s)}function ct(e,t){let n=Math.hypot(e,t),r=1-nt(16,35,n),i=(1-nt(9,18,Math.abs(e)))*nt(5.5,11,t)*(1-nt(33,41,t)),a=.34*(1-nt(28,48,n));return tt(Math.max(r,i,a)*(1-nt(6,15,-t)))}var lt=`
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
`,ut=`
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
`,dt=`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,ft=`
uniform sampler2D tSteam;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(tSteam, vUv);
}
`;function pt(e){return(`/`.endsWith(`/`)?`/`:`//`)+e.replace(/^\//,``)}function mt(e){let t=Math.sin(e*127.1+19.19)*43758.5453;return t-Math.floor(t)}function ht(t,i,u){let h=Math.max(0,Math.floor(t)),g=h===0?0:Math.min(6,Math.max(3,Math.round(h*.05))),v=[];for(let e=0;e<h;e+=1){let t=+(e>=h-g),n=mt(e+2)*Math.PI*2,r=t?.18+mt(e+5)*.42:.05+mt(e+4)*.5;v.push({x:Math.cos(n)*r,z:Math.sin(n)*r,phase:mt(e+8),spin:mt(e+11),wisp:t,dist:0})}let te=new Float32Array(Math.max(1,h)*4),ne=new s(te,4);ne.setUsage(f);let b=new ie(1,1,1,1);b.setAttribute(`aSeed`,ne);let S=new m().load(pt(`textures/fx/cloud.png`));S.colorSpace=``,S.wrapS=d,S.wrapT=d,S.magFilter=p,S.minFilter=n;let C=new c(4,4,{depthBuffer:!0,stencilBuffer:!1});C.depthTexture=new T(4,4),C.depthTexture.format=se,C.depthTexture.type=_;let w=new c(4,4,{type:a,format:F,depthBuffer:!1,stencilBuffer:!1});w.texture.generateMipmaps=!1,w.texture.minFilter=p,w.texture.magFilter=p,w.texture.colorSpace=x;let E=new ue({depthPacking:O,side:2}),D=new o(4,4),ce=new ae,A=new oe({uniforms:{uTime:{value:0},uTub:{value:ce},uCameraPos:{value:new l},tCloud:{value:S},tDepth:{value:C.depthTexture},uMood:{value:1},uSoft:{value:0},uResolution:{value:D},uStove:{value:new l},uNear:{value:.4},uFar:{value:80}},vertexShader:lt,fragmentShader:ut,transparent:!0,depthWrite:!1,depthTest:!1,side:2,toneMapped:!1,blending:5,blendSrc:201,blendDst:205,blendEquation:100,blendSrcAlpha:201,blendDstAlpha:205}),j=new ee(b,A,Math.max(1,h));j.count=h,j.frustumCulled=!1,j.instanceMatrix.setUsage(f);let M=new ae;for(let e=0;e<j.count;e+=1)j.setMatrixAt(e,M);j.instanceMatrix.needsUpdate=!0;let de=new r;de.add(j);let N=new r,fe=new oe({uniforms:{tSteam:{value:w.texture}},vertexShader:dt,fragmentShader:ft,transparent:!0,depthTest:!1,depthWrite:!1,toneMapped:!1,blending:5,blendSrc:201,blendDst:205,blendEquation:100,blendSrcAlpha:201,blendDstAlpha:205}),I=new y(new ie(1,1),fe);I.name=`SteamCard`,I.frustumCulled=!1,I.renderOrder=30,I.visible=!1,i.add(I);let pe=v.map((e,t)=>t),me=new l,he=new l,L=new l,R=new re,z=new re,ge=0,B=0,V=!0,H=e=>{let t=e=>e.wisp>.5?.24:.065;for(let n=0;n<v.length;n+=1){let r=v[n],i=(r.phase+e*t(r))%1,a=r.wisp>.5?i*.07:(1-(1-i)**1.7)*1.45;me.set(r.x,.78+a,r.z),me.applyMatrix4(ce),r.dist=me.distanceToSquared(A.uniforms.uCameraPos.value)}pe.sort((e,t)=>v[t].dist-v[e].dist);for(let e=0;e<pe.length;e+=1){let t=v[pe[e]],n=e*4;te[n]=t.x,te[n+1]=t.phase,te[n+2]=t.wisp,te[n+3]=t.z}ne.needsUpdate=!0},_e=(e,t)=>{(e!==ge||t!==B)&&(ge=e,B=t,C.setSize(e,t),w.setSize(e,t),D.set(e,t))},U=e=>{i.updateWorldMatrix(!0,!1);let t=Math.max(e.near*2.4,.42);e.getWorldDirection(he),L.copy(e.position).addScaledVector(he,t),i.worldToLocal(L),I.position.copy(L),i.getWorldQuaternion(R),z.copy(e.quaternion),I.quaternion.copy(z).premultiply(R.invert());let n=e.fov*Math.PI/180,r=2*Math.tan(n*.5)*t,a=r*(e.aspect>0?e.aspect:1);I.scale.set(a,r,1)},ve=(e,t)=>{let n=t.aspect>0?t.aspect:1,r=Math.max(2,n>=1?480:Math.floor(480*n)),i=Math.max(2,n>=1?Math.floor(480/n):480);_e(r,i);let a=e.getRenderTarget(),o=e.autoClear,s=e.getScissorTest(),c=e.getViewport(new k),l=e.getScissor(new k),d=e.getClearColor(new P),f=e.getClearAlpha(),p=u.parent,m=[];u.traverse(e=>{e!==u&&(e.name!==`Water`&&e.name!==`DoorGlow`&&e.name!==`DoorFlame`&&e.name!==`Embers`&&e.name!==`ContactShadow`||!e.visible||(e.visible=!1,m.push(e)))});try{e.autoClear=!0,e.setScissorTest(!1),p&&(u.updateWorldMatrix(!0,!0),N.attach(u),N.overrideMaterial=E,e.setRenderTarget(C),e.setViewport(0,0,r,i),e.setClearColor(0,1),e.clear(!0,!0,!0),e.render(N,t),N.overrideMaterial=null,p.attach(u)),A.uniforms.uSoft.value=+!!p,e.setRenderTarget(w),e.setViewport(0,0,r,i),e.setClearColor(0,0),e.clear(!0,!0,!0),e.render(de,t),I.visible=h>0}finally{for(let e of m)e.visible=!0;N.overrideMaterial=null,u.parent!==p&&p&&p.attach(u),e.setRenderTarget(a),e.setViewport(c),e.setScissor(l),e.setScissorTest(s),e.setClearColor(d,f),e.autoClear=o}};return{card:I,update(t){if(!V||h===0)return;let n=t.reduced?0:e(performance.now());i.updateWorldMatrix(!0,!1),ce.copy(i.matrixWorld),A.uniforms.uCameraPos.value.copy(t.camera.position),A.uniforms.uTime.value=n,A.uniforms.uMood.value=le.clamp(Math.max(t.dusk,t.night),0,1),A.uniforms.uStove.value.copy(t.stoveWorld);let r=t.camera;if(r.isPerspectiveCamera&&(A.uniforms.uNear.value=r.near,A.uniforms.uFar.value=r.far,U(r)),H(n),!t.renderer||!r.isPerspectiveCamera){I.visible=!1;return}try{ve(t.renderer,r)}catch{I.visible=!1}},dispose(){V&&(V=!1,I.removeFromParent(),b.dispose(),A.dispose(),fe.dispose(),I.geometry.dispose(),S.dispose(),E.dispose(),C.dispose(),w.dispose(),C.depthTexture.dispose())}}}var gt=40,_t=1,vt=.78,yt=.08,bt=new P(`#ff7a2a`),xt=new P(`#ffb060`);function St(e){return(`/`.endsWith(`/`)?`/`:`//`)+e.replace(/^\//,``)}function Q(e){let t=Math.sin(e*127.1+311.7)*43758.5453;return t-Math.floor(t)}function Ct(e,t,n,r){let i=new Oe(e,t,n,2,r),a=i.getAttribute(`uv`);return a&&i.setAttribute(`uv2`,a),i}function wt(e){let t=e.getAttribute(`position`);for(let e=0;e<t.count;e+=1){let n=1-(t.getY(e)/_t+.5)*.12;t.setX(e,t.getX(e)*n)}t.needsUpdate=!0,e.computeVertexNormals()}function $(e,t,n){return e.wrapS=d,e.wrapT=d,e.repeat.set(t,n),e.anisotropy=Ae(),e}function Tt(){let e=document.createElement(`canvas`);e.width=256,e.height=256;let t=e.getContext(`2d`);if(!t)return null;t.fillStyle=`#000000`,t.fillRect(0,0,256,256),t.globalCompositeOperation=`lighter`;for(let e=0;e<70;e+=1){let n=Q(e)*220+18,r=Q(e+40)*220+18,i=10+Q(e+9)*22,a=t.createRadialGradient(n,r,0,n,r,i);a.addColorStop(0,`rgba(210, 255, 236, 0.7)`),a.addColorStop(1,`rgba(0, 0, 0, 0)`),t.fillStyle=a,t.beginPath(),t.arc(n,r,i,0,Math.PI*2),t.fill()}let n=new b(e);return n.colorSpace=E,n.wrapS=d,n.wrapT=d,n}function Et(){let e=document.createElement(`canvas`);e.width=256,e.height=256;let t=e.getContext(`2d`);if(!t)return null;let n=t.createRadialGradient(128,128,20,128,128,120);n.addColorStop(0,`rgba(0,0,0,0.55)`),n.addColorStop(.55,`rgba(0,0,0,0.22)`),n.addColorStop(1,`rgba(0,0,0,0)`),t.fillStyle=n,t.beginPath(),t.arc(128,128,120,0,Math.PI*2),t.fill();let r=new b(e);return r.colorSpace=E,r}var Dt=`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,Ot=`
varying vec2 vUv;
uniform vec3 uColor;
uniform float uIntensity;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float glow = pow(1.0 - clamp(length(p), 0.0, 1.0), 3.6);
  if (glow < 0.02) discard;
  gl_FragColor = vec4(uColor * uIntensity, glow);
}
`,kt=`
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
`,At=`
float tubR = length(vEmissiveMapUv - vec2(0.5)) * 2.0;
diffuseColor.rgb *= mix(vec3(0.22, 0.36, 0.34), vec3(1.0, 0.92, 0.82), smoothstep(0.12, 0.92, tubR));
`;function jt(e){return .86+Math.sin(e*3.1)*.07+Math.sin(e*7.4+1.7)*.04+Math.sin(e*12.8+.4)*.02}function Mt(){let e=Re.x,t=Re.z,n=it(e,t)+yt+vt;return[{p:[e+2.4,n+2.35,t+7.4],t:[e-.4,n+.35,t-.2],fov:34},{p:[e+3.6,n+1.75,t+3.4],t:[e-.15,n+.22,t],fov:32},{p:[e+1.35,n+1.15,t+.7],t:[e-.1,n+.1,t],fov:34},{p:[e+.62,n+.42,t+.22],t:[e-.25,n+.02,t-.02],fov:46}]}function Nt(){let e=new m().load(St(`textures/water/Water_1_M_Normal.jpg`)),t=new m().load(St(`textures/water/Water_2_M_Normal.jpg`)),n=[];for(let r of[e,t])r.colorSpace=``,r.wrapS=d,r.wrapT=d,n.push(r);let r=new D({color:`#e4f0ee`,metalness:0,roughness:.05,transmission:.9,thickness:.2,ior:1.333,specularIntensity:1,envMapIntensity:1.15,attenuationColor:`#2f4a48`,attenuationDistance:.6,normalMap:e,normalScale:new o(.16,.16),transparent:!0,side:2});r.name=`water`;let i={uWaterTime:{value:0}};return r.onBeforeCompile=e=>{e.uniforms.tWater2={value:t},e.uniforms.uWaterTime=i.uWaterTime,e.fragmentShader=`uniform sampler2D tWater2;\nuniform float uWaterTime;\n${e.fragmentShader}`,e.fragmentShader=e.fragmentShader.replace(`#include <normal_fragment_maps>`,`
        vec3 mapN = texture2D(normalMap, vNormalMapUv + vec2(uWaterTime * 0.012, uWaterTime * 0.007)).xyz * 2.0 - 1.0;
        vec3 mapN2 = texture2D(tWater2, vNormalMapUv * 1.35 + vec2(-uWaterTime * 0.009, uWaterTime * 0.014)).xyz * 2.0 - 1.0;
        mapN = normalize(vec3(mapN.xy + mapN2.xy * 0.65, mapN.z));
        mapN.xy *= normalScale;
        normal = normalize(tbn * mapN);
      `),e.fragmentShader=e.fragmentShader.replace(`#include <output_fragment>`,`
        float auraFres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 4.0);
        outgoingLight += auraFres * vec3(0.22, 0.28, 0.3);
        #include <output_fragment>
      `)},{material:r,uniforms:i,textures:n}}function Pt(){let n=new g;n.name=`HotTub`;let r=new g;r.name=`HotTubBody`,n.add(r);let a=[],o=[],s=[],c=[],u=[],d=!0,p=()=>{},m=new M({color:`#ffffff`,roughness:.64,metalness:.02,envMapIntensity:.28});m.color.setRGB(1.62,1.08,.68),m.vertexColors=!0;let _=new M({color:`#ffffff`,roughness:.36,metalness:.04,envMapIntensity:.4});_.color.setRGB(.78,.62,.5);let b=new M({color:`#2c3238`,roughness:.62,metalness:.84,envMapIntensity:.5});c.push(m,_),u.push(b),o.push(m,_,b);let re=Ct(.152,_t,.04,.004);wt(re),a.push(re);let x=new ee(re,m,gt);x.name=`Staves`,x.castShadow=!0,x.receiveShadow=!0;let C=new S,ae=new P;for(let e=0;e<gt;e+=1){let t=e/gt*Math.PI*2,n=(Q(e)-.5)*.012;C.position.set(Math.cos(t)*.872,_t/2,Math.sin(t)*.872),C.rotation.set((Q(e+3)-.5)*.02,Math.PI/2-t+n,(Q(e+6)-.5)*.015),C.updateMatrix(),x.setMatrixAt(e,C.matrix),ae.setRGB(.96+Q(e+1)*.06,.94+Q(e+2)*.06,.9+Q(e+4)*.08),x.setColorAt(e,ae)}x.instanceMatrix.needsUpdate=!0,x.instanceColor&&(x.instanceColor.needsUpdate=!0),r.add(x);let T=(e,t,n,i,o,s,c=!0)=>{let l=t.getAttribute(`uv`);l&&!t.getAttribute(`uv2`)&&t.setAttribute(`uv2`,l),a.push(t);let u=new y(t,n);return u.name=e,u.position.set(i,o,s),u.castShadow=c,u.receiveShadow=!0,r.add(u),u},se=T(`Rim`,new I(.905,.05,10,48),m,0,.98,0);se.rotation.x=Math.PI/2;let D=T(`FloorRing`,new I(.8,.028,8,36),m,0,.06,0);D.rotation.x=Math.PI/2;for(let e of[.28,.7]){let t=T(`Band`,new I(.908,.016,8,40),b,0,e,0);t.rotation.x=Math.PI/2}let O=T(`Floor`,new h(.8,40),m,0,.045,0,!1);O.rotation.x=-Math.PI/2,O.castShadow=!1;let k=Tt();if(k){s.push(k),O.material=m.clone();let e=O.material;e.vertexColors=!1,e.emissive=new P(`#8fd4c8`),e.emissiveMap=k,e.emissiveIntensity=.55,c.push(e),o.push(e),e.onBeforeCompile=e=>{e.fragmentShader=e.fragmentShader.replace(`#include <color_fragment>`,`#include <color_fragment>\n${At}`)}}let ue=T(`WetBand`,new i(.82,.82,.07,40,1,!0),_,0,vt,0,!1);ue.castShadow=!1;let F=m.clone();F.vertexColors=!1,c.push(F),o.push(F),X(m),X(_),X(b),X(F),T(`Step`,Ct(.46,.1,.28,.012),F,.05,.05,1.08),T(`Step`,Ct(.42,.1,.24,.012),F,.02,.16,.9);let pe=Nt(),me=pe.material,he=pe.uniforms;s.push(...pe.textures),o.push(me);let L=T(`Water`,new h(.8,48),me,0,vt,0,!1);L.rotation.x=-Math.PI/2,L.castShadow=!1,L.renderOrder=4;let R=new g;R.name=`WoodStove`,r.add(R);let z=T(`StoveFallback`,new i(.16,.17,.42,20),b,0,0,0);z.castShadow=!0,R.add(z),R.position.set(-.78,vt,0);let ge=new M({color:`#1a100c`,emissive:bt.clone(),emissiveIntensity:2.4,roughness:.4,metalness:.1,toneMapped:!1});o.push(ge);let B=new y(Ct(.012,.16,.09,.002),ge);B.name=`DoorSlit`,B.position.set(.17,-.02,0),R.add(B),a.push(B.geometry);let V=new oe({uniforms:{uColor:{value:bt.clone()},uIntensity:{value:.9}},vertexShader:Dt,fragmentShader:Ot,transparent:!0,depthWrite:!1,blending:2,toneMapped:!1,side:2});o.push(V);let H=new y(new ie(.16,.16),V);H.name=`DoorGlow`,H.position.set(.2,-.02,0),H.rotation.y=Math.PI/2,H.renderOrder=6,R.add(H),a.push(H.geometry);let _e={uTime:{value:0}},U=null,ve=t().tier;if(ve===`high`||ve===`ultra`){let e=new oe({uniforms:_e,vertexShader:Dt,fragmentShader:kt,transparent:!0,depthWrite:!1,blending:2,toneMapped:!1,side:2});o.push(e),U=new y(new ie(.1,.34),e),U.name=`DoorFlame`,U.position.set(.185,.01,0),U.rotation.y=Math.PI/2,U.renderOrder=7,R.add(U),a.push(U.geometry)}let W=b.clone();W.color.set(`#14171a`),W.roughness=.48,u.push(W),o.push(W);let G=new y(new i(.04,.046,.82,12),W);G.name=`Chimney`,G.position.set(.02,.58,0),G.castShadow=!0,R.add(G),a.push(G.geometry);let ye=new y(new i(.09,.07,.04,12),W);ye.name=`ChimneyCap`,ye.position.set(.02,1.02,0),R.add(ye),a.push(ye.geometry);let K=new te(bt.clone(),8,3.4,2);K.name=`StoveLight`,K.position.set(.12,.02,0),R.add(K);let q=new g;q.name=`BarrelStove`,R.add(q);let xe=(e,t)=>{B.position.set(e*.98,-t*.08,0),H.position.set(e+.02,-t*.08,0),U&&U.position.set(e+.035,.06,0),K.position.set(e*.55,.02,0),G.position.set(-e*.05,t+.36,0),ye.position.set(-e*.05,t+.78,0)};ne(St(`models/barrel_stove.glb`)).then(e=>{if(!d)return;let t=e.scene.clone(!0);t.traverse(e=>{let t=e;t.isMesh&&(t.castShadow=!0,t.receiveShadow=!0)});let n=new w().setFromObject(t),r=n.getSize(new l),i=n.getCenter(new l),a=.5/Math.max(r.y,.001);t.position.copy(i).multiplyScalar(-1),q.scale.setScalar(a),q.rotation.y=Math.PI/2,q.add(t);let o=r.z*a/2,s=r.y*a/2;R.position.set(-(.84-o*.35),vt,0),xe(o,s),z.visible=!1}).catch(()=>void 0);let J=new de,Se=new Float32Array(144),Ce=new v(Se,3);Ce.setUsage(f),J.setAttribute(`position`,Ce),a.push(J);let we=new fe({color:bt.clone(),size:.026,transparent:!0,opacity:0,depthWrite:!1,blending:2,toneMapped:!1,sizeAttenuation:!0});o.push(we);let Te=new N(J,we);Te.name=`Embers`,Te.frustumCulled=!1,Te.renderOrder=8,R.add(Te);let De=Array.from({length:48},(e,t)=>({phase:Q(t+20),drift:(Q(t+21)-.5)*.12,sway:Q(t+22)*Math.PI*2})),Y=t().steamParticles,Oe=ht(Y,n,r),Ae=new l,je=Et();if(je){s.push(je);let e=new ie(2.2,2.2);e.rotateX(-Math.PI/2),a.push(e);let t=new ce({map:je,transparent:!0,depthWrite:!1});o.push(t);let r=new y(e,t);r.name=`ContactShadow`,r.position.y=.008,r.renderOrder=1,n.add(r)}let Me=e=>{for(let t of e)t.dispose()},Ne=e=>{let t=ke([`diff`,`nor_gl`,`rough`,`ao`]);return t.length?j().then(()=>Promise.all(t.map(t=>A.loadAsync(St(`textures/${e}/${t}.ktx2`))))):Promise.resolve([])};return Ne(`fine_grained_wood`).then(e=>{if(!d){Me(e);return}let[t,n,r,i]=e;t&&(t.colorSpace=E),n&&(n.colorSpace=``),r&&(r.colorSpace=``),i&&(i.colorSpace=``),t&&$(t,2.4,1.2),n&&$(n,2.4,1.2),r&&$(r,2.4,1.2),i&&$(i,2.4,1.2);for(let t of e)s.push(t);for(let e of c)t&&(e.map=t),n&&(e.normalMap=n,e.normalScale.set(.45,.45)),r&&(e.roughnessMap=r),i&&(e.aoMap=i,e.aoMapIntensity=.18),e.needsUpdate=!0}).catch(()=>void 0),Ne(`metal_plate`).then(e=>{if(!d){Me(e);return}let[t,n,r,i]=e;t&&$(t,3,.4),n&&$(n,3,.4),r&&$(r,3,.4),i&&$(i,3,.4);for(let t of e)s.push(t);for(let e of u)t&&(e.map=t),n&&(e.normalMap=n),r&&(e.roughnessMap=r),i&&(e.aoMap=i,e.aoMapIntensity=.7),e.needsUpdate=!0}).catch(()=>void 0),be(`hot-tub`).then(e=>{if(!e||!d)return;let t=Ee(e,`hot-tub`,{polycarbonate:()=>{let e=Xe();return o.push(e),e},water:()=>me});if(!d){t.release();return}for(let e of[...r.children])e.name!==`WoodStove`&&e.name!==`Gazebo`&&(e.visible=!1);for(let e of t.materials)o.push(e);r.add(t.object),p=t.release}),{object:n,body:r,update(t){if(!d)return;let n=t.reduced?0:e(performance.now()),r=jt(n);ge.emissiveIntensity=1.35*r,V.uniforms.uIntensity.value=.32+r*.1,K.intensity=7.2*r,K.color.copy(bt).lerp(xt,le.clamp((r-.8)*1.5,0,1)),_e.uTime.value=n,he.uWaterTime.value=n,k&&k.offset.set(n*.018,n*.012);let i=le.clamp(t.night,0,1);we.opacity=i,Te.visible=i>.04;let a=G.position.y+.52;for(let e=0;e<48;e+=1){let t=De[e],r=(t.phase+n*.11)%1,i=r*1.35;Se[e*3]=G.position.x+Math.cos(t.sway+r*2.4)*t.drift*r,Se[e*3+1]=a+i,Se[e*3+2]=G.position.z+Math.sin(t.sway+r*1.8)*t.drift*r}Ce.needsUpdate=!0,R.getWorldPosition(Ae),Oe.update({...t,stoveWorld:Ae})},dispose(){if(d){d=!1,p(),Oe.dispose(),n.removeFromParent();for(let e of a)e.dispose();for(let e of o)e.dispose();for(let e of s)e.dispose()}}}}function Ft(){let e=new g;e.name=`TubPlace`;let t=Pt();t.object.position.y=yt,e.add(t.object);let n=[],r=[],a=new M({color:`#ffffff`,roughness:.68,metalness:.02});a.color.setRGB(1.32,.9,.58);let o=new M({color:`#1a1d21`,roughness:.6,metalness:.86,envMapIntensity:.45});r.push(a,o);let s=new i(1.38,1.38,yt,48),c=s.getAttribute(`uv`);c&&s.setAttribute(`uv2`,c),n.push(s),X(a),X(o);let l=new y(s,a);l.name=`Deck`,l.position.y=yt/2,l.receiveShadow=!0,l.castShadow=!0,e.add(l);let u=new g;u.name=`Gazebo`,e.add(u);let d=Ct(.055,2.08,.055,.008);n.push(d);for(let[e,t]of[[1.02,1.02],[1.02,-1.02],[-1.02,1.02],[-1.02,-1.02]]){let n=new y(d,o);n.name=`GazeboPost`,n.position.set(e,1.12,t),n.castShadow=!0,n.receiveShadow=!0,u.add(n)}let f=Ct(2.1,.045,.045,.006);n.push(f);for(let e of[1.02,-1.02]){let t=new y(f,o);t.position.set(0,2.14,e),t.castShadow=!0,u.add(t)}let p=Ct(.045,.045,2.1,.006);n.push(p);for(let e of[1.02,-1.02]){let t=new y(p,o);t.position.set(e,2.14,0),t.castShadow=!0,u.add(t)}let m=(e,t,i,a,o,s)=>{let c=Ct(e,t,i,.0015);n.push(c);let l=Xe();r.push(l);let d=new y(c,l);d.name=`GazeboPane`,d.position.set(a,o,s),d.castShadow=!1,d.receiveShadow=!1,d.renderOrder=10,u.add(d)};m(1.9,1.78,.008,0,1.16,.99),m(1.9,1.78,.008,0,1.16,-.99),m(2.12,.008,2.12,0,2.2,0),e.updateMatrixWorld(!0),t.body.attach(u);let h=()=>{};be(`gazebo`).then(e=>{if(!e||!u.parent)return;let t=Ee(e,`gazebo`,{polycarbonate:()=>{let e=Xe();return r.push(e),e}});if(!u.parent){t.release();return}for(let e of[...u.children])e.removeFromParent();for(let e of t.materials)r.push(e);u.add(t.object),h=t.release});let _=ke([`diff`,`nor_gl`,`rough`,`ao`]);_.length&&j().then(()=>Promise.all(_.map(e=>A.loadAsync(St(`textures/weathered_brown_planks/${e}.ktx2`))))).then(e=>{let[t,n,r,i]=e;if(!l.parent){e.forEach(e=>e.dispose());return}t&&(t.colorSpace=E,$(t,1.4,1.4),a.map=t),n&&(n.colorSpace=``,$(n,1.4,1.4),a.normalMap=n),r&&(r.colorSpace=``,$(r,1.4,1.4),a.roughnessMap=r),i&&(i.colorSpace=``,$(i,1.4,1.4),a.aoMap=i,a.aoMapIntensity=.35),a.needsUpdate=!0}).catch(()=>void 0);let ee=ke([`diff`,`nor_gl`,`rough`]);return ee.length&&j().then(()=>Promise.all(ee.map(e=>A.loadAsync(St(`textures/metal_plate/${e}.ktx2`))))).then(e=>{if(!l.parent){e.forEach(e=>e.dispose());return}let[t,n,r]=e;t&&($(t,1.5,2),o.map=t),n&&($(n,1.5,2),o.normalMap=n),r&&($(r,1.5,2),o.roughnessMap=r),o.needsUpdate=!0}).catch(()=>void 0),{object:e,update(e){t.update(e)},dispose(){h(),t.dispose(),e.removeFromParent();for(let e of n)e.dispose();for(let e of r)e.dispose();a.map?.dispose(),a.normalMap?.dispose(),a.roughnessMap?.dispose(),a.aoMap?.dispose(),o.map?.dispose(),o.normalMap?.dispose(),o.roughnessMap?.dispose()}}}export{q as S,R as _,rt as a,be as b,it as c,Ge as d,Fe as f,ke as g,X as h,Mt as i,et as l,Ae as m,Ft as n,st as o,Re as p,Nt as r,ct as s,Pt as t,Xe as u,z as v,Ee as x,W as y};