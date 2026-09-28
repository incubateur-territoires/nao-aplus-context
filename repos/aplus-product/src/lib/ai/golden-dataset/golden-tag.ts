import { createHash } from "node:crypto";
import { generateText } from "ai";
import type { Step } from "@/types/ai-pipeline";
import {
  renderFineLabelPrompt,
  renderTaxonomyPrompt,
} from "@/utils/golden-dataset-taxonomy";
import type { RunModeKind } from "@/utils/golden-dataset-scoring";
import { CURRENT_GOLDEN_TAXONOMY } from "@/utils/golden-dataset-taxonomy-current";
import { normalizeSearchQuery } from "@/utils/normalize";
import { albertChatModel } from "../providers";
import { extractAxisValues } from "../tag-axes";
import type { BlindItem } from "./blind-item";

/**
 * Tagage « à blanc » d'un item du golden dataset : le modèle pose les deux
 * mêmes tags que les annotateurs humains, sans jamais voir les leurs.
 *
 * Les exemples de la consigne système reprennent mot pour mot les aides de
 * saisie affichées aux annotateurs (« compte inactif, retard, bug
 * informatique » pour le blocage, « demande de RSA, perte de carte d'identité »
 * pour la démarche). C'est la condition pour que les deux séries soient
 * comparables : donner au modèle une consigne plus riche, ou plus pauvre, ferait
 * mesurer l'écart entre deux tâches différentes plutôt que l'écart entre un
 * modèle et des humains sur la même tâche.
 */
export const GOLDEN_TAG_SYSTEM_PROMPT = `Tu es un annotateur d'Administration+, service public d'aide au déblocage de situations administratives complexes.
On te donne un signalement déjà pseudonymisé : les données personnelles sont remplacées par des jetons comme [NOM_1] ou [NUMERO_1].
Ta tâche : poser exactement deux tags, comme le ferait un agent qui dépouille le corpus.

BLOCAGE : la cause concrète qui empêche la situation d'avancer. Exemples : compte inactif, retard, bug informatique, absence de réponse, pièce refusée.
DEMARCHE : la prestation ou la procédure concernée. Exemples : demande de RSA, perte de carte d'identité, pension de retraite, titre de séjour.

Règles impératives :
- Un seul libellé par tag, de 1 à 5 mots maximum, en français, en minuscules.
- Décris ce signalement précisément ; pas de terme vague seul (administratif, blocage, démarche, problème, erreur, dossier).
- Si un tag est indéterminable, écris « inconnu ».
- Réponds UNIQUEMENT sur deux lignes, sans introduction ni commentaire :
BLOCAGE: <libellé>
DEMARCHE: <libellé>`;

export const GOLDEN_TAG_USER_TEMPLATE = `Organisme sollicité : {{organization}}

Sujet : {{subject}}

Description : {{description}}`;

export interface SystemPromptChoice {
  /** Annoncée par le script avant le premier appel. */
  readonly name: string;
  readonly mode: RunModeKind;
  /** Version de la liste fermée exposée par la consigne ; `null` en texte libre. */
  readonly taxonomyVersion: number | null;
  readonly systemPrompt: string;
}

/**
 * Stricte à dessein : deviner ouvrirait une série sous une consigne que
 * personne n'a choisie.
 */
export function selectSystemPrompt(
  taxonomy: string | undefined,
): SystemPromptChoice {
  if (taxonomy === undefined) {
    return {
      name: "texte libre",
      mode: "free",
      taxonomyVersion: null,
      systemPrompt: GOLDEN_TAG_SYSTEM_PROMPT,
    };
  }

  if (taxonomy === "closed") {
    return {
      name: `liste fermée v${CURRENT_GOLDEN_TAXONOMY.version}`,
      mode: "closed",
      taxonomyVersion: CURRENT_GOLDEN_TAXONOMY.version,
      systemPrompt: renderTaxonomyPrompt(CURRENT_GOLDEN_TAXONOMY),
    };
  }

  if (taxonomy === "fine") {
    return {
      name: `labels fins rangés par tag fermé v${CURRENT_GOLDEN_TAXONOMY.version}`,
      mode: "fine",
      taxonomyVersion: CURRENT_GOLDEN_TAXONOMY.version,
      systemPrompt: renderFineLabelPrompt(CURRENT_GOLDEN_TAXONOMY),
    };
  }

  throw new Error(
    `TAXONOMY « ${taxonomy} » inconnue : « closed » pour la liste fermée, « fine » pour les labels fins, rien pour le texte libre.`,
  );
}

