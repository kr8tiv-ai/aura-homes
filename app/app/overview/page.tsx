"use client";

/* /overview → /how-it-works. The rollout-arcs overview was replaced by the
   plain-language lifecycle page in the approved nav restructure. */

import LegacyRedirect from "@/components/LegacyRedirect";

export default function OverviewRedirect() {
  return (
    <LegacyRedirect
      to="/how-it-works"
      label="Read how Aura works"
      note="The overview is now a plain-language walk through the whole lifecycle — design, land, costs, team, quotes, and handoff."
    />
  );
}
