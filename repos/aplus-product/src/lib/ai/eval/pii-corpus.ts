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
];
