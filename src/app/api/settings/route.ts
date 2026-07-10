import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_KEYS = ["system_name", "VIRUSTOTAL_API_KEY", "OPENAI_API_KEY", "OPENROUTER_FALLBACK_MODEL"];

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.setting.findMany({
    where: { key: { in: ALLOWED_KEYS } },
  });

  const result: Record<string, string> = {};
  for (const s of settings) {
    result[s.key] = s.key.includes("API_KEY")
      ? s.value ? s.value.slice(0, 8) + "..." : ""
      : s.value;
  }

  return NextResponse.json(result);
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_KEYS.includes(key) && typeof value === "string") {
        await prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
}
