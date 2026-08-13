"use client";

/* ---------------------------------------------------------------------
   STORY CHROME — the enter gate and the persistent HUD.

   The gate exists for a real reason, not decoration: browsers will not let
   a page start audio without a user gesture, so the nature sounds need a
   click to exist at all. Rather than bolt a mute button into the corner and
   hope, the click becomes the moment you step into the place — which is
   also the moment the loop fades in. Same pattern as the Evolve Apparel
   forest-ambience button (evolveapparel.shop), same asset, ported here.

   Everything in the HUD is deliberately small, quiet, and out of the way of
   the scroll story: star the repo, flip day/night, mute the forest.
--------------------------------------------------------------------- */

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { FOLLOW_INTENT } from "../SocialShareLinks";
import { withBase } from "../../lib/basePath";
import { GATE, type StoryAudience } from "./copy";

export const REPO_URL = "https://github.com/kr8tiv-ai/aura-homes";
/* The star pill's destination. GitHub publishes no star-intent URL, so this
   uses the login?return_to pattern the star-button services (ghbtns class)
   link through — VERIFIED in a real headless browser, Aug 9 2026:
   · logged OUT: GitHub's own sign-in page with return_to carrying
     /kr8tiv-ai/aura-homes — after sign-in you land on the repo;
   · logged IN: /login redirects straight to the repo, whose header carries
     the Star control (also verified present on the logged-out repo page,
     where clicking Star routes through this same login?return_to flow).
   Either way the journey ends at the screen with the Star button. */
export const STAR_URL = "https://github.com/login?return_to=%2Fkr8tiv-ai%2Faura-homes";
export const XLAYER_URL = "https://web3.okx.com/xlayer";
export const OKX_URL = "https://www.okx.com/";
export const BUILDX_URL = "https://web3.okx.com/xlayer/build-x-series";

/* ----------------------------- the gate ----------------------------- */

