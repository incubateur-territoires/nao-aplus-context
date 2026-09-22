import type { FullUser } from "@/types/user";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";
import type { CareDelayTeamRow } from "@/trpc/routers/stats";
import {
  ReportStatus,
  OrganizationRole,
  NotificationFrequency,
  TeamType,
} from "@/generated/prisma/enums";
import { USER_ROLES, type UserRole } from "@/constants/user-roles";
import { ReportMode } from "@/types/report-mode";

// Re-export UserRole for test files
export { USER_ROLES, type UserRole } from "@/constants/user-roles";

// Common mock IDs
export const MOCK_IDS = {
  USER_1: "user-1",
  USER_2: "user-2",
  USER_3: "user-3",
  TEAM_1: "team-1",
  TEAM_2: "team-2",
  ORG_1: "org-1",
  AREA_1: "area-1",
  AREA_2: "area-2",
  REPORT_1: "1",
  REPORT_2: "2",
  REPORT_3: "3",
  ANSWER_1: "answer-1",
  ANSWER_2: "answer-2",
} as const;

// Common mock dates
export const MOCK_DATES = {
  JAN_1_2024: new Date("2024-01-01"),
  JAN_2_2024: new Date("2024-01-02"),
  JAN_3_2024: new Date("2024-01-03"),
  JAN_4_2024: new Date("2024-01-04"),
  MAY_23_2025: new Date("2025-05-23"),
  JUN_23_2025: new Date("2025-06-23"),
  JUN_24_2025: new Date("2025-06-24"),
} as const;

// Report table type
export type MockReportTableType =
  inferRouterOutputs<AppRouter>["report"]["getMyCreatedReportsTable"]["reports"][number];

// Factory function for creating mock areas
export function createMockArea(
  overrides?: Partial<{
    id: string;
    name: string;
    inseeCode: string;
    timezone: string;
    createdAt: Date;
    updatedAt: Date;
  }>,
) {
  return {
    id: MOCK_IDS.AREA_1,
    name: "Area 1",
    inseeCode: "01",
    timezone: "Europe/Paris",
    createdAt: MOCK_DATES.JAN_1_2024,
    updatedAt: MOCK_DATES.JAN_1_2024,
    ...overrides,
  };
}

// Factory function for creating mock organizations
export function createMockOrganization(
  overrides?: Partial<{
    id: string;
    name: string;
    shortName: string;
    id_v1: string;
    createdAt: Date;
    updatedAt: Date;
    role: OrganizationRole;
    type: TeamType;
    additionalInformation: string | null;
  }>,
) {
  return {
    id: MOCK_IDS.ORG_1,
    name: "Org 1",
    shortName: "ORG1",
    id_v1: "org-1-v1",
    createdAt: MOCK_DATES.JAN_1_2024,
    updatedAt: MOCK_DATES.JAN_1_2024,
    role: OrganizationRole.OPERATOR,
    type: TeamType.OPERATOR,
    additionalInformation: null,
    ...overrides,
  };
}

// Factory function for creating mock teams (for user context)
export function createMockTeam(
  overrides?: Partial<{
    id: string;
    name: string;
    role: OrganizationRole;
    organization: { id: string; name: string };
    areas: { id: string; name: string; timezone: string }[];
    deletedAt: Date | null;
  }>,
) {
  return {
    id: MOCK_IDS.TEAM_1,
    name: "Équipe A",
    role: OrganizationRole.HELPER,
    organization: createMockOrganization(),
    areas: [createMockArea()],
    deletedAt: null,
    ...overrides,
  };
}

// All team types for default acceptTypes
const ALL_TEAM_TYPES = Object.values(TeamType);

