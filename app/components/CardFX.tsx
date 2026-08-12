"use client";

/* ---------------------------------------------------------------------
   CARD FX v2 — descending border stars (the founder's ask, verbatim:
   "little stars of WebGL-accelerated lighting slowly moving down the
   frame of the text boxes").

   WHAT DRAWS: per traced card, small emerald star points travel DOWN the
   card's vertical border edges at a constant 42 px/s — a fixed SPEED, not
   a fixed lap time, so a 300px card and an 800px card read the same. Each
   star is a 3px head over a soft halo with a 26px emerald-to-teal comet
   tail, fading in at the top corner and out at the bottom
   (sin(pi*u)^0.7), alpha-only twinkle. Hovering the card is the
   "activated responsiveness": brightness x1.6 and speed x1.25, damped
   over ~600ms to match the CSS --fx-warm curve.

   WHICH EDGES: only edges that carry a VISIBLE border are traced — a star
   travelling down bare paper is attached to nothing. Story plates have
   exactly one border (the inner edge), so they get 2 stars on that edge;
   .aura-panel has a full border and gets 2 per side. A card with no
   vertical border at all (the hero ledger) traces both box edges, which
   its hairline rules terminate. Border sides and corner radii are re-read
   on resize — several radii are clamp()/vw-derived.

   WHY QUADS, NOT gl.POINTS (v1 used points):
   - gl_PointSize is capped at 64 on Apple silicon and v1's halo was
     22*dpr = 44px at dpr 2 — already in the danger zone;
   - a point primitive is discarded WHOLE when its centre leaves the clip
     volume, so sprites near the viewport edge pop instead of sliding off;
   - a tail wants one stretched quad, not 30 stacked circles.

   WHY ONE SHARED CANVAS: browsers cap live WebGL contexts (8-16, oldest
   evicted first) and the story route already runs the R3F scene in one.
   The cleanup releases this context explicitly (WEBGL_lose_context) so a
   walk around the routes can never evict the story scene, and
   webglcontextrestored rebuilds the program after a driver reset.

   BLENDING: premultiplied source-over (ONE, ONE_MINUS_SRC_ALPHA). Never
   additive — over #fafaf9 paper additive clamps to white and throws the
   emerald away.

   RESTRAINT CONTRACT (BRAND.md section 2 collision, resolved by founder
   direction): "no glow anywhere" was round 1's reading; the founder
   explicitly reinstated the hover glow and the border lights on Aug 10,
   2026 with restraint parameters. The values in this file — 0.42 peak
   alpha, 42 px/s, 3px heads, 2 stars per traced edge — ARE the approval,
   per MOTION-STACK-SPEC section 6.2. Do not crank them.

   Budget rules:
   - only cards in the viewport are traced (IntersectionObserver);
   - at most MAX_TRACED cards, <= 4 stars each (56 stars worst case);
   - canvas DPR capped at 1.5 — blurred sprites, nobody counts pixels;
   - the rAF PARKS when nothing is drawable and no card is warm, and is
     woken by scroll / IO / pointerover / visibilitychange. The wake from
     scroll is load-bearing: the story plates live in a position:fixed
     stage and never re-intersect, so IO alone cannot restart the loop
     (the v1 bug that killed the stars at every beat boundary);
   - prefers-reduced-motion or (any-hover: none) devices skip it entirely.
--------------------------------------------------------------------- */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { frame, cancelFrame } from "motion/react";

const SEL = ".aura-panel, [data-fx]";
const MAX_TRACED = 14;
const STARS_PER_EDGE = 2;
/** Founder-tuned Aug 12: 75% slower than the approved 42 px/s pass so the
 * border light stays atmospheric instead of competing with the copy. */
export const CARD_TRACER_SPEED_PX_PER_SECOND = 10.5;
const HEAD_PX = 9; // head quad size; the bright core inside reads ~3px
const HALO_PX = 16; // soft halo quad under the head, alpha <= 0.07
const TAIL_PX = 26; // comet tail length
const TAIL_W = 3.2; // tail width
const PEAK_A = 0.42; // peak head alpha at rest (v1's single light was 0.5)
const MIN_EDGE = 80; // edges shorter than this read as noise, skip

// premultiplied later; plain 0..1 rgb here
const EMERALD = [16 / 255, 185 / 255, 129 / 255];
const TEAL = [15 / 255, 118 / 255, 110 / 255];

