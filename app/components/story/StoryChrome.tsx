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

import { useCallback, useEffect, useRef, useState } from "react";
import { withBase } from "../../lib/basePath";

export const REPO_URL = "https://github.com/kr8tiv-ai/aura-homes";
export const XLAYER_URL = "https://web3.okx.com/xlayer";

/* ----------------------------- the gate ----------------------------- */

export function EnterGate({
  onEnter,
  entered,
}: {
  onEnter: (withSound: boolean) => void;
  entered: boolean;
}) {
  const [leaving, setLeaving] = useState(false);

  const go = useCallback(
    (withSound: boolean) => {
      setLeaving(true);
      // let the veil run before the scene takes the stage
      window.setTimeout(() => onEnter(withSound), 460);
    },
    [onEnter]
  );

  // Enter/Space anywhere also enters, with sound — keyboard users get the
  // same gesture credit the click gets.
  useEffect(() => {
    if (entered) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        go(true);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [entered, go]);

  if (entered) return null;

  return (
    <div className={`story-gate${leaving ? " leaving" : ""}`} role="dialog" aria-label="Enter Aura Homes">
      <div className="story-gate-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={withBase("/aura-mark.png")} alt="" className="story-gate-mark" />
        <p className="story-label story-gate-label">Alberta · off-grid · on-chain</p>
        <h1 className="story-display story-gate-title">Aura Homes</h1>
        <p className="story-gate-sub">
          A journey from USDC on X Layer to the keys of an off-grid eco home.
        </p>

        <button type="button" className="story-gate-btn" onClick={() => go(true)} autoFocus>
          <span className="story-gate-btn-ring" aria-hidden />
          <span className="story-gate-btn-ring d2" aria-hidden />
          <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
          <span>Enter with sound</span>
        </button>

        <button type="button" className="story-gate-quiet" onClick={() => go(false)}>
          Enter silently
        </button>

        <p className="story-gate-fine">Forest ambience · 6.5 MB, only loads if you ask for it</p>
      </div>
    </div>
  );
}

/* ------------------------------- HUD -------------------------------- */

export function StoryHUD({
  night,
  onNight,
  sound,
  onSound,
}: {
  night: boolean;
  onNight: () => void;
  sound: boolean;
  onSound: () => void;
}) {
  return (
    <div className="story-hud">
      <a
        className="story-hud-btn story-hud-star"
        href={`${REPO_URL}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Star the Aura Homes repository on GitHub"
        title="Star the repo on GitHub"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.45 6.19 20.5 7.3 14.03 2.6 9.45l6.5-.95z" />
        </svg>
        <span>Star the repo</span>
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
    </div>
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
    <audio
      ref={ref}
      src={withBase("/audio/forest-ambience.mp3")}
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
  const parts = text.split(/(X Layer)/g);
  return (
    <>
      {parts.map((p, i) =>
        p === "X Layer" ? (
          <a key={i} className="story-xlink" href={XLAYER_URL} target="_blank" rel="noreferrer">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

/* --------------------------- text tracers --------------------------- */

/* A light that walks the border of a copy block on hover. It is one SVG
   rect with an animated dash offset — no canvas, no per-frame JS, and it
   sits behind the text so it can never eat a click. */
export function Tracer() {
  return (
    <svg className="story-tracer" aria-hidden preserveAspectRatio="none" viewBox="0 0 100 100">
      <rect className="story-tracer-track" x="0.4" y="0.4" width="99.2" height="99.2" rx="1.6" vectorEffect="non-scaling-stroke" />
      <rect className="story-tracer-run" x="0.4" y="0.4" width="99.2" height="99.2" rx="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
