import { expect, test } from "playwright/test";
import {
  APP_ROUTE_TRANSITION_SECONDS,
  APP_SCROLL_BEHAVIOR,
  DOCUMENT_REVEAL_SECONDS,
  DOCUMENT_STAGGER_SECONDS,
} from "@/lib/ui/motionPolicy";

test("ordinary app routes use native scrolling and short motion", () => {
  expect(APP_SCROLL_BEHAVIOR).toBe("native");
  expect(APP_ROUTE_TRANSITION_SECONDS).toBeGreaterThanOrEqual(0.18);
  expect(APP_ROUTE_TRANSITION_SECONDS).toBeLessThanOrEqual(0.22);
  expect(DOCUMENT_REVEAL_SECONDS).toBeLessThanOrEqual(0.25);
  expect(DOCUMENT_STAGGER_SECONDS).toBeLessThanOrEqual(0.05);
});
