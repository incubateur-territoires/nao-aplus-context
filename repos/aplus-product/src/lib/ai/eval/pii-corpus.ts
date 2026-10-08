import type { CitizenIdentity } from "@/types/ai-pipeline";

/**
 * Corpus d'évaluation du caviardage. Textes FABRIQUÉS : le dépôt est public,
 * aucune donnée réelle n'y entre. Adresses en domaines réservés (RFC 2606).
 *
 * `mustPreserve` compte autant que `mustRedact` : sans lui, caviarder tout
 * donnerait un rappel parfait et un corpus détruit.
 *
 * Les noms couvrent des morphologies variées — apostrophe, particule, tiret,
 * diacritique, nom court, homonymie avec un mot courant — parce que c'est là que
 * le dictionnaire et le LLM échouent, chacun à sa manière.
 */

export const PII_CATEGORIES = {
  NIR: "NIR",
  CAF: "CAF",
  NIF: "NIF",
  PHONE: "PHONE",
  EMAIL: "EMAIL",
  BIRTH_DATE: "BIRTH_DATE",
  IBAN: "IBAN",
  CASE_NUMBER: "CASE_NUMBER",
  CITIZEN_NAME: "CITIZEN_NAME",
  PARTICIPANT_NAME: "PARTICIPANT_NAME",
  THIRD_PARTY_NAME: "THIRD_PARTY_NAME",
  ADDRESS: "ADDRESS",
} as const;

export type PiiCategory = (typeof PII_CATEGORIES)[keyof typeof PII_CATEGORIES];

export const DETECTION_LAYERS = {
  /** Attrapable sans réseau : motif fixe, ou valeur connue en base. */
  DETERMINISTIC: "DETERMINISTIC",
  /** Ne se déduit que du contexte : demande la couche B, puis le juge. */
  LLM: "LLM",
} as const;

export type DetectionLayer =
  (typeof DETECTION_LAYERS)[keyof typeof DETECTION_LAYERS];

export interface ExpectedPii {
  category: PiiCategory;
  layer: DetectionLayer;
  /** Valeur telle qu'écrite dans le texte, au grain atomique. */
  value: string;
  /**
   * Seule la forme capitalisée est une PII : le nom est aussi un mot courant,
   * dont l'emploi en minuscules doit survivre.
   */
  matchCase?: boolean;
}

export interface PiiEvalCase {
  label: string;
  text: string;
  /** Identité du citoyen, connue via l'enregistrement Report. */
  identity?: CitizenIdentity;
  /** Date de naissance du citoyen, connue via `Report.birthDate`. */
  birthDate?: string;
  /** Noms des participants au fil, connus via `User.firstName`/`lastName`. */
  participantNames?: string[];
  mustRedact: ExpectedPii[];
  mustPreserve: string[];
}

/** Une PII que la couche A laisse passer aujourd'hui, et pourquoi. */
export interface KnownGap {
  /** `label` du cas concerné. */
  case: string;
  /** `value` de l'attente non caviardée. */
  value: string;
  reason: string;
}

/**
 * Dette, pas tolérance : le spec vérifie que chaque entrée est ENCORE en échec,
 * donc combler un trou rougit le test et force à retirer la ligne.
 */
export const KNOWN_DETERMINISTIC_GAPS: KnownGap[] = [];

/** Un fragment de sens que la couche A détruit aujourd'hui, et pourquoi. */
export interface KnownOverRedaction {
  /** `label` du cas concerné. */
  case: string;
  /** `mustPreserve` que le caviardage mange. */
  fragment: string;
  reason: string;
}

/** Pendant de `KNOWN_DETERMINISTIC_GAPS` côté précision, même discipline. */
export const KNOWN_OVER_REDACTIONS: KnownOverRedaction[] = [];

const CITIZEN: CitizenIdentity = {
  firstName: "Karim",
  lastName: "Benali",
};

function thirdParty(value: string, matchCase?: boolean): ExpectedPii {
  return {
    category: PII_CATEGORIES.THIRD_PARTY_NAME,
    layer: DETECTION_LAYERS.LLM,
    value,
    ...(matchCase ? { matchCase } : {}),
  };
}

function address(value: string): ExpectedPii {
  return {
    category: PII_CATEGORIES.ADDRESS,
    layer: DETECTION_LAYERS.LLM,
    value,
  };
}

function citizenName(value: string): ExpectedPii {
  return {
    category: PII_CATEGORIES.CITIZEN_NAME,
    layer: DETECTION_LAYERS.DETERMINISTIC,
    value,
  };
}

