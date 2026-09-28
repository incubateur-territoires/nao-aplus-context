import {
  NO_BLOCKAGE_GOLDEN_TAG,
  OTHER_GOLDEN_TAG,
  sameTag,
  UNDETERMINED_GOLDEN_TAG,
} from "@/utils/golden-dataset-tag";
import {
  closedTagsOf,
  MIN_ITEMS_PER_TAG,
  validateTaxonomy,
} from "@/utils/golden-dataset-taxonomy";
import {
  GOLDEN_TAXONOMY_V1,
  type TaxonomyV1Tags,
} from "@/utils/golden-dataset-taxonomy-v1";
import { GOLDEN_TAG_AXES } from "@/utils/golden-dataset-golden-tags";

/**
 * Le gel de la v1 se prouve ici : les listes sont épinglées, donc une retouche
 * après le gel fait rougir la suite au lieu de réécrire la v1 en silence.
 */
describe("GOLDEN_TAXONOMY_V1", () => {
  it("est bien formée", () => {
    expect(validateTaxonomy(GOLDEN_TAXONOMY_V1)).toEqual([]);
  });

  it("garde ses onze tags de blocage, puis les deux exutoires", () => {
    expect(closedTagsOf(GOLDEN_TAXONOMY_V1, "blockageTag")).toEqual([
      "perte d'accès à la messagerie",
      "accès au compte en ligne impossible",
      "document ou courrier non reçu",
      "bug informatique",
      "versement bloqué",
      "absence de paiement",
      "dette ou retenue",
      "difficulté d'usage du numérique",
      "refus sans explication",
      "dossier incomplet ou erroné",
      NO_BLOCKAGE_GOLDEN_TAG,
      OTHER_GOLDEN_TAG,
      UNDETERMINED_GOLDEN_TAG,
    ]);
  });

  it("garde ses seize tags de démarche, puis les deux exutoires", () => {
    expect(closedTagsOf(GOLDEN_TAXONOMY_V1, "procedureTag")).toEqual([
      "demande de code provisoire",
      "accès au compte en ligne",
      "RSA",
      "mise à jour d'informations",
      "ASPA",
      "complémentaire santé (C2S)",
      "carte vitale",
      "demande d'informations",
      "AAH",
      "pension de réversion",
      "APL",
      "retraite personnelle",
      "carrière",
      "relevé de paiement",
      "attestation de droits",
      "prestations maladie",
      OTHER_GOLDEN_TAG,
      UNDETERMINED_GOLDEN_TAG,
    ]);
  });

  it("n'a « aucun » que sur l'axe blocage", () => {
    expect(closedTagsOf(GOLDEN_TAXONOMY_V1, "procedureTag")).not.toContain(
      NO_BLOCKAGE_GOLDEN_TAG,
    );
  });

  it("projette « inconnu » sur « inconnu » sur chaque axe", () => {
    for (const axis of GOLDEN_TAG_AXES) {
      expect(GOLDEN_TAXONOMY_V1.projection[axis]).toContainEqual([
        UNDETERMINED_GOLDEN_TAG,
        UNDETERMINED_GOLDEN_TAG,
      ]);
    }
  });

  it("ne projette que sur des tags de son axe", () => {
    for (const axis of GOLDEN_TAG_AXES) {
      const tags = closedTagsOf(GOLDEN_TAXONOMY_V1, axis);

      for (const [fineLabel, closedTag] of GOLDEN_TAXONOMY_V1.projection[
        axis
      ]) {
        expect({
          fineLabel,
          known: tags.some((tag) => sameTag(tag, closedTag)),
        }).toEqual({ fineLabel, known: true });
      }
    }
  });

  it("refuse un tag hors liste à la compilation", () => {
    // @ts-expect-error « retard » n'est pas un tag de l'axe blocage de la v1.
    const outOfList: TaxonomyV1Tags["blockageTag"] = "retard";

    expect(outOfList).toBe("retard");
  });

  it("documente la barre de mesure du guide", () => {
    expect(MIN_ITEMS_PER_TAG).toBe(3);
  });
});
