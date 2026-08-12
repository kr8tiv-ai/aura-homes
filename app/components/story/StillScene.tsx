"use client";

import { withBase } from "../../lib/basePath";

/** Immediate and no-WebGL state: the same authored Nordic house composition
 *  used by the social card. The interactive scene is still opt-in, so phones,
 *  reduced-motion users, and short visits get a complete composition without
 *  paying for Three.js or six GLBs. */
export default function StillScene({ hidden = false }: { hidden?: boolean }) {
  return (
    <div
      data-scene-quality="still"
      className={`story-static-scene${hidden ? " is-hidden" : ""}`}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={withBase("/story/aura-landing-still-v2.jpg")}
        alt=""
        width={1600}
        height={840}
        decoding="async"
        fetchPriority="low"
      />
    </div>
  );
}
