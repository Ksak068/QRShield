import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyAdmins } from "@/lib/notifications";

async function logAudit(
  adminId: string,
  action: string,
  details: Prisma.InputJsonValue,
  ip?: string,
) {
  try {
    await prisma.auditLog.create({
      data: { userId: adminId, action, details, ip },
    });
  } catch {
    // audit logging never crashes the request
  }
}

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isSuspended: true,
      emailVerified: true,
      createdAt: true,
      _count: { select: { scans: true } },
    },
  });

  return NextResponse.json(users);
}

async function getTargetEmail(userId: string): Promise<string> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email || "unknown";
  } catch {
    return "unknown";
  }
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  try {
    const { userId, action } = await request.json();

    if (
      !userId ||
      !["suspend", "unsuspend", "delete", "set-admin", "set-corporate"].includes(
        action,
      )
    ) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (userId === session.user.id) {
      return NextResponse.json(
        { error: "Cannot modify yourself" },
        { status: 400 },
      );
    }

    const targetEmail = await getTargetEmail(userId);

    switch (action) {
      case "suspend":
        await prisma.user.update({
          where: { id: userId },
          data: { isSuspended: true },
        });
        await logAudit(session.user.id, "user.suspend", { userId, email: targetEmail }, ip);
        await notifyAdmins("user.suspend", "User Suspended", `${targetEmail} was suspended by an admin.`);
        break;
      case "unsuspend":
        await prisma.user.update({
          where: { id: userId },
          data: { isSuspended: false },
        });
        await logAudit(session.user.id, "user.unsuspend", { userId, email: targetEmail }, ip);
        await notifyAdmins("user.unsuspend", "User Unsuspended", `${targetEmail} was unsuspended.`);
        break;
      case "delete":
        await prisma.user.delete({ where: { id: userId } });
        await logAudit(session.user.id, "user.delete", { userId, email: targetEmail }, ip);
        await notifyAdmins("user.delete", "User Deleted", `${targetEmail} was deleted.`);
        break;
      case "set-admin":
        await prisma.user.update({
          where: { id: userId },
          data: { role: "ADMIN" },
        });
        await logAudit(session.user.id, "user.promote", { userId, email: targetEmail }, ip);
        await notifyAdmins("user.promote", "User Promoted", `${targetEmail} was granted admin role.`);
        break;
      case "set-corporate":
        await prisma.user.update({
          where: { id: userId },
          data: { role: "CORPORATE" },
        });
        await logAudit(session.user.id, "user.demote", { userId, email: targetEmail }, ip);
        await notifyAdmins("user.demote", "User Demoted", `${targetEmail} was changed to corporate role.`);
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 },
    );
  }
}
