import {
  NO_BLOCKAGE_GOLDEN_TAG,
  OTHER_GOLDEN_TAG,
  UNDETERMINED_GOLDEN_TAG,
} from "@/utils/golden-dataset-tag";
import {
  withExits,
  type ClosedTagOf,
  type ClosedTaxonomy,
} from "@/utils/golden-dataset-taxonomy";

/**
 * Liste fermée v1 du golden dataset et projection des labels fins adjugés en
 * réunion. Ce fichier est figé au premier gel réussi ; une évolution est un
 * fichier `-v2.ts` à côté. Avant le gel, trancher un arbitrage du guide se
 * fait en déplaçant une paire de projection, jamais en réécrivant un tag.
 */

const BLOCKAGE_AXIS = withExits([
  {
    tag: "perte d'accès à la messagerie",
    definition:
      "L'usager n'accède plus à l'adresse e-mail liée à son compte, ce qui bloque la connexion ou la réception des codes.",
    examples: ["adresse e-mail piratée", "mot de passe de la messagerie perdu"],
  },
  {
    tag: "accès au compte en ligne impossible",
    definition:
      "L'usager ne parvient pas à se connecter à son espace en ligne, hors problème de messagerie.",
    examples: ["identifiants rejetés", "code d'accès jamais reçu"],
  },
  {
    tag: "document ou courrier non reçu",
    definition:
      "Un document attendu de l'administration (carte, attestation, courrier, notification) n'est jamais arrivé.",
    examples: ["attestation jamais arrivée", "courrier de notification perdu"],
  },
  {
    tag: "bug informatique",
    definition:
      "Un système informatique de l'administration dysfonctionne : service en ligne en erreur, page bloquée, donnée impossible à saisir, échange automatique entre organismes interrompu.",
    examples: [
      "page d'erreur à la validation",
      "télétransmission vers la mutuelle interrompue",
    ],
  },
  {
    tag: "versement bloqué",
    definition:
      "Un paiement identifié est retenu par l'organisme pour une raison connue ou identifiable.",
    examples: ["versement suspendu en attente d'une pièce"],
  },
  {
    tag: "absence de paiement",
    definition:
      "Un paiement attendu n'est jamais arrivé, sans explication connue.",
    examples: ["aucun versement depuis plusieurs mois"],
  },
  {
    tag: "dette ou retenue",
    definition: "Une dette envers l'organisme bloque ou ampute les versements.",
    examples: [
      "retenue mensuelle sur la prestation",
      "trop-perçu à rembourser",
    ],
  },
  {
    tag: "difficulté d'usage du numérique",
    definition:
      "L'usager ne peut pas faire la démarche en ligne faute d'équipement ou de maîtrise, sans panne côté administration.",
    examples: [
      "pas d'ordinateur ni de connexion",
      "démarche en ligne incomprise",
    ],
  },
  {
    tag: "refus sans explication",
    definition:
      "Une demande a été refusée ou rejetée sans motif compréhensible pour l'usager.",
    examples: ["rejet notifié sans motif"],
  },
  {
    tag: "dossier incomplet ou erroné",
    definition:
      "Le dossier contient une erreur ou il y manque une pièce, et cela bloque le traitement.",
    examples: ["pièce manquante au dossier", "date de naissance erronée"],
  },
  {
    tag: NO_BLOCKAGE_GOLDEN_TAG,
    definition:
      "Rien n'empêche la situation d'avancer ; la demande porte sur la démarche seule.",
    examples: ["demande d'information sans obstacle"],
  },
]);

