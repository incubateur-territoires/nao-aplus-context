import type { CitizenIdentity, GuardResult } from "@/types/ai-pipeline";
import { pseudonymizeReport } from "../pseudonymize";

/**
 * Guardrail RGPD : vérifie qu'une sortie LLM ne contient aucune PII détectable.
 *
 * Principe : on re-passe la couche A déterministe sur le texte produit par le
 * LLM. Si elle détecte quoi que ce soit (un numéro long, le nom du citoyen),
 * c'est qu'une PII a fuité ou été ré-introduite → violation. Les jetons de
 * pseudonymisation ([NOM_1], [NUMERO_1]) ne sont pas détectés et passent donc
 * sans problème.
 *
 * Portée : identifiants numériques, nom du citoyen connu, et — si fournis — les
 * noms détectés par la couche B (`extraNames`). Il NE détecte PAS un nom jamais
 * vu par les couches A/B (cas résiduel rare après couche B).
 */
export function checkNoPii(
  text: string,
  identity?: CitizenIdentity,
  extraNames: string[] = [],
): GuardResult {
  const { matches } = pseudonymizeReport(
    { subject: "", description: text },
    identity,
    extraNames,
  );

  return {
    ok: matches.length === 0,
    violations: matches.map((match) => ({
      type: match.type,
      value: match.value,
    })),
  };
}
