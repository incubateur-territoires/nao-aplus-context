import { generateText } from "ai";
import type { Step } from "@/types/ai-pipeline";
import { albertChatModel } from "../providers";
import type { SummarizeInput } from "./summarize";

/**
 * Étape de résumé ultra-compact : une seule ligne (≈ 15-20 mots) décrivant le
 * blocage administratif. Pensé pour un affichage en liste / aperçu.
 *
 * Prend un signalement DÉJÀ pseudonymisé (couche A). Comme pour le résumé long,
 * pas de structured output (un seul champ texte, non supporté par le vLLM Albert).
 */

export interface OnelineSummaryOutput {
  line: string;
}

const SYSTEM_PROMPT = `Tu es un assistant d'Administration+, service public d'aide au déblocage de situations administratives complexes.
On te fournit un signalement déjà pseudonymisé : les données personnelles sont des jetons comme [NOM_1] ou [NUMERO_1].
Ta tâche : résumer le blocage en UNE SEULE phrase TÉLÉGRAPHIQUE (8 à 12 mots maximum), en ne gardant QUE l'essentiel.

Garde uniquement :
- l'action ou la demande (transfert, versement, inscription, correction, radiation…) ;
- l'organisme ou la prestation concernée (CPAM, CAF, MSA, RSA…) et le territoire s'il est cité.

Supprime systématiquement les détails secondaires : modalités, pièces à fournir, identifiants, coordonnées, mots de passe, étapes, justifications.

Règles impératives :
- Ne mentionne PAS le citoyen ni aucun jeton de pseudonymisation ([NOM_1], [NUMERO_1], etc.).
- Commence directement par l'action (« Demande transfert… », « Blocage versement… »).
- Une seule ligne, style télégraphique, sans mots de liaison superflus.
- En français, sans préambule ni ponctuation finale.

Exemple :
Entrée : « [NOM_1] demande le transfert de son dossier vers la CPAM des Bouches-du-Rhône depuis la MSA, avec une nouvelle adresse et un mot de passe pour l'espace usager. »
Sortie : « Demande transfert CPAM Bouches-du-Rhône depuis MSA »`;

/** Retire les jetons de pseudonymisation résiduels (ex. [NOM_1]). */
const PLACEHOLDER_REGEX = /\[[A-Z]+_\d+\]/g;

/** Réduit une sortie LLM à une seule ligne nette, sans jeton ni amorce orpheline. */
function toSingleLine(text: string): string {
  return text
    .replace(PLACEHOLDER_REGEX, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:.–-]+/, "")
    .trim();
}

export const onelineSummaryStep: Step<SummarizeInput, OnelineSummaryOutput> = {
  name: "summarize-oneline",
  async run(input) {
    const { text } = await generateText({
      model: albertChatModel(),
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      prompt: `Sujet : ${input.subject}\n\nDescription : ${input.description}`,
    });
    return { line: toSingleLine(text) };
  },
};
