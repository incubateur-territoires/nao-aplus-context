import { generateText } from "ai";
import type { Step } from "@/types/ai-pipeline";
import { albertChatModel } from "../providers";
import { parseLlmList } from "./parse-list";

/**
 * Vérificateur adverse du caviardage. On lui donne un texte déjà caviardé et on
 * lui demande de trouver ce qui reste, sans jamais le laisser réécrire : il
 * DÉSIGNE, le code caviarde. Un modèle qui réécrit peut halluciner, altérer le
 * sens, ou se croire quitte.
 *
 * Le prompt lui interdit explicitement les organismes, dispositifs et montants :
 * tout ce qu'il cite étant supprimé, sur-citer détruirait le sens qu'on garde.
 */

export interface JudgeOutput {
  residues: string[];
}

const SYSTEM_PROMPT = `Tu vérifies l'anonymisation d'un signalement administratif français.
Le texte contient déjà des jetons comme [NOM_1], [NUMERO_2], [EMAIL_1], [DATE_NAISSANCE_1] : ils sont corrects, ne les cite jamais.

Ta tâche : citer MOT POUR MOT les données restantes qui permettraient d'identifier une personne.

Cite notamment :
- un nom ou un prénom de personne encore en clair
- une adresse postale ou un lieu d'habitation précis
- une date de naissance, y compris écrite en toutes lettres
- un employeur nommément désigné, un identifiant, une référence personnelle

Ne cite JAMAIS :
- les organismes et administrations (CAF, CPAM, MSA, France Travail, DGFIP, France Services, mairie…)
- les prestations et dispositifs (RSA, APL, AAH, prime d'activité, retraite…)
- les montants, durées, nombres, dates de procédure ou de relance
- les villes, départements et régions cités seuls
- les mots courants du dossier

Ne réécris rien, ne reformule rien, ne commente pas.
Réponds uniquement par les valeurs trouvées, séparées par des virgules.
Si le texte est correctement anonymisé, réponds exactement : AUCUNE`;

export const judgePiiStep: Step<{ text: string }, JudgeOutput> = {
  name: "judge-pii",
  async run(input) {
    const { text } = await generateText({
      model: albertChatModel(),
      temperature: 0,
      system: SYSTEM_PROMPT,
      prompt: input.text,
    });
    return { residues: parseLlmList(text) };
  },
};
