import type { Prisma } from "@/generated/prisma/client";

/**
 * Item du corpus tel qu'un modèle a le droit de le voir : jamais les tags posés
 * par les annotateurs humains, sinon la comparaison ne mesure plus rien.
 *
 * Le typage structurel de TypeScript ne suffit pas à fermer ce vecteur. Une
 * ligne Prisma plus large, chargée avec ses `annotations`, passe sans broncher
 * là où une interface nue est attendue dès lors qu'elle vient d'une variable et
 * non d'un littéral : le contrôle des propriétés en trop ne s'applique qu'aux
 * littéraux. D'où les deux gardes de ce module, qui se complètent.
 *
 * La marque `blind` interdit de fabriquer un `BlindItem` autrement que par
 * `toBlindItem`, seule frontière du dossier où un `as` est autorisé, et
 * `annotations?: never` fait rejeter à cette frontière tout objet qui les
 * porte. `BLIND_SELECT` ferme l'autre moitié du problème, à l'exécution :
 * l'objet renvoyé par Postgres n'a littéralement pas de propriété
 * `annotations`, donc ni un log, ni une capture d'erreur, ni une sérialisation
 * ne peut l'emporter jusqu'au prompt.
 */

declare const blind: unique symbol;

export interface BlindSource {
  readonly id: string;
  readonly organization: string;
  readonly subject: string;
  readonly description: string;
  readonly annotations?: never;
  readonly blockageTag?: never;
  readonly procedureTag?: never;
}

export interface BlindItem {
  readonly [blind]: true;
  readonly id: string;
  readonly organization: string;
  readonly subject: string;
  readonly description: string;
}

/**
 * `organization` est dans la sélection parce que l'annotateur humain le lit à
 * l'écran, en tête de la fiche d'annotation. Le retirer donnerait au modèle une
 * information de moins qu'à l'humain et rendrait la comparaison inéquitable.
 */
export const BLIND_SELECT = {
  id: true,
  organization: true,
  subject: true,
  description: true,
} as const satisfies Prisma.GoldenDatasetItemSelect;

export function toBlindItem(source: BlindSource): BlindItem {
  return {
    id: source.id,
    organization: source.organization,
    subject: source.subject,
    description: source.description,
  } as BlindItem;
}
