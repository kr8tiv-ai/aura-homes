import { expect, test } from "playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";

import { hashBuilderDocument, validateBuilderDocument } from "@/lib/builder/document";
import { buildHome } from "@/lib/builder/geometry";
import {
  PLAN_TEMPLATES,
  instantiatePlanTemplate,
  type PlanTemplate,
} from "@/lib/builder/planCatalog";

const IDS = ["ridge-a-frame", "fjell-cube", "lightframe-pavilion"] as const;
const TITLES: Record<(typeof IDS)[number], string> = {
  "ridge-a-frame": "Ridge A-Frame",
  "fjell-cube": "Fjell Cube",
  "lightframe-pavilion": "Lightframe Pavilion",
};

const CAMERA = {
  position: [72, 44, 92] as const,
  target: [0, 9, 0] as const,
  fov: 38,
  aspect: 16 / 10,
};

function fixedCameraBounds(document: ReturnType<typeof instantiatePlanTemplate>) {
  const home = buildHome(document.spec);
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, CAMERA.aspect, 0.5, 2_000);
  camera.position.set(...CAMERA.position);
  camera.lookAt(...CAMERA.target);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  const world = new THREE.Box3();
  const projected = new THREE.Box2();
  let vertexCount = 0;
  const visit = (
    origin: readonly [number, number, number],
    rotationY: number,
    parts: ReturnType<typeof buildHome>["volumes"][number]["parts"],
  ) => {
    const transform = new THREE.Matrix4().makeRotationY(rotationY);
    transform.setPosition(...origin);
    for (const part of parts) {
      const positions = part.geometry.getAttribute("position");
      for (let index = 0; index < positions.count; index += 1) {
        const point = new THREE.Vector3(
          positions.getX(index),
          positions.getY(index),
          positions.getZ(index),
        ).applyMatrix4(transform);
        world.expandByPoint(point);
        const view = point.clone().project(camera);
        projected.expandByPoint(new THREE.Vector2(view.x, view.y));
        vertexCount += 1;
      }
    }
  };

  for (const volume of home.volumes) visit(volume.origin, volume.rotationY, volume.parts);
  if (home.deck) visit(home.deck.origin, home.deck.rotationY, home.deck.parts);

  const quantize = (value: number) => Number(value.toFixed(4));
  return {
    camera: CAMERA,
    worldBounds: [world.min.x, world.min.y, world.min.z, world.max.x, world.max.y, world.max.z].map(quantize),
    projectedBounds: [projected.min.x, projected.min.y, projected.max.x, projected.max.y].map(quantize),
    vertexCount,
  };
}

test("the preview exposes geometry proof metadata rather than only a document hash", () => {
  const componentPath = resolve(process.cwd(), "components/builder/PlanModelPreview.tsx");
  const source = readFileSync(componentPath, "utf8");

  expect(source).toContain("data-preview-geometry-signature");
  expect(source).toContain("data-preview-camera");
  expect(source).toContain("data-preview-projected-bounds");
});

test("three materially different plans have different fixed-camera silhouettes", () => {
  const proofs = IDS.map((id) => fixedCameraBounds(instantiatePlanTemplate(id)));
  const referenceCamera = JSON.stringify(proofs[0].camera);

  for (const proof of proofs) {
    expect(JSON.stringify(proof.camera)).toBe(referenceCamera);
    expect(proof.vertexCount).toBeGreaterThan(100);
    expect(proof.worldBounds.every(Number.isFinite)).toBe(true);
    expect(proof.projectedBounds.every(Number.isFinite)).toBe(true);
    expect(proof.projectedBounds[0]).toBeLessThan(proof.projectedBounds[2]);
    expect(proof.projectedBounds[1]).toBeLessThan(proof.projectedBounds[3]);
  }

  expect(new Set(proofs.map((proof) => proof.worldBounds.join(","))).size).toBe(IDS.length);
  expect(new Set(proofs.map((proof) => proof.projectedBounds.join(","))).size).toBe(IDS.length);
});

