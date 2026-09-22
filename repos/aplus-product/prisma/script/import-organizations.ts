import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { $Enums, Prisma } from "@/generated/prisma/client";
import { TeamType } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { fetchOrganizations as fetchOrganizationsFromSource } from "./source-queries";

// ============================================
// CSV MAPPING (organisation.csv)
// ============================================
const CATEGORY_TO_TEAM_TYPE: Record<string, TeamType> = {
  "France Services": TeamType.FRANCE_SERVICE,
  Opérateurs: TeamType.OPERATOR,
  "Travailleurs sociaux historiques": TeamType.HISTORICAL_SOCIAL_WORKER,
};

interface OrgCsvEntry {
  role: $Enums.OrganizationRole;
  type: TeamType;
}

function loadOrganizationCsv(): Map<string, OrgCsvEntry> {
  const csvPath = path.join(__dirname, "..", "data", "organisation.csv");
  const content = fs.readFileSync(csvPath, "utf-8");
  const map = new Map<string, OrgCsvEntry>();

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [shortName, category, , role] = trimmed.split(";");

    const teamType = CATEGORY_TO_TEAM_TYPE[category];
    if (!teamType) {
      throw new Error(
        `Catégorie inconnue "${category}" pour l'organisation "${shortName}" dans le CSV`,
      );
    }

    const orgRole = role.toUpperCase() as $Enums.OrganizationRole;
    if (orgRole !== "OPERATOR" && orgRole !== "HELPER") {
      throw new Error(
        `Rôle invalide "${role}" pour l'organisation "${shortName}" dans le CSV`,
      );
    }

    map.set(shortName, { role: orgRole, type: teamType });
  }

  return map;
}

// ============================================
// SPECIFIC FIELDS CONFIG
// ============================================
const caf: Prisma.TeamSpecificFieldCreateInput = {
  name: "caf",
  label: "Identifiant CAF",
  hintText: "7 chiffres",
  errorMessage: "Veuillez saisir l'identifiant CAF du citoyen (7 chiffres).",
};

const nir: Prisma.TeamSpecificFieldCreateInput = {
  name: "nir",
  label: "Numéro de sécurité sociale NIR",
  hintText: "13 ou 15 chiffres",
  errorMessage:
    "Veuillez saisir le numéro de sécurité sociale NIR du citoyen (13 ou 15 caractères). ",
};

const nif: Prisma.TeamSpecificFieldCreateInput = {
  name: "nif",
  label: "Numéro d'immatriculation fiscal",
  hintText: "13 chiffres",
  errorMessage:
    "Veuillez saisir le numéro d'immatriculation fiscal du citoyen (15 chiffres). ",
};

const CAF_STRUCTURE_ID = ["CAF"];
// La CAF ne demande plus le NIR (demande de la pilote nationale Caf) :
// seul l'identifiant CAF est collecté. Le script ne fait que `connect`,
// le lien existant est retiré par la migration detach_nir_from_caf.
const NIR_STRUCTURE_ID = ["CARSAT", "CNAM", "CNAV", "CPAM", "CRAM", "MSA"];
const NIF_STRUCTURE_ID = ["Chèque énergie", "DDFIP", "DRFIP"];

// ============================================
// TAG MAPPING
// ============================================
const TAG_NAMES = [
  "Papiers / Titres",
  "Social / Famille",
  "Emploi / Formation",
  "Logement",
  "Retraite",
  "Impôts / Argent",
  "Juridique",
  "Adresse / Courrier",
  "Gestion d'entreprise",
  "Santé / Handicap",
];

const TAG_MAPPING: Record<string, string[]> = {
  ANAH: ["Logement"],
  ANTS: ["Papiers / Titres"],
  CAF: ["Social / Famille", "Logement"],
  CARSAT: ["Retraite"],
  CCAS: ["Social / Famille"],
  CDAD: ["Juridique"],
  "Chèque énergie": ["Impôts / Argent"],
  CNAM: ["Santé / Handicap"],
  CNAV: ["Retraite"],
  CPAM: ["Santé / Handicap"],
  CRAM: ["Santé / Handicap"],
  DDFIP: ["Impôts / Argent"],
  DRFIP: ["Impôts / Argent"],
  "France Rénov'": ["Logement"],
  "France Travail": ["Emploi / Formation"],
  Hôpital: ["Santé / Handicap"],
  "La Poste": ["Adresse / Courrier"],
  MDPH: ["Santé / Handicap"],
  "Mission locale": ["Emploi / Formation"],
  MSA: ["Social / Famille", "Santé / Handicap", "Retraite", "Logement"],
  OFPRA: ["Papiers / Titres"],
  Préf: ["Logement", "Papiers / Titres"],
  "Sous-Préf": ["Papiers / Titres"],
  URSSAF: ["Gestion d'entreprise"],
};

