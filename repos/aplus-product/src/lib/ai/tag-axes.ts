import { normalizeSearchQuery } from "@/utils/normalize";

/**
 * Axes du tagage libre et parsing de la réponse du modèle. Module pur (aucune
 * dépendance au SDK `ai` ni au provider Albert) : il est importé aussi bien par
 * le step serveur `summarize-tag` que par l'affichage client des résultats.
 *
 * Pendant de `taxonomy.ts` pour `tagStep` : ici la liste des libellés n'est pas
 * figée, seuls les AXES le sont.
 */

export const TAG_AXES = [
  "organisme",
  "demarche",
  "blocage",
  "urgence",
] as const;

export type TagAxis = (typeof TAG_AXES)[number];

export interface FreeTag {
  axis: TagAxis;
  label: string;
}

export const TAG_AXIS_LABELS: Record<TagAxis, string> = {
  organisme: "Organisme",
  demarche: "Démarche",
  blocage: "Blocage",
  urgence: "Urgence",
};

// Libellés non informatifs : le modèle les sort quand il ne sait pas. Mieux vaut
// pas de tag qu'un tag creux qui pollue l'agrégation.
const EMPTY_LABELS = new Set([
  "inconnu",
  "inconnue",
  // Le modèle répond parfois en anglais malgré la consigne.
  "unknown",
  "none",
  "not applicable",
  "aucun",
  "aucune",
  "indetermine",
  "indeterminee",
  "non identifie",
  "non identifiee",
  "non applicable",
  "sans objet",
  "non precise",
  "non precisee",
  "non renseigne",
  "non renseignee",
  "n/a",
  "na",
  "-",
  "administratif",
  "blocage",
  "demarche",
  "aide",
  "dossier",
  "probleme",
  "erreur",
  "communication",
  "droits sociaux",
  "aucune urgence",
  "pas d'urgence",
  "non urgent",
]);

// Synonymes récurrents → libellé canonique. Sans cette fusion, l'agrégation se
// fragmente (« non-réponse », « dossier sans réponse », « demande non traitée »
// comptés séparément) et aucune fréquence ne se dégage. Clés normalisées via
// `normalizeSearchQuery` (minuscules, sans accents).
const CANONICAL_LABELS: Record<string, string> = {
  // organisme
  "pole emploi": "france travail",
  "assurance maladie": "cpam",
  ameli: "cpam",
  "assurance retraite": "carsat",
  "caisse de retraite": "carsat",
  dgfip: "impôts",
  "centre des impots": "impôts",
  // blocage
  "non-reponse": "absence de réponse",
  "non reponse": "absence de réponse",
  "dossier sans reponse": "absence de réponse",
  "demande non traitee": "absence de réponse",
  "pas de reponse": "absence de réponse",
  "aucune reponse": "absence de réponse",
  "sans reponse": "absence de réponse",
  "refus de piece": "pièce justificative refusée",
  "piece refusee": "pièce justificative refusée",
  "refus de piece justificative": "pièce justificative refusée",
  "piece manquante": "pièce justificative manquante",
  // urgence
  "perte ressources": "rupture de ressources",
  "perte de ressources": "rupture de ressources",
  "sans ressources": "rupture de ressources",
  "rupture ressources": "rupture de ressources",
};

// Plafond de longueur de l'agrégation analytique. Plus serré que celui de
// l'extraction : un libellé de plus de 40 caractères se compte tout seul dans
// une distribution, il ne fusionne avec rien et n'apprend rien.
const MAX_AGGREGATED_LABEL_LENGTH = 40;

// Au-delà, le modèle a répondu par une phrase et non par un tag. Même valeur que
// la borne imposée aux annotateurs humains dans `golden-dataset-tag.ts`, mais
// recopiée plutôt qu'importée : ce module sert l'agrégation analytique et ne
// doit pas dépendre du golden dataset, qui n'en est qu'un consommateur.
const MAX_EXTRACTED_LABEL_LENGTH = 60;

/**
 * Extraction brute des lignes `AXE: valeur`, sans aucune politique : valeur
 * rendue telle que le modèle l'a écrite, casse comprise.
 *
 * Séparée de `parseFreeTags` parce que deux usages en ont besoin avec des
 * politiques opposées. L'agrégation analytique veut des libellés minusculés et
 * fusionnés par `CANONICAL_LABELS` ; l'évaluation d'un modèle contre les
 * annotations humaines les veut intacts, sinon elle mesure la table de
 * synonymes autant que le modèle.
 */
export function extractAxisValues(text: string): Map<TagAxis, string> {
  const byAxis = new Map<TagAxis, string>();

  for (const line of text.split("\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;

    // Le modèle décore parfois l'axe (« - **ORGANISME** ») : on ne garde que
    // les lettres avant de comparer.
    const axisKey = normalizeSearchQuery(
      line.slice(0, separatorIndex).replace(/[^\p{L}]/gu, ""),
    );
    const axis = TAG_AXES.find((candidate) => candidate === axisKey);
    if (!axis || byAxis.has(axis)) continue;

    // Le modèle glisse parfois plusieurs valeurs malgré la consigne : on ne
    // garde que la première, et on retire puces et guillemets résiduels.
    const raw = line
      .slice(separatorIndex + 1)
      .split(/[,;/]/)[0]
      .replace(/^[\s\-•*"'«]+|[\s"'»]+$/g, "");

    if (raw.length === 0 || raw.length > MAX_EXTRACTED_LABEL_LENGTH) continue;

    byAxis.set(axis, raw);
  }

  return byAxis;
}

/**
 * Découpe la réponse `AXE: libellé` du modèle en tags par axe : un tag par axe
 * au plus, libellés creux écartés, ordre des axes garanti par `TAG_AXES`.
 */
export function parseFreeTags(text: string): FreeTag[] {
  const byAxis = extractAxisValues(text);
  const tags: FreeTag[] = [];

  for (const axis of TAG_AXES) {
    const raw = byAxis.get(axis)?.toLowerCase();
    if (raw === undefined || raw.length > MAX_AGGREGATED_LABEL_LENGTH) continue;

    const label = CANONICAL_LABELS[normalizeSearchQuery(raw)] ?? raw;
    if (EMPTY_LABELS.has(normalizeSearchQuery(label))) continue;

    tags.push({ axis, label });
  }

  return tags;
}

/**
 * Découpe la réponse du step combiné résumé + tagage : tout ce qui précède la
 * première ligne d'axe est le résumé (préfixe `RESUME:` retiré s'il est là),
 * le reste part dans `parseFreeTags`. Fusionner les deux tâches en un appel
 * divise la consommation de requêtes Albert.
 */
export function parseSummaryAndTags(text: string): {
  summary: string;
  tags: FreeTag[];
} {
  const lines = text.split("\n");
  let firstAxisLine = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const separatorIndex = lines[i].indexOf(":");
    if (separatorIndex === -1) continue;
    const key = normalizeSearchQuery(
      lines[i].slice(0, separatorIndex).replace(/[^\p{L}]/gu, ""),
    );
    if ((TAG_AXES as readonly string[]).includes(key)) {
      firstAxisLine = i;
      break;
    }
  }

  const summary = lines
    .slice(0, firstAxisLine)
    .join("\n")
    .replace(/^\s*\**r[ée]sum[ée]?\**\s*:\s*/i, "")
    .trim();

  return {
    summary,
    tags: parseFreeTags(lines.slice(firstAxisLine).join("\n")),
  };
}