export function EnterGate({
  onEnter,
  entered,
  onVideoFallback,
}: {
  onEnter: (audience: StoryAudience, withSound: boolean) => void;
  entered: boolean;
  /** Called when the gate film cannot run (missing/failed asset or
   *  prefers-reduced-motion) so the parent can boot the 3D scene at once —
   *  the scene IS the fallback presentation. */
  onVideoFallback?: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (entered || !hydrated) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusableElements = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => !element.hasAttribute("hidden"));
    focusableElements()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = focusableElements();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!dialog.contains(event.target as Node)) focusableElements()[0]?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [entered, hydrated]);

  /* ---- the gate film ----
     The founder's Grok-generated establishing film plays as a muted looping
     cover behind the gate copy. Asset contract (app/public/video/enter.mp4):
     Desktop browsers that decode AV1 receive the 1920-wide, lightly restored
     source; mobile and compatibility clients keep the 1280-wide H.264 file.
     Both are yuv420p, silent and 15 s. The media query prevents phones from
     paying for desktop pixels, while the 1920 AVIF poster costs only 24 KB.
     Degradation is graceful and free of 404 spinners: the file ships with
     the bundle, and if it ever errors (or the visitor asks for reduced
     motion) the video unmounts and the gate is exactly the pre-film paper
     gate with the 3D scene behind it. playsInline keeps iOS from going
     fullscreen; muted is ALSO set via ref because React renders the muted
     prop after hydration, which some Chromium builds treat as unmuted at
     autoplay-policy time. */
  const [videoOk, setVideoOk] = useState(true);
  const [reducedM, setReducedM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => setReducedM(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);
  const videoDead = !videoOk || reducedM;
  useEffect(() => {
    if (videoDead) onVideoFallback?.();
  }, [videoDead, onVideoFallback]);

  const go = useCallback(
    (audience: StoryAudience) => {
      if (!hydrated || leaving) return;
      setLeaving(true);
      // The same confirmed gesture selects the story, starts optional audio,
      // and hands off to the scene. Keeping this synchronous avoids a dead
      // gate if a browser throttles timers during video or WebGL startup.
      onEnter(audience, soundOn);
    },
    [hydrated, leaving, onEnter, soundOn]
  );

  if (entered) return null;

  return (
    <div
      ref={dialogRef}
      className={`story-gate${leaving ? " leaving" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Choose an Aura Homes journey"
    >
      {!videoDead && (
        <>
          <video
            className="story-gate-video"
            /* The film is the LCP element: a 24KB AVIF poster paints the
               first frame immediately while preload="metadata" limits
               network contention. Both streams use hardware-decodable H.264
               so playback cannot starve the Three.js handoff. */
            poster={withBase("/video/enter-poster.avif")}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden
            ref={(el) => {
              if (el) el.muted = true;
            }}
            onError={() => setVideoOk(false)}
          >
            <source
              src={withBase("/video/enter-desktop.mp4")}
              type="video/mp4"
              media="(min-width: 900px)"
            />
            <source src={withBase("/video/enter.mp4")} type="video/mp4" />
          </video>
          <div className="story-gate-scrim" aria-hidden />
        </>
      )}
      <div className="story-gate-inner">
        <div className="story-gate-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={withBase("/aura-mark.png")} alt="" className="story-gate-mark" width={160} height={160} />
          <span>Aura <em>Homes</em></span>
        </div>
        <p className="story-gate-kicker"><span>00</span><i aria-hidden />Eco Homes, Tiny Homes, Unique Stays</p>
        <h1 className="story-display story-gate-title">
          {GATE.titleLines.map((line, i) => (
            <Fragment key={line}>
              {i > 0 ? <br /> : null}
              {line}
            </Fragment>
          ))}
        </h1>
        <p className="story-gate-sub">{GATE.sub}</p>
        {/* Both journeys are visible together — there is no hidden or default
            selection. Copy is the founder's verbatim pick (copy.ts GATE). */}
        <div className="story-gate-paths" aria-label="Choose your journey">
          <button type="button" className="story-gate-path" onClick={() => go("project")} disabled={!hydrated || leaving}>
            <strong>{GATE.paths.project.title}</strong>
            <small>{GATE.paths.project.desc}</small>
          </button>
          <button type="button" className="story-gate-path" onClick={() => go("crypto")} disabled={!hydrated || leaving}>
            <strong>{GATE.paths.crypto.title}</strong>
            <small>{GATE.paths.crypto.desc}</small>
          </button>
        </div>
        <div className="story-gate-preference">
          <button
            type="button"
            className="story-gate-quiet"
            aria-pressed={soundOn}
            aria-label={soundOn ? "Forest sound on" : "Forest sound off"}
            onClick={() => setSoundOn((value) => !value)}
            disabled={!hydrated || leaving}
          >
            Forest sound {soundOn ? "on" : "off"}
          </button>
        </div>
        <p className="story-gate-proof">
          <a href={BUILDX_URL} target="_blank" rel="noreferrer">OKX Build X · AI Season 2026</a>
          {" · "}<a href={XLAYER_URL} target="_blank" rel="noreferrer">X Layer testnet</a>
          {" · HOMES trust and owner launchpad planned"}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------- HUD -------------------------------- */

/** Live stargazer count for the HUD star pill. Unauthenticated GitHub API
 *  (60 req/hr/IP — fine per visitor), cached per session, and silent on
 *  any failure: the pill simply shows no number, which is exactly the
 *  pre-count design. */
function useRepoStars() {
  const [stars, setStars] = useState<number | null>(null);
  useEffect(() => {
    const KEY = "aura-gh-stars";
    try {
      const cached = sessionStorage.getItem(KEY);
      if (cached !== null && Number.isFinite(Number(cached))) {
        setStars(Number(cached));
        return;
      }
    } catch {}
    const ctl = new AbortController();
    fetch("https://api.github.com/repos/kr8tiv-ai/aura-homes", {
      signal: ctl.signal,
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const n = j && typeof j.stargazers_count === "number" ? j.stargazers_count : null;
        if (n !== null) {
          setStars(n);
          try {
            sessionStorage.setItem(KEY, String(n));
          } catch {}
        }
      })
      .catch(() => {});
    return () => ctl.abort();
  }, []);
  return stars;
}

export function StoryHUD({
  night,
  onNight,
  sound,
  onSound,
  audience,
  onAudience,
  initialFocusRef,
}: {
  night: boolean;
  onNight: () => void;
  sound: boolean;
  onSound: () => void;
  audience: StoryAudience;
  onAudience: (audience: StoryAudience) => void;
  initialFocusRef?: { current: HTMLButtonElement | null };
}) {
  const stars = useRepoStars();

  return (
    <nav className="story-hud" aria-label="Story controls">
      <button
        ref={initialFocusRef}
        type="button"
        className="story-hud-btn story-hud-perspective"
        onClick={() => onAudience(audience === "project" ? "crypto" : "project")}
        aria-label={audience === "project" ? "Switch to the X Layer ecosystem" : "Switch to the eco-home journey"}
        title={audience === "project" ? "X Layer ecosystem" : "Eco-home journey"}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M7 7h10m0 0-3-3m3 3-3 3M17 17H7m0 0 3 3m-3-3 3-3" />
        </svg>
        <span>{audience === "project" ? "X Layer" : "Eco home"}</span>
      </button>
      {/* Live star count in OUR design language (founder request, Aug 10).
          The official ghbtns iframe was built and screenshotted first —
          GitHub's rounded grey-gradient widget fought the square 2px mono
          pill system no matter the chip under it, so per the agreed
          fallback the count rides our own pill instead: fetched from the
          GitHub API, session-cached, and shown only once it is non-zero (a
          live "0" is anti-social-proof; the number appears when it helps).
          Click lands on the repo star flow verified Aug 9. */}
      <a
        className="story-hud-btn story-hud-star"
        href={STAR_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="Star the Aura Homes repository on GitHub"
        title="Star the repo on GitHub"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.45 6.19 20.5 7.3 14.03 2.6 9.45l6.5-.95z" />
        </svg>
        <span>Star the repo</span>
        {stars !== null && stars > 0 && (
          <em className="story-hud-count" aria-label={`${stars} stars`}>
            {stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars}
          </em>
        )}
      </a>

      {/* Follow pill (founder ask, Aug 12): the account is live and the
          hackathon weighs an ACTIVE one, so the landing asks plainly. A true
          one-click auto-follow needs OAuth and a server — impossible here —
          so this is X's own pre-filled follow dialog, the same honest
          journey shape as STAR_URL above. The soft breathing pulse is the
          "apparent" treatment; it stops entirely under reduced motion. */}
      <a
        className="story-hud-btn story-hud-follow"
        href={FOLLOW_INTENT}
        target="_blank"
        rel="noreferrer"
        aria-label="Follow @AuraHomes_fun on X"
        title="Follow @AuraHomes_fun on X"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        <span>Follow us on X</span>
      </a>

      <button
        type="button"
        className="story-hud-btn"
        onClick={onNight}
        aria-pressed={night}
        aria-label={night ? "Switch to day" : "Switch to night"}
        title={night ? "Day" : "Night"}
      >
        {night ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 4.5a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm0 12a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm7.5-5.5a1 1 0 010 2h-1a1 1 0 110-2zm-14 0a1 1 0 010 2h-1a1 1 0 110-2zM12 8a4 4 0 100 8 4 4 0 000-8z" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M20 14.5A8.2 8.2 0 019.6 4a8.5 8.5 0 105.6 15.9 8.6 8.6 0 004.8-5.4z" />
          </svg>
        )}
        <span>{night ? "Day" : "Night"}</span>
      </button>

      <button
        type="button"
        className={`story-hud-btn${sound ? " on" : ""}`}
        onClick={onSound}
        aria-pressed={sound}
        aria-label={sound ? "Mute forest ambience" : "Play forest ambience"}
        title={sound ? "Mute" : "Forest ambience"}
      >
        {sound ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 00-2.5-4v8a4.5 4.5 0 002.5-4z" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M4 9v6h4l5 4V5L8 9H4zm15.7 1.3l-1.4-1.4-1.8 1.8-1.8-1.8-1.4 1.4 1.8 1.8-1.8 1.8 1.4 1.4 1.8-1.8 1.8 1.8 1.4-1.4-1.8-1.8z" />
          </svg>
        )}
        <span className="story-hud-sr">{sound ? "Sound on" : "Sound off"}</span>
      </button>
    </nav>
  );
}

/* ------------------------- the audio element ------------------------ */

export function useForestAudio() {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [on, setOn] = useState(false);

  /* Fade rather than cut — a nature loop that snaps on is worse than none.
     30 steps over ~1.2s, cancelled cleanly if the user toggles mid-fade. */
  const fadeTo = useCallback((target: number, done?: () => void) => {
    const a = ref.current;
    if (!a) return;
    const from = a.volume;
    const steps = 30;
    let k = 0;
    const id = window.setInterval(() => {
      k++;
      const v = from + (target - from) * (k / steps);
      a.volume = Math.max(0, Math.min(1, v));
      if (k >= steps) {
        window.clearInterval(id);
        done?.();
      }
    }, 40);
  }, []);

  const start = useCallback(() => {
    const a = ref.current;
    if (!a) return;
    a.volume = 0;
    a.play()
      .then(() => {
        setOn(true);
        fadeTo(0.45);
      })
      .catch(() => setOn(false));
  }, [fadeTo]);

  const toggle = useCallback(() => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) start();
    else
      fadeTo(0, () => {
        a.pause();
        setOn(false);
      });
  }, [fadeTo, start]);

  const element = (
    /* forest-ambience-loop.mp3: 90s seamless loop (3s head crossfade from
       the tail), mono 64kbps — 721KB against the old 6.66MB stereo file.
       Inaudible difference at the 0.45-volume bed; 89% less data the moment
       someone taps "Enter with sound". */
    <audio
      ref={ref}
      src={withBase("/audio/forest-ambience-loop.mp3")}
      loop
      preload="none"
      onEnded={() => setOn(false)}
    />
  );

  return { element, on, start, toggle };
}

/* --------------------------- X Layer links -------------------------- */

/** Renders body copy with every "X Layer" mention linked to the official
 *  site. Kept as a splitter rather than raw HTML so the copy stays plain
 *  strings in copy.ts and nothing has to be escaped. */
export function WithXLayerLinks({ text }: { text: string }) {
  const parts = text.split(/(X Layer|OKX)/g);
  return (
    <>
      {parts.map((p, i) =>
        p === "X Layer" || p === "OKX" ? (
          <a key={i} className="story-xlink" href={p === "X Layer" ? XLAYER_URL : OKX_URL} target="_blank" rel="noreferrer">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

/* The hover "tracer" — an emerald light that walked the border of every copy
   block, with a 5px drop-shadow on the stroke — was removed in round 1.
   BRAND.md section 2 ends "no glow anywhere", and a crawling light on a
   static page is exactly the easing that draws attention to itself that
   section 8 forbids. Structure inside a plate is hairlines now. */
