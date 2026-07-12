"use server";

import { prisma } from "@/lib/prisma";
import { signOut } from "@/lib/auth";
import { registerSchema } from "@/validations/auth";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { checkRateLimit, logRequest } from "@/lib/rate-limit";

async function getIpFromHeaders(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim()
    || h.get("x-real-ip")
    || "127.0.0.1";
}

export async function registerUser(formData: FormData) {
  const ip = await getIpFromHeaders();
  const startTime = Date.now();

  const { allowed } = await checkRateLimit(ip, "auth");
  if (!allowed) {
    return { error: "Too many attempts. Please wait before trying again." };
  }

  const raw = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
    role: formData.get("role") as "CORPORATE" | "ADMIN" || "CORPORATE",
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid input", issues: parsed.error.flatten().fieldErrors };
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (existing) {
    return { error: "Email already registered" };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
    },
  });

  await logRequest({
    endpoint: "auth/register",
    method: "POST",
    status: 200,
    duration: Date.now() - startTime,
    ip,
  });

  return { success: true };
}

export async function logoutUser() {
  await signOut({ redirectTo: "/" });
}