// Factory function for creating mock teams in report context (with all required fields)
export function createMockReportTeam(
  overrides?: Partial<{
    id: string;
    name: string;
    role: OrganizationRole;
    createdAt: Date;
    updatedAt: Date;
    organizationId: string;
    email: string | null;
    description: string | null;
    registrationNumber: string | null;
    adminComment: string | null;
    type: TeamType;
    acceptTypes: TeamType[];
    internalSupportComment: string | null;
    publicNote: string | null;
    deletedAt: Date | null;
    organization: Partial<ReturnType<typeof createMockOrganization>>;
  }>,
) {
  const { organization: orgOverrides, ...teamOverrides } = overrides || {};
  return {
    id: MOCK_IDS.TEAM_1,
    name: "Équipe A",
    role: OrganizationRole.HELPER,
    createdAt: MOCK_DATES.JAN_1_2024,
    updatedAt: MOCK_DATES.JAN_1_2024,
    organizationId: MOCK_IDS.ORG_1,
    email: null,
    description: null,
    registrationNumber: null,
    adminComment: null,
    type: TeamType.OTHERS_HELPERS,
    acceptTypes: ALL_TEAM_TYPES,
    internalSupportComment: null,
    publicNote: null,
    deletedAt: null,
    organization: createMockOrganization(orgOverrides),
    ...teamOverrides,
  };
}

// Type for TeamWithIncludes (teams with organization including specificFields and tags)
export type MockTeamWithIncludesType =
  inferRouterOutputs<AppRouter>["team"]["getActiveOperatorTeamsByAreaIds"][number];

// Organization type for TeamWithIncludes
interface MockOrganizationFullType {
  id: string;
  name: string;
  shortName: string;
  id_v1: string;
  createdAt: Date;
  updatedAt: Date;
  role: OrganizationRole;
  type: TeamType;
  additionalInformation: string | null;
  tags: { id: string; createdAt: Date; updatedAt: Date; name: string }[];
  specificFields: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    name: string;
    label: string;
    hintText: string | null;
    errorMessage: string;
  }[];
}

// Factory function for creating mock organization with all fields (for TeamWithIncludes)
export function createMockOrganizationFull(
  overrides?: Partial<MockOrganizationFullType>,
): MockOrganizationFullType {
  return {
    id: MOCK_IDS.ORG_1,
    name: "Organization 1",
    shortName: "ORG1",
    id_v1: "org-1-v1",
    createdAt: MOCK_DATES.JAN_1_2024,
    updatedAt: MOCK_DATES.JAN_1_2024,
    role: OrganizationRole.OPERATOR,
    type: TeamType.OPERATOR,
    additionalInformation: null,
    tags: [],
    specificFields: [],
    ...overrides,
  };
}

// Factory function for creating mock teams with includes (TeamWithIncludes type)
export function createMockTeamWithIncludes(
  overrides?: Partial<{
    id: string;
    name: string;
    email: string | null;
    description: string | null;
    registrationNumber: string | null;
    adminComment: string | null;
    type: TeamType;
    acceptTypes: TeamType[];
    internalSupportComment: string | null;
    publicNote: string | null;
    role: OrganizationRole;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    organization: Partial<MockOrganizationFullType>;
  }>,
): MockTeamWithIncludesType {
  const { organization: orgOverrides, ...teamOverrides } = overrides || {};
  return {
    id: MOCK_IDS.TEAM_1,
    name: "Test Team",
    email: null,
    description: null,
    registrationNumber: null,
    adminComment: null,
    type: TeamType.OTHERS_HELPERS,
    acceptTypes: ALL_TEAM_TYPES,
    internalSupportComment: null,
    publicNote: null,
    role: OrganizationRole.OPERATOR,
    organizationId: MOCK_IDS.ORG_1,
    createdAt: MOCK_DATES.JAN_1_2024,
    updatedAt: MOCK_DATES.JAN_1_2024,
    deletedAt: null,
    organization: createMockOrganizationFull(orgOverrides),
    ...teamOverrides,
  } as MockTeamWithIncludesType;
}