/** Identité d'une série comparable, celle que porte l'unicité de `GoldenDatasetRun`. */
export interface GoldenTagRecipe {
  readonly model: string;
  /**
   * Envoyée par le step et hachée par le script : la consigne stockée avec la
   * série est par construction celle qui part au modèle.
   */
  readonly systemPrompt: string;
  readonly temperature: number;
}

export interface GoldenTagInput {
  readonly item: BlindItem;
  readonly recipe: GoldenTagRecipe;
}

export interface GoldenTags {
  readonly blockageTag: string | null;
  readonly procedureTag: string | null;
}

export interface GoldenTagOutput extends GoldenTags {
  readonly rawOutput: string;
}

export function renderPrompt(template: string, item: BlindItem): string {
  const values: Record<string, string> = {
    organization: item.organization,
    subject: item.subject,
    description: item.description,
  };

  // Substitution par fonction et non par chaîne : passée en second argument de
  // `String.replace`, une description contenant « $& » ou « $' » serait
  // réinterprétée et le texte du signalement partirait déformé au modèle.
  return template.replace(
    /\{\{(organization|subject|description)\}\}/g,
    (_match, key: string) => values[key],
  );
}

export function promptHash(systemPrompt: string, userTemplate: string): string {
  return createHash("sha256")
    .update(systemPrompt)
    .update("\n")
    .update(userTemplate)
    .digest("hex");
}

/**
 * Libellés qui signifient « je ne sais pas » et valent donc absence de tag.
 *
 * « n » figure dans la liste parce que l'extraction coupe la valeur au premier
 * slash : un modèle qui répond « n/a » arrive ici amputé de sa seconde moitié.
 */
const UNDETERMINED_LABELS = new Set(["inconnu", "inconnue", "n/a", "na", "n"]);

/**
 * Politique d'évaluation, opposée à celle de `parseFreeTags` : le libellé est
 * gardé tel que le modèle l'a écrit, majuscules comprises et sans passer par la
 * table de synonymes. Canonicaliser la sortie du modèle sans canonicaliser
 * celle des humains ferait mesurer la table autant que le modèle.
 *
 * Aucun filtre de longueur non plus. Un modèle qui répond en six mots déborde
 * la consigne, mais la consigne s'adresse au modèle et n'est pas un critère de
 * stockage : écarter ces réponses reviendrait à retirer du corpus les cas où le
 * modèle obéit mal, donc à fabriquer un score flatteur.
 */
export function parseGoldenTags(text: string): GoldenTags {
  const values = extractAxisValues(text);
  return {
    blockageTag: keepLabel(values.get("blocage")),
    procedureTag: keepLabel(values.get("demarche")),
  };
}

function keepLabel(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  return UNDETERMINED_LABELS.has(normalizeSearchQuery(raw)) ? null : raw;
}

/**
 * Un seul appel LLM, et aucune réinjection des libellés déjà émergés, contrairement
 * au step voisin `summarize-tag` dont le mécanisme `knownLabels` invite à être
 * recopié. Ici la prédiction N dépendrait des prédictions 1 à N-1, donc de
 * l'ordre du corpus, de la concurrence des workers et du point de reprise :
 * deux passages de la même recette ne donneraient plus le même résultat et
 * l'unicité (model, promptHash, temperature) mentirait. Une prédiction doit
 * rester une fonction de la recette et de l'item, rien d'autre.
 */
export const goldenTagStep: Step<GoldenTagInput, GoldenTagOutput> = {
  name: "golden-tag",
  async run({ item, recipe }) {
    const { text } = await generateText({
      model: albertChatModel(recipe.model),
      temperature: recipe.temperature,
      system: recipe.systemPrompt,
      prompt: renderPrompt(GOLDEN_TAG_USER_TEMPLATE, item),
    });
    return { ...parseGoldenTags(text), rawOutput: text };
  },
};