test("three plans remain visibly different through the same rendered camera and projection", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.goto("/build");
  await expect(page.getByRole("heading", { name: "Start from a plan, then make it yours." })).toBeVisible({ timeout: 60_000 });

  const captures: Array<{
    id: (typeof IDS)[number];
    bytes: Buffer;
    camera: string | null;
    projection: string | null;
    geometry: string | null;
    projectedBounds: string | null;
  }> = [];

  for (const id of IDS) {
    const title = TITLES[id];
    await page.getByRole("button", { name: new RegExp(`^${title}:`) }).click();
    const preview = page.locator(`[data-plan-model-preview="${id}"]`);
    await expect(preview).toHaveAttribute("data-preview-camera-mode", "fixed-comparison-v1");
    const canvas = preview.locator("canvas");
    await expect(canvas).toBeVisible();
    await page.evaluate(() => new Promise<void>((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()))));
    const bytes = await canvas.screenshot({ animations: "disabled" });
    await testInfo.attach(`${id}-fixed-camera.png`, { body: bytes, contentType: "image/png" });
    captures.push({
      id,
      bytes,
      camera: await preview.getAttribute("data-preview-render-camera"),
      projection: await preview.getAttribute("data-preview-render-projection"),
      geometry: await preview.getAttribute("data-preview-geometry-signature"),
      projectedBounds: await preview.getAttribute("data-preview-projected-bounds"),
    });
  }

  expect(new Set(captures.map(({ camera }) => camera))).toEqual(new Set(["72,44,92→0,9,0"]));
  expect(new Set(captures.map(({ projection }) => projection))).toEqual(new Set(["perspective:38/0.5/2000"]));
  expect(new Set(captures.map(({ geometry }) => geometry)).size).toBe(IDS.length);
  expect(new Set(captures.map(({ projectedBounds }) => projectedBounds)).size).toBe(IDS.length);
  expect(new Set(captures.map(({ bytes }) => createHash("sha256").update(bytes).digest("hex"))).size).toBe(IDS.length);

  const differences = await page.evaluate(async (encoded) => {
    const decode = async (base64: string) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("The proof browser could not create a 2D comparison context.");
      context.drawImage(image, 0, 0);
      return {
        width: canvas.width,
        height: canvas.height,
        pixels: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data),
      };
    };
    const decoded = await Promise.all(encoded.map(async (capture) => ({
      id: capture.id,
      image: await decode(capture.base64),
    })));
    const out: Array<{ pair: string; ratio: number }> = [];
    for (let left = 0; left < decoded.length; left += 1) {
      for (let right = left + 1; right < decoded.length; right += 1) {
        const a = decoded[left];
        const b = decoded[right];
        if (a.image.width !== b.image.width || a.image.height !== b.image.height) {
          throw new Error(`${a.id} and ${b.id} were not captured at one projection size.`);
        }
        let changed = 0;
        const pixelCount = a.image.width * a.image.height;
        for (let offset = 0; offset < a.image.pixels.length; offset += 4) {
          const rgbDelta =
            Math.abs(a.image.pixels[offset] - b.image.pixels[offset]) +
            Math.abs(a.image.pixels[offset + 1] - b.image.pixels[offset + 1]) +
            Math.abs(a.image.pixels[offset + 2] - b.image.pixels[offset + 2]);
          if (rgbDelta >= 48) changed += 1;
        }
        out.push({ pair: `${a.id} vs ${b.id}`, ratio: changed / pixelCount });
      }
    }
    return out;
  }, captures.map(({ id, bytes }) => ({ id, base64: bytes.toString("base64") })));

  /* A plan must change at least 2.5% of the rendered frame by a meaningful
     RGB delta. This is deliberately far above antialiasing noise and far
     below the measured plan-to-plan deltas, so it catches the former bug
     (every card kept showing one model) without becoming a GPU snapshot test. */
  for (const difference of differences) {
    expect(difference.ratio, `${difference.pair} rendered only ${(difference.ratio * 100).toFixed(2)}% different pixels`).toBeGreaterThan(0.025);
  }

  await testInfo.attach("fixed-camera-differences.json", {
    body: Buffer.from(`${JSON.stringify(differences, null, 2)}\n`),
    contentType: "application/json",
  });
});

test("a committed sourced template keeps canonical origin, cost basis, and licence evidence after reload", () => {
  const sourced = PLAN_TEMPLATES.filter((plan) => plan.source.kind !== "aura-authored").slice(0, 3);
  expect(sourced).toHaveLength(3);

  for (const plan of sourced) {
    const id = plan.id;
    const committed = instantiatePlanTemplate(id);
    const beforeHash = hashBuilderDocument(committed);
    const reloaded = validateBuilderDocument(JSON.parse(JSON.stringify(committed)));

    expect(reloaded.ok).toBe(true);
    if (!reloaded.ok) continue;

    expect(hashBuilderDocument(reloaded.document)).toBe(beforeHash);
    expect(reloaded.document.planOrigin).toEqual(committed.planOrigin);
    expect(reloaded.document.planOrigin?.templateId).toBe(id);
    expect(reloaded.document.planOrigin?.costBasis).toEqual(
      plan.costBasis ?? {
        status: "modelled",
        label: "Modelled Aura basis",
        note: "The range uses the material and systems selected in this editable concept.",
      },
    );
    expect(reloaded.document.spec.notes).toContain(plan.source.license);
    expect(reloaded.document.spec.notes).toContain(plan.source.licenseUrl);
    expect(reloaded.document.spec.notes).toContain(plan.source.url);
  }
});
