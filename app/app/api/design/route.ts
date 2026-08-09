// Stub design API. Echoes the questionnaire back with a fixture brief.
// TODO: call the aura-architect pipeline (agent/) service here.

import { NextResponse } from "next/server";
import { designFixture } from "@/lib/fixtures";

export async function POST(request: Request) {
  let questionnaire: unknown = null;
  try {
    questionnaire = await request.json();
  } catch {
    // Body optional for the stub.
  }
  return NextResponse.json({ ...designFixture, questionnaire });
}

export async function GET() {
  return NextResponse.json(designFixture);
}
