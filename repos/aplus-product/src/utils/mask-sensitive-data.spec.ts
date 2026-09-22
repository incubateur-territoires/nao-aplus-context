import { USER_ROLES } from "@/constants/user-roles";
import {
  getMaskingRole,
  maskReportForRole,
  maskReportsForRole,
  maskAnswerForRole,
  maskAnswersForRole,
} from "./mask-sensitive-data";

const SAMPLE_REPORT = {
  id: "report-1",
  subject: "Problème urgent",
  description: "Description détaillée du problème",
  firstName: "Jean",
  lastName: "Dupont",
  maritalName: "Martin",
  phone: "0612345678",
  caf: "1234567",
  nir: "1234567890123",
  nif: "1234567890123",
  birthDate: "1990-01-01",
  status: "PENDING_ASSIGNMENT",
};

const SAMPLE_ANSWER = {
  id: "answer-1",
  content: "Réponse détaillée",
  files: [{ id: "file-1", name: "document.pdf" }],
};

describe("getMaskingRole", () => {
  it("retourne ADMIN quand impersonatedBy est défini", () => {
    expect(getMaskingRole(USER_ROLES.USER, "admin-id-123")).toBe(
      USER_ROLES.ADMIN,
    );
  });

  it("retourne ADMIN même si le rôle impersonnifié est supervisor", () => {
    expect(getMaskingRole(USER_ROLES.SUPERVISOR, "admin-id-123")).toBe(
      USER_ROLES.ADMIN,
    );
  });

  it("retourne le rôle original quand impersonatedBy est null", () => {
    expect(getMaskingRole(USER_ROLES.USER, null)).toBe(USER_ROLES.USER);
  });

  it("retourne le rôle original quand impersonatedBy est undefined", () => {
    expect(getMaskingRole(USER_ROLES.USER)).toBe(USER_ROLES.USER);
  });

  it("retourne le rôle original quand impersonatedBy est une chaîne vide", () => {
    expect(getMaskingRole(USER_ROLES.USER, "")).toBe(USER_ROLES.USER);
  });

  it("retourne undefined quand le rôle est undefined et pas d'impersonation", () => {
    expect(getMaskingRole(undefined, null)).toBeUndefined();
  });
});

describe("maskReportForRole", () => {
  it("ne masque pas pour un utilisateur normal (rôle user)", () => {
    const result = maskReportForRole(SAMPLE_REPORT, USER_ROLES.USER);
    expect(result.firstName).toBe("Jean");
    expect(result.lastName).toBe("Dupont");
    expect(result.maritalName).toBe("Martin");
    expect(result.subject).toBe("Problème urgent");
    expect(result.nir).toBe("1234567890123");
    expect(result.birthDate).toBe("1990-01-01");
  });

  it("masque pour un admin", () => {
    const result = maskReportForRole(SAMPLE_REPORT, USER_ROLES.ADMIN);
    expect(result.firstName).toBe("Prénom (4 caractères)");
    expect(result.lastName).toBe("Nom (6 caractères)");
    expect(result.maritalName).toBe("Nom marital (6 caractères)");
    expect(result.subject).toBe("Sujet (15 caractères)");
    expect(result.nir).toBe("NIR (13 caractères)");
    expect(result.birthDate).toBe("1990-01-01");
  });

  it("masque pour un supervisor", () => {
    const result = maskReportForRole(SAMPLE_REPORT, USER_ROLES.SUPERVISOR);
    expect(result.firstName).toBe("Prénom (4 caractères)");
    expect(result.lastName).toBe("Nom (6 caractères)");
    expect(result.maritalName).toBe("Nom marital (6 caractères)");
  });

  it("masque quand un admin impersonnifie un user (via getMaskingRole)", () => {
    const role = getMaskingRole(USER_ROLES.USER, "admin-id-123");
    const result = maskReportForRole(SAMPLE_REPORT, role);
    expect(result.firstName).toBe("Prénom (4 caractères)");
    expect(result.lastName).toBe("Nom (6 caractères)");
    expect(result.subject).toBe("Sujet (15 caractères)");
    expect(result.description).toBe("Description (33 caractères)");
    expect(result.phone).toBe("Téléphone (10 caractères)");
    expect(result.caf).toBe("CAF (7 caractères)");
    expect(result.nir).toBe("NIR (13 caractères)");
    expect(result.nif).toBe("NIF (13 caractères)");
    expect(result.birthDate).toBe("1990-01-01");
  });

  it("ne masque pas quand un user normal sans impersonation", () => {
    const role = getMaskingRole(USER_ROLES.USER, null);
    const result = maskReportForRole(SAMPLE_REPORT, role);
    expect(result.firstName).toBe("Jean");
    expect(result.lastName).toBe("Dupont");
    expect(result.birthDate).toBe("1990-01-01");
  });

  it("préserve les champs non sensibles", () => {
    const result = maskReportForRole(SAMPLE_REPORT, USER_ROLES.ADMIN);
    expect(result.id).toBe("report-1");
    expect(result.status).toBe("PENDING_ASSIGNMENT");
  });

  it("gère les champs null sans erreur", () => {
    const report = { ...SAMPLE_REPORT, phone: null, nir: null };
    const result = maskReportForRole(report, USER_ROLES.ADMIN);
    expect(result.phone).toBeNull();
    expect(result.nir).toBeNull();
  });

  it("masque les fichiers imbriqués", () => {
    const report = {
      ...SAMPLE_REPORT,
      files: [{ id: "f1", name: "document.pdf" }],
    };
    const result = maskReportForRole(report, USER_ROLES.ADMIN);
    expect(result.files[0].name).toBe("Fichier (12 caractères)");
    expect(result.files[0].id).toBe("f1");
  });

  it("masque les réponses imbriquées", () => {
    const report = {
      ...SAMPLE_REPORT,
      answers: [SAMPLE_ANSWER],
    };
    const result = maskReportForRole(report, USER_ROLES.ADMIN);
    expect(result.answers[0].content).toBe("contenu (17 caractères)");
    expect(result.answers[0].files[0].name).toBe("Fichier (12 caractères)");
  });
});

