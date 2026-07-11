import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runScanPipeline } from "@/services/scan-pipeline";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, logRequest } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "127.0.0.1";
  const startTime = Date.now();

  const { allowed, remaining } = await checkRateLimit(ip, "scan");
  if (!allowed) {
    await logRequest({
      endpoint: "/api/scan",
      method: "POST",
      userId,
      status: 429,
      duration: Date.now() - startTime,
      ip,
    });
    return NextResponse.json(
      { error: "Too many requests. Please wait before scanning again.", remaining },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const { qrContent, qrImage } = body;

    if (!qrContent || typeof qrContent !== "string") {
      return NextResponse.json(
        { error: "QR content is required" },
        { status: 400 },
      );
    }

    const result = await runScanPipeline(qrContent, qrImage || null, userId);

    await logRequest({
      endpoint: "/api/scan",
      method: "POST",
      userId,
      status: 200,
      duration: Date.now() - startTime,
      ip,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Scan failed:", error);

    await logRequest({
      endpoint: "/api/scan",
      method: "POST",
      userId,
      status: 500,
      duration: Date.now() - startTime,
      ip,
    });

    return NextResponse.json(
      { error: "Scan processing failed" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
  const offset = Number(searchParams.get("offset")) || 0;

  const isAdmin = session.user.role === "ADMIN";

  const scans = await prisma.scan.findMany({
    where: isAdmin ? {} : { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const total = await prisma.scan.count({
    where: isAdmin ? {} : { userId: session.user.id },
  });

  return NextResponse.json({ scans, total });
}
