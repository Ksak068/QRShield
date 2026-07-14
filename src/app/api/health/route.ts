import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    const vtKey = await prisma.setting.findUnique({
      where: { key: "VIRUSTOTAL_API_KEY" },
    });
    const orKey = await prisma.setting.findUnique({
      where: { key: "OPENROUTER_API_KEY" },
    });

    return NextResponse.json({
      status: "healthy",
      uptime: process.uptime(),
      dbConnected: true,
      vtConfigured: !!(vtKey?.value),
      orConfigured: !!(orKey?.value),
      responseTime: Date.now() - start,
    });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        uptime: process.uptime(),
        dbConnected: false,
        vtConfigured: false,
        orConfigured: false,
        responseTime: Date.now() - start,
      },
      { status: 503 },
    );
  }
}