describe("maskReportsForRole", () => {
  it("masque tous les rapports pour un admin", () => {
    const reports = [SAMPLE_REPORT, { ...SAMPLE_REPORT, id: "report-2" }];
    const result = maskReportsForRole(reports, USER_ROLES.ADMIN);
    expect(result).toHaveLength(2);
    expect(result[0].firstName).toBe("Prénom (4 caractères)");
    expect(result[1].firstName).toBe("Prénom (4 caractères)");
  });

  it("ne masque aucun rapport pour un user", () => {
    const reports = [SAMPLE_REPORT];
    const result = maskReportsForRole(reports, USER_ROLES.USER);
    expect(result[0].firstName).toBe("Jean");
  });

  it("masque lors d'une impersonation", () => {
    const role = getMaskingRole(USER_ROLES.USER, "admin-id");
    const result = maskReportsForRole([SAMPLE_REPORT], role);
    expect(result[0].firstName).toBe("Prénom (4 caractères)");
  });
});

describe("maskAnswerForRole", () => {
  it("masque le contenu et les fichiers pour un admin", () => {
    const result = maskAnswerForRole(SAMPLE_ANSWER, USER_ROLES.ADMIN);
    expect(result.content).toBe("contenu (17 caractères)");
    expect(result.files[0].name).toBe("Fichier (12 caractères)");
  });

  it("ne masque pas pour un user", () => {
    const result = maskAnswerForRole(SAMPLE_ANSWER, USER_ROLES.USER);
    expect(result.content).toBe("Réponse détaillée");
    expect(result.files[0].name).toBe("document.pdf");
  });

  it("masque lors d'une impersonation", () => {
    const role = getMaskingRole(USER_ROLES.USER, "admin-id");
    const result = maskAnswerForRole(SAMPLE_ANSWER, role);
    expect(result.content).toBe("contenu (17 caractères)");
  });
});

describe("maskAnswersForRole", () => {
  it("masque toutes les réponses lors d'une impersonation", () => {
    const role = getMaskingRole(USER_ROLES.USER, "admin-id");
    const answers = [SAMPLE_ANSWER, { ...SAMPLE_ANSWER, id: "answer-2" }];
    const result = maskAnswersForRole(answers, role);
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe("contenu (17 caractères)");
    expect(result[1].content).toBe("contenu (17 caractères)");
  });
});
