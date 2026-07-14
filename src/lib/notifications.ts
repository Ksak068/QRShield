import { prisma } from "@/lib/prisma";

type NotificationType = "user.suspend" | "user.unsuspend" | "user.delete" | "user.promote" | "user.demote" | "scan.delete" | "scan.phishing" | "scan.suspicious" | "user.registered";

export async function createNotification(
  type: NotificationType,
  title: string,
  message: string,
  link?: string,
  userId?: string,
) {
  try {
    await prisma.notification.create({
      data: { type, title, message, link, userId },
    });
  } catch {
    // non-critical
  }
}

export async function notifyAdmins(
  type: NotificationType,
  title: string,
  message: string,
  link?: string,
) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type,
        title,
        message,
        link,
      })),
    });
  } catch {
    // non-critical
  }
}
