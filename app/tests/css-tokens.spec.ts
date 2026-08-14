import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";

/* Why this file exists.

   `--st-sans-font` was referenced four times in globals.css and declared
   nowhere. Nothing threw. No test went red. The page rendered, and four form
   controls — including the quote file input and the RFQ select — silently
   inherited a face instead of taking the one the rule asked for. A font audit
   found it by reading, which is not a control.

   An undefined custom property is the quietest failure CSS has: the whole
   declaration is dropped at computed-value time and the element falls back to
   whatever it inherited. That is indistinguishable from "styled that way on
   purpose" to every eye and every existing spec. So it needs a gate.

   The same sweep found five more: --aura-ink, --aura-paper, --st-sunken,
   --st-danger and a --tone-panel typo for --tone-raised. All fixed at the
   token layer; this file is what stops the seventh. */

const appRoot = path.resolve(__dirname, "..");
const cssPath = path.join(appRoot, "app/globals.css");
const css = readFileSync(cssPath, "utf8");

/** Custom properties a stylesheet READS, minus the ones it reads with a
 *  fallback. `var(--cx, -100px)` is the documented pattern for a value JS
 *  supplies at runtime — the fallback IS the declaration, so a reference that
 *  carries one is never a defect and must not be reported as one. */
const scan = (source: string, pattern: RegExp, keep: (match: RegExpExecArray) => boolean): string[] => {
  const found: Record<string, true> = {};
  const regex = new RegExp(pattern.source, pattern.flags);
  let match = regex.exec(source);
  while (match) {
    if (keep(match)) found[match[1]] = true;
    match = regex.exec(source);
  }
  return Object.keys(found).sort();
};

const referencedWithoutFallback = (source: string): string[] =>
  scan(source, /var\(\s*(--[A-Za-z0-9_-]+)\s*([,)])/g, (match) => match[2] !== ",");

/** Custom properties a stylesheet DECLARES, at any selector or nesting. */
const declaredIn = (source: string): string[] =>
  scan(source, /(?:^|[;{]|\/\*)\s*(--[A-Za-z0-9_-]+)\s*:/gm, () => true);

/* Components legitimately set custom properties from JS — inline style
   objects and setProperty calls. Those names appear in the TS sources, so the
   sources are part of the declaration surface. Scanning them is what keeps
   this gate from flagging the runtime-driven tokens, which would make it
   noisy enough to be switched off. */
const sourceText = (): string => {
  const skip = new Set(["node_modules", ".next", "out", ".git"]);
  const chunks: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (skip.has(entry)) continue;
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx|mjs)$/.test(entry)) chunks.push(readFileSync(full, "utf8"));
    }
  };
  walk(appRoot);
  return chunks.join("\n");
};

const REFERENCED = referencedWithoutFallback(css);
const DECLARED = declaredIn(css);
const SEEN_IN_SOURCES = sourceText();

test("the detector can actually fail", () => {
  /* A gate that cannot go red converts "unverified" into "verified" without
     doing any work, so prove each half before trusting the sweep. */
  const broken = ":root { --real: 1px; } .x { color: var(--ghost); }";
  expect(referencedWithoutFallback(broken)).toEqual(["--ghost"]);
  expect(declaredIn(broken)).toEqual(["--real"]);

  /* A reference WITH a fallback is not a finding. This is the exemption that
     keeps --cx / --cy / --cs out of the report, and it is pinned so a later
     "tightening" cannot quietly start flagging them. */
  expect(referencedWithoutFallback(".x { left: var(--cx, -100px); }")).toEqual([]);

  /* Both halves see the real file at a realistic scale — a regex that
     silently stopped matching would otherwise pass everything. */
  expect(REFERENCED.length).toBeGreaterThan(50);
  expect(DECLARED.length).toBeGreaterThan(60);
});

