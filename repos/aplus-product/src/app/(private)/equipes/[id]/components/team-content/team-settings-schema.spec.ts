import { TeamType } from "@/generated/prisma/enums";
import {
  teamSettingsSchema,
  teamAcceptTypesSchema,
} from "./team-settings-schema";

const allTeamTypes = Object.values(TeamType);

describe("teamSettingsSchema", () => {
  it("validates valid team settings", () => {
    const validData = {
      name: "Test Team",
      email: "test@example.com",
      description: "Test description",
    };

    const result = teamSettingsSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("validates team settings with only required fields", () => {
    const validData = {
      name: "Test Team",
    };

    const result = teamSettingsSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("validates team settings with null optional fields", () => {
    const validData = {
      name: "Test Team",
      email: null,
      description: null,
    };

    const result = teamSettingsSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const invalidData = {
      name: "",
    };

    const result = teamSettingsSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.message).toBe(
        "Le nom de l'équipe est obligatoire.",
      );
    }
  });

  it("rejects invalid email format", () => {
    const invalidData = {
      name: "Test Team",
      email: "invalid-email",
    };

    const result = teamSettingsSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.message).toBe(
        "Veuillez saisir une adresse e-mail au format attendu, exemple : nom@domaine.fr",
      );
    }
  });

  it("accepts valid email format", () => {
    const validData = {
      name: "Test Team",
      email: "test@example.com",
    };

    const result = teamSettingsSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("accepts null for optional fields", () => {
    const data = {
      name: "Test Team",
      email: null,
      description: null,
    };

    const result = teamSettingsSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe("teamAcceptTypesSchema", () => {
  it("validates valid accept types", () => {
    const validData = {
      acceptTypes: allTeamTypes,
    };

    const result = teamAcceptTypesSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("validates a single accept type", () => {
    const validData = {
      acceptTypes: [TeamType.OPERATOR],
    };

    const result = teamAcceptTypesSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects empty acceptTypes array", () => {
    const invalidData = {
      acceptTypes: [],
    };

    const result = teamAcceptTypesSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
