export const LINE_DIFF_KINDS = {
  SAME: "same",
  ADDED: "added",
  REMOVED: "removed",
} as const;

export type LineDiffKind =
  (typeof LINE_DIFF_KINDS)[keyof typeof LINE_DIFF_KINDS];

export interface LineDiff {
  readonly kind: LineDiffKind;
  readonly text: string;
}

/** Diff ligne à ligne par plus longue sous-suite commune ; quadratique, pour des textes courts. */
export function diffLines(before: string, after: string): LineDiff[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const common: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      common[i][j] =
        a[i] === b[j]
          ? common[i + 1][j + 1] + 1
          : Math.max(common[i + 1][j], common[i][j + 1]);
    }
  }

  const lines: LineDiff[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lines.push({ kind: LINE_DIFF_KINDS.SAME, text: a[i] });
      i++;
      j++;
    } else if (
      i < a.length &&
      (j === b.length || common[i + 1][j] >= common[i][j + 1])
    ) {
      lines.push({ kind: LINE_DIFF_KINDS.REMOVED, text: a[i] });
      i++;
    } else {
      lines.push({ kind: LINE_DIFF_KINDS.ADDED, text: b[j] });
      j++;
    }
  }

  return lines;
}
