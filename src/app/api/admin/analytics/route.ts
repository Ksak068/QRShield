import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [totalScans, totalUsers, scansByRisk, recentScans] = await Promise.all([
    prisma.scan.count(),
    prisma.user.count(),
    prisma.scan.groupBy({
      by: ["riskLevel"],
      _count: true,
    }),
    prisma.scan.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
      },
    }),
  ]);

  const scansByDay = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
    SELECT DATE(created_at) as date, COUNT(*)::int as count
    FROM "Scan"
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  const scansByMonth = await prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
    SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*)::int as count
    FROM "Scan"
    WHERE created_at >= NOW() - INTERVAL '12 months'
    GROUP BY TO_CHAR(created_at, 'YYYY-MM')
    ORDER BY month ASC
  `;

  const riskDistribution: Record<string, number> = {};
  for (const r of scansByRisk) {
    riskDistribution[r.riskLevel] = r._count;
  }

  return NextResponse.json({
    totalScans,
    totalUsers,
    riskDistribution,
    scansByDay: scansByDay.map((r) => ({
      date: typeof r.date === "string" ? r.date : String(r.date),
      count: Number(r.count),
    })),
    scansByMonth: scansByMonth.map((r) => ({
      month: typeof r.month === "string" ? r.month : String(r.month),
      count: Number(r.count),
    })),
    recentScans,
  });
}
