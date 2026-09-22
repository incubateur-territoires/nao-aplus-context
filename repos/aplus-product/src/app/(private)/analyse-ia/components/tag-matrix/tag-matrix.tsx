import Table from "@codegouvfr/react-dsfr/Table";
import Tag from "@codegouvfr/react-dsfr/Tag";
import type { FreeTag } from "@/lib/ai/tag-axes";

/**
 * Matrice de croisement organisme × blocage : effectifs par paire, lignes et
 * colonnes triées par fréquence. Répond à « à la CARSAT, qu'est-ce qui
 * coince ? » — ce que l'agrégation à plat par axe ne montre pas. Chaque
 * cellule non vide est cliquable et applique le couple de filtres
 * correspondant aux résultats.
 */

interface MatrixItem {
  tags: FreeTag[];
}

interface TagMatrixProps {
  items: MatrixItem[];
  filters: FreeTag[];
  onSelectPair: (organisme: FreeTag, blocage: FreeTag) => void;
}

// Caractère nul : impossible dans un libellé, la clé de paire est non ambiguë
// (une espace ne suffirait pas, les libellés en contiennent).
const PAIR_SEPARATOR = "\u0000";

export interface MatrixData {
  organismes: string[];
  blocages: string[];
  counts: Map<string, number>;
  rowTotals: Map<string, number>;
  excluded: number;
}

export function pairKey(organisme: string, blocage: string): string {
  return `${organisme}${PAIR_SEPARATOR}${blocage}`;
}

export function buildMatrix(items: MatrixItem[]): MatrixData {
  const counts = new Map<string, number>();
  const rowTotals = new Map<string, number>();
  const colTotals = new Map<string, number>();
  let excluded = 0;

  for (const item of items) {
    const organisme = item.tags.find((tag) => tag.axis === "organisme");
    const blocage = item.tags.find((tag) => tag.axis === "blocage");
    if (!organisme || !blocage) {
      excluded++;
      continue;
    }
    const key = pairKey(organisme.label, blocage.label);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    rowTotals.set(organisme.label, (rowTotals.get(organisme.label) ?? 0) + 1);
    colTotals.set(blocage.label, (colTotals.get(blocage.label) ?? 0) + 1);
  }

  const byCountDesc = (a: [string, number], b: [string, number]) => b[1] - a[1];
  return {
    organismes: [...rowTotals.entries()].sort(byCountDesc).map(([l]) => l),
    blocages: [...colTotals.entries()].sort(byCountDesc).map(([l]) => l),
    counts,
    rowTotals,
    excluded,
  };
}

export function TagMatrix({ items, filters, onSelectPair }: TagMatrixProps) {
  const matrix = buildMatrix(items);
  if (matrix.organismes.length === 0) return null;

  function isPairActive(organisme: string, blocage: string) {
    return (
      filters.some((f) => f.axis === "organisme" && f.label === organisme) &&
      filters.some((f) => f.axis === "blocage" && f.label === blocage)
    );
  }

  const headers = ["Organisme", ...matrix.blocages, "Total"];
  const data = matrix.organismes.map((organisme) => [
    <span key="label" className="font-bold">
      {organisme}
    </span>,
    ...matrix.blocages.map((blocage) => {
      const count = matrix.counts.get(pairKey(organisme, blocage)) ?? 0;
      if (count === 0) {
        return (
          <span key={blocage} className="text-[#929292]">
            –
          </span>
        );
      }
      return (
        <Tag
          key={blocage}
          small
          pressed={isPairActive(organisme, blocage)}
          nativeButtonProps={{
            "aria-label": `${organisme} × ${blocage} : ${count} signalement${count > 1 ? "s" : ""}`,
            onClick: () =>
              onSelectPair(
                { axis: "organisme", label: organisme },
                { axis: "blocage", label: blocage },
              ),
          }}
        >
          {count}
        </Tag>
      );
    }),
    <span key="total" className="font-bold">
      {matrix.rowTotals.get(organisme)}
    </span>,
  ]);

  return (
    <section>
      <Table
        caption="Croisement organisme × blocage"
        headers={headers}
        data={data}
      />
      {matrix.excluded > 0 && (
        <p className="m-0 text-sm text-[#666]">
          {matrix.excluded} signalement{matrix.excluded > 1 ? "s" : ""} hors
          matrice (organisme ou blocage non identifié).
        </p>
      )}
    </section>
  );
}
