"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { frame, cancelFrame } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { STORY_COPY, type LedgerRow, type StoryAudience } from "./copy";
import { withBase } from "../../lib/basePath";
import { applyTheme, currentTheme, onThemeChange } from "../../lib/theme";
import { probeWebGL } from "@/lib/three/webgl";
import type { OpeningSceneStage } from "@/lib/three/sceneQuality";
import { BUILDX_URL, EnterGate, StoryHUD, useForestAudio, WithXLayerLinks, REPO_URL, XLAYER_URL } from "./StoryChrome";
import StillScene from "./StillScene";
import SceneLoader, { type LoaderFetchState } from "./Loader";
import SocialShareLinks from "../SocialShareLinks";

const StoryCanvas = dynamic(() => import("./StoryCanvas"), { ssr: false });

/* ---------------------------------------------------------------------
   THE COPY STAGE — why the beats are pinned rather than sticky.

   v1 laid each beat's copy inside a tall section as `position: sticky`.
   Sticky means the card rides UP and out of the top of the viewport when
   its section ends, which put body text straight through the fixed
   "AURA HOMES" wordmark at three of eight scroll positions, and left two
   cards legible at once — a double exposure across half the story.

   BRAND.md section 8: "Copy behaves like signage: fades in place, holds,
   fades." So the five beats now live in ONE fixed stage that sits inside a
   safe band between the header and the HUD. Nothing translates through the
   chrome, because nothing translates at all: opacity is written per frame
   from the same rAF that drives the camera progress, and the fade windows
   are disjoint (full at |p-k| < 0.30, gone by 0.50), so two beats can never
   be readable simultaneously.
--------------------------------------------------------------------- */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/* Word-mask heading reveal: words rise out of an overflow mask with a small
   stagger, at a reading pace. The plain text stays the accessible label. */
function Reveal({
  text,
  as: Tag = "h2",
  className,
}: {
  text: string;
  as?: "h1" | "h2" | "p";
  className?: string;
}) {
  return (
    <Tag className={className} aria-label={text}>
      {text.split(" ").map((w, i) => (
        <span key={i}>
          {i > 0 ? " " : null}
          <span className="story-wmask" aria-hidden>
            <span className="story-w" style={{ transitionDelay: `${i * 70}ms` }}>
              {w}
            </span>
          </span>
        </span>
      ))}
    </Tag>
  );
}

/** BRAND.md section 4, the section-kicker: mono number in accent, hairline
 *  running to the margin, tracked-caps label. Load-bearing house pattern. */
function Kicker({ n, label, delay = 0 }: { n: string; label: string; delay?: number }) {
  return (
    <p className="story-kicker" data-rv style={{ transitionDelay: `${delay}ms` }}>
      <span className="story-kicker-n">{n}</span>
      <i aria-hidden />
      <span className="story-kicker-l">{label}</span>
    </p>
  );
}

/** BRAND.md section 7, the spec-ledger: hairline-ruled mono IN / OUT rows.
 *  `fx` opts the standalone hero ledger into the border tracer (CardFX); the
 *  in-plate ledgers inherit the plate's own hover glow instead — a tracer
 *  orbiting a box inside a traced box would be noise, not elevation. */
function Ledger({
  rows,
  delay = 320,
  fx = false,
}: {
  rows: readonly LedgerRow[];
  delay?: number;
  fx?: boolean;
}) {
  /* The fx card WRAPS the reveal target rather than being it. transition-
     property is one list per element: when `fx-card` and `[data-rv]` sat on
     the same <dl>, the reveal rule's higher specificity (0,3,0 vs 0,1,0)
     replaced the fx transition list entirely and every hover property
     snapped in 0s. With the wrapper, no element carries both systems.
     (ELEVATION-BRIEF §2.2, the H1 fix at the source.) */
  const dl = (
    <dl className="story-ledger" data-rv style={{ transitionDelay: `${delay}ms` }}>
      {rows.map((r) => (
        <div key={r.k}>
          <dt>{r.k}</dt>
          <dd>{r.v}</dd>
        </div>
      ))}
    </dl>
  );
  return fx ? (
    <div className="fx-card" data-fx="">
      {dl}
    </div>
  ) : (
    dl
  );
}