const PROCEDURE_AXIS = withExits([
  {
    tag: "demande de code provisoire",
    definition:
      "L'usager demande un code provisoire pour accéder à son compte.",
    examples: ["code provisoire demandé par téléphone"],
  },
  {
    tag: "accès au compte en ligne",
    definition:
      "Toute autre démarche d'accès à l'espace en ligne : création, déblocage, récupération de compte.",
    examples: ["création d'un espace personnel", "déblocage d'un compte"],
  },
  {
    tag: "RSA",
    definition: "Demande, ouverture ou versement du RSA.",
    examples: ["première demande de RSA", "versement du RSA interrompu"],
  },
  {
    tag: "mise à jour d'informations",
    definition:
      "Correction ou actualisation des informations du dossier : état civil, coordonnées, situation familiale ou professionnelle, ressources déclarées.",
    examples: [
      "changement d'adresse",
      "déclaration de ressources à actualiser",
    ],
  },
  {
    tag: "ASPA",
    definition: "Demande, versement ou justificatif lié à l'ASPA.",
    examples: ["demande d'ASPA", "justificatif d'ASPA à obtenir"],
  },
  {
    tag: "complémentaire santé (C2S)",
    definition: "Demande, renouvellement ou rattachement à la C2S.",
    examples: ["renouvellement de la C2S", "rattachement d'un ayant droit"],
  },
  {
    tag: "carte vitale",
    definition:
      "Demande, renouvellement ou duplicata de la carte vitale ou de la carte européenne d'assurance maladie (CEAM).",
    examples: ["duplicata après perte", "CEAM avant un séjour à l'étranger"],
  },
  {
    tag: "demande d'informations",
    definition:
      "L'usager veut comprendre sa situation ou connaître la marche à suivre, sans demander une prestation précise.",
    examples: [
      "comprendre un calcul de droits",
      "connaître la marche à suivre",
    ],
  },
  {
    tag: "AAH",
    definition: "Demande ou versement de l'AAH.",
    examples: ["demande d'AAH", "versement d'AAH interrompu"],
  },
  {
    tag: "pension de réversion",
    definition: "Demande de pension de réversion.",
    examples: ["demande de réversion après un décès"],
  },
  {
    tag: "APL",
    definition: "Demande ou versement de l'APL.",
    examples: ["demande d'APL après un emménagement"],
  },
  {
    tag: "retraite personnelle",
    definition:
      "Demande de retraite de droit propre, hors réversion et hors ASPA.",
    examples: ["demande de départ à la retraite"],
  },
  {
    tag: "carrière",
    definition: "Mise à jour ou attestation du relevé de carrière.",
    examples: [
      "trimestres manquants au relevé",
      "attestation de carrière longue",
    ],
  },
  {
    tag: "relevé de paiement",
    definition: "Demande d'un relevé ou avis de paiement.",
    examples: ["relevé de paiement à fournir à un bailleur"],
  },
  {
    tag: "attestation de droits",
    definition: "Demande d'une attestation de droits à l'assurance maladie.",
    examples: ["attestation de droits à jour"],
  },
  {
    tag: "prestations maladie",
    definition:
      "Prestations de l'assurance maladie hors carte vitale, CEAM et C2S : accident du travail, indemnités journalières, invalidité, transport, remboursements, formulaires entre régimes.",
    examples: ["indemnités journalières", "prise en charge d'un transport"],
  },
]);

export interface TaxonomyV1Tags {
  blockageTag: ClosedTagOf<typeof BLOCKAGE_AXIS>;
  procedureTag: ClosedTagOf<typeof PROCEDURE_AXIS>;
}

