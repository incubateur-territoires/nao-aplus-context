import argon2 from "argon2";
import prisma from "@/lib/prisma";

async function resetAllPasswords() {
  console.log("🔑 Resetting all user passwords to default...\n");

  const devPassword = process.env.NEXT_PUBLIC_DEV_PASSWORD;
  if (!devPassword) {
    throw new Error(
      "NEXT_PUBLIC_DEV_PASSWORD manquant dans le .env — refus de poser un mot de passe vide",
    );
  }
  const hashedPassword = await argon2.hash(devPassword);

  const accounts = await prisma.account.findMany({
    where: {
      providerId: "credential",
    },
    include: { user: { select: { email: true } } },
  });

  console.log(`Found ${accounts.length} accounts to update\n`);

  let updated = 0;
  for (const account of accounts) {
    await prisma.account.update({
      where: { id: account.id },
      data: { password: hashedPassword },
    });
    updated++;
    if (updated % 50 === 0) {
      console.log(`  ... ${updated}/${accounts.length} updated`);
    }
  }

  console.log(`\n✅ ${updated} passwords reset to "${DEFAULT_PASSWORD}"`);
}

resetAllPasswords()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
