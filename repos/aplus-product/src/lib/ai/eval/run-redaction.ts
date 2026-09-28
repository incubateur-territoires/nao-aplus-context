import { PII_TYPES } from "@/types/ai-pipeline";
import { pseudonymizeReport } from "../pseudonymize";
import type { PiiEvalCase } from "./pii-corpus";

export interface LayerAResult {
  text: string;
  /** Nombre de jetons `[NOM_n]` déjà posés, pour que la couche B poursuive la numérotation. */
  nameCount: number;
}

/** Couche A seule : déterministe, sans réseau, donc exécutable en CI. */
export function redactWithLayerA(evalCase: PiiEvalCase): LayerAResult {
  const { description, matches } = pseudonymizeReport(
    { subject: "", description: evalCase.text },
    { ...evalCase.identity, birthDate: evalCase.birthDate },
    evalCase.participantNames ?? [],
  );

  return {
    text: description,
    nameCount: matches.filter((match) => match.type === PII_TYPES.NAME).length,
  };
}
