import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
  const offset = Number(searchParams.get("offset")) || 0;
  const unreadOnly = searchParams.get("unread") === "true";

  const where: any = { userId: session.user.id };
  if (unreadOnly) where.read = false;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where: { userId: session.user.id } }),
    prisma.notification.count({
      where: { userId: session.user.id, read: false },
    }),
  ]);

  return NextResponse.json({ notifications, total, unreadCount });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { ids, all } = await request.json();

    if (all) {
      await prisma.notification.updateMany({
        where: { userId: session.user.id, read: false },
        data: { read: true },
      });
    } else if (Array.isArray(ids) && ids.length > 0) {
      await prisma.notification.updateMany({
        where: { id: { in: ids }, userId: session.user.id },
        data: { read: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 },
    );
  }
}