export const PII_EVAL_CASES: PiiEvalCase[] = [
  {
    label: "NIR compact",
    text: "Le numéro de sécurité sociale 184017511620716 ne remonte pas dans le dossier.",
    mustRedact: [
      {
        category: PII_CATEGORIES.NIR,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "184017511620716",
      },
    ],
    mustPreserve: ["numéro de sécurité sociale", "ne remonte pas"],
  },
  {
    label: "NIR espacé",
    text: "NIR communiqué par l'usager : 1 84 01 75 116 207 16.",
    mustRedact: [
      {
        category: PII_CATEGORIES.NIR,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "1 84 01 75 116 207 16",
      },
    ],
    mustPreserve: ["NIR communiqué par l'usager"],
  },
  {
    label: "identifiant CAF à 7 chiffres",
    text: "Identifiant allocataire 4821937, radiation notifiée sans motif.",
    mustRedact: [
      {
        category: PII_CATEGORIES.CAF,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "4821937",
      },
    ],
    mustPreserve: ["Identifiant allocataire", "radiation notifiée sans motif"],
  },
  {
    label: "numéro fiscal à 13 chiffres",
    text: "Le numéro fiscal de référence 2704918365420 est rejeté à la saisie.",
    mustRedact: [
      {
        category: PII_CATEGORIES.NIF,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "2704918365420",
      },
    ],
    mustPreserve: ["numéro fiscal de référence", "rejeté à la saisie"],
  },
  {
    label: "téléphone, trois écritures du même numéro",
    text: "Joignable au 0612345678, sinon au 06 12 34 56 78 ou 06.12.34.56.78.",
    mustRedact: [
      {
        category: PII_CATEGORIES.PHONE,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "0612345678",
      },
    ],
    mustPreserve: ["Joignable au"],
  },
  {
    label: "adresse e-mail dans le corps du texte",
    text: "Les relances envoyées à h.vasseur@example.org restent sans réponse.",
    mustRedact: [
      {
        category: PII_CATEGORIES.EMAIL,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "h.vasseur@example.org",
      },
    ],
    mustPreserve: ["Les relances envoyées à", "restent sans réponse"],
  },
  {
    label: "adresse e-mail en signature de réponse",
    text: "Le dossier est débloqué. Pour la suite : accueil.antenne@example.com",
    mustRedact: [
      {
        category: PII_CATEGORIES.EMAIL,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "accueil.antenne@example.com",
      },
    ],
    mustPreserve: ["Le dossier est débloqué"],
  },
  {
    label: "date de naissance au format français",
    text: "Usager né le 12/01/1984, droits suspendus depuis la révision annuelle.",
    birthDate: "12/01/1984",
    mustRedact: [
      {
        category: PII_CATEGORIES.BIRTH_DATE,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "12/01/1984",
      },
    ],
    mustPreserve: ["droits suspendus", "révision annuelle"],
  },
  {
    label: "date de naissance au format ISO",
    text: "État civil transmis : naissance 1984-01-12, pièce jointe illisible.",
    birthDate: "1984-01-12",
    mustRedact: [
      {
        category: PII_CATEGORIES.BIRTH_DATE,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "1984-01-12",
      },
    ],
    mustPreserve: ["État civil transmis", "pièce jointe illisible"],
  },
  {
    label: "date de naissance en toutes lettres",
    text: "Né le 12 janvier 1984, l'usager conteste le calcul de ses trimestres.",
    birthDate: "12/01/1984",
    mustRedact: [
      {
        category: PII_CATEGORIES.BIRTH_DATE,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "12 janvier 1984",
      },
    ],
    mustPreserve: ["conteste le calcul de ses trimestres"],
  },
  {
    label: "IBAN",
    text: "Le virement part sur FR7630006000011234567890189 au lieu du compte courant.",
    mustRedact: [
      {
        category: PII_CATEGORIES.IBAN,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "FR7630006000011234567890189",
      },
    ],
    mustPreserve: ["Le virement part sur", "au lieu du compte courant"],
  },
  {
    label: "numéro de dossier alphanumérique",
    text: "Dossier AB123456 clos par erreur par le service instructeur.",
    mustRedact: [
      {
        category: PII_CATEGORIES.CASE_NUMBER,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "AB123456",
      },
    ],
    mustPreserve: ["clos par erreur", "service instructeur"],
  },
  {
    label: "nom du citoyen, prénom et nom",
    text: "Hélène Vasseur n'a reçu aucune notification depuis la révision.",
    identity: { firstName: "Hélène", lastName: "Vasseur" },
    mustRedact: [
      {
        category: PII_CATEGORIES.CITIZEN_NAME,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "Hélène Vasseur",
      },
    ],
    mustPreserve: ["n'a reçu aucune notification"],
  },
  {
    label: "nom du citoyen en minuscules et sans accent",
    text: "monsieur benali a déposé sa demande en janvier, sans accusé de réception.",
    identity: { firstName: "Karim", lastName: "Bénali" },
    mustRedact: [
      {
        category: PII_CATEGORIES.CITIZEN_NAME,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "benali",
      },
    ],
    mustPreserve: ["a déposé sa demande en janvier", "accusé de réception"],
  },
  {
    label: "nom marital du citoyen",
    text: "Le dossier est encore au nom de Lefranc, alors que le divorce est prononcé.",
    identity: { ...CITIZEN, maritalName: "Lefranc" },
    mustRedact: [
      {
        category: PII_CATEGORIES.CITIZEN_NAME,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "Lefranc",
      },
    ],
    mustPreserve: ["le divorce est prononcé"],
  },
  {
    label: "signature d'agent en fin de réponse",
    text: "Votre dossier est débloqué, le rappel sera versé en mars. Cordialement, Youssef Amrani, Caf du Rhône.",
    participantNames: ["Youssef Amrani"],
    mustRedact: [
      {
        category: PII_CATEGORIES.PARTICIPANT_NAME,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "Youssef Amrani",
      },
    ],
    mustPreserve: ["le rappel sera versé en mars", "Caf du Rhône"],
  },
  {
    label: "aidant cité dans le fil",
    text: "Comme convenu avec Sophie Marchand lors de l'entretien, la pièce manquante a été transmise.",
    participantNames: ["Sophie Marchand"],
    mustRedact: [
      {
        category: PII_CATEGORIES.PARTICIPANT_NAME,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "Sophie Marchand",
      },
    ],
    mustPreserve: ["lors de l'entretien", "la pièce manquante a été transmise"],
  },
  {
    label: "tiers cité en texte libre, inconnu de la base",
    text: "Son employeuse, Elena Petrescu, refuse de fournir l'attestation de salaire.",
    identity: CITIZEN,
    mustRedact: [
      {
        category: PII_CATEGORIES.THIRD_PARTY_NAME,
        layer: DETECTION_LAYERS.LLM,
        value: "Elena Petrescu",
      },
    ],
    mustPreserve: ["Son employeuse", "attestation de salaire"],
  },
  {
    label: "adresse postale",
    text: "Le courrier part toujours au 14 allée des Cerisiers, ancienne adresse.",
    mustRedact: [
      {
        category: PII_CATEGORIES.ADDRESS,
        layer: DETECTION_LAYERS.LLM,
        value: "allée des Cerisiers",
      },
    ],
    mustPreserve: ["Le courrier part toujours", "ancienne adresse"],
  },
  {
    label: "chiffres porteurs de sens, rien à caviarder",
    text: "Bloqué depuis 8 mois, RSA de 600 euros non versé, 3 enfants à charge. Dossier ouvert en 2023, relance le 12/01/2024 sans réponse.",
    mustRedact: [],
    mustPreserve: [
      "Bloqué depuis 8 mois",
      "600 euros",
      "3 enfants à charge",
      "Dossier ouvert en 2023",
      "relance le 12/01/2024",
    ],
  },
  {
    label: "signalement complet, plusieurs PII mêlées",
    text: "Karim Benali, né le 12/01/1984, allocataire 4821937, signale que son RSA de 600 euros n'est plus versé depuis 8 mois. Joignable au 06 12 34 56 78 ou à karim.benali@example.org. Sa sœur Amina Benali l'accompagne dans les démarches.",
    identity: CITIZEN,
    birthDate: "12/01/1984",
    mustRedact: [
      {
        category: PII_CATEGORIES.CITIZEN_NAME,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "Karim Benali",
      },
      {
        category: PII_CATEGORIES.BIRTH_DATE,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "12/01/1984",
      },
      {
        category: PII_CATEGORIES.CAF,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "4821937",
      },
      {
        category: PII_CATEGORIES.PHONE,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "06 12 34 56 78",
      },
      {
        category: PII_CATEGORIES.EMAIL,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "karim.benali@example.org",
      },
      {
        category: PII_CATEGORIES.THIRD_PARTY_NAME,
        layer: DETECTION_LAYERS.LLM,
        value: "Amina",
      },
    ],
    mustPreserve: [
      "RSA de 600 euros",
      "n'est plus versé depuis 8 mois",
      "l'accompagne dans les démarches",
    ],
  },
  {
    label: "réponse d'opérateur, PII de l'agent et du citoyen mêlées",
    text: "Bonjour, après vérification le dossier de Thomas Berger était suspendu pour pièce manquante. Le versement reprendra le mois prochain. Fatoumata Diallo, 0478123456.",
    identity: { firstName: "Thomas", lastName: "Berger" },
    participantNames: ["Fatoumata Diallo"],
    mustRedact: [
      {
        category: PII_CATEGORIES.CITIZEN_NAME,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "Thomas Berger",
      },
      {
        category: PII_CATEGORIES.PARTICIPANT_NAME,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "Fatoumata Diallo",
      },
      {
        category: PII_CATEGORIES.PHONE,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "0478123456",
      },
    ],
    mustPreserve: [
      "suspendu pour pièce manquante",
      "Le versement reprendra le mois prochain",
    ],
  },
  {
    label: "nom à apostrophe, écrit aussi sans",
    text: "J'ai eu Awa N'Diaye au téléphone. Mme Ndiaye a confirmé que le dossier repart.",
    participantNames: ["Awa N'Diaye"],
    mustRedact: [
      {
        category: PII_CATEGORIES.PARTICIPANT_NAME,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "Awa N'Diaye",
      },
      {
        category: PII_CATEGORIES.PARTICIPANT_NAME,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "Ndiaye",
      },
    ],
    mustPreserve: ["au téléphone", "a confirmé que le dossier repart"],
  },
  {
    label: "nom composé, cité ensuite par sa seule seconde partie",
    text: "Anne-Marie Nguyen-Legrand n'a pas reçu son attestation. Mme Legrand relance depuis mars.",
    identity: { firstName: "Anne-Marie", lastName: "Nguyen-Legrand" },
    mustRedact: [
      {
        category: PII_CATEGORIES.CITIZEN_NAME,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "Anne-Marie Nguyen-Legrand",
      },
      {
        category: PII_CATEGORIES.CITIZEN_NAME,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "Legrand",
      },
    ],
    mustPreserve: ["n'a pas reçu son attestation", "relance depuis mars"],
  },
  {
    label: "nom à particule",
    text: "Le versement de la prime d'activité est suspendu depuis la révision de décembre. Marc de Vaucelles, France Services.",
    participantNames: ["Marc de Vaucelles"],
    mustRedact: [
      {
        category: PII_CATEGORIES.PARTICIPANT_NAME,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "Marc",
      },
      {
        category: PII_CATEGORIES.PARTICIPANT_NAME,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "Vaucelles",
      },
    ],
    mustPreserve: [
      "Le versement de la prime d'activité",
      "la révision de décembre",
    ],
  },
  {
    label: "nom de famille court",
    text: "Fatou Ba signale que sa demande de retraite est bloquée depuis janvier.",
    identity: { firstName: "Fatou", lastName: "Ba" },
    mustRedact: [
      {
        category: PII_CATEGORIES.CITIZEN_NAME,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "Fatou Ba",
      },
    ],
    mustPreserve: ["sa demande de retraite est bloquée depuis janvier"],
  },
  {
    label: "nom de famille homonyme d'un mot courant",
    text: "Léa Petit conteste le calcul : un petit reste à charge subsiste après le remboursement.",
    identity: { firstName: "Léa", lastName: "Petit" },
    mustRedact: [
      {
        category: PII_CATEGORIES.CITIZEN_NAME,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "Léa Petit",
        matchCase: true,
      },
    ],
    mustPreserve: ["un petit reste à charge", "après le remboursement"],
  },
  {
    label: "prénom écrit sans son diacritique",
    text: "Chaima Haddad a déposé un recours, sans retour du service depuis six semaines.",
    identity: { firstName: "Chaïma", lastName: "Haddad" },
    mustRedact: [
      {
        category: PII_CATEGORIES.CITIZEN_NAME,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "Chaima Haddad",
      },
    ],
    mustPreserve: ["a déposé un recours", "depuis six semaines"],
  },

  // Cas qui sollicitent la couche B et le juge : tiers, adresses, et pièges de
  // sur-caviardage. Écrits comme un aidant les écrit, fautes et minuscules comprises.
  {
    label: "tiers désigné par son seul prénom",
    text: "Mme Koval est hébergée par sa cousine Nadia depuis la fin de son bail. La CAF demande une attestation d'hébergement signée.",
    identity: { firstName: "Sandrine", lastName: "Koval" },
    mustRedact: [citizenName("Koval"), thirdParty("Nadia")],
    mustPreserve: [
      "est hébergée par sa cousine",
      "La CAF demande une attestation d'hébergement",
    ],
  },
  {
    label: "enfants cités par leur prénom en minuscules",
    text: "usager seul avec ses 2 enfants lina et noah, l'APL a été coupée en mars sans courrier.",
    mustRedact: [thirdParty("lina"), thirdParty("noah")],
    mustPreserve: [
      "ses 2 enfants",
      "l'APL a été coupée en mars",
      "sans courrier",
    ],
  },
  {
    label: "ex-conjoint nommé en toutes lettres",
    text: "Depuis la séparation, la pension alimentaire n'est plus versée par son ex-conjoint Grégory Masson. L'ARIPA a été saisie mais la CAF indique ne pas pouvoir agir sans jugement.",
    mustRedact: [thirdParty("Grégory Masson")],
    mustPreserve: [
      "la pension alimentaire n'est plus versée",
      "L'ARIPA a été saisie",
      "sans jugement",
    ],
  },
  {
    label: "propriétaire au nom homonyme d'une ville",
    text: "Le propriétaire, M. Laval, refuse de remplir l'attestation de loyer pour la CAF. Les APL sont suspendues depuis deux mois.",
    mustRedact: [thirdParty("Laval")],
    mustPreserve: [
      "Le propriétaire",
      "refuse de remplir l'attestation de loyer pour la CAF",
      "Les APL sont suspendues depuis deux mois",
    ],
  },
  {
    label: "ville homonyme d'un nom, rien à caviarder",
    text: "Le dossier a été transféré de la CAF de Laval vers celle du Mans après le déménagement, et il est bloqué depuis. Aucun versement depuis juin.",
    mustRedact: [],
    mustPreserve: [
      "la CAF de Laval",
      "celle du Mans",
      "Aucun versement depuis juin",
    ],
  },
  {
    label: "ville homonyme d'un prénom, à préserver",
    text: "Mme Tessier a quitté Nancy pour Metz en janvier. France Travail Nancy continue de la convoquer et l'a radiée pour absence.",
    identity: { firstName: "Corinne", lastName: "Tessier" },
    mustRedact: [citizenName("Tessier")],
    mustPreserve: [
      "a quitté Nancy pour Metz en janvier",
      "France Travail Nancy continue de la convoquer",
      "radiée pour absence",
    ],
  },
  {
    label: "tiers au prénom homonyme d'une ville",
    text: "La fille de l'usager, Nancy, s'occupe des papiers depuis son AVC ; elle n'a pas de procuration pour la CPAM.",
    mustRedact: [thirdParty("Nancy")],
    mustPreserve: [
      "s'occupe des papiers depuis son AVC",
      "n'a pas de procuration pour la CPAM",
    ],
  },
  {
    label: "nom homonyme d'un mot courant, écrit en minuscules",
    text: "la voisine, mme blanc, garde le courrier car la boîte aux lettres est cassée. Les courriers de la CPAM se perdent.",
    mustRedact: [thirdParty("blanc")],
    mustPreserve: [
      "garde le courrier",
      "la boîte aux lettres est cassée",
      "Les courriers de la CPAM se perdent",
    ],
  },
  {
    label: "mots courants homonymes de noms, rien à caviarder",
    text: "Le Cerfa est revenu en blanc, sans signature ni cachet. Madame a rempli le petit formulaire rose de la CAF mais il a été refusé.",
    mustRedact: [],
    mustPreserve: [
      "revenu en blanc",
      "petit formulaire rose de la CAF",
      "a été refusé",
    ],
  },
  {
    label: "contact employeur désigné par sa civilité",
    text: "L'employeur ne répond pas. La gérante du restaurant, Mme Rousset, dit avoir envoyé l'attestation à France Travail mais l'ARE n'est toujours pas ouverte.",
    mustRedact: [thirdParty("Rousset")],
    mustPreserve: [
      "La gérante du restaurant",
      "France Travail",
      "l'ARE n'est toujours pas ouverte",
    ],
  },
  {
    label: "assistante sociale nommée dans une réponse d'opérateur",
    text: "Bonjour, nous avons bien reçu les pièces. L'assistante sociale du département, Mme Clément, nous a confirmé la situation d'urgence ; le RSA sera réexaminé en commission le 14 mars.",
    mustRedact: [thirdParty("Clément")],
    mustPreserve: [
      "L'assistante sociale du département",
      "situation d'urgence",
      "le RSA sera réexaminé en commission le 14 mars",
    ],
  },
  {
    label: "conseiller d'un opérateur absent du fil",
    text: "Rdv pris avec M. Olivieri, conseiller France Travail, qui a promis une réinscription rétroactive. Rien depuis 3 semaines.",
    mustRedact: [thirdParty("Olivieri")],
    mustPreserve: [
      "conseiller France Travail",
      "réinscription rétroactive",
      "Rien depuis 3 semaines",
    ],
  },
  {
    label: "médecin désigné par « Dr »",
    text: "Le Dr Kowalczyk a prescrit un arrêt de travail de 3 mois mais la CPAM n'a pas enregistré l'avis d'arrêt, les IJ ne sont pas versées.",
    mustRedact: [thirdParty("Kowalczyk")],
    mustPreserve: [
      "a prescrit un arrêt de travail de 3 mois",
      "la CPAM",
      "les IJ ne sont pas versées",
    ],
  },
  {
    label: "curateur en minuscules, organisme à préserver",
    text: "son curateur mr vidal (UDAF) n'a jamais transmis l'avis d'imposition à la CAF, l'AAH est suspendue.",
    mustRedact: [thirdParty("vidal")],
    mustPreserve: ["(UDAF)", "l'avis d'imposition", "l'AAH est suspendue"],
  },
  {
    label: "nom du citoyen déformé par un organisme",
    text: "M. Benaissa a déposé sa demande d'ASPA. Sur le courrier de la CARSAT il est écrit Benaïssa, sur celui de la MSA Bennaissa : les deux dossiers ne se rejoignent pas.",
    identity: { firstName: "Mehdi", lastName: "Benaissa" },
    mustRedact: [
      citizenName("Benaissa"),
      {
        category: PII_CATEGORIES.CITIZEN_NAME,
        layer: DETECTION_LAYERS.LLM,
        value: "Bennaissa",
      },
    ],
    mustPreserve: [
      "a déposé sa demande d'ASPA",
      "Sur le courrier de la CARSAT",
      "les deux dossiers ne se rejoignent pas",
    ],
  },
  {
    label: "tiers à particule et nom composé",
    text: "Sa belle-mère, Josiane Le Floch-Marteau, l'héberge mais refuse de déclarer sa présence à la CAF par peur de perdre son allocation logement.",
    mustRedact: [thirdParty("Josiane Le Floch-Marteau")],
    mustPreserve: [
      "Sa belle-mère",
      "refuse de déclarer sa présence à la CAF",
      "allocation logement",
    ],
  },
  {
    label: "adresse sans code postal, bâtiment et escalier",
    text: "Merci de noter la nouvelle adresse : 12 bis rue des Tanneurs bat B esc 3, 2e étage. Les courriers de la CPAM partent encore à l'ancienne.",
    mustRedact: [address("rue des Tanneurs")],
    mustPreserve: [
      "Merci de noter la nouvelle adresse",
      "Les courriers de la CPAM partent encore à l'ancienne",
    ],
  },
  {
    label: "adresse en lieu-dit",
    text: "Famille installée au lieu-dit la Combe aux Loups, pas de transport, la convocation France Travail à 40 km est impossible à honorer.",
    mustRedact: [address("Combe aux Loups")],
    mustPreserve: [
      "pas de transport",
      "la convocation France Travail à 40 km est impossible à honorer",
    ],
  },
  {
    label: "hébergé chez un proche, adresse du proche",
    text: "Hébergé chez sa sœur, 5 impasse du Lavoir à Rezé, depuis l'expulsion. La domiciliation au CCAS n'est pas reconnue par la CAF.",
    mustRedact: [address("impasse du Lavoir")],
    mustPreserve: [
      "Hébergé chez sa sœur",
      "depuis l'expulsion",
      "La domiciliation au CCAS n'est pas reconnue par la CAF",
    ],
  },
  {
    label: "adresse en minuscules, rue au nom d'une personne",
    text: "nouvelle adresse 3 av jean jaurès apt 12, l'avis d'imposition est parti à l'ancienne adresse donc pas de CSS.",
    mustRedact: [address("jean jaurès")],
    mustPreserve: [
      "l'avis d'imposition est parti à l'ancienne adresse",
      "pas de CSS",
    ],
  },
  {
    label: "résidence et numéro d'appartement",
    text: "Mme vit à la résidence les Hortensias, appt 24, logement insalubre signalé à la mairie. Le bailleur social ne répond pas à la demande de mutation.",
    mustRedact: [address("les Hortensias")],
    mustPreserve: [
      "logement insalubre signalé à la mairie",
      "Le bailleur social ne répond pas à la demande de mutation",
    ],
  },
  {
    label: "adresse avec code postal et prénom d'un enfant",
    text: "Le fils, Dylan, vit toujours au 27 chemin de la Garenne 45160 mais n'est plus à charge. La CAF continue de le compter dans le foyer.",
    mustRedact: [thirdParty("Dylan"), address("chemin de la Garenne")],
    mustPreserve: [
      "n'est plus à charge",
      "La CAF continue de le compter dans le foyer",
    ],
  },
  {
    label: "mois capitalisés et prestations, rien à caviarder",
    text: "Depuis Avril plus aucun versement de la Prime d'Activité. Relance faite en Mai à la CAF de Valence, puis à la MSA. Avis d'imposition 2024 fourni.",
    mustRedact: [],
    mustPreserve: [
      "Depuis Avril",
      "Prime d'Activité",
      "Relance faite en Mai",
      "la CAF de Valence",
      "la MSA",
      "Avis d'imposition 2024",
    ],
  },
  {
    label: "sigles et dispositifs en rafale, rien à caviarder",
    text: "RSA suspendu, APL recalculées à 0, AAH refusée par la MDPH, CSS non renouvelée. L'usager est suivi par le CCAS et par une conseillère France Travail.",
    mustRedact: [],
    mustPreserve: [
      "RSA suspendu",
      "APL recalculées à 0",
      "AAH refusée par la MDPH",
      "CSS non renouvelée",
      "suivi par le CCAS",
      "une conseillère France Travail",
    ],
  },
  {
    label: "professions et fonctions sans nom, rien à caviarder",
    text: "L'infirmière libérale et le médecin traitant ont rempli le certificat MDPH. La référente RSA du département attend l'avis de la commission.",
    mustRedact: [],
    mustPreserve: [
      "L'infirmière libérale",
      "le médecin traitant",
      "certificat MDPH",
      "La référente RSA du département",
    ],
  },
  {
    label: "villes citées seules, rien à caviarder",
    text: "Arrivée de Marseille en septembre, domiciliée au CCAS de Saint-Étienne, elle doit retourner à Lyon pour le rendez-vous de la préfecture.",
    mustRedact: [],
    mustPreserve: [
      "Arrivée de Marseille en septembre",
      "CCAS de Saint-Étienne",
      "retourner à Lyon",
      "rendez-vous de la préfecture",
    ],
  },
  {
    label: "employeur désigné par un nom de famille",
    text: "L'ancien employeur (boulangerie Martin, à Tours) n'a jamais transmis l'attestation employeur à France Travail.",
    mustRedact: [thirdParty("Martin")],
    mustPreserve: [
      "n'a jamais transmis l'attestation employeur à France Travail",
    ],
  },
  {
    label: "commune contenant un prénom, à préserver",
    text: "Le dossier a été transmis au CCAS de Saint-Martin-d'Hères puis à la CPAM de l'Isère, sans suite depuis.",
    mustRedact: [],
    mustPreserve: [
      "CCAS de Saint-Martin-d'Hères",
      "CPAM de l'Isère",
      "sans suite depuis",
    ],
  },
  {
    label: "voisine citée par son prénom dans une réponse",
    text: "Bonjour, j'ai eu au téléphone la voisine de monsieur, Josette, qui confirme qu'il ne relève plus son courrier. Nous suspendons le contrôle en attendant.",
    mustRedact: [thirdParty("Josette")],
    mustPreserve: [
      "qui confirme qu'il ne relève plus son courrier",
      "Nous suspendons le contrôle en attendant",
    ],
  },
  {
    label: "récit long, famille et intervenants nommés",
    text: "Mme Gomes (née le 03/07/1991) élève seule ses trois enfants, Enzo, Maëlys et Timéo. Depuis le départ de son conjoint M. Ferreira en novembre, la CAF continue de calculer le RSA sur les revenus du couple. Elle a fourni la déclaration de séparation, visée par l'assistante sociale Mme Brunet-Lacaze du CMS. Tel 06 45 78 21 09.",
    identity: { firstName: "Aurélie", lastName: "Gomes" },
    birthDate: "03/07/1991",
    mustRedact: [
      citizenName("Gomes"),
      {
        category: PII_CATEGORIES.BIRTH_DATE,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "03/07/1991",
      },
      {
        category: PII_CATEGORIES.PHONE,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "06 45 78 21 09",
      },
      thirdParty("Enzo"),
      thirdParty("Maëlys"),
      thirdParty("Timéo"),
      thirdParty("Ferreira"),
      thirdParty("Brunet-Lacaze"),
    ],
    mustPreserve: [
      "élève seule ses trois enfants",
      "la CAF continue de calculer le RSA sur les revenus du couple",
      "la déclaration de séparation",
      "l'assistante sociale",
      "du CMS",
    ],
  },
  {
    label: "message sans ponctuation, employeur en minuscules",
    text: "bonjour je vous contacte pour mr diop il a perdu son travail chez son patron mr haddouche en fevrier et france travail dit que l'attestation employeur est pas arrivé merci de voir",
    identity: { firstName: "Ousmane", lastName: "Diop" },
    mustRedact: [citizenName("diop"), thirdParty("haddouche")],
    mustPreserve: [
      "il a perdu son travail",
      "france travail dit que l'attestation employeur est pas arrivé",
    ],
  },
  {
    label: "tiers cité avec l'initiale de son prénom",
    text: "Le bailleur privé M. J. Fabre refuse de faire les travaux ; la CAF a conservé l'APL pour non-décence.",
    mustRedact: [thirdParty("Fabre")],
    mustPreserve: [
      "Le bailleur privé",
      "refuse de faire les travaux",
      "la CAF a conservé l'APL pour non-décence",
    ],
  },
  {
    label: "tiers au nom homonyme d'un mot courant, capitalisé",
    text: "Mme Rose, la tutrice de l'enfant, n'arrive pas à faire basculer les allocations familiales à son nom.",
    mustRedact: [thirdParty("Rose", true)],
    mustPreserve: [
      "la tutrice de l'enfant",
      "faire basculer les allocations familiales à son nom",
    ],
  },
  {
    label: "employeur particulier et son adresse",
    text: "Elle travaillait comme aide à domicile chez un particulier, M. Garnier, 8 rue Pasteur à Angers, qui ne déclare plus ses heures au CESU.",
    mustRedact: [thirdParty("Garnier"), address("rue Pasteur")],
    mustPreserve: [
      "aide à domicile chez un particulier",
      "qui ne déclare plus ses heures au CESU",
    ],
  },
  {
    label: "adresse sans type de voie ni numéro",
    text: "Il dort dans sa voiture depuis l'expulsion ; courrier à récupérer chez son frère, les Hauts de Chênaie, porte 6.",
    mustRedact: [address("les Hauts de Chênaie")],
    mustPreserve: [
      "Il dort dans sa voiture depuis l'expulsion",
      "courrier à récupérer chez son frère",
    ],
  },
  {
    label: "ancienne adresse dans une réponse DGFIP",
    text: "Réponse DGFIP : l'avis de taxe d'habitation concerne le 41 rue Émile Zola, logement quitté en 2022. Merci de nous transmettre l'état des lieux de sortie.",
    mustRedact: [address("rue Émile Zola")],
    mustPreserve: [
      "l'avis de taxe d'habitation concerne",
      "logement quitté en 2022",
      "l'état des lieux de sortie",
    ],
  },
  {
    label: "pièces et formulaires, rien à caviarder",
    text: "Pièces fournies : avis d'imposition, relevé de situation Ameli, attestation de droits, formulaire S3705, RIB. Le Cerfa 15692 a été renvoyé deux fois.",
    mustRedact: [],
    mustPreserve: [
      "avis d'imposition",
      "relevé de situation Ameli",
      "attestation de droits",
      "formulaire S3705",
      "Le Cerfa 15692",
    ],
  },
  {
    label: "proche indiqué comme contact en fin de message",
    text: "Pour tout échange, contacter plutôt la fille de madame, Samia, au même numéro. Merci à la CPAM de rappeler avant vendredi.",
    mustRedact: [thirdParty("Samia")],
    mustPreserve: [
      "Pour tout échange",
      "Merci à la CPAM de rappeler avant vendredi",
    ],
  },
  {
    label: "même mot en nom de tiers et en mot courant",
    text: "Mme Blanc, sa tutrice, a signalé que le formulaire de la CAF est revenu en blanc, sans aucune mention.",
    mustRedact: [thirdParty("Blanc", true)],
    mustPreserve: ["sa tutrice", "revenu en blanc", "sans aucune mention"],
  },
];