// Factory function for creating mock author (user in report context)
export function createMockAuthor(
  overrides?: Partial<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    name: string;
    phone: string | null;
    profession: string | null;
    cguAcceptedAt: Date | null;
    role: UserRole;
    emailVerified: boolean;
    isInactive: Date | null;
    deletedAt: Date | null;
    lastActivityAt: Date | null;
    inactivityWarningsSentAt: Date[];
    notificationFrequency: NotificationFrequency;
    lastDigestSentAt: Date | null;
    newsLetterAcceptedAt: Date | null;
    internalSupportComment: string | null;
    banned: boolean;
    banReason: string | null;
    banExpires: Date | null;
    teams: { id: string; name: string; deletedAt: Date | null }[];
    createdAt: Date;
    updatedAt: Date;
  }>,
) {
  return {
    id: MOCK_IDS.USER_1,
    email: "author@example.com",
    firstName: "Author",
    lastName: "User",
    name: "Author User",
    phone: "0123456789",
    profession: "Developer",
    cguAcceptedAt: MOCK_DATES.JAN_1_2024,
    role: USER_ROLES.USER,
    emailVerified: true,
    isInactive: null,
    deletedAt: null,
    lastActivityAt: MOCK_DATES.JAN_1_2024,
    inactivityWarningsSentAt: [],
    notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
    lastDigestSentAt: null,
    newsLetterAcceptedAt: null,
    internalSupportComment: null,
    banned: false,
    banReason: null,
    banExpires: null,
    twoFactorEnabled: false,
    notificationsViewedBefore: null,
    teams: [],
    createdAt: MOCK_DATES.JAN_1_2024,
    updatedAt: MOCK_DATES.JAN_1_2024,
    ...overrides,
  };
}

// Factory function for creating mock answers
export function createMockAnswer(
  overrides?: Partial<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    reportId: string;
    authorId: string;
    isIrrelevant: boolean;
    isOperatorOnly: boolean;
    content: string;
    isMetadataOnly: boolean;
    hasStandardProcedure: boolean;
  }>,
) {
  return {
    id: "answer-1",
    createdAt: MOCK_DATES.JAN_1_2024,
    updatedAt: MOCK_DATES.JAN_1_2024,
    reportId: MOCK_IDS.REPORT_1,
    authorId: MOCK_IDS.USER_1,
    isIrrelevant: false,
    isOperatorOnly: false,
    content: "",
    isMetadataOnly: false,
    hasStandardProcedure: false,
    ...overrides,
  };
}

// Factory function for creating mock users
export function createMockUser(overrides?: Partial<FullUser>): FullUser {
  const defaultTeams = [
    createMockTeam(),
    createMockTeam({
      id: MOCK_IDS.TEAM_2,
      name: "Équipe B",
      organization: createMockOrganization(),
      areas: [],
    }),
  ];

  return {
    id: MOCK_IDS.USER_1,
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    name: "Test User",
    phone: "0123456789",
    profession: "Developer",
    cguAcceptedAt: MOCK_DATES.JAN_1_2024,
    role: USER_ROLES.USER,
    emailVerified: false,
    createdAt: MOCK_DATES.JAN_1_2024,
    updatedAt: MOCK_DATES.JAN_1_2024,
    isInactive: null,
    deletedAt: null,
    lastActivityAt: MOCK_DATES.JAN_1_2024,
    inactivityWarningsSentAt: [],
    notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
    lastDigestSentAt: null,
    newsLetterAcceptedAt: null,
    internalSupportComment: null,
    banned: false,
    banReason: null,
    banExpires: null,
    // true par défaut : la 2FA est exigée par adminProcedure, et un mock qui
    // la désactive doit le dire explicitement.
    twoFactorEnabled: true,
    notificationsViewedBefore: null,
    teams: defaultTeams,
    ...overrides,
  };
}

// Factory function for creating mock users for getUsers query
export function createMockUserForList(
  overrides?: Partial<{
    id: string;
    email: string;
    name: string;
    firstName: string;
    lastName: string;
    profession: string | null;
    role: UserRole;
    isInactive: Date | null;
    teams: {
      id: string;
      name: string;
      areas: { id: string; name: string; inseeCode: string | null }[];
    }[];
    managedTeams: { id: string }[];
    deactivatedTeamSnapshot: {
      teams: {
        id: string;
        name: string;
        role: string;
        organization: { name: string; shortName: string };
        areas: { id: string; name: string; inseeCode: string | null }[];
      }[];
    } | null;
  }>,
) {
  return {
    id: MOCK_IDS.USER_1,
    email: "test@example.com",
    name: "Test User",
    firstName: "Test",
    lastName: "User",
    profession: "Developer",
    role: USER_ROLES.USER,
    isInactive: null,
    teams: [
      {
        id: MOCK_IDS.TEAM_1,
        name: "FS Arras",
        areas: [
          { id: MOCK_IDS.AREA_1, name: "Pas-de-Calais", inseeCode: "62" },
        ],
      },
    ],
    managedTeams: [],
    deactivatedTeamSnapshot: null,
    ...overrides,
  };
}

