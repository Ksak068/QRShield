import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runScanPipeline } from "@/services/scan-pipeline";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;

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

    return NextResponse.json(result);
  } catch (error) {
    console.error("Scan failed:", error);
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