test("every custom property globals.css reads is declared somewhere", () => {
  const undeclared = REFERENCED.filter(
    (name) => DECLARED.indexOf(name) === -1 && !SEEN_IN_SOURCES.includes(name),
  );

  expect(
    undeclared,
    `these custom properties are read by app/globals.css, declared by no rule, and set by no component.\n` +
      `Each one silently drops its whole declaration at computed-value time — the element keeps whatever it inherited.\n` +
      `Declare it in the token block, or give the reference a fallback if a component supplies it at runtime:\n` +
      undeclared.join("\n"),
  ).toEqual([]);
});

test("the six repaired tokens resolve through the real cascade", async ({ page }) => {
  /* Regex agreement is not proof that a browser resolves the chain —
     --st-danger reaches its colour through TWO hops (--st-danger →
     --tone-danger → the triplet), and a break at either hop looks identical
     to a working rule in the text. So resolve them for real.

     The sentinel is the mechanism: an inherited colour nothing in the token
     system would ever produce. If a var chain is broken the declaration is
     dropped and the element inherits the sentinel, so "not the sentinel" is a
     genuine pass and the assertion has a way to fail. */
  await page.setContent(
    `<div id="ground" style="color: rgb(1, 2, 3); background: rgb(1, 2, 3)">
       <p class="quote-problem">could not save</p>
       <p class="plan-preview__commit-error">could not commit</p>
       <div class="plan-model-preview"></div>
       <div class="quote-file"><input type="file" /></div>
       <div class="budget-footer"><a href="#">continue</a></div>
     </div>`,
  );
  await page.addStyleTag({ content: css });

  const read = await page.evaluate(() => {
    const style = (selector: string) => getComputedStyle(document.querySelector(selector) as Element);
    return {
      sentinel: style("#ground").color,
      danger: style(".quote-problem").color,
      dangerCommit: style(".plan-preview__commit-error").color,
      sunkenBg: style(".plan-model-preview").backgroundColor,
      fileFont: style(".quote-file input").fontFamily,
      inkBg: style(".budget-footer a").backgroundColor,
      paperText: style(".budget-footer a").color,
    };
  });

  /* The control: the sentinel really is inheritable, so a pass below cannot
     come from a stylesheet that failed to attach. */
  expect(read.sentinel).toBe("rgb(1, 2, 3)");

  /* --st-danger → --tone-danger. Before the fix both of these rendered in the
     inherited body colour, which is the bug: an error a reader cannot tell
     from ordinary prose. */
  expect(read.danger).not.toBe("rgb(1, 2, 3)");
  expect(read.dangerCommit).toBe(read.danger);

  /* --st-sunken and --aura-ink are surfaces: a dropped declaration leaves
     them transparent, not merely wrong. */
  expect(read.sunkenBg).not.toBe("rgba(0, 0, 0, 0)");
  expect(read.inkBg).not.toBe("rgba(0, 0, 0, 0)");

  /* --aura-paper is the text that sits ON that ink. Same colour as the
     surface it sits on would be invisible; the sentinel would mean dropped. */
  expect(read.paperText).not.toBe("rgb(1, 2, 3)");
  expect(read.paperText).not.toBe(read.inkBg);

  /* --st-body-font, the original finding: the file input asked for the body
     face and got whatever it inherited. */
  expect(read.fileFont).toContain("Manrope");
});

test("the warning ink is remapped for night, not reused", async ({ page }) => {
  /* The file's own stated rule is that accents are perceptually REMAPPED
     rather than reused, because a shade that is AA on paper is not on
     charcoal. A token added without its dark value would satisfy every
     assertion above and still be unreadable at night. */
  await page.setContent(`<p class="quote-problem">could not save</p>`);
  await page.addStyleTag({ content: css });

  const dangerIn = async (theme: "light" | "dark") => {
    await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
    return page.evaluate(
      () => getComputedStyle(document.querySelector(".quote-problem") as Element).color,
    );
  };

  const light = await dangerIn("light");
  const dark = await dangerIn("dark");
  expect(light).toBe("rgb(148, 81, 61)");
  expect(dark).toBe("rgb(224, 160, 140)");
  expect(dark).not.toBe(light);
});
