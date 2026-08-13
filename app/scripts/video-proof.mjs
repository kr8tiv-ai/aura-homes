import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestRelative = "public/video/enter-media.json";
const manifest = JSON.parse(readFileSync(resolve(appRoot, manifestRelative), "utf8"));
const errors = [];

function fail(message) {
  errors.push(message);
}

function command(name, args) {
  const result = spawnSync(name, args, {
    cwd: appRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) throw new Error(`${name} is required for landing-film verification: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${name} failed (${result.status}): ${result.stderr || result.stdout}`);
  return { stdout: result.stdout, stderr: result.stderr };
}

function nearly(actual, expected, tolerance, label) {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    fail(`${label}: expected ${expected} +/- ${tolerance}, received ${actual}`);
  }
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function probe(asset) {
  const assetPath = resolve(appRoot, "public/video", asset.file);
  const stats = statSync(assetPath);
  if (stats.size !== asset.bytes) fail(`${asset.file}: expected ${asset.bytes} bytes, received ${stats.size}`);
  const digest = sha256(assetPath);
  if (digest !== asset.sha256) fail(`${asset.file}: SHA-256 mismatch (${digest})`);

  const { stdout } = command("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=codec_name,profile,pix_fmt,width,height,r_frame_rate",
    "-show_entries", "format=duration,size,bit_rate",
    "-of", "json",
    assetPath,
  ]);
  const metadata = JSON.parse(stdout);
  const stream = metadata.streams?.[0] ?? {};
  const format = metadata.format ?? {};
  if (stream.codec_name !== asset.codec) fail(`${asset.file}: expected ${asset.codec}, received ${stream.codec_name}`);
  if (stream.profile !== asset.profile) fail(`${asset.file}: expected profile ${asset.profile}, received ${stream.profile}`);
  if (stream.pix_fmt !== asset.pixelFormat) fail(`${asset.file}: expected ${asset.pixelFormat}, received ${stream.pix_fmt}`);
  if (stream.width !== asset.width || stream.height !== asset.height) {
    fail(`${asset.file}: expected ${asset.width}x${asset.height}, received ${stream.width}x${stream.height}`);
  }
  const [fpsNumerator, fpsDenominator] = String(stream.r_frame_rate ?? "0/1").split("/").map(Number);
  nearly(fpsNumerator / fpsDenominator, asset.fps, 0.001, `${asset.file} fps`);
  if (asset.durationSeconds !== undefined) {
    nearly(Number(format.duration), asset.durationSeconds, 0.002, `${asset.file} duration`);
    nearly(Number(format.bit_rate), asset.bitrate, 1, `${asset.file} bitrate`);
  }
  return {
    role: asset.role,
    codec: stream.codec_name,
    width: stream.width,
    height: stream.height,
    bytes: stats.size,
  };
}

function compare(entry) {
  const referencePath = resolve(appRoot, "public/video", entry.reference);
  const distortedPath = resolve(appRoot, "public/video", entry.distorted);
  const graph = [
    "[0:v]settb=AVTB,setpts=PTS-STARTPTS,split=2[refa][refb]",
    "[1:v]scale=1920:1294:flags=lanczos,settb=AVTB,setpts=PTS-STARTPTS,split=2[dista][distb]",
    "[refa][dista]ssim",
    "[refb][distb]psnr",
  ].join(";");
  const { stderr } = command("ffmpeg", [
    "-hide_banner", "-i", referencePath, "-i", distortedPath,
    "-lavfi", graph, "-f", "null", process.platform === "win32" ? "NUL" : "/dev/null",
  ]);
  const ssimMatch = stderr.match(/SSIM Y:[^\r\n]+All:([0-9.]+)/g)?.at(-1)?.match(/All:([0-9.]+)/);
  const psnrMatch = stderr.match(/PSNR y:[^\r\n]+average:([0-9.]+)/g)?.at(-1)?.match(/average:([0-9.]+)/);
  const ssim = Number(ssimMatch?.[1]);
  const psnrDb = Number(psnrMatch?.[1]);
  nearly(ssim, entry.ssim, 0.0005, `${entry.distorted} SSIM`);
  nearly(psnrDb, entry.psnrDb, 0.05, `${entry.distorted} PSNR`);
  if (ssim < 0.94) fail(`${entry.distorted}: SSIM ${ssim} is below the 0.94 consistency floor`);
  return { reference: entry.reference, distorted: entry.distorted, ssim, psnrDb };
}

let result;
try {
  if (manifest.schema !== "AuraLandingFilmProofV1") fail(`Unexpected manifest schema: ${manifest.schema}`);
  const assets = manifest.assets.map(probe);
  const comparisons = manifest.comparisons.map(compare);
  result = { ok: errors.length === 0, manifest: manifestRelative, assets, comparisons, errors };
} catch (error) {
  result = { ok: false, manifest: manifestRelative, assets: [], comparisons: [], errors: [...errors, String(error)] };
}

if (process.argv.includes("--json")) process.stdout.write(`${JSON.stringify(result)}\n`);
else if (result.ok) process.stdout.write(`Landing film proof passed: ${result.assets.length} assets, ${result.comparisons.length} comparisons.\n`);
else process.stderr.write(`${result.errors.join("\n")}\n`);

if (!result.ok) process.exitCode = 1;
