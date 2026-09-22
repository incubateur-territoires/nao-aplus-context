import {
  GOLDEN_TAG_AXES,
  type GoldenTagAxis,
} from "@/utils/golden-dataset-golden-tags";
import { sameTag } from "@/utils/golden-dataset-tag";

/**
 * L'accord se mesure entre humains, jamais contre une prédiction : confronter
 * un modèle aux annotateurs mesure sa performance, pas la clarté de la
 * consigne. La forme de l'entrée le rend impossible plutôt que de le dire en
 * commentaire, une prédiction portant un `runId` et non un `annotatorId`.
 */
export interface AgreementAnnotation {
  annotatorId: string;
  blockageTag: string | null;
  procedureTag: string | null;
}

export interface AgreementItem {
  annotations: AgreementAnnotation[];
}

export interface AnnotatorPairAgreement {
  a: string;
  b: string;
  compared: number;
  agreed: number;
}

export interface AxisAgreement {
  pairs: AnnotatorPairAgreement[];
  compared: number;
  agreed: number;
}

export type AgreementByAxis = Record<GoldenTagAxis, AxisAgreement>;

function orderedAnnotatorIds(items: AgreementItem[]): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    for (const annotation of item.annotations) {
      if (!seen.has(annotation.annotatorId)) {
        seen.add(annotation.annotatorId);
        ordered.push(annotation.annotatorId);
      }
    }
  }

  return ordered;
}

/**
 * Toutes les paires sont créées d'avance, y compris celles que le corpus ne
 * permettra pas de comparer une seule fois. La fonction reste totale et c'est
 * l'affichage qui décide de masquer une paire vide, pas le calcul.
 */
function emptyAxisAgreement(annotatorIds: string[]): AxisAgreement {
  const pairs: AnnotatorPairAgreement[] = [];

  for (let i = 0; i < annotatorIds.length; i += 1) {
    for (let j = i + 1; j < annotatorIds.length; j += 1) {
      pairs.push({
        a: annotatorIds[i],
        b: annotatorIds[j],
        compared: 0,
        agreed: 0,
      });
    }
  }

  return { pairs, compared: 0, agreed: 0 };
}

/**
 * Un item ne compte pour une paire que si les deux annotateurs ont posé un tag
 * sur l'axe : une absence n'est pas un désaccord, elle ne dit rien.
 *
 * Les totaux de l'axe somment les paires plutôt que d'en moyenner les taux, si
 * bien qu'une paire qui a beaucoup annoté pèse plus qu'une paire qui a à peine
 * commencé. C'est voulu, la moyenne des taux laisserait deux comparaisons
 * corriger deux cents.
 */
export function computeAgreement(items: AgreementItem[]): AgreementByAxis {
  const annotatorIds = orderedAnnotatorIds(items);
  const byAxis: AgreementByAxis = {
    blockageTag: emptyAxisAgreement(annotatorIds),
    procedureTag: emptyAxisAgreement(annotatorIds),
  };

  for (const item of items) {
    const byAnnotator = new Map(
      item.annotations.map((annotation) => [
        annotation.annotatorId,
        annotation,
      ]),
    );

    for (const axis of GOLDEN_TAG_AXES) {
      const axisAgreement = byAxis[axis];

      for (const pair of axisAgreement.pairs) {
        const tagA = byAnnotator.get(pair.a)?.[axis] ?? null;
        const tagB = byAnnotator.get(pair.b)?.[axis] ?? null;
        if (tagA === null || tagB === null) {
          continue;
        }

        pair.compared += 1;
        axisAgreement.compared += 1;

        if (sameTag(tagA, tagB)) {
          pair.agreed += 1;
          axisAgreement.agreed += 1;
        }
      }
    }
  }

  return byAxis;
}
