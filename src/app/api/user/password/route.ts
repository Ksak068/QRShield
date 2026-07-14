import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current and new password are required" },
        { status: 400 },
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user?.passwordHash) {
      return NextResponse.json(
        { error: "Account has no password set" },
        { status: 400 },
      );
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 },
    );
  }
}
