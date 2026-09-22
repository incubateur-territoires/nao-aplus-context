import { Fragment } from "react";
import { normalizeSearchQuery } from "@/utils/normalize";

/**
 * Normalise une chaîne en retirant les accents, et retourne un mapping
 * des positions normalisées vers les positions originales.
 */
function normalizeWithMapping(str: string): {
  normalized: string;
  toOriginal: number[];
} {
  const toOriginal: number[] = [];
  let normalized = "";

  for (let i = 0; i < str.length; i++) {
    const nfd = str[i].normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    for (let j = 0; j < nfd.length; j++) {
      toOriginal.push(i);
      normalized += nfd[j];
    }
  }
  // Sentinel pour faciliter le calcul de la fin
  toOriginal.push(str.length);

  return { normalized: normalized.toLowerCase(), toOriginal };
}

/**
 * Highlights all occurrences of a query string in text by wrapping matches in a span with blue background.
 * Case-insensitive matching. For multi-word queries, highlights each word separately.
 *
 * @param text - The text to search in
 * @param query - The search query to highlight (can contain spaces for multi-word queries)
 * @returns React node with highlighted matches, or original text if query is empty
 */
export function highlightText(text: string, query: string): React.ReactNode {
  if (!query || query.trim() === "") {
    return text;
  }

  const trimmedQuery = query.trim();
  const queryWords = trimmedQuery
    .split(/\s+/)
    .filter((word) => word.length > 0);

  // If query has multiple words, highlight each word separately
  if (queryWords.length > 1) {
    return highlightMultipleWords(text, queryWords);
  }

  // Single word query
  return highlightSingleWord(text, trimmedQuery);
}

function highlightMultipleWords(
  text: string,
  words: string[],
): React.ReactNode {
  const { normalized, toOriginal } = normalizeWithMapping(text);
  const matches: Array<{ start: number; end: number }> = [];

  // Find all matches for all words in the normalized text
  words.forEach((word) => {
    const normalizedWord = normalizeSearchQuery(word);
    let index = normalized.indexOf(normalizedWord, 0);
    while (index !== -1) {
      // Map normalized positions back to original text positions
      const origStart = toOriginal[index];
      const origEnd = toOriginal[index + normalizedWord.length];
      matches.push({ start: origStart, end: origEnd });
      index = normalized.indexOf(normalizedWord, index + 1);
    }
  });

  // Sort matches by position
  matches.sort((a, b) => a.start - b.start);

  // Merge overlapping matches
  const mergedMatches: Array<{ start: number; end: number }> = [];
  matches.forEach((match) => {
    const lastMatch = mergedMatches[mergedMatches.length - 1];
    if (lastMatch && match.start < lastMatch.end) {
      lastMatch.end = Math.max(lastMatch.end, match.end);
    } else {
      mergedMatches.push({ ...match });
    }
  });

  // Build the result with highlights
  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  mergedMatches.forEach((match, idx) => {
    if (match.start > lastIndex) {
      parts.push(text.substring(lastIndex, match.start));
    }
    parts.push(
      <span
        key={`${match.start}-${idx}`}
        style={{ backgroundColor: "#BFDBFE" }}
      >
        {text.substring(match.start, match.end)}
      </span>,
    );
    lastIndex = match.end;
  });

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  if (parts.length === 0 || parts.every((part) => typeof part === "string")) {
    return text;
  }

  return <Fragment>{parts}</Fragment>;
}

function highlightSingleWord(text: string, query: string): React.ReactNode {
  const { normalized, toOriginal } = normalizeWithMapping(text);
  const normalizedQuery = normalizeSearchQuery(query);
  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  let index = normalized.indexOf(normalizedQuery, 0);

  while (index !== -1) {
    const origStart = toOriginal[index];
    const origEnd = toOriginal[index + normalizedQuery.length];

    if (origStart > lastIndex) {
      parts.push(text.substring(lastIndex, origStart));
    }

    parts.push(
      <span key={origStart} style={{ backgroundColor: "#BFDBFE" }}>
        {text.substring(origStart, origEnd)}
      </span>,
    );

    lastIndex = origEnd;
    index = normalized.indexOf(normalizedQuery, index + normalizedQuery.length);
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  if (parts.length === 0 || parts.every((part) => typeof part === "string")) {
    return text;
  }

  return <Fragment>{parts}</Fragment>;
}
