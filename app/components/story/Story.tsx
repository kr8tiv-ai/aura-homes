"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { HERO, BEATS, END, BUILD_CTA } from "./copy";
import { withBase } from "../../lib/basePath";
import { EnterGate, StoryHUD, Tracer, useForestAudio, WithXLayerLinks } from "./StoryChrome";

const StoryCanvas = dynamic(() => import("./StoryCanvas"), { ssr: false });

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

function BudgetBand() {
  return (
    <div className="story-band" data-rv style={{ transitionDelay: "160ms" }}>
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
      <p className="story-band-basis">Computed for a 780 sq ft SIP build, Alberta suppliers, 2026 pricing.</p>
    </div>
  );
}

const MILESTONES = ["Deposit", "Foundation", "Shell", "Systems", "Keys"];

function EscrowLine() {
  return (
    <div className="story-mline" data-rv style={{ transitionDelay: "160ms" }}>
      <div className="story-mline-track">
        {MILESTONES.map((m, i) => (
          <span key={m} className="story-mline-node" style={{ left: `${(i / (MILESTONES.length - 1)) * 100}%` }}>
            <i />
            <em>{m}</em>
          </span>
        ))}
      </div>
      <p className="story-mline-note">10% statutory holdback, released at completion.</p>
    </div>
  );
}

export default function Story() {
  const progressRef = useRef(0);
  const sectionsRef = useRef<(HTMLElement | null)[]>([]);
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

  /* Story -> app: dip to the app's dark ground, then route. The scene
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

  // Scroll -> story progress (kage-style anchors: each section's midpoint).
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
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const p = progressFor(window.scrollY);
        progressRef.current = p;
        const a = Math.round(p);
        if (a !== activeRef.current) {
          activeRef.current = a;
          setActive(a);
        }
      });
    };
    measure();
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => {
      measure();
      onScroll();
    });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Reveal-on-enter for copy blocks.
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
    if (el) el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

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
      <nav className="story-rail" aria-label="Story progress">
        {BEATS.map((b, i) => (
          <button
            key={b.id}
            type="button"
            className={active === i + 1 ? "on" : ""}
            aria-label={b.label}
            onClick={() => scrollToBeat(i)}
          >
            <i />
            <span>{b.label}</span>
          </button>
        ))}
      </nav>

      <div className="story-flow">
        {/* hero */}
        <section
          ref={(el) => {
            sectionsRef.current[0] = el;
          }}
          className="story-hero story-rv-group"
        >
          <div className="story-hero-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={withBase("/aura-mark.png")} alt="" className="story-mark" data-rv />
            <p className="story-label" data-rv>
              {HERO.label}
            </p>
            <Reveal as="h1" className="story-display story-display-xl" text={HERO.heading} />
            <p className="story-sub" data-rv style={{ transitionDelay: "420ms" }}>
              <WithXLayerLinks text={HERO.sub} />
            </p>
          </div>
          <div className="story-cue" data-rv style={{ transitionDelay: "700ms" }}>
            <span>{HERO.cue}</span>
            <i />
          </div>
        </section>

        {/* the five beats */}
        {BEATS.map((b, i) => (
          <section
            key={b.id}
            id={b.id + "-beat"}
            ref={(el) => {
              sectionsRef.current[i + 1] = el;
            }}
            className={`story-beat story-side-${b.side}`}
          >
            <div className={`story-copy story-rv-group story-accent-${b.accent}`}>
              <Tracer />
              <p className="story-label" data-rv>
                {b.label}
              </p>
              <Reveal className="story-display" text={b.heading} />
              <p className="story-body" data-rv style={{ transitionDelay: "260ms" }}>
                <WithXLayerLinks text={b.body} />
              </p>
              {b.id === "budget" && <BudgetBand />}
              {b.id === "escrow" && <EscrowLine />}
              {b.id === "build" && (
                <Link
                  href={BUILD_CTA.href}
                  onClick={enterApp(BUILD_CTA.href)}
                  className="story-cta"
                  data-rv
                  style={{ transitionDelay: "380ms" }}
                >
                  {BUILD_CTA.label}
                  <i aria-hidden>&rarr;</i>
                </Link>
              )}
            </div>
          </section>
        ))}

        {/* end card */}
        <section
          ref={(el) => {
            sectionsRef.current[6] = el;
          }}
          className="story-end story-rv-group"
        >
          <div className="story-end-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={withBase("/aura-mark.png")} alt="" className="story-mark story-mark-end" data-rv />
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
            <nav className="story-end-links" data-rv style={{ transitionDelay: "380ms" }} aria-label="Product">
              {END.links.map((l) => (
                <Link key={l.href} href={l.href} onClick={enterApp(l.href)}>
                  {l.label}
                </Link>
              ))}
            </nav>
            <p className="story-label story-end-season" data-rv style={{ transitionDelay: "420ms" }}>
              {END.season}
            </p>
            <div className="story-kr8tiv" data-rv style={{ transitionDelay: "500ms" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={withBase("/kr8tiv-badge.png")} alt="KR8TIV AI" />
              <span>A KR8TIV AI product</span>
            </div>
            <p className="story-end-credit" data-rv style={{ transitionDelay: "580ms" }}>
              MIT ·{" "}
              <a href={END.creditsUrl} target="_blank" rel="noreferrer">
                scene inspired by MengTo&apos;s kage (credited)
              </a>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
