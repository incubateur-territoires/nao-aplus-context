import { getAuthorGroup, groupTimeline, shouldShowAuthorInfo } from "./utils";
import type {
  AnswerType,
  AnswersType,
  ReportStatusHistoryType,
  TimelineItem,
} from "./types";
import { OrganizationRole } from "@/generated/prisma/enums";
import { createMockReportTeam, USER_ROLES } from "@/test/mocks";

const createMockAnswer = (
  id: string,
  authorId: string,
  isOperatorOnly = false,
): AnswerType => ({
  id,
  content: `Message ${id}`,
  createdAt: new Date(`2024-01-01T10:00:00Z`),
  updatedAt: new Date(`2024-01-01T10:00:00Z`),
  authorId,
  reportId: "request-1",
  isOperatorOnly,
  isIrrelevant: false,
  hasStandardProcedure: false,
  isMetadataOnly: false,
  author: {
    id: authorId,
    phone: "0123456789",
    profession: "Developer",
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    name: "John Doe",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    role: USER_ROLES.USER,
    isInactive: null,
    deletedAt: null,
    cguAcceptedAt: null,
    lastActivityAt: new Date(),
    inactivityWarningsSentAt: [],
    notificationFrequency: "EACH_SOLICITATION" as const,
    lastDigestSentAt: null,
    newsLetterAcceptedAt: null,
    internalSupportComment: null,
    banned: false,
    banReason: null,
    banExpires: null,
    twoFactorEnabled: false,
    notificationsViewedBefore: null,
    teams: [],
  },
  report: {
    id: "request-1",
    authorId: "author-1",
    status: "PENDING_ASSIGNMENT" as const,
    caf: null,
    nir: null,
    nif: null,
    maritalName: null,
    subject: "Test Subject",
    description: "Test Description",
    phone: null,
    firstName: "John",
    lastName: "Doe",
    birthDate: "1990-01-01",
    citizenPermissionConfirmed: true,
    areaId: "area-1",
    applicantTeamId: "group-1",
    organizationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastAnswerAt: null,
    overdueAt: null,
    userId: null,
    applicantTeam: createMockReportTeam({
      id: "group-1",
      name: "Test Group",
      organizationId: "organization-1",
      role: OrganizationRole.OPERATOR,
    }),
    requestedTeams: [],
  },
  files: [],
});

