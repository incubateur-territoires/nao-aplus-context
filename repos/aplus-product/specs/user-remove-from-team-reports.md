# User Remove from Team - Report Handling Specification

## Overview

When a user is removed from a team, the system handles their active reports differently based on their role (author, co-author, or recipient) and the availability of other team members. This is similar to user deactivation but **scoped to the specific team** being removed from.

**Key difference from deactivation:** The user remains active in the system and may still be part of other teams.

## Author/Co-author Scenarios

These scenarios apply when the user is an author or co-author of reports **belonging to the team they are being removed from** (`applicantTeamId = teamId`).

### Scenario 1: Author with Co-authors

**Condition:** User is the author AND the report has other co-authors

**Actions:**

- Post metadata message: `"<strong>[User Name]</strong> a été retiré de l'équipe. Les co-auteurs devront poursuivre le traitement de ce signalement."`
- No authorship change

### Scenario 2: Author without Co-authors (Team has members)

**Condition:** User is the author AND report has no other co-authors AND `applicantTeam` has other active members

**Actions:**

1. Find the most active team member (based on most recent answer activity)
2. Set this member as the new author (`authorId`)
3. Add remaining team members as co-authors
4. Post metadata message: `"<strong>[User Name]</strong> a été retiré de l'équipe. Le signalement a été transféré à un autre membre."`

**Note:** The "most active" logic uses `answer.findMany` to find the team member with the most recent message. If no activity exists, the first team member is selected.

### Scenario 3: Author Alone in Team

**Condition:** User is the author AND report has no other co-authors AND `applicantTeam` has no other active members

**Actions:**

1. Close the report (set status to `CLOSED`)
2. Create a `ReportStatusHistory` entry
3. Post metadata message: `"<strong>[User Name]</strong> a été retiré de l'équipe et était le seul membre. Ce signalement est désormais clôturé."`

### Scenario 4: Co-author Only

**Condition:** User is a co-author but NOT the author

**Actions:**

- Post metadata message: `"<strong>[User Name]</strong> a été retiré de l'équipe."`
- No other changes

## Recipient Scenarios

These scenarios apply when the user is a recipient via the specific team (member of `requestedTeams` where team matches `teamId`) but NOT an author or co-author of the report.

### Scenario 5: Recipient Alone in Team

**Condition:** User is a recipient AND user's team within `requestedTeams` has no other active members

**Actions:**

1. Close the report (set status to `CLOSED`)
2. Create a `ReportStatusHistory` entry
3. Post metadata message: `"<strong>[User Name]</strong> a été retiré de l'équipe et était le seul opérateur. Ce signalement est désormais clôturé."`

### Scenario 6: Recipient Handled Report (Team has members)

**Condition:** User is a recipient AND handled the report (has `ReportStatusHistory` with status `IN_TREATMENT`) AND team has other active members

**Actions:**

1. Revert report status to `PENDING_ASSIGNMENT`
2. Create a `ReportStatusHistory` entry
3. Post metadata message: `"<strong>[User Name]</strong> a été retiré de l'équipe."`

### Scenario 7: Recipient Did Not Handle Report

**Condition:** User is a recipient AND did NOT handle the report AND team has other active members

**Actions:**

- Post metadata message: `"<strong>[User Name]</strong> a été retiré de l'équipe."`
- No other changes

## Scope

- Only **active reports** are affected (status in: `PENDING_ASSIGNMENT`, `IN_TREATMENT`, `OVERDUE`)
- Reports with status `COMPLETED`, `CLOSED`, or `DELETED` are not affected
- Only reports **associated with the specific team** being removed from are processed

## Implementation Details

### Team Scoping

- For **author scenarios**: Only reports where `applicantTeamId` matches the team being removed from
- For **recipient scenarios**: Only reports where the specific team is in `requestedTeams`

### Handling Determination

A recipient is considered to have "handled" a report if they are the author of a `ReportStatusHistory` entry with status `IN_TREATMENT`.

### Most Active Member Selection

- Query recent answers from team members (excluding the user being removed)
- Select the member with the most recent `createdAt` timestamp
- Fallback to first member if no activity history exists

### Transaction

All operations (report updates, message creation, user disconnection from team) are executed in a single Prisma transaction.

## Files

- `src/app/services/user/user-team-removal.ts` - Main processing logic
- `src/trpc/routers/team.ts` - `removeUserFromTeam` mutation and `previewRemoveFromTeam` query
- `src/app/(private)/equipes/[id]/components/team-content/team-content-columns/team-content-columns.tsx` - UI modal with debug preview

## Message Constants

Located in `src/app/services/user/user-team-removal.ts`:

```typescript
export const TEAM_REMOVAL_MESSAGES = {
  // Author scenarios
  AUTHOR_WITH_COAUTHORS: (name: string) =>
    `<strong>${name}</strong> a été retiré de l'équipe. Les co-auteurs devront poursuivre le traitement de ce signalement.`,
  AUTHOR_TRANSFER: (name: string) =>
    `<strong>${name}</strong> a été retiré de l'équipe. Le signalement a été transféré à un autre membre.`,
  AUTHOR_ALONE_CLOSED: (name: string) =>
    `<strong>${name}</strong> a été retiré de l'équipe et était le seul membre. Ce signalement est désormais clôturé.`,
  COAUTHOR_ONLY: (name: string) =>
    `<strong>${name}</strong> a été retiré de l'équipe.`,
  // Recipient scenarios
  RECIPIENT_REMOVED: (name: string) =>
    `<strong>${name}</strong> a été retiré de l'équipe.`,
  RECIPIENT_ALONE_CLOSED: (name: string) =>
    `<strong>${name}</strong> a été retiré de l'équipe et était le seul opérateur. Ce signalement est désormais clôturé.`,
};
```

## Debug Preview

When `ENABLE_DEBUG_TOOLS=true`, the removal confirmation modal shows a debug preview panel with:

- Summary of impacts (transfers, closures, notifications, status reverts)
- Detailed list of affected reports with their scenarios
- For transfers: shows the new author name

## Comparison with User Deactivation

| Aspect            | User Deactivation                   | Remove from Team                       |
| ----------------- | ----------------------------------- | -------------------------------------- |
| Scope             | All teams user belongs to           | Single specific team                   |
| User status after | Inactive (cannot login)             | Active (can still login)               |
| Reports affected  | All user's reports across all teams | Only reports tied to the specific team |
| Team snapshot     | Created for potential reactivation  | Not needed                             |
| Sessions          | Deleted                             | Preserved                              |
