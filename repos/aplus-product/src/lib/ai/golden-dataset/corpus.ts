import prisma from "@/lib/prisma";
import { BLIND_SELECT, toBlindItem, type BlindItem } from "./blind-item";

/**
 * Seul module du dossier autorisé à lire la base. Concentrer l'accès ici laisse
 * une seule requête à relire pour vérifier qu'aucune annotation humaine ne
 * remonte : partout ailleurs, les items ne circulent que sous la forme déjà
 * marquée `BlindItem`.
 */
export async function loadBlindCorpus(runId: string): Promise<BlindItem[]> {
  const rows = await prisma.goldenDatasetItem.findMany({
    where: { predictions: { none: { runId } } },
    select: BLIND_SELECT,
    orderBy: { position: "asc" },
  });
  return rows.map(toBlindItem);
}
