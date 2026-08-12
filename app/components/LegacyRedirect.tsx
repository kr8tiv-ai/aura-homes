"use client";

/* Compatibility shim for moved routes. This site is a static export on
   GitHub Pages, so there is no server to issue a 301 — the old path ships a
   real page that performs a client-side router.replace and, for the case
   where JavaScript never runs, offers a plain link to the same destination.
   `replace`, not `push`: the legacy URL must not pollute the back stack. */

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyRedirect({
  to,
  label,
  note,
}: {
  /** Destination path, query string allowed (e.g. "/build?mode=guided"). */
  to: string;
  /** What the visitor is being taken to, in plain words. */
  label: string;
  /** One sentence on why the page moved. */
  note: string;
}) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to);
  }, [router, to]);
  return (
    <div className="py-24">
      <p className="aura-label mb-4">This page has moved</p>
      <p className="max-w-xl text-[0.95rem] leading-[1.65] text-aura-text/75">{note}</p>
      <p className="mt-6">
        <Link
          href={to}
          data-cursor="Open"
          className="inline-flex min-h-11 items-center text-aura-emerald underline underline-offset-4"
        >
          {label} <span aria-hidden>&nbsp;&rarr;</span>
        </Link>
      </p>
    </div>
  );
}
