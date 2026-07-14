import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name } = await request.json();
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { name: name.trim() },
    });

    return NextResponse.json({ name: updated.name });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 },
    );
  }
}
