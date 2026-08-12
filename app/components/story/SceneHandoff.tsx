"use client";

/**
 * A lightweight, always-visible handoff indicator that lives outside the
 * dynamically imported Three.js bundle. That placement is the feature: it
 * can paint before WebGL construction or shader compilation occupies the
 * main thread.
 */
export default function SceneHandoff({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div
      className="aura-loader is-on is-indeterminate"
      data-scene-handoff
      role="status"
      aria-live="polite"
      aria-label="Loading the interactive home"
    >
      <svg
        className="aura-loader-mark"
        viewBox="0 0 46 40"
        width="34"
        height="30"
        aria-hidden
        focusable="false"
      >
        <line className="aura-loader-plot" x1="2.5" y1="35.4" x2="43.5" y2="35.4" />
        <path className="aura-loader-ghost" d="M6 34 L23 5 L40 34" />
        <rect className="aura-loader-win" x="19" y="24" width="8" height="8" rx="0.6" />
        <path
          className="aura-loader-frame"
          d="M6 34 L23 5 L40 34"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={0.34}
        />
      </svg>
      <span className="aura-loader-txt" aria-hidden>
        <span className="aura-loader-label">Preparing your view</span>
        <span className="aura-loader-pct">—</span>
      </span>
    </div>
  );
}
