import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const root = resolve(process.argv[2] ?? "out");
const port = Number(process.argv[3] ?? "4331");
const host = "127.0.0.1";

if (!existsSync(root) || !statSync(root).isDirectory()) {
  throw new Error("Static export directory does not exist: " + root);
}
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("Invalid port: " + String(process.argv[3]));
}

const types = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".mp4", "video/mp4"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webm", "video/webm"],
  [".woff2", "font/woff2"],
]);

function exportedFile(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded.replace(/^\/+/, "");
  const base = resolve(root, relative || "index.html");
  if (base !== root && !base.startsWith(root + sep)) return null;
  const candidates = [base, resolve(base, "index.html"), base + ".html"];
  return candidates.find((candidate) => {
    try {
      return candidate.startsWith(root) && statSync(candidate).isFile();
    } catch {
      return false;
    }
  }) ?? null;
}

const server = createServer((request, response) => {
  try {
    const pathname = new URL(request.url ?? "/", "http://" + host + ":" + port).pathname;
    const file = exportedFile(pathname);
    if (!file) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": types.get(extname(file).toLowerCase()) ?? "application/octet-stream",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(file).pipe(response);
  } catch (error) {
    response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : String(error));
  }
});

server.listen(port, host, () => {
  process.stdout.write("Aura static export listening on http://" + host + ":" + port + "\n");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
