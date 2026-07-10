import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("Admin@123456", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@qrshield.com" },
    update: {},
    create: {
      email: "admin@qrshield.com",
      name: "System Administrator",
      passwordHash: adminPassword,
      role: Role.ADMIN,
      emailVerified: new Date(),
    },
  });

  const corporatePassword = await bcrypt.hash("User@123456", 12);

  const corporate = await prisma.user.upsert({
    where: { email: "user@qrshield.com" },
    update: {},
    create: {
      email: "user@qrshield.com",
      name: "Corporate User",
      passwordHash: corporatePassword,
      role: Role.CORPORATE,
      emailVerified: new Date(),
    },
  });

  await prisma.setting.upsert({
    where: { key: "system_name" },
    update: {},
    create: {
      key: "system_name",
      value: "QR_Shield Enterprise",
    },
  });

  console.log("Seed completed:", { admin: admin.email, corporate: corporate.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
