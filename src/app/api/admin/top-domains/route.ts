import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function extractDomain(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scans = await prisma.scan.findMany({
    where: { extractedUrl: { not: null } },
    select: { extractedUrl: true, riskScore: true, riskLevel: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const domainMap = new Map<
    string,
    { count: number; totalScore: number; riskLevels: Record<string, number> }
  >();

  for (const s of scans) {
    if (!s.extractedUrl) continue;
    const domain = extractDomain(s.extractedUrl);
    if (!domain) continue;

    const entry = domainMap.get(domain) || {
      count: 0,
      totalScore: 0,
      riskLevels: { SAFE: 0, SUSPICIOUS: 0, PHISHING: 0 },
    };
    entry.count++;
    entry.totalScore += s.riskScore || 0;
    entry.riskLevels[s.riskLevel] =
      (entry.riskLevels[s.riskLevel] || 0) + 1;
    domainMap.set(domain, entry);
  }

  const domains = Array.from(domainMap.entries())
    .map(([domain, data]) => ({
      domain,
      count: data.count,
      avgRiskScore: Math.round(data.totalScore / data.count),
      riskLevels: data.riskLevels,
    }))
    .sort((a, b) => b.avgRiskScore - a.avgRiskScore)
    .slice(0, 20);

  return NextResponse.json({ domains });
}
