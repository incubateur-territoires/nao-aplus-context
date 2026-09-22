import { generateText } from "ai";
import type { Step } from "@/types/ai-pipeline";
import { albertChatModel } from "../providers";
import {
  parseSummaryAndTags,
  TAG_AXES,
  type FreeTag,
  type TagAxis,
} from "../tag-axes";
import type { SummarizeInput } from "./summarize";

/**
 * Étape combinée résumé + tagage libre, en UN appel LLM là où `summarizeStep`
 * puis `freeTagStep` en faisaient deux. Motivation : le quota Albert se compte
 * en requêtes/jour (offre Expérimentation : 1 000/j) — fusionner divise le
 * coût par signalement. Mêmes règles que les deux steps d'origine : résumé
 * factuel 2-4 phrases, un libellé par axe, réutilisation des libellés déjà
 * émergés (`knownLabels`).
 */

export interface SummarizeTagInput extends SummarizeInput {
  knownLabels?: Partial<Record<TagAxis, string[]>>;
}

export interface SummarizeTagOutput {
  summary: string;
  tags: FreeTag[];
}

const SYSTEM_PROMPT = `Tu es un assistant d'Administration+, service public d'aide au déblocage de situations administratives complexes.
On te fournit un signalement déjà pseudonymisé : les données personnelles ont été remplacées par des jetons comme [NOM_1] ou [NUMERO_1].
Ta tâche : produire un résumé du blocage, puis le décrire sur quatre axes.

RESUME : 2 à 4 phrases, factuel, neutre, sans interprétation ni recommandation. Conserve les jetons de pseudonymisation tels quels, n'en invente pas, n'ajoute aucune donnée personnelle.

ORGANISME : l'institution publique en cause (ex : CAF, CPAM, CARSAT, France Travail, préfecture, impôts, MSA, mairie). Toujours le NOM d'un organisme — jamais un domaine comme « droits sociaux ».
DEMARCHE : la prestation ou la procédure concernée (ex : RSA, allocation logement, pension de retraite, titre de séjour, carte vitale, prime d'activité).
BLOCAGE : la cause concrète qui bloque, la plus précise possible (ex : absence de réponse, pièce justificative refusée, radiation injustifiée, trop-perçu contesté, compte inaccessible, adresse erronée, rendez-vous introuvable).
URGENCE : la conséquence pour la personne si rien n'est fait (ex : rupture de ressources, expulsion imminente, soins interrompus, dette qui s'accumule). Sans urgence particulière, écris « inconnu ».

Règles impératives pour les axes :
- Un seul libellé par axe, de 1 à 4 mots, en français, en minuscules.
- Quand une liste de libellés déjà utilisés est fournie, réutilise EXACTEMENT l'un d'eux s'il convient ; n'invente un nouveau libellé que si aucun ne correspond.
- Jamais de terme vague seul : « administratif », « blocage », « démarche », « problème », « erreur », « communication », « droits sociaux » sont interdits.
- Si un axe est indéterminable, écris « inconnu ».
- Réponds UNIQUEMENT au format suivant, sans phrase d'introduction :
RESUME: <résumé>
ORGANISME: <libellé>
DEMARCHE: <libellé>
BLOCAGE: <libellé>
URGENCE: <libellé>`;

// Plafond de libellés réinjectés par axe : borne la taille du prompt quand le
// corpus analysé grossit (les plus fréquents d'abord, cf. tri côté client).
const MAX_KNOWN_LABELS_PER_AXIS = 30;

function buildPrompt(input: SummarizeTagInput): string {
  const parts = [
    `Sujet : ${input.subject}`,
    `Description : ${input.description}`,
  ];

  const knownLines = TAG_AXES.map((axis) => {
    const labels = input.knownLabels?.[axis]?.slice(
      0,
      MAX_KNOWN_LABELS_PER_AXIS,
    );
    return labels?.length
      ? `${axis.toUpperCase()}: ${labels.join(", ")}`
      : null;
  }).filter(Boolean);

  if (knownLines.length > 0) {
    parts.push(
      `Libellés déjà utilisés sur d'autres signalements — réutilise exactement l'un d'eux quand il convient :\n${knownLines.join("\n")}`,
    );
  }

  return parts.join("\n\n");
}

export const summarizeTagStep: Step<SummarizeTagInput, SummarizeTagOutput> = {
  name: "summarize-tag",
  async run(input) {
    const { text } = await generateText({
      model: albertChatModel(),
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(input),
    });
    return parseSummaryAndTags(text);
  },
};
