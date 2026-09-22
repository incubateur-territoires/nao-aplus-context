import { generateText } from "ai";
import type { Step } from "@/types/ai-pipeline";
import { albertChatModel } from "../providers";
import type { SummarizeInput } from "./summarize";

/**
 * Couche B (volet LLM) : extraction des noms de personnes physiques encore
 * présents en clair dans un texte déjà pseudonymisé par la couche A.
 *
 * Le LLM ne fait QUE détecter (il est bon à ça) ; le caviardage effectif est
 * réalisé ensuite de façon déterministe via `redactNames`. On lui passe le texte
 * couche A (numéros et nom du citoyen connu déjà retirés), donc il se concentre
 * sur ce que le déterministe ne sait pas voir : noms mal orthographiés et tiers.
 */

export interface ExtractNamesOutput {
  names: string[];
}

const SYSTEM_PROMPT = `Tu es un outil de détection de données personnelles pour Administration+.
On te fournit un signalement déjà partiellement pseudonymisé : certaines données sont des jetons comme [NOM_1] ou [NUMERO_1].
Ta tâche : lister TOUS les noms et prénoms de PERSONNES PHYSIQUES encore présents en clair dans le texte.

Règles impératives :
- N'inclus PAS les jetons existants ([NOM_1], [NUMERO_1]…).
- N'inclus PAS les noms d'organismes, d'administrations, d'entreprises (CAF, CPAM, MSA, Pôle emploi…).
- N'inclus PAS les noms de lieux (villes, départements, régions).
- Inclus les noms même mal orthographiés ou en minuscules.
- Réponds UNIQUEMENT par les noms trouvés, séparés par des virgules.
- Si aucun nom de personne n'est présent, réponds exactement : AUCUN`;

/** Parse la liste de noms renvoyée par le LLM en tableau nettoyé. */
export function parseExtractedNames(text: string): string[] {
  const trimmed = text.trim();
  if (/^aucun\.?$/i.test(trimmed)) return [];

  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of trimmed.split(/[,\n]/)) {
    const name = raw.trim().replace(/^[-•*\s]+/, "");
    // Ignore le vide et les jetons de pseudonymisation résiduels.
    if (!name || /^\[[A-Z]+_\d+\]$/.test(name)) continue;
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

export const extractNamesStep: Step<SummarizeInput, ExtractNamesOutput> = {
  name: "extract-names",
  async run(input) {
    const { text } = await generateText({
      model: albertChatModel(),
      temperature: 0,
      system: SYSTEM_PROMPT,
      prompt: `Sujet : ${input.subject}\n\nDescription : ${input.description}`,
    });
    return { names: parseExtractedNames(text) };
  },
};
