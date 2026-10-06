import{o as e,r as t}from"./motion.CASNhnqH.js";import{a as n,c as r,s as i}from"./quality.CTYOUeGs.js";import{Gt as a,Jn as o,Ot as s,Vt as c,Yn as l,br as u,v as d,xr as f}from"./three.core.aYj4cLSI.js";import{n as p,t as m}from"./stage.CKrmatAr.js";function h(t){let r=new o,i=new c(-1,1,1,-1,.1,10);i.position.z=2;let h=t.dataset.field||`room`,g=h===`glass`?[.86,.9,.91]:h===`resort`?[.84,.86,.9]:[.91,.9,.87],_=h===`glass`?[.74,.82,.86]:h===`resort`?[.7,.76,.84]:[.8,.83,.82],v=h===`glass`?[.62,.72,.78]:h===`resort`?[.55,.62,.74]:[.7,.74,.71],y=h===`glass`?[.42,.54,.62]:h===`resort`?[.34,.42,.56]:[.48,.54,.52],b=new l({transparent:!0,depthWrite:!1,uniforms:{uTime:{value:0},uScroll:{value:0},uPointer:{value:new u},uMist:{value:new f(...g)},uFar:{value:new f(..._)},uMid:{value:new f(...v)},uNear:{value:new f(...y)},uSharp:{value:h===`resort`?1.55:h===`glass`?1.22:1}},vertexShader:`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      varying vec2 vUv;
      uniform float uTime;
      uniform float uScroll;
      uniform vec2 uPointer;
      uniform vec3 uMist;
      uniform vec3 uFar;
      uniform vec3 uMid;
      uniform vec3 uNear;
      uniform float uSharp;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 3; i++) {
          v += a * noise(p);
          p = p * 2.02 + vec2(1.7, 9.2);
          a *= 0.5;
        }
        return v;
      }
      float ridge(float x, float k) {
        float s = max(uSharp, 0.4);
        return sin(x * 2.4 * s + k) * 0.55 + sin(x * 5.1 * s + k * 1.6) * 0.28 + sin(x * 9.4 * s - k) * 0.12;
      }
      float cover(float y, float h) {
        return 1.0 - smoothstep(h - 0.01, h + 0.028, y);
      }
      void main() {
        vec2 p = vUv + uPointer * vec2(0.035, 0.012);
        float drift = uTime * 0.012;
        float lift = uScroll * 0.035;
        float farH = 0.34 + lift + ridge(p.x * 0.85 + drift * 0.35, 2.1) * 0.045;
        float midH = 0.24 + lift * 0.6 + ridge(p.x * 1.15 + drift * 0.55 + uPointer.x * 0.08, 1.2) * 0.055;
        float nearH = 0.12 + ridge(p.x * 1.45 + drift, 0.4) * 0.04;
        float sFar = cover(p.y, farH);
        float sMid = cover(p.y, midH);
        float sNear = cover(p.y, nearH);
        float n = fbm(vec2(p.x * 1.4 + drift, p.y * 0.7 - drift * 0.35 + uScroll * 0.12));
        float mistAmt = smoothstep(0.38, 0.78, n);
        float low = smoothstep(0.62, 0.02, p.y);
        float sides = smoothstep(0.46, 0.0, p.x) + smoothstep(0.62, 1.0, p.x);
        float reading = smoothstep(0.0, 0.02, p.x) * smoothstep(0.58, 0.36, p.x);
        reading *= smoothstep(0.08, 0.2, p.y) * smoothstep(0.86, 0.52, p.y);
        vec3 col = uMist;
        col = mix(col, uFar, sFar * (0.45 + mistAmt * 0.2));
        col = mix(col, uMid, sMid * 0.62);
        col = mix(col, uNear, sNear * 0.7);
        col = mix(col, uMist, mistAmt * low * 0.55);
        float alpha = low * 0.11 + sides * 0.08 + sFar * 0.1 + sMid * 0.14 + sNear * 0.18 + mistAmt * low * 0.07;
        alpha *= 1.0 - reading * 0.94;
        float traces = 0.0;
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          float slide = fract(uTime * (0.015 + fi * 0.005) + fi * 0.29);
          vec2 origin = vec2(slide * 1.5 - 0.25, 0.18 + fi * 0.22);
          vec2 dir = normalize(vec2(0.86, 0.22 + fi * 0.07));
          float d = abs(dot(p - origin, vec2(-dir.y, dir.x)));
          traces += exp(-d * d * (380.0 - fi * 50.0));
        }
        col = mix(col, vec3(0.93, 0.84, 0.7), traces * 0.28);
        alpha += traces * 0.04;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.36));
      }
    `}),x=new s(new a(2,2),b);x.position.z=-.4,r.add(x);let S=Array.from({length:20},()=>{let e=new l({transparent:!0,depthWrite:!1,blending:2,uniforms:{uColor:{value:new d(h===`resort`?10400980:h===`glass`?12043984:12886138)},uAlpha:{value:0}},vertexShader:`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,fragmentShader:`
        varying vec2 vUv;
        uniform vec3 uColor;
        uniform float uAlpha;
        void main() {
          float x = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.42, vUv.x);
          float y = smoothstep(0.0, 0.45, vUv.y) * smoothstep(1.0, 0.2, vUv.y);
          float a = x * y * uAlpha;
          if (a < 0.008) discard;
          gl_FragColor = vec4(uColor, a);
        }
      `}),t=new s(new a(.72,.04),e);return r.add(t),{mesh:t,mat:e}}),C=e(),w=new u,T=new u,E=e=>{T.set(e.clientX/window.innerWidth*2-1,e.clientY/window.innerHeight*-2+1)};C||window.addEventListener(`pointermove`,E,{passive:!0});let D=h===`room`?[{mist:[.91,.9,.87],far:[.8,.83,.82],mid:[.7,.74,.71],near:[.48,.54,.52]},{mist:[.86,.9,.91],far:[.74,.82,.86],mid:[.62,.72,.78],near:[.42,.54,.62]},{mist:[.9,.86,.82],far:[.78,.74,.68],mid:[.64,.58,.52],near:[.46,.4,.36]},{mist:[.84,.88,.92],far:[.66,.74,.84],mid:[.5,.58,.7],near:[.34,.42,.54]}]:null,O=[0,.3,.58,1],k=(e,t,n)=>e.map((e,r)=>e+(t[r]-e)*n),A=!1,j=m({element:t,scene:r,camera:i,layer:`field`,draw:()=>p()>=window.innerHeight*.82,update(e){if(w.lerp(T,C?1:.04),D){let t=0;for(;t<O.length-2&&e>O[t+1];)t+=1;let n=O[t+1]-O[t]||1,r=Math.min(1,Math.max(0,(e-O[t])/n)),i=D[t],a=D[t+1];b.uniforms.uMist.value.set(...k(i.mist,a.mist,r)),b.uniforms.uFar.value.set(...k(i.far,a.far,r)),b.uniforms.uMid.value.set(...k(i.mid,a.mid,r)),b.uniforms.uNear.value.set(...k(i.near,a.near,r))}b.uniforms.uTime.value=n(performance.now()),b.uniforms.uScroll.value=e,b.uniforms.uPointer.value.copy(w);let r=t.ownerDocument.querySelectorAll(`[data-glow]`),i=t.clientWidth||window.innerWidth||1,a=t.clientHeight||window.innerHeight||1;S.forEach((e,t)=>{let n=r[t];if(!n){e.mat.uniforms.uAlpha.value=0;return}let o=n.getBoundingClientRect(),s=1-Math.min(1,Math.max(0,(o.top-a*.78)/(a*.32))),c=s*s*(3-2*s),l=(o.left+o.width*.32)/i*2-1,u=-((o.bottom-4)/a*2-1);e.mesh.position.set(l,u-(1-c)*.05,0),e.mesh.scale.set(Math.max(.45,o.width/i*2.4),.85+c*.35,1),e.mat.uniforms.uAlpha.value=c*.26})}});return{setProgress(e){j.setProgress(e)},destroy(){A||(A=!0,j.destroy(),window.removeEventListener(`pointermove`,E),x.geometry.dispose(),b.dispose(),S.forEach(e=>{e.mesh.geometry.dispose(),e.mat.dispose()}))}}}function g(e){let n=!1,a=null,o=0,s=()=>{n||a||r().tier===`off`||(a=h(e),a.setProgress(o))},c=i(e=>{if(!n){if(e.tier===`off`){a?.destroy(),a=null;return}a||s()}});s();let l={setProgress(e){o=e,a?.setProgress(e)},destroy(){n||(n=!0,c(),a?.destroy(),a=null)}};return t(l.destroy),l}export{g as mountField};