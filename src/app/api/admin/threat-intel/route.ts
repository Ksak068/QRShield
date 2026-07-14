import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [totalScans, phishingCount, suspiciousCount, recentThreats, vtHits] =
    await Promise.all([
      prisma.scan.count(),
      prisma.scan.count({ where: { riskLevel: "PHISHING" } }),
      prisma.scan.count({ where: { riskLevel: "SUSPICIOUS" } }),
      prisma.scan.findMany({
        where: { riskLevel: { in: ["PHISHING", "SUSPICIOUS"] } },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { email: true } } },
      }),
      prisma.scan.count({ where: { vtDetected: true } }),
    ]);

  const scanRateLastHour = await prisma.apiLog.count({
    where: {
      endpoint: { startsWith: "/api/scan" },
      createdAt: { gte: new Date(Date.now() - 3600_000) },
    },
  });

  return NextResponse.json({
    totalScans,
    phishingCount,
    suspiciousCount,
    threatRate: totalScans > 0
      ? Math.round(((phishingCount + suspiciousCount) / totalScans) * 100)
      : 0,
    vtHits,
    scanRateLastHour,
    recentThreats: recentThreats.map((s) => ({
      id: s.id,
      url: s.extractedUrl,
      riskLevel: s.riskLevel,
      riskScore: s.riskScore,
      userEmail: s.user?.email || "anonymous",
      createdAt: s.createdAt,
    })),
  });
}