// ============================================
// MAIN EXPORT
// ============================================
export async function importOrganizations() {
  console.log("\n🏢 Importing organizations...");

  const csvMapping = loadOrganizationCsv();
  console.log(`  📋 Loaded ${csvMapping.size} organization entries from CSV`);

  const rows = await fetchOrganizationsFromSource();
  const orgsData = rows
    .filter((r) => r.id_v1 && r.shortName && r.name)
    .map((r) => {
      const csvEntry = csvMapping.get(r.shortName);
      if (!csvEntry) {
        throw new Error(
          `Organisation "${r.shortName}" (id_v1: ${r.id_v1}) n'a pas de correspondance dans le CSV organisation.csv`,
        );
      }
      return {
        id_v1: r.id_v1,
        shortName: r.shortName,
        name: r.name,
        role: csvEntry.role,
        type: csvEntry.type,
      };
    });

  // Batch upsert organizations
  console.log(`  Processing ${orgsData.length} organizations in batch...`);
  await prisma.$transaction(
    orgsData.map((org) =>
      prisma.organization.upsert({
        where: { shortName: org.shortName },
        update: {
          id_v1: org.id_v1,
          name: org.name,
          role: org.role,
          type: org.type,
        },
        create: org,
      }),
    ),
  );

  // 2. Create specific fields in batch
  console.log("\n🔧 Creating specific fields...");
  const [cafField, nirField, nifField] = await prisma.$transaction([
    prisma.teamSpecificField.upsert({
      where: { id: "caf" },
      update: caf,
      create: { id: "caf", ...caf },
    }),
    prisma.teamSpecificField.upsert({
      where: { id: "nir" },
      update: nir,
      create: { id: "nir", ...nir },
    }),
    prisma.teamSpecificField.upsert({
      where: { id: "nif" },
      update: nif,
      create: { id: "nif", ...nif },
    }),
  ]);

  // 3. Connect fields to organizations in batch
  const allOrgs = await prisma.organization.findMany();

  const fieldUpdates = allOrgs
    .map((org) => {
      const fieldsToConnect = [];
      if (CAF_STRUCTURE_ID.includes(org.shortName))
        fieldsToConnect.push(cafField);
      if (NIR_STRUCTURE_ID.includes(org.shortName))
        fieldsToConnect.push(nirField);
      if (NIF_STRUCTURE_ID.includes(org.shortName))
        fieldsToConnect.push(nifField);

      if (fieldsToConnect.length > 0) {
        return prisma.organization.update({
          where: { id: org.id },
          data: {
            specificFields: {
              connect: fieldsToConnect.map((f) => ({ id: f.id })),
            },
          },
        });
      }
      return null;
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);

  if (fieldUpdates.length > 0) {
    await prisma.$transaction(fieldUpdates);
  }
  console.log("✅ Specific fields connected");

  // 4. Create tags in batch
  console.log("\n🏷️  Creating tags...");
  await prisma.$transaction(
    TAG_NAMES.map((name) =>
      prisma.organizationTag.upsert({
        where: { name },
        update: { name },
        create: { name },
      }),
    ),
  );

  // 5. Connect tags to organizations in batch
  const allTags = await prisma.organizationTag.findMany();

  const tagUpdates = allOrgs
    .map((org) => {
      const tagNamesToConnect = TAG_MAPPING[org.shortName];
      if (tagNamesToConnect) {
        const tagsToConnect = allTags.filter((t) =>
          tagNamesToConnect.includes(t.name),
        );
        return prisma.organization.update({
          where: { id: org.id },
          data: {
            tags: { connect: tagsToConnect.map((t) => ({ id: t.id })) },
          },
        });
      }
      return null;
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);

  if (tagUpdates.length > 0) {
    await prisma.$transaction(tagUpdates);
  }

  console.log("✅ Organizations imported with tags and specific fields");

  return { total: orgsData.length };
}

// Run standalone
if (require.main === module) {
  importOrganizations()
    .catch((e) => {
      console.error("Error importing organizations:", e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