describe("shouldShowAuthorInfo", () => {
  describe("without visibility check (backward compatibility)", () => {
    it("returns true for the last message", () => {
      const answers: AnswersType = [
        createMockAnswer("1", "author-1"),
        createMockAnswer("2", "author-1"),
      ];

      const result = shouldShowAuthorInfo(answers[1], answers, 1);
      expect(result).toBe(true);
    });

    it("returns true when next message is from different author", () => {
      const answers: AnswersType = [
        createMockAnswer("1", "author-1"),
        createMockAnswer("2", "author-2"),
      ];

      const result = shouldShowAuthorInfo(answers[0], answers, 0);
      expect(result).toBe(true);
    });

    it("returns true when next message is same author but different category", () => {
      const answers: AnswersType = [
        createMockAnswer("1", "author-1", false),
        createMockAnswer("2", "author-1", true),
      ];

      const result = shouldShowAuthorInfo(answers[0], answers, 0);
      expect(result).toBe(true);
    });

    it("returns false when next message is same author and same category", () => {
      const answers: AnswersType = [
        createMockAnswer("1", "author-1", false),
        createMockAnswer("2", "author-1", false),
      ];

      const result = shouldShowAuthorInfo(answers[0], answers, 0);
      expect(result).toBe(false);
    });
  });

  describe("with visibility check", () => {
    const isHelperVisible = (answer: AnswerType): boolean => {
      return !answer.isOperatorOnly;
    };

    it("returns false for invisible messages", () => {
      const answers: AnswersType = [
        createMockAnswer("1", "author-1", true), // instructor-only, invisible to helper
      ];

      const result = shouldShowAuthorInfo(
        answers[0],
        answers,
        0,
        isHelperVisible,
      );
      expect(result).toBe(false);
    });

    it("returns true for last visible message", () => {
      const answers: AnswersType = [
        createMockAnswer("1", "author-1", false), // visible
        createMockAnswer("2", "author-1", true), // hidden
      ];

      const result = shouldShowAuthorInfo(
        answers[0],
        answers,
        0,
        isHelperVisible,
      );
      expect(result).toBe(true);
    });

    it("skips hidden messages when looking for next visible message", () => {
      const answers: AnswersType = [
        createMockAnswer("1", "author-1", false), // visible
        createMockAnswer("2", "author-1", true), // hidden instructor-only
        createMockAnswer("3", "author-1", false), // visible, same author
      ];

      // First message should not show author info because next visible is same author
      const result1 = shouldShowAuthorInfo(
        answers[0],
        answers,
        0,
        isHelperVisible,
      );
      expect(result1).toBe(false);

      // Last visible message should show author info
      const result2 = shouldShowAuthorInfo(
        answers[2],
        answers,
        2,
        isHelperVisible,
      );
      expect(result2).toBe(true);
    });

    it("returns true when next visible message is from different author", () => {
      const answers: AnswersType = [
        createMockAnswer("1", "author-1", false), // visible
        createMockAnswer("2", "author-1", true), // hidden
        createMockAnswer("3", "author-2", false), // visible, different author
      ];

      const result = shouldShowAuthorInfo(
        answers[0],
        answers,
        0,
        isHelperVisible,
      );
      expect(result).toBe(true);
    });

    it("handles multiple consecutive hidden messages", () => {
      const answers: AnswersType = [
        createMockAnswer("1", "author-1", false), // visible
        createMockAnswer("2", "author-1", true), // hidden
        createMockAnswer("3", "author-1", true), // hidden
        createMockAnswer("4", "author-1", false), // visible, same author
      ];

      // First visible message should not show author info
      const result1 = shouldShowAuthorInfo(
        answers[0],
        answers,
        0,
        isHelperVisible,
      );
      expect(result1).toBe(false);

      // Last visible message should show author info
      const result2 = shouldShowAuthorInfo(
        answers[3],
        answers,
        3,
        isHelperVisible,
      );
      expect(result2).toBe(true);
    });

    it("returns true when all subsequent messages are hidden", () => {
      const answers: AnswersType = [
        createMockAnswer("1", "author-1", false), // visible
        createMockAnswer("2", "author-1", true), // hidden
        createMockAnswer("3", "author-1", true), // hidden
      ];

      const result = shouldShowAuthorInfo(
        answers[0],
        answers,
        0,
        isHelperVisible,
      );
      expect(result).toBe(true);
    });
  });
});

