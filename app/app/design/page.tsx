"use client";

/* /design → /build?mode=guided. The design questionnaire's job — plain
   questions in, a review-ready concept out — belongs to the editor's guided
   mode now, so one design surface holds every answer. */

import LegacyRedirect from "@/components/LegacyRedirect";

export default function DesignRedirect() {
  return (
    <LegacyRedirect
      to="/build?mode=guided"
      label="Open the guided editor"
      note="The design questionnaire now lives inside the editor as guided mode — same plain questions, and the drawing updates as you answer."
    />
  );
}
