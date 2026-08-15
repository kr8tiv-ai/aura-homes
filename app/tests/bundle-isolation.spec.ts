import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";

/* BN01 — WALLET CODE MUST NOT SHIP TO ROUTES THAT NEVER TOUCH A WALLET.

   The defect this guards: <WagmiProvider> used to be mounted in
   app/app/providers.tsx, which the ROOT layout renders, so @wagmi/core and
   its storage layer were in the module graph of every single route. Someone
   who only wanted to design a house downloaded ~77 KB of wallet plumbing.

   Why this spec reads the BUILD and not the source. A source-level assertion
   ("providers.tsx does not import wagmi") is a proxy: it passes the moment
   the import moves one file sideways while the bytes still ship. The only
   honest question is which JavaScript a browser is told to fetch for a given
   URL, and that question is answered by app/out, not by an import statement.

   Why a marker string and not a chunk number. Chunk ids and hashes are
   webpack bookkeeping and change on every build; pinning 3706/6845 would
   turn a real invariant into a rename-detector. The markers below are
   literal strings emitted by the packages themselves, so they survive
   minification and they cannot be produced by anything else:

     · "@wagmi/core"  — from @wagmi/core's version tag, `@wagmi/core@${version}`.
     · "No QueryClient set, use QueryClientProvider to set one" — the
       @tanstack/react-query error text.

   @tanstack/react-query is gated here because BN01 moved it too: it was
   imported in exactly one first-party file (app/app/providers.tsx) and its
   only consumer was wagmi's query-backed hooks — no component in this repo
   calls useQuery/useMutation. If a non-wallet surface ever legitimately
   needs react-query, hoist QueryClientProvider back to the root and CHANGE
   the react-query test below with the reason written beside it. Do not
   delete it, and do not touch the wagmi test to make room for it — those are
   two independent claims. */

const appRoot = path.resolve(__dirname, "..");
const outDir = path.join(appRoot, "out");

/* The two surfaces that legitimately mount the wallet boundary. Matched as a
   path prefix so /labs/xlayer-proof/index.html and any future nested page
   under the same surface are both covered. */
const CHAIN_ROUTE_PREFIXES = ["labs/xlayer-proof", "operator/registry"] as const;

const WAGMI_CORE_MARKER = "@wagmi/core";
const REACT_QUERY_MARKER = "No QueryClient set, use QueryClientProvider to set one";

/* A marker no bundler will ever emit. Its job is to prove the scanner below
   discriminates rather than matching everything it is handed. */
const IMPOSSIBLE_MARKER = "@wagmi/core-this-string-is-not-in-any-bundle-BN01";

/* Matches both forms Next writes into an exported HTML page: the
   "/_next/static/chunks/…" of <script src>/<link rel=preload>, and the bare
   "static/chunks/…" inside the flight payload. Capturing from "static/" makes
   the assertion independent of basePath/assetPrefix (BASE_PATH= builds). */
const CHUNK_REF = /static\/chunks\/[A-Za-z0-9._/-]+?\.js/g;

const OUT_MISSING_REASON =
  "app/out is absent — this spec measures the BUILT export, so there is nothing to measure. " +
  "Run `GH_PAGES=1 npm run build` first. Skipping is correct here; passing would be a lie.";

function htmlFilesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "_next") continue; // assets, not routes
      found.push(...htmlFilesUnder(full));
    } else if (entry.endsWith(".html")) {
      found.push(full);
    }
  }
  return found;
}

interface RouteGraph {
  /** Page identity relative to out/, e.g. "build/index.html". */
  route: string;
  isChainRoute: boolean;
  /** Chunk refs that resolved to a real file on disk. */
  resolved: string[];
  /** Chunk refs that did NOT resolve — a non-empty list invalidates the scan. */
  unresolved: string[];
  /** Resolved chunks whose bytes contain the given marker. */
  chunksWith: (marker: string) => string[];
}