describe("getAuthorGroup", () => {
  type ReportTeam = AnswerType["author"]["teams"][number];

  function buildAnswer(
    authorTeams: ReportTeam[],
    applicantTeam: ReportTeam,
    requestedTeams: AnswerType["report"]["requestedTeams"],
  ): AnswerType {
    const answer = createMockAnswer("answer-1", "author-1");
    answer.author.teams = authorTeams;
    answer.report.applicantTeam = applicantTeam;
    answer.report.applicantTeamId = applicantTeam.id;
    answer.report.requestedTeams = requestedTeams;
    return answer;
  }

  it("retourne l'équipe sollicitée à laquelle appartient un opérateur multi-équipes", () => {
    const ain = createMockReportTeam({ id: "team-ain", name: "CARSAT - Ain" });
    const jura = createMockReportTeam({
      id: "team-jura",
      name: "CARSAT - Jura",
    });
    const applicant = createMockReportTeam({
      id: "team-helper",
      name: "France Services",
    });

    // L'opérateur appartient à l'Ain ET au Jura, mais seul le Jura est sollicité.
    const answer = buildAnswer([ain, jura], applicant, [jura]);

    expect(getAuthorGroup(answer)?.id).toBe("team-jura");
  });

  it("ne dépend pas de l'ordre des équipes de l'auteur", () => {
    const ain = createMockReportTeam({ id: "team-ain", name: "CARSAT - Ain" });
    const jura = createMockReportTeam({
      id: "team-jura",
      name: "CARSAT - Jura",
    });
    const applicant = createMockReportTeam({ id: "team-helper" });

    // Le Jura est en première position : on doit quand même renvoyer l'Ain.
    const answer = buildAnswer([jura, ain], applicant, [ain]);

    expect(getAuthorGroup(answer)?.id).toBe("team-ain");
  });

  it("retourne l'équipe demandeuse pour l'auteur du signalement (aidant)", () => {
    const helperTeam = createMockReportTeam({
      id: "team-helper",
      name: "France Services",
    });
    const operatorTeam = createMockReportTeam({ id: "team-op" });

    const answer = buildAnswer([helperTeam], helperTeam, [operatorTeam]);

    expect(getAuthorGroup(answer)?.id).toBe("team-helper");
  });

  it("se replie sur la première équipe si aucune ne correspond au signalement", () => {
    const otherTeam = createMockReportTeam({
      id: "team-other",
      name: "Autre",
    });
    const applicant = createMockReportTeam({ id: "team-helper" });
    const requested = createMockReportTeam({ id: "team-op" });

    const answer = buildAnswer([otherTeam], applicant, [requested]);

    expect(getAuthorGroup(answer)?.id).toBe("team-other");
  });

  it("retourne undefined si l'auteur n'a aucune équipe", () => {
    const applicant = createMockReportTeam({ id: "team-helper" });
    const answer = buildAnswer([], applicant, []);

    expect(getAuthorGroup(answer)).toBeUndefined();
  });
});

describe("groupTimeline", () => {
  function statusItem(id: string): Extract<TimelineItem, { kind: "status" }> {
    return {
      kind: "status",
      status: { id } as ReportStatusHistoryType,
    };
  }

  function answerItem(id: string, index: number): TimelineItem {
    return {
      kind: "answer",
      answer: createMockAnswer(id, "author-1"),
      index,
    };
  }

  it("retourne un tableau vide pour une timeline vide", () => {
    expect(groupTimeline([])).toEqual([]);
  });

  it("rattache les messages au statut qui les précède", () => {
    const groups = groupTimeline([
      statusItem("status-1"),
      statusItem("status-2"),
      answerItem("a1", 0),
      answerItem("a2", 1),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].status?.id).toBe("status-1");
    expect(groups[0].answers).toHaveLength(0);
    expect(groups[1].status?.id).toBe("status-2");
    expect(groups[1].answers.map((a) => a.answer.id)).toEqual(["a1", "a2"]);
  });

  it("ouvre une nouvelle étape à chaque changement de statut", () => {
    const groups = groupTimeline([
      statusItem("status-1"),
      answerItem("a1", 0),
      statusItem("status-2"),
      answerItem("a2", 1),
    ]);

    expect(groups.map((g) => g.status?.id)).toEqual(["status-1", "status-2"]);
    expect(groups[0].answers.map((a) => a.answer.id)).toEqual(["a1"]);
    expect(groups[1].answers.map((a) => a.answer.id)).toEqual(["a2"]);
  });

  it("crée une étape sans statut pour les messages antérieurs au premier statut", () => {
    const groups = groupTimeline([
      answerItem("a1", 0),
      statusItem("status-1"),
      answerItem("a2", 1),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].status).toBeNull();
    expect(groups[0].answers.map((a) => a.answer.id)).toEqual(["a1"]);
    expect(groups[1].status?.id).toBe("status-1");
    expect(groups[1].answers.map((a) => a.answer.id)).toEqual(["a2"]);
  });
});