const VERT = `
attribute vec2 aPos;
attribute vec2 aUV;
attribute vec4 aCol;
uniform vec2 uRes;
varying vec2 vUV;
varying vec4 vCol;
void main() {
  vec2 clip = (aPos / uRes) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vUV = aUV;
  vCol = aCol;
}`;

const FRAG = `
precision mediump float;
varying vec2 vUV;
varying vec4 vCol;
uniform float uShape; // 0 = head (radial), 1 = tail (comet)
void main() {
  float a;
  if (uShape < 0.5) {
    /* Plateau core with a soft skirt. A pure smoothstep(1,0,d) squared
       leaves only ~2px above 20% alpha inside a 9px quad — the approved
       "3px head at 0.42" never actually reached the screen. The plateau
       (full alpha inside d < 0.30, i.e. a ~2.7px core) makes the DRAWN
       star match the approved numbers; the skirt keeps it soft. */
    float d = length(vUV * 2.0 - 1.0);
    a = smoothstep(1.0, 0.30, d);
    a *= a;
  } else {
    float across = smoothstep(1.0, 0.0, abs(vUV.y * 2.0 - 1.0));
    float along = pow(1.0 - vUV.x, 2.2);
    a = across * along;
  }
  gl_FragColor = vCol * a;
}`;

type Edge = { side: "l" | "r" };

type Card = {
  el: HTMLElement;
  radius: number;
  edges: Edge[];
  phase: number; // 0..1 stagger so neighbours never sync
  visible: boolean;
  warm: number; // damped 0..1 — the hover coupling
  warmTarget: number;
  /** rect + fade measured in frame.read; null = not drawable this frame */
  m: { x: number; y: number; w: number; h: number; fade: number } | null;
};

/** Which vertical edges carry a visible border. No vertical border at all
 *  (the hero ledger) traces both box edges — its hairline rules terminate
 *  there, so the edge is real to the eye. */
function edgesFor(cs: CSSStyleDeclaration): Edge[] {
  const l = (parseFloat(cs.borderLeftWidth) || 0) > 0;
  const r = (parseFloat(cs.borderRightWidth) || 0) > 0;
  if (l && r) return [{ side: "l" }, { side: "r" }];
  if (l) return [{ side: "l" }];
  if (r) return [{ side: "r" }];
  return [{ side: "l" }, { side: "r" }];
}