export const GOLDEN_TAXONOMY_V1: ClosedTaxonomy<TaxonomyV1Tags> = {
  version: 1,
  axes: { blockageTag: BLOCKAGE_AXIS, procedureTag: PROCEDURE_AXIS },
  projection: {
    blockageTag: [
      ["accès mail", "perte d'accès à la messagerie"],
      // Arbitrage 3 : les deux labels fusionnent, sinon deux tags à 2 items.
      ["compte en ligne inaccessible", "accès au compte en ligne impossible"],
      ["code d'accès non reçu", "accès au compte en ligne impossible"],
      ["document non reçu", "document ou courrier non reçu"],
      ["bug informatique", "bug informatique"],
      // Arbitrage 2 : « télétransmission » est versée dans le bug informatique.
      ["télétransmission", "bug informatique"],
      // Arbitrage 1 : deux tags à 3 items, frontière = raison connue ou non.
      ["versement bloqué", "versement bloqué"],
      ["absence paiement", "absence de paiement"],
      ["dette", "dette ou retenue"],
      ["détresse numérique", "difficulté d'usage du numérique"],
      ["refus sans explication", "refus sans explication"],
      ["rejet sans explication", "refus sans explication"],
      // Arbitrage 3 : les deux labels fusionnent, sinon deux tags à 2 et 1 items.
      ["dossier incomplet", "dossier incomplet ou erroné"],
      ["erreur dossier", "dossier incomplet ou erroné"],
      ["déménagement", OTHER_GOLDEN_TAG],
      ["formulaire inadapté", OTHER_GOLDEN_TAG],
      [UNDETERMINED_GOLDEN_TAG, UNDETERMINED_GOLDEN_TAG],
    ],
    procedureTag: [
      ["demande code provisoire", "demande de code provisoire"],
      // Arbitrage 4 : « compte en ligne » reste séparé de la demande de code.
      ["compte en ligne", "accès au compte en ligne"],
      ["demande rsa", "RSA"],
      ["mise à jour informations", "mise à jour d'informations"],
      // Arbitrage 6 : ces trois labels actualisent le dossier plutôt que « autre ».
      ["Suivi déclaration ressources", "mise à jour d'informations"],
      ["demande déclaration ressources", "mise à jour d'informations"],
      ["reprise activité", "mise à jour d'informations"],
      ["demande aspa", "ASPA"],
      ["versement aspa", "ASPA"],
      ["demande justificatif aspa", "ASPA"],
      ["demande c2s", "complémentaire santé (C2S)"],
      ["renouvellement c2s", "complémentaire santé (C2S)"],
      ["rattachement c2s", "complémentaire santé (C2S)"],
      ["demande carte vitale", "carte vitale"],
      // Arbitrage 7 : la CEAM rejoint la carte vitale plutôt que « autre ».
      ["demande CEAM", "carte vitale"],
      ["demande informations", "demande d'informations"],
      ["versement aah", "AAH"],
      ["demande aah", "AAH"],
      ["demande pension réversion", "pension de réversion"],
      ["demande apl", "APL"],
      ["demande retraite", "retraite personnelle"],
      ["mise à jour carrière", "carrière"],
      // Fusion du guide hors des sept décisions : l'attestation rejoint la carrière.
      ["demande attestation carrière longue", "carrière"],
      ["demande relevé paiement", "relevé de paiement"],
      ["demande attestation droits", "attestation de droits"],
      // Arbitrage 5 : sept démarches réunies pour atteindre la barre des 3.
      ["accident travail", "prestations maladie"],
      ["indemnités journalières", "prestations maladie"],
      ["pension invalidité", "prestations maladie"],
      ["prise en charge transport", "prestations maladie"],
      ["remboursement mutuelle", "prestations maladie"],
      ["formulaire s1", "prestations maladie"],
      ["Formulaire liaison autre régime français", "prestations maladie"],
      ["avis d'imposition", OTHER_GOLDEN_TAG],
      ["crédit d'impôts", OTHER_GOLDEN_TAG],
      ["chèque énergie", OTHER_GOLDEN_TAG],
      ["ants", OTHER_GOLDEN_TAG],
      ["demande duplicata carte grise", OTHER_GOLDEN_TAG],
      ["création compte césu", OTHER_GOLDEN_TAG],
      ["versement prime d'activité", OTHER_GOLDEN_TAG],
      ["annulation retenue", OTHER_GOLDEN_TAG],
      ["demande ouverture droits", OTHER_GOLDEN_TAG],
      ["dépôt document", OTHER_GOLDEN_TAG],
      ["demande rendez-vous", OTHER_GOLDEN_TAG],
      ["demande allocations", OTHER_GOLDEN_TAG],
      ["demande attestation chômage", OTHER_GOLDEN_TAG],
      ["demande attestation ASSEDIC", OTHER_GOLDEN_TAG],
      [UNDETERMINED_GOLDEN_TAG, UNDETERMINED_GOLDEN_TAG],
    ],
  },
};