function readRouteGraphs(): RouteGraph[] {
  const chunkText = new Map<string, string>();
  const readChunk = (rel: string) => {
    let text = chunkText.get(rel);
    if (text === undefined) {
      text = readFileSync(path.join(outDir, "_next", rel), "utf8");
      chunkText.set(rel, text);
    }
    return text;
  };

  return htmlFilesUnder(outDir).map((file) => {
    const route = path.relative(outDir, file).split(path.sep).join("/");
    const html = readFileSync(file, "utf8");
    const refs = Array.from(new Set(html.match(CHUNK_REF) ?? [])).sort();
    const resolved: string[] = [];
    const unresolved: string[] = [];
    for (const ref of refs) {
      if (existsSync(path.join(outDir, "_next", ref))) resolved.push(ref);
      else unresolved.push(ref);
    }
    return {
      route,
      isChainRoute: CHAIN_ROUTE_PREFIXES.some((prefix) => route.startsWith(prefix)),
      resolved,
      unresolved,
      chunksWith: (marker: string) => resolved.filter((ref) => readChunk(ref).includes(marker)),
    };
  });
}

test.describe("BN01 wallet-code isolation", () => {
  test.skip(!existsSync(outDir), OUT_MISSING_REASON);

  test("the chunk scanner reads a real export and can tell chunks apart", () => {
    const graphs = readRouteGraphs();

    /* If this scan ever returns a handful of pages or no chunk references,
       every isolation assertion below would pass by measuring nothing. */
    expect(graphs.length, "route HTML files found under app/out").toBeGreaterThan(15);
    for (const graph of graphs) {
      expect(graph.unresolved, `${graph.route} references chunks that are not on disk`).toEqual([]);
      expect(
        graph.resolved.length,
        `${graph.route} resolved no chunk references — the CHUNK_REF regex has stopped matching`,
      ).toBeGreaterThan(4);
    }

    /* Discrimination: the marker must be findable in this build, and a
       marker that cannot exist must be found nowhere. Without both halves a
       broken `includes` reads as perfect isolation. */
    const carriers = graphs.flatMap((graph) => graph.chunksWith(WAGMI_CORE_MARKER));
    expect(
      new Set(carriers).size,
      "no chunk in the whole export carries the @wagmi/core marker — either wagmi is gone entirely (then delete this spec on purpose) or the marker has drifted",
    ).toBeGreaterThan(0);
    expect(graphs.flatMap((graph) => graph.chunksWith(IMPOSSIBLE_MARKER))).toEqual([]);

    /* Both chain surfaces must be present as routes, or "no non-chain route
       carries wagmi" could be true because the chain routes vanished. */
    for (const prefix of CHAIN_ROUTE_PREFIXES) {
      expect(
        graphs.some((graph) => graph.route.startsWith(prefix)),
        `${prefix} is missing from the export`,
      ).toBe(true);
    }
  });

  test("no route outside the chain surfaces downloads @wagmi/core", () => {
    const offenders = readRouteGraphs()
      .filter((graph) => !graph.isChainRoute)
      .map((graph) => ({ route: graph.route, chunks: graph.chunksWith(WAGMI_CORE_MARKER) }))
      .filter((entry) => entry.chunks.length > 0);

    expect(
      offenders,
      `these routes ship @wagmi/core to people who never connect a wallet:\n${offenders
        .map((entry) => `  ${entry.route} <- ${entry.chunks.join(", ")}`)
        .join("\n")}`,
    ).toEqual([]);
  });

  test("the chain surfaces still download @wagmi/core", () => {
    /* The other half of the invariant. Isolation is only a win if the wallet
       surfaces still have their wallet code; without this, deleting the
       feature outright would score as a pass. */
    for (const graph of readRouteGraphs().filter((entry) => entry.isChainRoute)) {
      expect(
        graph.chunksWith(WAGMI_CORE_MARKER).length,
        `${graph.route} is a wallet surface but no longer loads @wagmi/core`,
      ).toBeGreaterThan(0);
    }
  });

  test("no route outside the chain surfaces downloads @tanstack/react-query", () => {
    const graphs = readRouteGraphs();

    /* Same discrimination check as above, for the second marker. */
    expect(
      new Set(graphs.flatMap((graph) => graph.chunksWith(REACT_QUERY_MARKER))).size,
      "no chunk carries the react-query marker — it has drifted, or react-query left the build",
    ).toBeGreaterThan(0);

    const offenders = graphs
      .filter((graph) => !graph.isChainRoute)
      .map((graph) => ({ route: graph.route, chunks: graph.chunksWith(REACT_QUERY_MARKER) }))
      .filter((entry) => entry.chunks.length > 0);

    expect(
      offenders,
      `react-query exists in this app only to serve wagmi's hooks, so it belongs inside the wallet boundary. These routes still ship it:\n${offenders
        .map((entry) => `  ${entry.route} <- ${entry.chunks.join(", ")}`)
        .join("\n")}`,
    ).toEqual([]);
  });
});
