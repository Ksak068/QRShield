"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { notifyAdmins } from "@/lib/notifications";

export async function getUserScans(limit = 20, offset = 0) {
  const session = await auth();
  if (!session?.user?.id) return { scans: [], total: 0 };

  const [scans, total] = await Promise.all([
    prisma.scan.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.scan.count({ where: { userId: session.user.id } }),
  ]);

  return { scans, total };
}

export async function getDashboardStats() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const where = session.user.role === "ADMIN" ? {} : { userId: session.user.id };

  const [total, byRisk, recent] = await Promise.all([
    prisma.scan.count({ where }),
    prisma.scan.groupBy({
      by: ["riskLevel"],
      where,
      _count: true,
    }),
    prisma.scan.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const riskCounts = { SAFE: 0, SUSPICIOUS: 0, PHISHING: 0 };
  for (const r of byRisk) {
    riskCounts[r.riskLevel as keyof typeof riskCounts] = r._count;
  }

  return { total, ...riskCounts, recent };
}

export async function deleteScan(scanId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const scan = await prisma.scan.findUnique({ where: { id: scanId } });
  if (!scan) return { error: "Scan not found" };
  if (scan.userId !== session.user.id && session.user.role !== "ADMIN") {
    return { error: "Unauthorized" };
  }

  await prisma.scan.delete({ where: { id: scanId } });

  if (session.user.role === "ADMIN" && scan.userId !== session.user.id) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "scan.delete",
          details: { scanId, targetUserId: scan.userId, url: scan.extractedUrl },
        },
      });
      await notifyAdmins("scan.delete", "Scan Deleted by Admin", `A scan was deleted by an admin.`, `/admin`);
    } catch {
      // non-critical
    }
  }

  revalidatePath("/history");
  return { success: true };
}
