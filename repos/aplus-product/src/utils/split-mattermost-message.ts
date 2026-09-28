// Mattermost refuse ou tronque un post au-delà de 16 383 caractères ; on garde de la marge.
export const MATTERMOST_MAX_POST_LENGTH = 15000;

const TABLE_SEPARATOR = /^\|(\s*:?-+:?\s*\|)+\s*$/;

function isTableLine(line: string): boolean {
  return line.trimStart().startsWith("|");
}

function hardWrap(line: string, maxLength: number): string[] {
  if (line.length <= maxLength) return [line];
  const parts: string[] = [];
  for (let start = 0; start < line.length; start += maxLength) {
    parts.push(line.slice(start, start + maxLength));
  }
  return parts;
}

/**
 * Découpe un message en posts qui tiennent dans la limite de Mattermost, aux
 * frontières de ligne. Chaque suite reprend le titre et, au milieu d'un tableau,
 * son en-tête, pour que le markdown reste lisible post par post.
 */
export function splitMattermostMessage(
  message: string,
  maxLength: number = MATTERMOST_MAX_POST_LENGTH,
): string[] {
  if (message.length <= maxLength) return [message];

  const lines = message.split("\n");
  const continuationTitle = `${lines[0]} _(suite)_`;

  const posts: string[] = [];
  let current: string[] = [];
  let currentLength = 0;
  let tableHeader: string[] = [];

  function startPost(): void {
    current = [continuationTitle, "", ...tableHeader];
    currentLength = current.join("\n").length;
  }

  function flush(): void {
    posts.push(current.join("\n").trimEnd());
    startPost();
  }

  // Une ligne seule plus longue que la limite est coupée brutalement : cas
  // pathologique, mais il ne doit pas produire un post refusé.
  const lineLimit = Math.max(maxLength - continuationTitle.length - 200, 1);

  lines.forEach((rawLine, index) => {
    const opensTable =
      TABLE_SEPARATOR.test(rawLine) &&
      index > 0 &&
      isTableLine(lines[index - 1]);
    if (opensTable) tableHeader = [lines[index - 1], rawLine];
    else if (!isTableLine(rawLine)) tableHeader = [];

    for (const line of hardWrap(rawLine, lineLimit)) {
      const added = (current.length > 0 ? 1 : 0) + line.length;
      if (current.length > 0 && currentLength + added > maxLength) {
        flush();
        // La suite vient d'ouvrir le tableau avec son en-tête complet.
        if (opensTable) continue;
      }
      currentLength += (current.length > 0 ? 1 : 0) + line.length;
      current.push(line);
    }
  });

  posts.push(current.join("\n").trimEnd());
  return posts;
}
