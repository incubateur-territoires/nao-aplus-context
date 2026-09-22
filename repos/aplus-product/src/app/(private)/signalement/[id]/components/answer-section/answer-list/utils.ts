import type {
  AnswersType,
  AnswerType,
  ReportStatusHistoryType,
  TimelineItem,
  TimelineGroup,
  TimelineAnswerItem,
} from "./types";

/**
 * Regroupe les éléments de la timeline par étape de statut pour produire une
 * structure de liste sémantique (correctif RGAA — lecteurs d'écran).
 *
 * Chaque changement de statut ouvre une nouvelle étape (`<li>` de la liste
 * principale) ; les messages qui suivent ce statut, jusqu'au statut suivant,
 * lui sont rattachés (`<ol><li>` imbriquée).
 *
 * Cas limite : si des messages apparaissent avant tout changement de statut,
 * ils forment une première étape sans statut (`status: null`).
 */
export function groupTimeline(timelineItems: TimelineItem[]): TimelineGroup[] {
  const groups: TimelineGroup[] = [];
  let current: TimelineGroup | null = null;

  for (const item of timelineItems) {
    if (item.kind === "status") {
      current = { status: item.status, answers: [] };
      groups.push(current);
    } else {
      if (!current) {
        current = { status: null, answers: [] };
        groups.push(current);
      }
      current.answers.push(item as TimelineAnswerItem);
    }
  }

  return groups;
}

export function buildTimeline(
  answers: AnswersType,
  statusHistory: ReportStatusHistoryType[],
): TimelineItem[] {
  if (!answers.length && !statusHistory.length) {
    return [];
  }

  // Build answer index map in single pass
  const answerIndexMap = new Map<string, number>();
  answers.forEach((answer, index) => {
    answerIndexMap.set(answer.id, index);
  });

  // Group status entries by answerId and collect standalone entries
  const statusByAnswerId = new Map<string, ReportStatusHistoryType[]>();
  const standaloneStatusEntries: ReportStatusHistoryType[] = [];

  for (const statusEntry of statusHistory) {
    if (statusEntry.answerId) {
      const existing = statusByAnswerId.get(statusEntry.answerId);
      if (existing) {
        existing.push(statusEntry);
      } else {
        statusByAnswerId.set(statusEntry.answerId, [statusEntry]);
      }
    } else {
      standaloneStatusEntries.push(statusEntry);
    }
  }

  // Pre-allocate array with approximate size
  const allItems: Array<{
    kind: "answer" | "status";
    answer?: AnswerType;
    status?: ReportStatusHistoryType;
    index?: number;
    sortKey: number;
  }> = [];

  // Add standalone status entries
  for (const statusEntry of standaloneStatusEntries) {
    allItems.push({
      kind: "status",
      status: statusEntry,
      sortKey: new Date(statusEntry.createdAt).getTime(),
    });
  }

  // Add answers and their linked status entries
  for (const answer of answers) {
    const index = answerIndexMap.get(answer.id) ?? 0;
    const answerTime = new Date(answer.createdAt).getTime();

    // Add linked status entries (appear before answer)
    const linkedStatusEntries = statusByAnswerId.get(answer.id);
    if (linkedStatusEntries) {
      for (const statusEntry of linkedStatusEntries) {
        allItems.push({
          kind: "status",
          status: statusEntry,
          sortKey: answerTime - 1,
        });
      }
    }

    // Add the answer
    allItems.push({
      kind: "answer",
      answer,
      index,
      sortKey: answerTime,
    });
  }

  // Single sort operation
  allItems.sort((a, b) => a.sortKey - b.sortKey);

  // Build final timeline with hasStatusAfter flag
  const timelineItems: TimelineItem[] = new Array(allItems.length);

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    if (item.kind === "answer") {
      const hasStatusAfter =
        i + 1 < allItems.length && allItems[i + 1].kind === "status";
      timelineItems[i] = {
        kind: "answer",
        answer: item.answer!,
        index: item.index!,
        hasStatusAfter,
      };
    } else {
      timelineItems[i] = { kind: "status", status: item.status! };
    }
  }

  return timelineItems;
}

/**
 * Détermine l'équipe à afficher dans la signature d'une réponse.
 *
 * Un utilisateur peut appartenir à plusieurs équipes (ex: un opérateur CARSAT
 * membre de l'Ain ET du Jura). Le modèle `Answer` ne stocke pas l'équipe « au nom
 * de laquelle » la réponse a été rédigée : on l'infère donc en croisant les équipes
 * de l'auteur avec les équipes impliquées dans CE signalement (l'équipe demandeuse
 * `applicantTeam` et les équipes sollicitées `requestedTeams`).
 *
 * On ne se fie jamais à `teams[0]` : l'ordre des équipes n'est pas garanti par la
 * base, ce qui faisait afficher une équipe arbitraire pour les utilisateurs
 * multi-équipes.
 */
