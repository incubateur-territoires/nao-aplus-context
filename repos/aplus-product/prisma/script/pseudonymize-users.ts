import * as argon2 from "argon2";
import prisma from "@/lib/prisma";
import {
  isFakeUser,
  getDefaultPassword,
  pseudonymizeUserRow,
} from "./anonymize-helpers";

export async function pseudonymizeUsers() {
  console.log("🔒 Pseudonymisation des utilisateurs...\n");

  const allUsers = await prisma.user.findMany({
    select: { id: true, email: true },
  });

  const users = allUsers.filter((u) => !isFakeUser(u.email));
  const skipped = allUsers.length - users.length;

  console.log(`   ${allUsers.length} utilisateurs trouvés`);
  console.log(`   ${skipped} utilisateurs de test ignorés`);
  console.log(`   ${users.length} utilisateurs à pseudonymiser\n`);

  const hashedPassword = await argon2.hash(getDefaultPassword());
  const usedEmails = new Set<string>();

  let updated = 0;
  let errors = 0;

  for (const user of users) {
    const { firstName, lastName, name, email } = pseudonymizeUserRow(
      user.email,
      usedEmails,
    );

    try {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { firstName, lastName, name, email },
        }),
        prisma.account.updateMany({
          where: { userId: user.id, providerId: "credential" },
          data: { accountId: email, password: hashedPassword },
        }),
      ]);

      updated++;
      console.log(`  ✓ ${user.email} → ${email}`);
    } catch (error) {
      errors++;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  ✗ ${user.email}: ${message}`);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ ${updated} utilisateur(s) pseudonymisé(s)`);
  if (errors > 0) {
    console.log(`❌ ${errors} erreur(s)`);
  }
  console.log(`🔑 Mot de passe commun: ${getDefaultPassword()}`);
}

// Run standalone
if (require.main === module) {
  pseudonymizeUsers()
    .catch((e) => {
      console.error("Erreur fatale:", e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
