import argon2 from "argon2";
import prisma from "@/lib/prisma";

const FAKE_DOMAINS = [
  "@administration.fr",
  "@mfs.fr",
  "@msa.fr",
  "@caf.fr",
  "@cpam.fr",
];

async function fixFakePasswords() {
  console.log("🔑 Fixing fake user passwords...\n");

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
      user: {
        OR: FAKE_DOMAINS.map((domain) => ({
          email: { endsWith: domain },
        })),
      },
    },
    include: { user: { select: { email: true } } },
  });

  console.log(`Found ${accounts.length} fake user accounts\n`);

  for (const account of accounts) {
    await prisma.account.update({
      where: { id: account.id },
      data: { password: hashedPassword },
    });
    console.log(`  ✓ ${account.user.email}`);
  }

  console.log(`\n✅ ${accounts.length} passwords updated (argon2)`);
}

fixFakePasswords()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