// Factory function for creating mock report table items
export function createMockReport(
  overrides?: Partial<MockReportTableType>,
): MockReportTableType {
  const defaultApplicantTeam = createMockReportTeam();
  const defaultRequestedTeams = [createMockReportTeam()];

  const defaultReport = {
    id: MOCK_IDS.REPORT_1,
    firstName: "Emma",
    lastName: "Bouchard",
    subject: "Subject 1",
    status: ReportStatus.PENDING_ASSIGNMENT,
    overdueAt: null,
    createdAt: MOCK_DATES.JAN_1_2024,
    updatedAt: MOCK_DATES.JAN_1_2024,
    authorId: MOCK_IDS.USER_1,
    area: { id: MOCK_IDS.AREA_1, name: "Ain" },
    author: {
      id: MOCK_IDS.USER_1,
      firstName: "Lucie",
      lastName: "Grondin",
    },
    applicantTeam: defaultApplicantTeam,
    requestedTeams: defaultRequestedTeams,
    answers: [] as { createdAt: Date; authorId: string }[],
    hasUserAnswered: false,
  } as MockReportTableType;

  // Deep merge to handle nested objects properly
  if (overrides) {
    return {
      ...defaultReport,
      ...overrides,
      area: overrides.area
        ? { ...defaultReport.area, ...overrides.area }
        : defaultReport.area,
      author: overrides.author
        ? { ...defaultReport.author, ...overrides.author }
        : defaultReport.author,
      applicantTeam: overrides.applicantTeam
        ? { ...defaultApplicantTeam, ...overrides.applicantTeam }
        : defaultApplicantTeam,
      requestedTeams: overrides.requestedTeams ?? defaultRequestedTeams,
      answers: overrides.answers ?? defaultReport.answers,
      hasUserAnswered:
        overrides.hasUserAnswered ?? defaultReport.hasUserAnswered,
    } as MockReportTableType;
  }

  return defaultReport;
}

// Factory function for creating multiple mock reports
export function createMockReports(
  count?: number,
  overrides?: Partial<MockReportTableType>,
): MockReportTableType[] {
  if (count === undefined) {
    const team2 = createMockReportTeam({
      id: MOCK_IDS.TEAM_2,
      name: "Équipe B",
    });

    return [
      createMockReport(),
      createMockReport({
        id: MOCK_IDS.REPORT_2,
        firstName: "Rémi",
        lastName: "Chevalier",
        subject: "Subject 2",
        status: ReportStatus.IN_TREATMENT,
        createdAt: MOCK_DATES.JAN_2_2024,
        updatedAt: MOCK_DATES.JAN_2_2024,
        authorId: MOCK_IDS.USER_2,
        applicantTeam: team2,
        requestedTeams: [team2],
        ...overrides,
      }),
    ];
  }

  return Array.from({ length: count }, (_, index) =>
    createMockReport({
      id: `${index + 1}`,
      subject: `Subject ${index + 1}`,
      ...overrides,
    }),
  );
}

// Factory function for creating common jest.fn() mocks
export function createMockFunctions() {
  return {
    onStatusFilterChange: jest.fn(),
    onTeamFilterChange: jest.fn(),
    handleMyReportsToggle: jest.fn(),
    setSearchQuery: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    mutateAsync: jest.fn(),
  };
}

/** Ligne du tableau « Délais de prise en charge » (page /statistiques). */
export function createMockCareDelayTeamRow(
  overrides?: Partial<CareDelayTeamRow>,
): CareDelayTeamRow {
  return {
    teamId: "team-1",
    teamName: "CAF Aisne",
    totalReports: 10,
    inTreatmentCount: 8,
    avgDelayBusinessDays: 1.5,
    underOneBusinessDayCount: 2,
    underTwoBusinessDaysCount: 5,
    underThreeBusinessDaysCount: 7,
    ...overrides,
  };
}

// Default mock values for common use cases
export const mockDefaults = {
  currentUser: createMockUser(),
  userWithNoTeams: createMockUser({ teams: [] }),
  reports: createMockReports(),
  reportMode: ReportMode.CREATED,
  functions: createMockFunctions(),
};
