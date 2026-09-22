# User Deactivation - Report Handling Specification

See notion in french here : https://www.notion.so/incubateurdesterritoires/App-v1-5-Cycle-de-vie-des-comptes-utilisateurs-effet-sur-les-fonctionnalit-s-2cd744bf03dd805e9714cd51e965f960?source=copy_link

## Overview

When a user is deactivated, the system handles their active reports differently based on their role (author, co-author, or recipient) and the availability of team members.

## Author/Co-author Scenarios

### Scenario 1: Author with Co-authors

**Condition:** User is the author AND the report has other co-authors

**Actions:**

- Post metadata message: `"<strong>[User Name]</strong> n'est plus actif. Les co-auteurs devront clôturer ce signalement."`
- No authorship change

### Scenario 2: Author without Co-authors (Team has members)

**Condition:** User is the author AND report has no other co-authors AND `applicantTeam` has other active members

**Actions:**

1. Find the most active team member (based on most recent answer activity)
2. Set this member as the new author (`authorId`)
3. Add remaining team members as co-authors
4. Post metadata message: `"<strong>[User Name]</strong> n'est plus actif. Les co-auteurs devront clôturer ce signalement."`

**Note:** The "most active" logic uses `answer.findMany` to find the team member with the most recent message. If no activity exists, the first team member is selected. This logic may change in the future (marked with TODO).

### Scenario 3: Author Alone in Team

**Condition:** User is the author AND report has no other co-authors AND `applicantTeam` has no other active members (or is null)

**Actions:**

1. Close the report (set status to `CLOSED`)
2. Create a `ReportStatusHistory` entry
3. Post metadata message: `"<strong>[User Name]</strong> n'est plus actif et était le seul membre de son équipe. Ce signalement est désormais clôturé, mais les destinataires peuvent toujours travailler à la résolution de la demande."`

### Scenario 4: Co-author Only

**Condition:** User is a co-author but NOT the author

**Actions:**

- Post metadata message: `"<strong>[User Name]</strong> n'est plus actif."`
- No other changes

## Recipient Scenarios

These scenarios apply when the user is a recipient (member of `requestedTeams`) but NOT an author or co-author of the report.

### Scenario 5: Recipient Alone in Team

**Condition:** User is a recipient AND user's team within `requestedTeams` has no other active members

**Actions:**

1. Close the report (set status to `CLOSED`)
2. Create a `ReportStatusHistory` entry
3. Post metadata message: `"<strong>[User Name]</strong> n'est plus actif et était le seul opérateur de son équipe. Ce signalement est désormais clôturé."`

### Scenario 6: Recipient Handled Report (Team has members)

**Condition:** User is a recipient AND handled the report (has `ReportStatusHistory` with status `IN_TREATMENT`) AND team has other active members

**Actions:**

1. Revert report status to `PENDING_ASSIGNMENT`
2. Create a `ReportStatusHistory` entry
3. Post metadata message: `"<strong>[User Name]</strong> n'est plus actif."`

### Scenario 7: Recipient Did Not Handle Report

**Condition:** User is a recipient AND did NOT handle the report AND team has other active members

**Actions:**

- Post metadata message: `"<strong>[User Name]</strong> n'est plus actif."`
- No other changes

## Scope

- Only **active reports** are affected (status in: `PENDING_ASSIGNMENT`, `IN_TREATMENT`, `OVERDUE`)
- Reports with status `COMPLETED`, `CLOSED`, or `DELETED` are not affected

## Implementation Details

### Team Source

- For **author scenarios**: The team used to find replacement authors is the report's `applicantTeam`
- For **recipient scenarios**: The user's team within `requestedTeams` is checked for other active members

### Handling Determination

A recipient is considered to have "handled" a report if they are the author of a `ReportStatusHistory` entry with status `IN_TREATMENT`.

### Most Active Member Selection

- Query recent answers from team members
- Select the member with the most recent `createdAt` timestamp
- Fallback to first member if no activity history exists

### Transaction

All operations (snapshot creation, user deactivation, session deletion, report updates, message creation) are executed in a single Prisma transaction.

## Files

- `src/trpc/routers/user.ts` - Main `deactivateUser` mutation
- `src/utils/report.ts` - Helper functions and message constants
- `src/trpc/routers/user.spec.ts` - Tests

## Message Constants

Located in `src/utils/report.ts`:

```typescript
export const DEACTIVATION_MESSAGES = {
  // Author scenarios
  AUTHOR_WITH_COAUTHORS: (name: string) =>
    `<strong>${name}</strong> n'est plus actif. Les co-auteurs devront clôturer ce signalement.`,
  AUTHOR_ALONE_CLOSED: (name: string) =>
    `<strong>${name}</strong> n'est plus actif et était le seul membre de son équipe. Ce signalement est désormais clôturé, mais les destinataires peuvent toujours travailler à la résolution de la demande.`,
  COAUTHOR_ONLY: (name: string) => `<strong>${name}</strong> n'est plus actif.`,
  // Recipient scenarios
  RECIPIENT_INACTIVE: (name: string) =>
    `<strong>${name}</strong> n'est plus actif.`,
  RECIPIENT_ALONE_CLOSED: (name: string) =>
    `<strong>${name}</strong> n'est plus actif et était le seul opérateur de son équipe. Ce signalement est désormais clôturé.`,
};
```

TODO: Checker le comportement: si en base je supprime un user d'une équipe, il continue à apparaitre en co auteur par ex. Voir comment on gère ça et si c'est normal,
