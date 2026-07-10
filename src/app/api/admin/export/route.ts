import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "csv";

  const scans = await prisma.scan.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true } } },
  });

  if (format === "csv") {
    const headers = [
      "ID,Date,User,URL,Status,RiskScore,RiskLevel,VirusTotal,SafeBrowsing",
    ];
    const rows = scans.map(
      (s) =>
        `${s.id},${s.createdAt.toISOString()},${s.user?.email || "guest"},${s.extractedUrl || ""},${s.status},${s.riskScore ?? ""},${s.riskLevel},${s.vtDetected},${s.sbThreat}`,
    );
    const csv = [...headers, ...rows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="qr-shield-scans-${Date.now()}.csv"`,
      },
    });
  }

  return NextResponse.json(scans);
}
