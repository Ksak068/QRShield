import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { userId, action } = await request.json();

    if (!userId || !["suspend", "unsuspend", "delete", "set-admin"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (userId === session.user.id) {
      return NextResponse.json(
        { error: "Cannot modify yourself" },
        { status: 400 },
      );
    }

    switch (action) {
      case "suspend":
        await prisma.user.update({
          where: { id: userId },
          data: { isSuspended: true },
        });
        break;
      case "unsuspend":
        await prisma.user.update({
          where: { id: userId },
          data: { isSuspended: false },
        });
        break;
      case "delete":
        await prisma.user.delete({ where: { id: userId } });
        break;
      case "set-admin":
        await prisma.user.update({
          where: { id: userId },
          data: { role: "ADMIN" },
        });
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
