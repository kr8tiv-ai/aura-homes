"use client";

import { useEffect, useRef, useState } from "react";
import type { LandFitResult } from "@/lib/marketplace/discovery";

const VERDICT = {
  "potential-match": "Potential match",
  "manual-review": "Needs evidence",
  "does-not-match": "Does not match",
} as const;

export default function LandMap({ results, onSelect }: { results: LandFitResult[]; onSelect: (id: string) => void }) {
  const host = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    if (!host.current) return;
    const canvas = document.createElement("canvas");
    if (!canvas.getContext("webgl2")) { setState("fallback"); return; }
    let live = true;
    let map: import("maplibre-gl").Map | null = null;
    const markers: import("maplibre-gl").Marker[] = [];
    void import("maplibre-gl").then(({ Map, Marker }) => {
      if (!live || !host.current) return;
      map = new Map({
        container: host.current,
        center: [-114.05, 52.95],
        zoom: 5.3,
        attributionControl: { compact: true },
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [
            { id: "paper", type: "background", paint: { "background-color": "#e9eee8" } },
            { id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.7, "raster-opacity": 0.72 } },
          ],
        },
      });
      map.once("load", () => live && setState("ready"));
      map.on("error", () => live && setState("fallback"));
      for (const result of results) {
        const point = result.listing.coordinates;
        if (!point) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = `land-map-marker is-${result.verdict}`;
        button.setAttribute("aria-label", `${result.listing.title}: ${VERDICT[result.verdict]}, ${result.score} out of 100`);
        button.innerHTML = `<span>${result.score}</span>`;
        button.addEventListener("click", () => onSelect(result.listing.id));
        markers.push(new Marker({ element: button, anchor: "bottom" }).setLngLat([point.longitude, point.latitude]).addTo(map));
      }
    }).catch(() => live && setState("fallback"));
    return () => { live = false; markers.forEach((marker) => marker.remove()); map?.remove(); };
  }, [onSelect, results]);

  return (
    <div className="land-map-shell" data-map-state={state}>
      <div ref={host} className="land-map-canvas" aria-label="Map of demonstration parcel fit results" />
      {state === "loading" ? <div className="land-map-state"><span>Opening project map…</span></div> : null}
      {state === "fallback" ? <div className="land-map-state"><strong>Map unavailable on this device.</strong><span>Every parcel and fit finding remains in the accessible list below.</span></div> : null}
      <div className="land-map-legend" aria-hidden="true"><span className="is-potential-match">Potential</span><span className="is-manual-review">Check</span><span className="is-does-not-match">Blocked</span></div>
    </div>
  );
}