export function getAuthorGroup(answer: AnswerType) {
  const authorTeams = answer.author?.teams;
  if (!authorTeams?.length) return undefined;

  // Identifiants des équipes réellement impliquées dans ce signalement.
  const reportTeamIds = new Set<string>([
    answer.report.applicantTeam.id,
    ...answer.report.requestedTeams.map((team) => team.id),
  ]);

  // L'équipe de l'auteur qui correspond à ce signalement.
  const matchingTeam = authorTeams.find((team) => reportTeamIds.has(team.id));

  // Repli défensif : si aucune correspondance, on garde la première équipe.
  return matchingTeam ?? authorTeams[0];
}

export function shouldShowOnlyTime(
  answer: AnswerType,
  answers: AnswersType | undefined,
  currentIndex: number | undefined,
): boolean {
  if (!answers || currentIndex === undefined || currentIndex === 0)
    return false;

  const previousAnswer = answers[currentIndex - 1];
  const isSameDay =
    new Date(answer.createdAt).toDateString() ===
    new Date(previousAnswer.createdAt).toDateString();
  const isSameAuthor = answer.authorId === previousAnswer.authorId;

  return isSameDay && isSameAuthor;
}

/**
 * Determines whether to show author information for a message.
 *
 * When `isMessageVisible` is provided, the function skips hidden messages when looking ahead
 * to find the next visible message. This ensures that author names appear only once on the
 * last visible message from the same author, even when there are hidden messages (e.g.,
 * instructor-only messages for helpers) in between.
 *
 * @param answer - The current answer/message
 * @param answers - The full array of answers
 * @param currentIndex - The index of the current answer in the answers array
 * @param isMessageVisible - Optional function to check if a message is visible to the current user.
 *                          When provided, hidden messages are skipped when looking for the next message.
 *                          When not provided, uses default behavior (backward compatible).
 * @returns `true` if author info should be shown, `false` otherwise
 *
 * @example
 * For helpers viewing messages with hidden instructor-only messages:
 * const isHelperVisible = (answer) => !answer.isOperatorOnly;
 * shouldShowAuthorInfo(message1, [message1, hiddenMessage, message2], 0, isHelperVisible);
 * Returns false (next visible message is from same author)
 *
 * shouldShowAuthorInfo(message2, [message1, hiddenMessage, message2], 2, isHelperVisible);
 * Returns true (last visible message from this author)
 */
export function shouldShowAuthorInfo(
  answer: AnswerType,
  answers: AnswersType | undefined,
  currentIndex: number | undefined,
  isMessageVisible?: (answer: AnswerType) => boolean,
): boolean {
  if (!answers || currentIndex === undefined) return true;

  // If no visibility check provided, use default behavior (for backward compatibility)
  if (!isMessageVisible) {
    // Always show for the last message
    if (currentIndex === answers.length - 1) return true;

    const nextAnswer = answers[currentIndex + 1];
    if (!nextAnswer) return true;

    // Show author info if the next message is from a different author
    const isNextMessageDifferentAuthor =
      answer.authorId !== nextAnswer.authorId;
    if (isNextMessageDifferentAuthor) return true;

    // Show author info if the next message is from the same author but different category (normal vs instructor-only)
    const isDifferentCategory =
      answer.isOperatorOnly !== nextAnswer.isOperatorOnly;
    if (isDifferentCategory) return true;

    // Don't show if next message is from same author and same category
    return false;
  }

  // Check if current message is visible
  if (!isMessageVisible(answer)) return false;

  // Find the next visible message
  let nextVisibleIndex = currentIndex + 1;
  while (nextVisibleIndex < answers.length) {
    const nextAnswer = answers[nextVisibleIndex];
    if (isMessageVisible(nextAnswer)) {
      // Found next visible message - show author info if it's from a different author
      return answer.authorId !== nextAnswer.authorId;
    }
    nextVisibleIndex++;
  }

  // No more visible messages after this one - this is the last visible message
  return true;
}

export function getMessageSpacing(
  answer: AnswerType,
  answers: AnswersType | undefined,
  currentIndex: number | undefined,
): string {
  if (!answers || currentIndex === undefined || currentIndex === 0) return "";

  const previousAnswer = answers[currentIndex - 1];
  const isSameAuthor = answer.authorId === previousAnswer.authorId;
  const isDifferentCategory =
    answer.isOperatorOnly !== previousAnswer.isOperatorOnly;

  // Smaller gap for consecutive messages from same author
  if (isDifferentCategory) return "mt-8";

  return isSameAuthor ? "mt-6" : "mt-8";
}
