import { generateText } from "ai";
import type { Step } from "@/types/ai-pipeline";
import { albertChatModel } from "../providers";

/**
 * Étape de résumé. Prend le texte d'un signalement DÉJÀ pseudonymisé (couche A)
 * et produit un résumé factuel et concis du blocage administratif.
 *
 * Le résumé est du texte libre : pas de structured output ici (inutile pour un
 * seul champ, et non supporté par le déploiement vLLM d'Albert). La contrainte
 * de format viendra à l'étape de tagage.
 */

export interface SummarizeInput {
  subject: string;
  description: string;
}

export interface SummaryOutput {
  summary: string;
}

const SYSTEM_PROMPT = `Tu es un assistant d'Administration+, service public d'aide au déblocage de situations administratives complexes.
On te fournit un signalement déjà pseudonymisé : les données personnelles ont été remplacées par des jetons comme [NOM_1] ou [NUMERO_1].
Ta tâche : produire un résumé factuel, neutre et concis (2 à 4 phrases) du blocage administratif décrit.
Règles impératives :
- Conserve les jetons de pseudonymisation tels quels, ne les remplace pas et n'en invente pas.
- N'ajoute aucune donnée personnelle (nom, numéro, adresse) qui ne serait pas déjà un jeton.
- Reste factuel : pas d'interprétation, pas de jugement, pas de recommandation.
- Réponds uniquement par le résumé, en français, sans préambule.`;

export const summarizeStep: Step<SummarizeInput, SummaryOutput> = {
  name: "summarize",
  async run(input) {
    const { text } = await generateText({
      model: albertChatModel(),
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      prompt: `Sujet : ${input.subject}\n\nDescription : ${input.description}`,
    });
    return { summary: text.trim() };
  },
};
