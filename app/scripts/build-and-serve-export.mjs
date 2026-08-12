import { spawn } from "node:child_process";

const build = spawn("npm run build", {
  env: { ...process.env, GH_PAGES: "1" },
  shell: true,
  stdio: "inherit",
});

const code = await new Promise((resolve, reject) => {
  build.once("error", reject);
  build.once("exit", resolve);
});

if (code !== 0) {
  process.exit(typeof code === "number" ? code : 1);
}

await import("./serve-export.mjs");
