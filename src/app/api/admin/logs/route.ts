import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const offset = Number(searchParams.get("offset")) || 0;
  const type = searchParams.get("type"); // "api" | "audit" | null (both)
  const action = searchParams.get("action");
  const fromDate = searchParams.get("fromDate");
  const toDate = searchParams.get("toDate");

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (fromDate) dateFilter.gte = new Date(fromDate);
  if (toDate) dateFilter.lte = new Date(toDate + "T23:59:59");
  const hasDateFilter = fromDate || toDate;

  const [apiLogs, auditLogs, apiTotal, auditTotal] = await Promise.all([
    type !== "audit"
      ? prisma.apiLog.findMany({
          where: {
            ...(hasDateFilter ? { createdAt: dateFilter } : {}),
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        })
      : Promise.resolve([]),
    type !== "api"
      ? prisma.auditLog.findMany({
          where: {
            ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
            ...(hasDateFilter ? { createdAt: dateFilter } : {}),
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        })
      : Promise.resolve([]),
    type !== "audit"
      ? prisma.apiLog.count({
          where: {
            ...(hasDateFilter ? { createdAt: dateFilter } : {}),
          },
        })
      : Promise.resolve(0),
    type !== "api"
      ? prisma.auditLog.count({
          where: {
            ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
            ...(hasDateFilter ? { createdAt: dateFilter } : {}),
          },
        })
      : Promise.resolve(0),
  ]);

  const logs = [
    ...apiLogs.map((l) => ({ ...l, logType: "api" as const })),
    ...auditLogs.map((l) => ({ ...l, logType: "audit" as const })),
  ].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return NextResponse.json({
    logs,
    total: apiTotal + auditTotal,
  });
}
