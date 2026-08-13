import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const maxDuration = 30;

async function pingDatabase(): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    }
  }
  return false;
}

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();

  const dbConnected = await pingDatabase();

  return NextResponse.json(
    {
      status: dbConnected ? "healthy" : "degraded",
      uptime: process.uptime(),
      dbConnected,
      responseTime: Date.now() - start,
    },
    { status: dbConnected ? 200 : 503 },
  );
}