function BudgetBand() {
  return (
    <div className="story-band" data-rv style={{ transitionDelay: "300ms" }}>
      <div className="story-band-nums">
        <span>$199K</span>
        <span className="story-band-dash">–</span>
        <span>$444K</span>
      </div>
      <div className="story-band-scale">
        <i />
        {["Low", "Mid", "High"].map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
      <p className="story-band-basis">800 sq ft SIP build, Alberta suppliers, 2026 pricing.</p>
    </div>
  );
}

function CryptoEcosystemLinks({ onNavigate }: { onNavigate: (href: string) => (event: React.MouseEvent) => void }) {
  return (
    <div className="story-ecosystem-links" aria-label="OKX and X Layer resources">
      <a href={BUILDX_URL} target="_blank" rel="noreferrer" className="story-ecosystem-card">
        {/* Unmodified OKX mark, CC BY-SA 4.0; attribution in docs/CREDITS.md. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={withBase("/brand/okx-logo.svg")} alt="OKX" width={44} height={44} />
        <span><strong>Build X · AI Season</strong><small>Official hackathon page</small></span>
      </a>
      <a href={XLAYER_URL} target="_blank" rel="noreferrer" className="story-ecosystem-card">
        <span className="story-xlayer-lockup" aria-hidden>X Layer</span>
        <span><strong>Network overview</strong><small>Official X Layer site</small></span>
      </a>
      <Link href="/faq#x-layer" onClick={onNavigate("/faq#x-layer")} className="story-ecosystem-faq">
        What are OKX and X Layer? <i aria-hidden>&rarr;</i>
      </Link>
    </div>
  );
}

export default function Story() {
  const progressRef = useRef(0);
  const sectionsRef = useRef<(HTMLElement | null)[]>([]);
  const plateRefs = useRef<(HTMLElement | null)[]>([]);
  const [reduced, setReduced] = useState<boolean | null>(null);
  const [active, setActive] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const activeRef = useRef(0);
  const router = useRouter();

  const [entered, setEntered] = useState(false);
  const [audience, setAudience] = useState<StoryAudience>("project");
  const { hero, beats, end, buildCta } = STORY_COPY[audience];
  /* ONE switch, one world. The HUD's NIGHT button no longer only darkens the
     sky — it is the site theme. Flipping it here turns the paper plates,
     the rail, the header and every document page to charcoal at the same
     moment the sun sets over the meadow, and arriving from a page already
     set to night starts the scene at dusk instead of snapping to it.
     Starts false so the server markup and the first client render agree;
     the effect reconciles with <html data-theme> immediately after mount. */
  const [night, setNight] = useState(false);
  useEffect(() => {
    setNight(currentTheme() === "dark");
    return onThemeChange((t) => setNight(t === "dark"));
  }, []);
  const flipNight = useCallback(() => {
    applyTheme(currentTheme() === "dark" ? "light" : "dark");
  }, []);
  const audio = useForestAudio();

  /* 3D is interaction-gated. The poster and authored still paint immediately;
     WebGL does no automatic work on mobile, reduced-motion, low-power, or
     short visits. Entering the story is the explicit request to begin. */
  const [canvasBoot, setCanvasBoot] = useState(false);
  const [canvasMount, setCanvasMount] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [canvasUnavailable, setCanvasUnavailable] = useState(false);
  const handleCanvasReady = useCallback(() => setCanvasReady(true), []);
  const handleCanvasUnavailable = useCallback(() => setCanvasUnavailable(true), []);
  const bootCanvas = useCallback(() => setCanvasBoot(true), []);

  /* The central loader's real signals, reported up from inside the 3D chunk:
     GLB fetch counts and each progressive stage's first committed frame. The
     loader itself is DOM-only (see Loader.tsx) and holds until the meadow —
     the last progressive layer — has genuinely painted. */
  const [paintedStage, setPaintedStage] = useState<OpeningSceneStage | null>(null);
  const [fetchState, setFetchState] = useState<LoaderFetchState>({ loaded: 0, total: 0 });
  const handleStagePainted = useCallback((stage: OpeningSceneStage) => setPaintedStage(stage), []);
  const handleFetch = useCallback((loaded: number, total: number) => setFetchState({ loaded, total }), []);

  /* Paint the DOM handoff before mounting Three.js. Two animation frames
     guarantee the centred status card reaches the compositor before scene
     construction can occupy the main thread. */
  useEffect(() => {
    if (!canvasBoot || reduced !== false || canvasMount) return;
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => setCanvasMount(true));
    });
    return () => {
      window.cancelAnimationFrame(first);
      if (second) window.cancelAnimationFrame(second);
    };
  }, [canvasBoot, canvasMount, reduced]);

  /* DOWNLOAD EARLY, MOUNT LATE — the two used to be the same timer, and that
     is most of the "couple of seconds" before the 3D appears.

     StoryCanvas is next/dynamic, and next/dynamic does not REQUEST its chunk
     until the component first renders. Because it only renders once
     canvasBoot flips, the three.js + drei + postprocessing bundle and all six
     GLBs (~590 KB) sat unrequested for the full 1600 ms hold — and a visitor
     who clicked Enter immediately started that download from zero while
     staring at an empty world.

     The hold exists so the gate film's opening streams clean, and it still
     does: the MOUNT is untouched. Only the FETCH moves earlier, to 700 ms,
     by which point the film has its opening buffered. Warming on pointer or
     focus too, because reaching for the gate is the strongest possible
     signal that the scene is about to be needed. Repeat calls are free —
     webpack resolves an already-loaded chunk from cache. */
  useEffect(() => {
    if (!window.matchMedia("(min-width: 820px) and (prefers-reduced-motion: no-preference)").matches) return;
    let warmed = false;
    const warm = () => {
      if (warmed) return;
      warmed = true;
      void import("./StoryCanvas");
    };
    const t = window.setTimeout(warm, 700);
    window.addEventListener("pointerdown", warm, { once: true, passive: true });
    window.addEventListener("keydown", warm, { once: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("pointerdown", warm);
      window.removeEventListener("keydown", warm);
    };
  }, []);

  /* The gate's click is the audio gesture. Entering silently still enters —
     the sound button in the HUD stays available either way. */
  const handleEnter = useCallback(
    (selectedAudience: StoryAudience, withSound: boolean) => {
      setAudience(selectedAudience);
      setEntered(true);
      const webgl = probeWebGL();
      if (webgl === false) setCanvasUnavailable(true);
      else setCanvasBoot(true);
      document.documentElement.classList.remove("story-gated");
      if (withSound) audio.start();
    },
    [audio]
  );

  /* Lock the page behind the gate so the story can't be scrolled past it. */
  useEffect(() => {
    if (entered) return;
    document.documentElement.classList.add("story-gated");
    return () => document.documentElement.classList.remove("story-gated");
  }, [entered]);

  /* Story -> app: dip to the app's paper ground, then route. The scene
     doesn't hard-cut — the world fades and the tool takes over. */
  const enterApp = useCallback(
    (href: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      if (reduced) {
        router.push(href);
        return;
      }
      setLeaving(true);
      window.setTimeout(() => router.push(href), 520);
    },
    [reduced, router]
  );

  // Reduced-motion watch — the scene falls back to a still beauty shot.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => setReduced(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  // JS flag gates the hidden initial states so no-JS still shows all copy.
  useEffect(() => {
    document.documentElement.classList.add("story-js");
    return () => document.documentElement.classList.remove("story-js");
  }, []);

  // Scroll -> story progress (kage-style anchors: each section's midpoint),
  // and, in the same frame, the pinned plates' cross-fade.
  useEffect(() => {
    let anchors: number[] = [];
    const measure = () => {
      const vh = window.innerHeight;
      const max = Math.max(1, document.documentElement.scrollHeight - vh);
      const secs = sectionsRef.current.filter(Boolean) as HTMLElement[];
      anchors = secs.map((el, i) => {
        if (i === 0) return 0;
        if (i === secs.length - 1) return max;
        return Math.min(max, Math.max(0, el.offsetTop + el.offsetHeight * 0.5 - vh * 0.5));
      });
      for (let i = 1; i < anchors.length; i++) anchors[i] = Math.max(anchors[i], anchors[i - 1] + 1);
    };
    const progressFor = (y: number) => {
      if (!anchors.length || y <= anchors[0]) return 0;
      for (let i = 0; i < anchors.length - 1; i++) {
        if (y <= anchors[i + 1]) return i + (y - anchors[i]) / (anchors[i + 1] - anchors[i]);
      }
      return anchors.length - 1;
    };
    /* Signage law: hold, then fade. Windows are disjoint by construction —
       at the midpoint between two beats both are already at zero, so the
       page is never a double exposure. */
    const paint = (p: number) => {
      for (let i = 0; i < beats.length; i++) {
        const el = plateRefs.current[i];
        if (!el) continue;
        const o = 1 - smoothstep(0.3, 0.5, Math.abs(p - (i + 1)));
        el.style.opacity = o.toFixed(3);
        el.style.visibility = o < 0.008 ? "hidden" : "visible";
        /* Interactive window matches the LEGIBLE window. At the old o > 0.6
           the plate was inert across a band where its copy was still plainly
           readable — a large part of "hover sometimes works". 0.35 keeps the
           guard against hovering a ghost. (ELEVATION-BRIEF §2.3, H5.)
           The per-frame inline write is load-bearing — see .story-stage in
           globals.css before "improving" it. */
        el.style.pointerEvents = o > 0.35 ? "auto" : "none";
        if (o > 0.5) el.classList.add("rv-in");
      }
    };
    /* The style WRITES go through Motion's frame.render so they land after
       every frame.read in the same tick — CardFX measures card rects in
       frame.read, and write-then-read across two plain rAFs forced a
       synchronous layout on every scrolled frame (H10). Motion dedupes a
       re-scheduled callback, so this also keeps the one-paint-per-frame
       throttle the old inner rAF provided. progressRef is written
       synchronously — the R3F camera must never wait a frame for it. */
    const paintNow = () => paint(progressRef.current);
    const onScroll = () => {
      const p = progressFor(window.scrollY);
      progressRef.current = p;
      frame.render(paintNow);
      const a = Math.round(p);
      if (a !== activeRef.current) {
        activeRef.current = a;
        setActive(a);
      }
    };
    const onResize = () => {
      measure();
      onScroll();
    };
    measure();
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      cancelFrame(paintNow);
    };
  }, [beats]);

  // Reveal-on-enter for the in-flow copy blocks (hero and the end sheet).
  useEffect(() => {
    const els = Array.from(document.querySelectorAll(".story-rv-group"));
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("rv-in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const scrollToBeat = (i: number) => {
    const el = sectionsRef.current[i + 1];
    if (el) el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  };

  /* The rail lives in the gutter OPPOSITE the page that is on screen, so it
     can never be drawn over the copy — the collision the critics found at
     every single beat. It retires on the closing sheet. */
  const railSide = active >= 1 && active <= beats.length ? beats[active - 1].side : "left";
  const railClass = `story-rail${railSide === "right" ? " at-left" : ""}${active >= beats.length + 1 ? " off" : ""}`;

  return (
    <div className={`story-scope${night ? " night" : ""}`} data-story-audience={audience}>
      <div className="story-sky" aria-hidden />
      <StillScene hidden={canvasReady} />
      <SceneLoader
        active={entered && reduced === false && !canvasUnavailable}
        canvasLive={canvasMount}
        fetched={fetchState}
        painted={paintedStage}
      />
      {reduced === false && canvasMount && (
        <StoryCanvas
          progressRef={progressRef}
          reduced={reduced}
          night={night}
          onReady={handleCanvasReady}
          onUnavailable={handleCanvasUnavailable}
          onStagePainted={handleStagePainted}
          onFetch={handleFetch}
        />
      )}
      <div className="story-grain" aria-hidden />
      <div className={`story-veil${leaving ? " on" : ""}`} aria-hidden />

      {audio.element}
      <EnterGate onEnter={handleEnter} entered={entered} onVideoFallback={bootCanvas} />
      <StoryHUD
        night={night}
        onNight={flipNight}
        sound={audio.on}
        onSound={audio.toggle}
        audience={audience}
        onAudience={setAudience}
      />

      {/* progress rail */}
      <nav className={railClass} aria-label="Story progress">
        {beats.map((b, i) => (
          <button
            key={b.id}
            type="button"
            className={active === i + 1 ? "on" : ""}
            aria-label={`${b.n} ${b.label}`}
            aria-current={active === i + 1 ? "step" : undefined}
            onClick={() => scrollToBeat(i)}
          >
            <i aria-hidden />
            {/* ordinal always visible, the word on hover/active — globals
                .story-rail button span / span em */}
            <span aria-hidden>
              {b.n}
              <em>&nbsp;· {b.label}</em>
            </span>
          </button>
        ))}
      </nav>

      {/* ---- the pinned copy stage: paper pages laid over the world ---- */}
      <div className="story-stage">
        {beats.map((b, i) => (
          <article
            key={b.id}
            ref={(el) => {
              plateRefs.current[i] = el;
            }}
            className={`story-plate story-plate-${b.side} story-accent-${b.accent} fx-card`}
            data-fx=""
          >
            <Kicker n={b.n} label={b.label} />
            <Reveal className="story-display" text={b.heading} />
            <p className="story-body" data-rv style={{ transitionDelay: "220ms" }}>
              <WithXLayerLinks text={b.body} />
            </p>
            {b.ledger && <Ledger rows={b.ledger} />}
            {b.id === "budget" && <BudgetBand />}
            {b.cta && (
              <Link
                href={b.cta.href}
                onClick={enterApp(b.cta.href)}
                className="story-cta"
                data-rv
                style={{ transitionDelay: "400ms" }}
              >
                {b.cta.label}
                <i aria-hidden>&rarr;</i>
              </Link>
            )}
            {/* the journey's closing door rides the LAST beat — unless that
                beat already carries its own cta (two doors on one plate is
                noise, not choice) */}
            {i === beats.length - 1 && !b.cta && (
              <Link
                href={buildCta.href}
                onClick={enterApp(buildCta.href)}
                className="story-cta"
                data-rv
                style={{ transitionDelay: "400ms" }}
              >
                {buildCta.label}
                <i aria-hidden>&rarr;</i>
              </Link>
            )}
          </article>
        ))}
      </div>

      <div className="story-flow" id="main">
        {/* hero — a paper column against the world, not a scrim blob */}
        <section
          ref={(el) => {
            sectionsRef.current[0] = el;
          }}
          className="story-hero story-rv-group"
        >
          <div className="story-hero-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={withBase("/aura-mark.png")} alt="" className="story-mark" data-rv width={160} height={160} />
            <Kicker n={hero.n} label={hero.label} delay={80} />
            <Reveal as="h1" className="story-display story-display-xl" text={hero.heading} />
            <p className="story-sub" data-rv style={{ transitionDelay: "380ms" }}>
              <WithXLayerLinks text={hero.sub} />
            </p>
            {hero.actions && hero.actions.length > 0 ? (
              <div className="story-hero-actions" data-rv style={{ transitionDelay: "440ms" }}>
                {hero.actions.map((a, i) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    onClick={enterApp(a.href)}
                    className={`story-cta${i === 0 ? " story-cta-primary" : ""}`}
                  >
                    {a.label}
                    <i aria-hidden>&rarr;</i>
                  </Link>
                ))}
              </div>
            ) : null}
            <Ledger rows={hero.ledger} delay={480} fx />
            {audience === "crypto" ? <CryptoEcosystemLinks onNavigate={enterApp} /> : null}
            <button
              type="button"
              className="story-perspective-link"
              onClick={() => setAudience(audience === "project" ? "crypto" : "project")}
            >
              {audience === "project" ? "Explore the X Layer ecosystem" : "Return to the eco-home journey"}
              <i aria-hidden>&rarr;</i>
            </button>
            <div className="story-cue" data-rv style={{ transitionDelay: "640ms" }}>
              <span>{hero.cue}</span>
              <i aria-hidden />
            </div>
          </div>
        </section>

        {/* the five beats are scroll distance only — their copy is pinned */}
        {beats.map((b, i) => (
          <section
            key={b.id}
            id={b.id + "-beat"}
            ref={(el) => {
              sectionsRef.current[i + 1] = el;
            }}
            className="story-beat"
            aria-hidden
          />
        ))}

        {/* closing sheet */}
        <section
          ref={(el) => {
            sectionsRef.current[beats.length + 1] = el;
          }}
          className="story-end story-rv-group"
        >
          <div className="story-end-sheet">
            <div className="story-end-grid">
              <div className="story-end-lead">
                <p className="story-wordmark" data-rv>
                  Aura <em>Homes</em>
                </p>
                <Reveal className="story-display story-end-tagline" text={end.tagline} />
                <div data-rv style={{ transitionDelay: "260ms" }}>
                  <Link
                    href={end.cta.href}
                    onClick={enterApp(end.cta.href)}
                    className="story-cta story-cta-primary"
                  >
                    {end.cta.label}
                    <i aria-hidden>&rarr;</i>
                  </Link>
                </div>
                <p className="story-end-rollout" data-rv style={{ transitionDelay: "320ms" }}>
                  {end.rollout.text}{" "}
                  <Link href={end.rollout.href} onClick={enterApp(end.rollout.href)}>
                    {end.rollout.label} &rarr;
                  </Link>
                </p>
                {/* the eco journey's only HOMES mention, by design the last
                    word of the story (founder copy, verbatim) */}
                {end.homes && (
                  <p className="story-end-rollout" data-rv style={{ transitionDelay: "360ms" }}>
                    {end.homes.text}{" "}
                    <Link href={end.homes.href} onClick={enterApp(end.homes.href)}>
                      {end.homes.label} &rarr;
                    </Link>
                  </p>
                )}
                <button
                  type="button"
                  className="story-perspective-link story-perspective-link-end"
                  onClick={() => setAudience(audience === "project" ? "crypto" : "project")}
                >
                  {audience === "project" ? "Explore the X Layer ecosystem" : "Return to the eco-home journey"}
                  <i aria-hidden>&rarr;</i>
                </button>
              </div>

              <div className="story-end-side">
                <Kicker n={end.n} label={end.label} delay={200} />
                <nav className="story-end-links" data-rv style={{ transitionDelay: "300ms" }} aria-label="Product">
                  {end.links.map((l) => (
                    <Link key={l.href} href={l.href} onClick={enterApp(l.href)}>
                      <span>{l.label}</span>
                      <i aria-hidden>&rarr;</i>
                    </Link>
                  ))}
                </nav>
                <div className="story-end-meta" data-rv style={{ transitionDelay: "400ms" }}>
                  <SocialShareLinks compact />
                  <p className="story-end-season">{end.season}</p>
                  <div className="story-kr8tiv">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={withBase("/kr8tiv-badge.png")} alt="" width={72} height={72} />
                    <span>A KR8TIV AI product</span>
                  </div>
                  <p className="story-end-credit">
                    Open source, end to end — MIT on{" "}
                    <a href={REPO_URL} target="_blank" rel="noreferrer">
                      GitHub
                    </a>{" "}
                    ·{" "}
                    <a href={end.creditsUrl} target="_blank" rel="noreferrer">
                      scene inspired by MengTo&apos;s kage (credited)
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