export default function CardFXLayer() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    /* any-hover, not hover: the primary pointer on a Windows touchscreen
       laptop can report coarse, which silently killed the whole layer.
       Phones still answer any-hover:none and stay excluded. */
    const noHover = window.matchMedia("(any-hover: none)");
    if (reduced.matches || noHover.matches) return;

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

    /* ---- geometry budget ----
       per star: head + halo (radial batch) and one tail quad.
       floats/vertex: x,y,u,v,r,g,b,a = 8. */
    const STRIDE = 8;
    const MAX_STARS = MAX_TRACED * 2 * STARS_PER_EDGE;
    const MAX_QUADS = MAX_STARS * 3;
    const data = new Float32Array(MAX_QUADS * 4 * STRIDE);
    const indices = new Uint16Array(MAX_QUADS * 6);
    for (let q = 0; q < MAX_QUADS; q++) {
      const v = q * 4;
      const o = q * 6;
      indices[o] = v;
      indices[o + 1] = v + 1;
      indices[o + 2] = v + 2;
      indices[o + 3] = v + 2;
      indices[o + 4] = v + 1;
      indices[o + 5] = v + 3;
    }

    /* ---- program, rebuildable for webglcontextrestored ---- */
    let uRes: WebGLUniformLocation | null = null;
    let uShape: WebGLUniformLocation | null = null;
    let dpr = 1;
    const resize = () => {
      /* DPR cap 1.5, not 2: these are blurred sprites — a 44% fill saving
         on Retina that nobody can see. */
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      glc.viewport(0, 0, canvas.width, canvas.height);
      if (uRes) glc.uniform2f(uRes, canvas.width, canvas.height);
      /* border sides and corner radii go stale on resize — several radii
         are clamp()/vw-derived */
      cards.forEach((c) => {
        const cs = window.getComputedStyle(c.el);
        c.radius = Math.max(0, parseFloat(cs.borderTopLeftRadius) || 0);
        c.edges = edgesFor(cs);
      });
      maybeRun();
    };
    const setupGL = () => {
      const mk = (type: number, src: string) => {
        const sh = glc.createShader(type)!;
        glc.shaderSource(sh, src);
        glc.compileShader(sh);
        return sh;
      };
      const prog = glc.createProgram()!;
      glc.attachShader(prog, mk(glc.VERTEX_SHADER, VERT));
      glc.attachShader(prog, mk(glc.FRAGMENT_SHADER, FRAG));
      glc.linkProgram(prog);
      glc.useProgram(prog);
      uRes = glc.getUniformLocation(prog, "uRes");
      uShape = glc.getUniformLocation(prog, "uShape");
      const aPos = glc.getAttribLocation(prog, "aPos");
      const aUV = glc.getAttribLocation(prog, "aUV");
      const aCol = glc.getAttribLocation(prog, "aCol");
      const vbuf = glc.createBuffer();
      glc.bindBuffer(glc.ARRAY_BUFFER, vbuf);
      glc.enableVertexAttribArray(aPos);
      glc.enableVertexAttribArray(aUV);
      glc.enableVertexAttribArray(aCol);
      glc.vertexAttribPointer(aPos, 2, glc.FLOAT, false, STRIDE * 4, 0);
      glc.vertexAttribPointer(aUV, 2, glc.FLOAT, false, STRIDE * 4, 2 * 4);
      glc.vertexAttribPointer(aCol, 4, glc.FLOAT, false, STRIDE * 4, 4 * 4);
      const ibuf = glc.createBuffer();
      glc.bindBuffer(glc.ELEMENT_ARRAY_BUFFER, ibuf);
      glc.bufferData(glc.ELEMENT_ARRAY_BUFFER, indices, glc.STATIC_DRAW);
      glc.enable(glc.BLEND);
      /* premultiplied source-over — NEVER additive over paper (clamps to
         white, throws the emerald away) */
      glc.blendFunc(glc.ONE, glc.ONE_MINUS_SRC_ALPHA);
      glc.clearColor(0, 0, 0, 0);
      resize();
    };

    // ---- card registry ----
    const cards = new Map<Element, Card>();
    let running = false;
    let lastT = 0;

    setupGL();
    window.addEventListener("resize", resize);

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const c = cards.get(e.target);
          if (c) c.visible = e.isIntersecting;
        }
        maybeRun();
      },
      { rootMargin: "48px", threshold: 0 }
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
          cards.set(el, {
            el,
            radius: Math.max(0, parseFloat(cs.borderTopLeftRadius) || 0),
            edges: edgesFor(cs),
            // deterministic golden-ratio stride so neighbours never sync
            phase: (idx * 0.382) % 1,
            visible: false,
            warm: 0,
            warmTarget: 0,
            m: null,
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

    /* ---- hover coupling, no per-frame DOM reads: two delegated listeners
       write a target; the frame loop damps toward it. */
    const onOver = (e: Event) => {
      const el = (e.target as Element)?.closest?.(SEL) as HTMLElement | null;
      if (el && cards.has(el)) {
        cards.get(el)!.warmTarget = 1;
        maybeRun();
      }
    };
    const onOut = (e: Event) => {
      const el = (e.target as Element)?.closest?.(SEL) as HTMLElement | null;
      if (el && cards.has(el)) cards.get(el)!.warmTarget = 0;
    };
    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });

    // ---- draw loop ----
    let quad = 0; // running quad index into `data`

    /** One axis-aligned quad. (x0,y0)-(x1,y1) box; UVs u0..u1 along x,
     *  v0..v1 along y; premultiplied colour per end (cA at y1 end, cB at
     *  y0 end) — for heads both ends match. */
    function pushQuad(
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      u0: number,
      v0: number,
      u1: number,
      v1: number,
      rA: number, gA: number, bA: number, aA: number,
      rB: number, gB: number, bB: number, aB: number
    ) {
      if (quad >= MAX_QUADS) return;
      let o = quad * 4 * STRIDE;
      // TL, TR, BL, BR — matches the static index pattern
      data[o++] = x0; data[o++] = y0; data[o++] = u0; data[o++] = v0;
      data[o++] = rB; data[o++] = gB; data[o++] = bB; data[o++] = aB;
      data[o++] = x1; data[o++] = y0; data[o++] = u1; data[o++] = v0;
      data[o++] = rB; data[o++] = gB; data[o++] = bB; data[o++] = aB;
      data[o++] = x0; data[o++] = y1; data[o++] = u0; data[o++] = v1;
      data[o++] = rA; data[o++] = gA; data[o++] = bA; data[o++] = aA;
      data[o++] = x1; data[o++] = y1; data[o++] = u1; data[o++] = v1;
      data[o++] = rA; data[o++] = gA; data[o++] = bA; data[o++] = aA;
      quad++;
    }

    /* ---- the two frame phases (Motion scheduler) ----
       READ measures every drawable card's rect; RENDER computes and draws.
       Story.tsx writes plate styles through frame.render too, so within a
       single browser frame every DOM read happens before every DOM write —
       the H10 forced-synchronous-layout is structurally gone. */
    // function declarations, hoisted — maybeRun() can be reached from
    // scan()/resize() before this point in the effect body
    function readPhase() {
      if (document.hidden) return;
      cards.forEach((c) => {
        c.m = null;
        if (!c.visible) return;
        const el = c.el;
        // story plates fade via inline opacity/visibility — the stars
        // follow the plate's own fade instead of lighting a ghost
        if (el.style.visibility === "hidden") return;
        const fade = el.style.opacity === "" ? 1 : parseFloat(el.style.opacity);
        if (!(fade > 0.05)) return;
        const rect = el.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 24) return;
        c.m = { x: rect.left, y: rect.top, w: rect.width, h: rect.height, fade };
      });
    }

    function renderPhase(info: { timestamp: number; delta: number }) {
      if (document.hidden) {
        glc.clear(glc.COLOR_BUFFER_BIT);
        stop();
        return;
      }
      const t = info.timestamp / 1000;
      const dt = Math.min(0.05, lastT ? t - lastT : 1 / 60);
      lastT = t;

      let anyWarm = false;
      let traced = 0;
      quad = 0;
      let headQuads = 0;

      // pass 0: heads + halos (radial shader batch); pass 1: tails — the
      // same fill loop run twice so each batch is contiguous in the buffer.
      for (let pass = 0; pass < 2; pass++) {
        traced = 0;
        cards.forEach((c) => {
          if (traced >= MAX_TRACED || !c.m) return;
          const { x: rx, y: ry, w: rw, h: rh, fade } = c.m;
          traced++;

          // damp the hover warmth once, on the first pass only
          if (pass === 0) {
            const k =
              c.warmTarget > c.warm
                ? 1 - Math.exp(-dt / 0.24) // ~560ms settle, matches CSS
                : 1 - Math.exp(-dt / 0.16); // ~380ms out
            c.warm += (c.warmTarget - c.warm) * k;
            if (c.warm > 0.01) anyWarm = true;
          }

          const r = Math.min(c.radius, rw / 2, rh / 2);
          const y0 = ry + r;
          const y1 = ry + rh - r;
          const edgeLen = y1 - y0;
          if (edgeLen < MIN_EDGE) return;

          const bright = 1 + 0.6 * c.warm;
          const speed =
            (CARD_TRACER_SPEED_PX_PER_SECOND * (1 + 0.25 * c.warm)) / edgeLen;

          for (let e = 0; e < c.edges.length; e++) {
            const x = c.edges[e].side === "l" ? rx + 0.5 : rx + rw - 0.5;
            for (let s = 0; s < STARS_PER_EDGE; s++) {
              const u = (t * speed + c.phase + e * 0.25 + s * 0.5) % 1;
              const y = y0 + u * edgeLen;
              // fade in at the top corner, out at the bottom — no pops
              const env = Math.pow(Math.sin(Math.PI * u), 0.7);
              // alpha-only twinkle: size flicker reads cheap, alpha reads
              // like light
              const tw = 0.85 + 0.15 * Math.sin(1.7 * t + 7 * (c.phase + e + s));
              const a = PEAK_A * env * tw * fade * bright;
              if (a < 0.004) continue;

              const cx = x * dpr;
              const cy = y * dpr;
              if (pass === 0) {
                // halo under the head
                const ha = Math.min(0.07, 0.07 * env * fade * bright);
                const hr = (HALO_PX / 2) * dpr;
                pushQuad(
                  cx - hr, cy - hr, cx + hr, cy + hr, 0, 0, 1, 1,
                  EMERALD[0] * ha, EMERALD[1] * ha, EMERALD[2] * ha, ha,
                  EMERALD[0] * ha, EMERALD[1] * ha, EMERALD[2] * ha, ha
                );
                // head core
                const cr = (HEAD_PX / 2) * dpr;
                pushQuad(
                  cx - cr, cy - cr, cx + cr, cy + cr, 0, 0, 1, 1,
                  EMERALD[0] * a, EMERALD[1] * a, EMERALD[2] * a, a,
                  EMERALD[0] * a, EMERALD[1] * a, EMERALD[2] * a, a
                );
              } else {
                /* comet tail: one stretched quad above the head (the star
                   travels down, the light it was trails up). vUV.x is the
                   along axis: 0 at the bright head end (bottom), 1 at the
                   spent tail end (top). Emerald at the head end, teal at
                   the tail end, interpolated per-vertex. */
                const ta = a * 0.8;
                const wr = (TAIL_W / 2) * dpr;
                pushQuad(
                  cx - wr, cy - TAIL_PX * dpr, cx + wr, cy,
                  1, 0, 1, 1, // placeholder — u varies with y, set below
                  EMERALD[0] * ta, EMERALD[1] * ta, EMERALD[2] * ta, ta,
                  TEAL[0] * ta, TEAL[1] * ta, TEAL[2] * ta, ta
                );
                /* fix the along-axis UVs on the quad we just wrote: top
                   vertices u=1 (tail end), bottom vertices u=0 (head end);
                   v spans 0..1 across the width. */
                const o = (quad - 1) * 4 * STRIDE;
                data[o + 2] = 1; data[o + 3] = 0; // TL: along=1, across=0
                data[o + STRIDE + 2] = 1; data[o + STRIDE + 3] = 1; // TR
                data[o + 2 * STRIDE + 2] = 0; data[o + 2 * STRIDE + 3] = 0; // BL
                data[o + 3 * STRIDE + 2] = 0; data[o + 3 * STRIDE + 3] = 1; // BR
              }
            }
          }
        });
        if (pass === 0) headQuads = quad;
      }

      glc.clear(glc.COLOR_BUFFER_BIT);
      if (quad > 0) {
        glc.bufferData(glc.ARRAY_BUFFER, data.subarray(0, quad * 4 * STRIDE), glc.DYNAMIC_DRAW);
        if (uShape) glc.uniform1f(uShape, 0);
        glc.drawElements(glc.TRIANGLES, headQuads * 6, glc.UNSIGNED_SHORT, 0);
        const tailQuads = quad - headQuads;
        if (tailQuads > 0) {
          if (uShape) glc.uniform1f(uShape, 1);
          glc.drawElements(glc.TRIANGLES, tailQuads * 6, glc.UNSIGNED_SHORT, headQuads * 6 * 2);
        }
      } else if (!anyWarm) {
        // idle: park until maybeRun() wakes the loop. (While a hover is
        // still settling the loop keeps ticking so the warmth lands.)
        stop();
      }
    }

    function start() {
      running = true;
      lastT = 0;
      frame.read(readPhase, true);
      frame.render(renderPhase, true);
    }
    function stop() {
      running = false;
      lastT = 0;
      cancelFrame(readPhase);
      cancelFrame(renderPhase);
    }

    /* THE WAKE-UP (the v1 parking bug, ELEVATION-BRIEF section 5.1): the
       park above is correct — the wake has to be reachable. IO never
       re-fires for plates inside the fixed stage, so scroll and pointerover
       also wake the loop. A wake with nothing to draw parks again one frame
       later; the cost is one no-op frame per scroll event while parked. */
    function maybeRun() {
      if (running) return;
      let any = false;
      cards.forEach((c) => {
        if (c.visible) any = true;
      });
      if (any && !document.hidden) start();
    }
    const onVis = () => maybeRun();
    document.addEventListener("visibilitychange", onVis);
    const onScrollWake = () => maybeRun();
    window.addEventListener("scroll", onScrollWake, { passive: true });

    const onLost = (e: Event) => e.preventDefault();
    const onRestored = () => {
      setupGL();
      maybeRun();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScrollWake);
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      mo.disconnect();
      io.disconnect();
      window.clearTimeout(scanTimer);
      stop();
      /* Release the context explicitly: this effect re-runs per route and
         browsers evict the OLDEST context first — which would be the R3F
         story scene. */
      glc.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
    // Re-run on route change: the DOM under SiteShell is replaced wholesale
    // and the canvas context is cheap to rebuild.
  }, [pathname]);

  return null;
}
