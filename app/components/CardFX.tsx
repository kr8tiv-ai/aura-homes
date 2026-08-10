"use client";

/* ---------------------------------------------------------------------
   CARD FX — the founder's interactivity round (Aug 10, 2026).

   Two effects, applied consistently to every text box on the site (story
   beat plates, the hero IN/OUT ledger, dashboard panels, stage-page
   section cards, the FAQ):

   1. HOVER GLOW — pure CSS, in globals.css: a slow (~550 ms) emerald-
      tinted text-shadow lift plus a faint border/background lift on the
      box. Nothing here; see `.fx-card` styles.

   2. BORDER LIGHT TRACER — this file. A 2 px luminous point with a short
      alpha-faded tail orbits each visible card's border on a slow loop
      (~11 s per lap), emerald-to-teal inside the brand band.

   WHY ONE SHARED WEBGL CANVAS, not one per card: browsers cap live WebGL
   contexts per page (typically 8-16, oldest evicted first) and the story
   route already runs the R3F scene in one. A dozen per-card contexts
   would evict the 3D world. So this is ONE fixed, pointer-events-none
   canvas over the viewport, ONE context, and every visible card's tracer
   is drawn into it as point sprites in screen space — a single
   drawArrays(POINTS) per frame, a few hundred vertices, zero effect on
   scroll (the buffer rebuild is microseconds and the fill is additive
   points over a mostly-empty transparent canvas).

   Why not CSS: a rotating conic-gradient border animates a custom
   property, which repaints the card every frame on the main thread — it
   is NOT compositor-only, and with a dozen cards it costs more than this
   canvas does. The founder asked for WebGL; WebGL is also genuinely the
   cheaper option here. (Honest tradeoff, measured with the harness.)

   Restraint contract (BRAND.md collision, resolved by founder direction):
   BRAND.md section 2 says "no glow anywhere" and round 1 removed an
   earlier, louder tracer for exactly that rule. The founder explicitly
   reinstated both effects on Aug 10, 2026 with restraint parameters —
   whisper alpha, slow laps, hover-gated text glow — so the rule is now
   "no glow LOUDER than this file", not "none". Do not crank these
   numbers; the values ARE the approval.

   Budget rules:
   · only cards in the viewport are traced (IntersectionObserver);
   · at most MAX_TRACED cards draw at once;
   · prefers-reduced-motion disables the tracer entirely;
   · coarse-pointer / no-hover devices (phones) skip it entirely — hover
     doesn't exist there and the whisper isn't worth a battery tick.
--------------------------------------------------------------------- */

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SEL = ".aura-panel, [data-fx]";
const LAP_S = 11; // seconds per lap
const TAIL_PX = 120; // trail length along the border path
const SAMPLES = 30; // sprites in the tail
const MAX_TRACED = 14;

const VERT = `
attribute vec2 aPos;
attribute float aSize;
attribute vec4 aCol;
uniform vec2 uRes;
varying vec4 vCol;
void main() {
  vec2 clip = (aPos / uRes) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = aSize;
  vCol = aCol;
}`;

const FRAG = `
precision mediump float;
varying vec4 vCol;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, d);
  gl_FragColor = vCol * (a * a);
}`;

/** Point at arc-length s (clockwise from the top-left corner's end) on a
 *  rounded rect of size w*h with corner radius r. Returns into `out`. */
