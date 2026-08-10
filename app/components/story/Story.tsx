"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { HERO, BEATS, END, BUILD_CTA, type LedgerRow } from "./copy";
import { withBase } from "../../lib/basePath";
import { EnterGate, StoryHUD, useForestAudio, WithXLayerLinks } from "./StoryChrome";

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

/** BRAND.md section 7, the spec-ledger: hairline-ruled mono IN / OUT rows. */
function Ledger({ rows, delay = 320 }: { rows: readonly LedgerRow[]; delay?: number }) {
  return (
    <dl className="story-ledger" data-rv style={{ transitionDelay: `${delay}ms` }}>
      {rows.map((r) => (
        <div key={r.k}>
          <dt>{r.k}</dt>
          <dd>{r.v}</dd>
        </div>
      ))}
    </dl>
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

const MILESTONES = ["Deposit", "Foundation", "Shell", "Systems", "Keys"];

function EscrowLine() {
  return (
    <div className="story-mline" data-rv style={{ transitionDelay: "300ms" }}>
      <div className="story-mline-track">
        {MILESTONES.map((m, i) => (
          <span key={m} className="story-mline-node" style={{ left: `${(i / (MILESTONES.length - 1)) * 100}%` }}>
            <i />
            <em>{m}</em>
          </span>
        ))}
      </div>
      <p className="story-mline-note">10% holdback, released at completion.</p>
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
  const [night, setNight] = useState(false);
  const audio = useForestAudio();

  /* The gate's click is the audio gesture. Entering silently still enters —
     the sound button in the HUD stays available either way. */
  const handleEnter = useCallback(
    (withSound: boolean) => {
      setEntered(true);
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
    let raf = 0;
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
      for (let i = 0; i < BEATS.length; i++) {
        const el = plateRefs.current[i];
        if (!el) continue;
        const o = 1 - smoothstep(0.3, 0.5, Math.abs(p - (i + 1)));
        el.style.opacity = o.toFixed(3);
        el.style.visibility = o < 0.008 ? "hidden" : "visible";
        el.style.pointerEvents = o > 0.6 ? "auto" : "none";
        if (o > 0.5) el.classList.add("rv-in");
      }
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const p = progressFor(window.scrollY);
        progressRef.current = p;
        paint(p);
        const a = Math.round(p);
        if (a !== activeRef.current) {
          activeRef.current = a;
          setActive(a);
        }
      });
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
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

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
  const railSide = active >= 1 && active <= BEATS.length ? BEATS[active - 1].side : "left";
  const railClass = `story-rail${railSide === "right" ? " at-left" : ""}${active >= BEATS.length + 1 ? " off" : ""}`;

  return (
    <div className={`story-scope${night ? " night" : ""}`}>
      <div className="story-sky" aria-hidden />
      {reduced !== null && <StoryCanvas progressRef={progressRef} reduced={reduced} night={night} />}
      <div className="story-grain" aria-hidden />
      <div className={`story-veil${leaving ? " on" : ""}`} aria-hidden />

      {audio.element}
      <EnterGate onEnter={handleEnter} entered={entered} />
      <StoryHUD night={night} onNight={() => setNight((n) => !n)} sound={audio.on} onSound={audio.toggle} />

      {/* progress rail */}
      <nav className={railClass} aria-label="Story progress">
        {BEATS.map((b, i) => (
          <button
            key={b.id}
            type="button"
            className={active === i + 1 ? "on" : ""}
            aria-label={`${b.n} ${b.label}`}
            aria-current={active === i + 1 ? "step" : undefined}
            onClick={() => scrollToBeat(i)}
          >
            <i aria-hidden />
            <span aria-hidden>
              {b.n} · {b.label}
            </span>
          </button>
        ))}
      </nav>

      {/* ---- the pinned copy stage: paper pages laid over the world ---- */}
      <div className="story-stage">
        {BEATS.map((b, i) => (
          <article
            key={b.id}
            ref={(el) => {
              plateRefs.current[i] = el;
            }}
            className={`story-plate story-plate-${b.side} story-accent-${b.accent}`}
          >
            <Kicker n={b.n} label={b.label} />
            <Reveal className="story-display" text={b.heading} />
            <p className="story-body" data-rv style={{ transitionDelay: "220ms" }}>
              <WithXLayerLinks text={b.body} />
            </p>
            {b.ledger && <Ledger rows={b.ledger} />}
            {b.id === "budget" && <BudgetBand />}
            {b.id === "escrow" && <EscrowLine />}
            {b.id === "build" && (
              <Link
                href={BUILD_CTA.href}
                onClick={enterApp(BUILD_CTA.href)}
                className="story-cta"
                data-rv
                style={{ transitionDelay: "400ms" }}
              >
                {BUILD_CTA.label}
                <i aria-hidden>&rarr;</i>
              </Link>
            )}
          </article>
        ))}
      </div>

      <div className="story-flow">
        {/* hero — a paper column against the world, not a scrim blob */}
        <section
          ref={(el) => {
            sectionsRef.current[0] = el;
          }}
          className="story-hero story-rv-group"
        >
          <div className="story-hero-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={withBase("/aura-mark.png")} alt="" className="story-mark" data-rv />
            <Kicker n={HERO.n} label={HERO.label} delay={80} />
            <Reveal as="h1" className="story-display story-display-xl" text={HERO.heading} />
            <p className="story-sub" data-rv style={{ transitionDelay: "380ms" }}>
              <WithXLayerLinks text={HERO.sub} />
            </p>
            <Ledger rows={HERO.ledger} delay={480} />
            <div className="story-cue" data-rv style={{ transitionDelay: "640ms" }}>
              <span>{HERO.cue}</span>
              <i aria-hidden />
            </div>
          </div>
        </section>

        {/* the five beats are scroll distance only — their copy is pinned */}
        {BEATS.map((b, i) => (
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
            sectionsRef.current[BEATS.length + 1] = el;
          }}
          className="story-end story-rv-group"
        >
          <div className="story-end-sheet">
            <div className="story-end-grid">
              <div className="story-end-lead">
                <p className="story-wordmark" data-rv>
                  Aura <em>Homes</em>
                </p>
                <Reveal className="story-display story-end-tagline" text={END.tagline} />
                <div data-rv style={{ transitionDelay: "260ms" }}>
                  <Link
                    href={END.cta.href}
                    onClick={enterApp(END.cta.href)}
                    className="story-cta story-cta-primary"
                  >
                    {END.cta.label}
                    <i aria-hidden>&rarr;</i>
                  </Link>
                </div>
              </div>

              <div className="story-end-side">
                <Kicker n={END.n} label={END.label} delay={200} />
                <nav className="story-end-links" data-rv style={{ transitionDelay: "300ms" }} aria-label="Product">
                  {END.links.map((l) => (
                    <Link key={l.href} href={l.href} onClick={enterApp(l.href)}>
                      <span>{l.label}</span>
                      <i aria-hidden>&rarr;</i>
                    </Link>
                  ))}
                </nav>
                <div className="story-end-meta" data-rv style={{ transitionDelay: "400ms" }}>
                  <p className="story-end-season">{END.season}</p>
                  <div className="story-kr8tiv">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={withBase("/kr8tiv-badge.png")} alt="" />
                    <span>A KR8TIV AI product</span>
                  </div>
                  <p className="story-end-credit">
                    MIT ·{" "}
                    <a href={END.creditsUrl} target="_blank" rel="noreferrer">
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
