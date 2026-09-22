import {
  ITEM_GROUPS,
  itemGroup,
  unanimousFills,
  type AdjudicationItem,
  type ItemGroup,
} from "@/utils/golden-dataset-adjudication";

export interface OverviewSummary {
  groups: Record<ItemGroup, number>;
  /**
   * Un nombre d'axes et non d'items : un item dont un seul axe est unanime en
   * apporte un. Le compte sort de `unanimousFills`, la fonction dont la
   * mutation `adjudicateUnanimous` dérive son `filled` ; annoncer autrement
   * ferait mentir le bouton sur ce que le serveur écrira.
   */
  pendingUnanimousAxes: number;
}

export function summarizeOverview(items: AdjudicationItem[]): OverviewSummary {
  const summary: OverviewSummary = {
    groups: {
      [ITEM_GROUPS.ADJUDICATED]: 0,
      [ITEM_GROUPS.UNANIMOUS]: 0,
      [ITEM_GROUPS.TO_DISCUSS]: 0,
    },
    pendingUnanimousAxes: 0,
  };

  for (const item of items) {
    summary.groups[itemGroup(item)] += 1;
    summary.pendingUnanimousAxes += unanimousFills(item).length;
  }

  return summary;
}