function pointOnPath(
  w: number,
  h: number,
  r: number,
  s: number,
  out: { x: number; y: number }
) {
  const ew = Math.max(0, w - 2 * r);
  const eh = Math.max(0, h - 2 * r);
  const q = (Math.PI * r) / 2; // quarter-arc length
  const P = 2 * ew + 2 * eh + 4 * q;
  s = ((s % P) + P) % P;
  // top edge
  if (s < ew) {
    out.x = r + s;
    out.y = 0;
    return;
  }
  s -= ew;
  if (s < q) {
    const a = s / r; // 0..pi/2
    out.x = w - r + Math.sin(a) * r;
    out.y = r - Math.cos(a) * r;
    return;
  }
  s -= q;
  if (s < eh) {
    out.x = w;
    out.y = r + s;
    return;
  }
  s -= eh;
  if (s < q) {
    const a = s / r;
    out.x = w - r + Math.cos(a) * r;
    out.y = h - r + Math.sin(a) * r;
    return;
  }
  s -= q;
  if (s < ew) {
    out.x = w - r - s;
    out.y = h;
    return;
  }
  s -= ew;
  if (s < q) {
    const a = s / r;
    out.x = r - Math.sin(a) * r;
    out.y = h - r + Math.cos(a) * r;
    return;
  }
  s -= q;
  if (s < eh) {
    out.x = 0;
    out.y = h - r - s;
    return;
  }
  s -= eh;
  const a = s / r;
  out.x = r - Math.cos(a) * r;
  out.y = r - Math.sin(a) * r;
}

function perimeter(w: number, h: number, r: number) {
  return 2 * Math.max(0, w - 2 * r) + 2 * Math.max(0, h - 2 * r) + 2 * Math.PI * r;
}

type Card = {
  el: HTMLElement;
  radius: number;
  phase: number; // 0..1 lap offset so cards never sync
  visible: boolean;
};

