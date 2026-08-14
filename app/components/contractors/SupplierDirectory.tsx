/* THE SUPPLY SIDE — the material suppliers this repo has always carried and
   never shown.

   `data/alberta/suppliers.json` has been in the project since the Alberta
   research pass, read by nothing. The contractor workbench beside this is
   about WHO builds; this is about WHERE THE MATERIAL COMES FROM, and the two
   are different questions with different evidence, so they get different
   sections rather than one blurred list.

   WHAT THIS IS NOT. Nobody here was contacted, nobody agreed to appear, and
   nobody is endorsed — the data file says so itself and that sentence is
   printed rather than paraphrased. A row is a starting point for a phone
   call, not a referral, and the score measures how much EVIDENCE a record
   carries, never how good the supplier is.

   Server component on purpose: the directory is baked, so there is nothing
   to hydrate and no reason to ship this to the browser. */

import {
  ALBERTA_SUPPLIER_DIRECTORY,
  SUPPLIER_DIRECTORY_DISCLAIMER,
  SUPPLIER_SCORE_MEANING,
  SUPPLIER_EVIDENCE_LABELS,
  categoryLabel,
  supplierEvidenceScore,
} from "@/lib/marketplace/suppliers";

const READINESS_WORDS = {
  "source-backed": "Source-backed",
  "manual-review": "Needs a check",
  "check-expired": "Check expired",
} as const;

export default function SupplierDirectory() {
  const directory = ALBERTA_SUPPLIER_DIRECTORY;
  /* One clock read, at render, shared by every row — so two rows on the same
     page can never disagree about whether a check has expired. */
  const now = new Date();

  return (
    <section className="mt-16" aria-labelledby="supplier-directory-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="aura-label">Where the material comes from</p>
          <h2
            id="supplier-directory-heading"
            className="mt-2 font-display text-[1.6rem] font-medium leading-tight tracking-[-0.02em]"
          >
            Alberta suppliers, with their sources attached
          </h2>
        </div>
        <p className="font-mono text-[0.6rem] uppercase tracking-label text-aura-text/50">
          Collected {directory.asOfLabel ?? "date not recorded"} ·{" "}
          {directory.profiles.length} record{directory.profiles.length === 1 ? "" : "s"}
        </p>
      </div>

      {directory.principle ? (
        <p className="mt-4 max-w-3xl text-[0.95rem] leading-[1.65] text-aura-text/75">
          {directory.principle}
        </p>
      ) : null}
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-aura-text/65">
        {SUPPLIER_DIRECTORY_DISCLAIMER}
      </p>

      {directory.categories.map((category) => (
        <div key={category.id} className="mt-10">
          <h3 className="aura-label text-aura-emerald">{categoryLabel(category.id)}</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {directory.profiles
              .filter((profile) => profile.categoryId === category.id)
              .map((profile) => {
              const score = supplierEvidenceScore(profile, now);
              return (
                <article key={profile.id} className="aura-panel flex h-full flex-col p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h4 className="font-display text-[1.05rem] leading-tight">{profile.name}</h4>
                    <span className="shrink-0 font-mono text-[0.6rem] uppercase tracking-label text-aura-text/55">
                      {READINESS_WORDS[score.readiness]}
                    </span>
                  </div>
                  {profile.location ? (
                    <p className="mt-1 text-xs text-aura-text/60">{profile.location}</p>
                  ) : null}
                  {profile.note ? (
                    <p className="mt-3 text-sm leading-relaxed text-aura-text/75">{profile.note}</p>
                  ) : null}

                  <ul className="mt-4 space-y-1.5 text-xs leading-relaxed text-aura-text/65">
                    {profile.evidence.map((item) => (
                      <li key={item.kind} className="flex items-baseline justify-between gap-3">
                        <span>{SUPPLIER_EVIDENCE_LABELS[item.kind]}</span>
                        {/* The file's own five states, printed as they are.
                            "self-declared" is deliberately not dressed up as
                            confirmed: a supplier saying a thing about itself
                            is evidence of a claim, not of the fact. */}
                        <span
                          className={
                            item.status === "confirmed"
                              ? "text-aura-emerald"
                              : item.status === "expired" || item.status === "not-found"
                                ? "text-aura-violet"
                                : "text-aura-text/45"
                          }
                        >
                          {item.status === "confirmed"
                            ? "confirmed"
                            : item.status === "self-declared"
                              ? "self-declared"
                              : item.status === "expired"
                                ? "expired"
                                : item.status === "not-found"
                                  ? "not found"
                                  : "unknown"}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-4">
                    {profile.websiteUrl ? (
                      <a
                        href={profile.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-aura-emerald underline underline-offset-4"
                      >
                        Open the source ↗
                      </a>
                    ) : (
                      <span className="text-xs text-aura-text/45">
                        No source recorded — treat this row as a name to verify.
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ))}

      <p className="mt-10 max-w-3xl text-xs leading-relaxed text-aura-text/55">
        {SUPPLIER_SCORE_MEANING}
      </p>
    </section>
  );
}
