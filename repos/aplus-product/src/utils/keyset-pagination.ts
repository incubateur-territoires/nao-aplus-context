export interface NewestFirstCursor {
  createdAt: Date;
  id: string;
}

export const NEWEST_FIRST = [
  { createdAt: "desc" },
  { id: "desc" },
] as const satisfies { createdAt?: "desc"; id?: "desc" }[];

/**
 * Lignes plus anciennes que le curseur. Contrairement à `cursor` + `skip: 1`,
 * rien n'est sauté quand la ligne du curseur a quitté le filtre entre-temps.
 */
export function olderThan(cursor: NewestFirstCursor | null) {
  if (cursor === null) return {};
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}

/** Curseur de la page suivante : la dernière ligne de la page courante. */
export function nextCursor(page: NewestFirstCursor[]): NewestFirstCursor {
  const last = page[page.length - 1];
  return { createdAt: last.createdAt, id: last.id };
}