export default function CardFXLayer() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(hover: none), (pointer: coarse)");
    if (reduced.matches || coarse.matches) return;

    const canvas = document.createElement("canvas");
    canvas.className = "fx-tracer-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);

    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl) {
      canvas.remove();
      return;
    }
    // hoisted function declarations below don't inherit the null-narrowing
    const glc: WebGLRenderingContext = gl;

    // ---- program ----
    const mk = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, mk(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const uRes = gl.getUniformLocation(prog, "uRes");
    const aPos = gl.getAttribLocation(prog, "aPos");
    const aSize = gl.getAttribLocation(prog, "aSize");
    const aCol = gl.getAttribLocation(prog, "aCol");
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const STRIDE = 7; // x, y, size, r, g, b, a
    gl.enableVertexAttribArray(aPos);
    gl.enableVertexAttribArray(aSize);
    gl.enableVertexAttribArray(aCol);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, STRIDE * 4, 0);
    gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, STRIDE * 4, 2 * 4);
    gl.vertexAttribPointer(aCol, 4, gl.FLOAT, false, STRIDE * 4, 3 * 4);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    let dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    // ---- card registry ----
    const cards = new Map<Element, Card>();
    let raf = 0;
    let running = false;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const c = cards.get(e.target);
          if (c) c.visible = e.isIntersecting;
        }
        maybeRun();
      },
      { rootMargin: "48px" }
    );

    let scanTimer = 0;
    const scan = () => {
      const found = new Set<Element>();
      let idx = 0;
      document.querySelectorAll<HTMLElement>(SEL).forEach((el) => {
        found.add(el);
        idx++;
        if (!cards.has(el)) {
          const cs = window.getComputedStyle(el);
          const radius = Math.max(0, parseFloat(cs.borderTopLeftRadius) || 0);
          cards.set(el, {
            el,
            radius,
            // deterministic offset per card — a fixed stride walks the
            // phase circle so neighbours never orbit in step
            phase: (idx * 0.382) % 1,
            visible: false,
          });
          io.observe(el);
        }
      });
      cards.forEach((c, el) => {
        if (!found.has(el)) {
          io.unobserve(el);
          cards.delete(el);
        }
      });
      maybeRun();
    };
    const scheduleScan = () => {
      window.clearTimeout(scanTimer);
      scanTimer = window.setTimeout(scan, 180);
    };
    const mo = new MutationObserver(scheduleScan);
    mo.observe(document.body, { childList: true, subtree: true });
    scan();

    // ---- draw loop ----
    const pt = { x: 0, y: 0 };
    // head + halo + tail sprites per card
    const PER_CARD = SAMPLES + 1;
    const data = new Float32Array(MAX_TRACED * PER_CARD * STRIDE);

    function frame(now: number) {
      raf = 0;
      if (document.hidden) {
        running = false;
        glc.clear(glc.COLOR_BUFFER_BIT);
        return;
      }
      const t = now / 1000;
      let n = 0; // sprite count
      let traced = 0;
      cards.forEach((c) => {
        if (traced >= MAX_TRACED || !c.visible) return;
        const el = c.el;
        // story plates fade via inline opacity/visibility — the tracer
        // follows the plate's own fade instead of orbiting a ghost
        if (el.style.visibility === "hidden") return;
        const fade = el.style.opacity === "" ? 1 : parseFloat(el.style.opacity);
        if (!(fade > 0.05)) return;
        const rect = el.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 24) return;
        traced++;
        const r = Math.min(c.radius, rect.width / 2, rect.height / 2);
        const P = perimeter(rect.width, rect.height, r);
        const head = ((t / LAP_S + c.phase) % 1) * P;
        const spacing = TAIL_PX / (SAMPLES - 1);
        for (let k = 0; k < SAMPLES; k++) {
          const fall = 1 - k / SAMPLES;
          pointOnPath(rect.width, rect.height, r, head - k * spacing, pt);
          const x = (rect.left + pt.x) * dpr;
          const y = (rect.top + pt.y) * dpr;
          // emerald head -> teal tail, premultiplied, whisper alpha
          const a = 0.5 * fall * fall * fade;
          const mixT = 1 - fall;
          const cr = (16 + (15 - 16) * mixT) / 255;
          const cg = (185 + (118 - 185) * mixT) / 255;
          const cb = (129 + (110 - 129) * mixT) / 255;
          const o = n * STRIDE;
          data[o] = x;
          data[o + 1] = y;
          data[o + 2] = (2 + 4.5 * fall * fall) * dpr;
          data[o + 3] = cr * a;
          data[o + 4] = cg * a;
          data[o + 5] = cb * a;
          data[o + 6] = a;
          n++;
        }
        // soft halo under the head
        pointOnPath(rect.width, rect.height, r, head, pt);
        const o = n * STRIDE;
        const ha = 0.085 * fade;
        data[o] = (rect.left + pt.x) * dpr;
        data[o + 1] = (rect.top + pt.y) * dpr;
        data[o + 2] = 22 * dpr;
        data[o + 3] = (16 / 255) * ha;
        data[o + 4] = (185 / 255) * ha;
        data[o + 5] = (129 / 255) * ha;
        data[o + 6] = ha;
        n++;
      });

      glc.clear(glc.COLOR_BUFFER_BIT);
      if (n > 0) {
        glc.bufferData(glc.ARRAY_BUFFER, data.subarray(0, n * STRIDE), glc.DYNAMIC_DRAW);
        glc.drawArrays(glc.POINTS, 0, n);
        raf = requestAnimationFrame(frame);
      } else {
        running = false; // idle: no rAF until a card scrolls into view
      }
    }

    function maybeRun() {
      if (running) return;
      let any = false;
      cards.forEach((c) => {
        if (c.visible) any = true;
      });
      if (any && !document.hidden && !raf) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    }
    const onVis = () => maybeRun();
    document.addEventListener("visibilitychange", onVis);

    const onLost = (e: Event) => e.preventDefault();
    canvas.addEventListener("webglcontextlost", onLost);

    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onLost);
      mo.disconnect();
      io.disconnect();
      window.clearTimeout(scanTimer);
      if (raf) cancelAnimationFrame(raf);
      canvas.remove();
    };
    // Re-run on route change: the DOM under SiteShell is replaced wholesale
    // and the canvas context is cheap to rebuild.
  }, [pathname]);

  return null;
}
