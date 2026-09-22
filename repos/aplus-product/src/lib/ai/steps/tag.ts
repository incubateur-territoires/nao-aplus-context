import { generateText } from "ai";
import type { Step } from "@/types/ai-pipeline";
import { albertChatModel } from "../providers";
import {
  matchTags,
  NATURES,
  THEMES,
  type Nature,
  type Theme,
} from "../taxonomy";
import type { SummarizeInput } from "./summarize";

/**
 * Étape de tagage. Classe un signalement (déjà pseudonymisé) selon deux axes
 * contrôlés : thème (domaine) et nature du blocage.
 *
 * Plan B au structured output (non supporté par le vLLM Albert) : on laisse le
 * modèle répondre librement, puis on filtre sa sortie contre les vocabulaires
 * (cf. `matchTags`). Garantie : aucun tag hors-liste, aucune erreur de parsing.
 */

export interface TagOutput {
  themes: Theme[];
  natures: Nature[];
}

const SYSTEM_PROMPT = `Tu es un assistant d'Administration+, service public d'aide au déblocage de situations administratives complexes.
On te fournit un signalement déjà pseudonymisé. Ta tâche : le classer selon deux axes.

THÈMES possibles (domaine) : ${THEMES.join(", ")}.
NATURES possibles (type de blocage) : ${NATURES.join(", ")}.

Règles impératives :
- Choisis UNIQUEMENT des libellés exacts issus de ces listes.
- 1 à 2 thèmes et 1 à 2 natures maximum, les plus pertinents.
- Si aucun ne convient pour un axe, n'en mets aucun.
- Réponds au format :
THEMES: <libellés séparés par des virgules>
NATURES: <libellés séparés par des virgules>`;

export const tagStep: Step<SummarizeInput, TagOutput> = {
  name: "tag",
  async run(input) {
    const { text } = await generateText({
      model: albertChatModel(),
      temperature: 0.1,
      system: SYSTEM_PROMPT,
      prompt: `Sujet : ${input.subject}\n\nDescription : ${input.description}`,
    });
    return {
      themes: matchTags(text, THEMES),
      natures: matchTags(text, NATURES),
    };
  },
};
