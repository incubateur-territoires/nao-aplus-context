import {
  reportFormSchema,
  reportFormSchemaWithFileObjects,
} from "./request-form.schema";

describe("requestFormSchema", () => {
  // Fixed specificFields structure
  const validData = {
    area: [{ label: "Paris", value: "paris" }],
    applicantTeam: [{ label: "Structure Paris", value: "structure-paris" }],
    requestedTeams: [
      {
        label: "CAF - Paris",
        value: "caf-paris",
        specificFields: [
          {
            name: "caf" as const,
            label: "Identifiant CAF",
            errorMessage: "Veuillez saisir l'identifiant CAF du citoyen.",
            hintText: "7 chiffres",
          },
        ],
      },
    ],
    subject: "Test subject",
    description: "Test description",
    files: [new File(["dummy"], "file.pdf")],
    caf: "1234567",
    nir: "123456789012345",
    firstName: "Jean",
    lastName: "Dupont",
    birthDate: "2000-01-01",
    phone: undefined,
    address: "",
    citizenPermissionConfirmed: true,
    colleagues: [],
    nif: "1234567890123",
  };

  it("accepts valid data", () => {
    expect(() => reportFormSchema.parse(validData)).not.toThrow();
  });

  it("rejects missing area", () => {
    const data = { ...validData, area: [] };
    const result = reportFormSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].message).toBe(
        "Veuillez choisir un territoire.",
      );
  });

  it("rejects missing applicantTeam", () => {
    const data = { ...validData, applicantTeam: [] };
    const result = reportFormSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].message).toBe(
        "Veuillez choisir une structure.",
      );
  });

  it("rejects empty requestedTeams", () => {
    const data = { ...validData, requestedTeams: [] };
    const result = reportFormSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].message).toBe(
        "Veuillez choisir au moins une équipe opérateur.",
      );
  });

  it("rejects missing subject", () => {
    const data = { ...validData, subject: "" };
    const result = reportFormSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].message).toBe(
        "Veuillez saisir le sujet du signalement du citoyen. Attention : le sujet ne doit pas contenir de données personnelles (nom ou numéro de sécurité sociale par exemple)",
      );
  });

  it("rejects missing description", () => {
    const data = { ...validData, description: "" };
    const result = reportFormSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].message).toBe(
        "Veuillez saisir une description précise du blocage du citoyen. Vous pouvez fournir autant de détails que nécessaire.",
      );
  });

  it("rejects missing firstName", () => {
    const data = { ...validData, firstName: "" };
    const result = reportFormSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].message).toBe(
        "Veuillez saisir le prénom du citoyen.",
      );
  });

  it("rejects missing lastName", () => {
    const data = { ...validData, lastName: "" };
    const result = reportFormSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].message).toBe(
        "Veuillez saisir le nom du citoyen.",
      );
  });

  it("rejects invalid birthDate format", () => {
    const data = { ...validData, birthDate: "01/01/2000" };
    const result = reportFormSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].message).toBe(
        "Veuillez saisir la date de naissance du citoyen au format jour / mois / année, par exemple : 31/12/1980.",
      );
  });

  describe("phone validation (obligatoire cochable)", () => {
    it("accepts any non-empty phone number", () => {
      const result = reportFormSchema.safeParse({
        ...validData,
        phone: "0612345678",
      });
      expect(result.success).toBe(true);
    });

    it("accepts null when the citizen cannot provide a phone number", () => {
      const result = reportFormSchema.safeParse({ ...validData, phone: null });
      expect(result.success).toBe(true);
    });

    it("rejects an empty phone number (required unless checkbox is checked)", () => {
      const result = reportFormSchema.safeParse({ ...validData, phone: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        const phoneError = result.error.issues.find((issue) =>
          issue.path.includes("phone"),
        );
        expect(phoneError?.message).toBe(
          "Veuillez saisir le numéro de téléphone du citoyen ou cocher la case « Le citoyen ne peut pas fournir son numéro de téléphone ».",
        );
      }
    });
  });

  it("rejects citizenPermissionConfirmed false", () => {
    const data = { ...validData, citizenPermissionConfirmed: false };
    const result = reportFormSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].message).toBe(
        "Vous devez recueillir l'autorisation du citoyen pour envoyer le signalement.",
      );
  });

  it("accepts valid files array", () => {
    const data = {
      ...validData,
      files: [
        new File(["content1"], "file1.pdf", { type: "application/pdf" }),
        new File(["content2"], "file2.jpg", { type: "image/jpeg" }),
      ],
    };
    const result = reportFormSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("accepts empty files array", () => {
    const data = {
      ...validData,
      files: [],
    };
    const result = reportFormSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("rejects invalid file types in files array", () => {
    const data = {
      ...validData,
      files: [
        "not-a-file",
        new File(["content"], "valid.pdf"),
      ] as unknown as File[],
    };
    const result = reportFormSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("accepts empty colleagues array", () => {
    const data = {
      ...validData,
      colleagues: [],
    };
    const result = reportFormSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("accepts valid colleagues array", () => {
    const data = {
      ...validData,
      colleagues: [
        { label: "John Doe", value: "john-doe" },
        { label: "Jane Smith", value: "jane-smith" },
      ],
    };
    const result = reportFormSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("accepts colleagues array with optional elements", () => {
    const data = {
      ...validData,
      colleagues: [
        { label: "John Doe", value: "john-doe" },
        undefined, // Optional element
        { label: "Jane Smith", value: "jane-smith" },
      ].filter(Boolean), // Remove undefined for actual test
    };
    const result = reportFormSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  describe("Dynamic specific field validation", () => {
    it("requires CAF when requestedGroup has CAF specific field", () => {
      const data = {
        ...validData,
        caf: "", // Empty CAF field
      };
      const result = reportFormSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const cafError = result.error.issues.find((issue) =>
          issue.path.includes("caf"),
        );
        expect(cafError?.message).toBe(
          "Veuillez saisir l'identifiant CAF du citoyen (7 chiffres) ou cocher la case « Le citoyen ne peut pas fournir son identifiant ».",
        );
      }
    });

    it("requires NIR when requestedTeam has NIR specific field", () => {
      const dataWithNir = {
        ...validData,
        requestedTeams: [
          {
            label: "Pôle Emploi",
            value: "pole-emploi",
            specificFields: [
              {
                name: "nir" as const,
                label: "Numéro NIR",
                errorMessage: "Le numéro NIR est requis pour ce signalement.",
                hintText: "13 ou 15 chiffres",
              },
            ],
          },
        ],
        nir: "", // Empty NIR field
      };
      const result = reportFormSchema.safeParse(dataWithNir);
      expect(result.success).toBe(false);
      if (!result.success) {
        const nirError = result.error.issues.find((issue) =>
          issue.path.includes("nir"),
        );
        expect(nirError?.message).toBe(
          "Veuillez saisir le numéro de sécurité sociale NIR du citoyen (13 ou 15 chiffres) ou cocher la case « Le citoyen ne peut pas fournir son numéro ».",
        );
      }
    });

    it("requires NIF when requestedTeam has NIF specific field", () => {
      const dataWithNif = {
        ...validData,
        requestedTeams: [
          {
            label: "DGFIP",
            value: "dgfip",
            specificFields: [
              {
                name: "nif" as const,
                label: "Numéro NIF",
                errorMessage: "Le numéro NIF est requis.",
                hintText: "13 chiffres",
              },
            ],
          },
        ],
        nif: "", // Empty NIF field
      };
      const result = reportFormSchema.safeParse(dataWithNif);
      expect(result.success).toBe(false);
      if (!result.success) {
        const nifError = result.error.issues.find((issue) =>
          issue.path.includes("nif"),
        );
        expect(nifError?.message).toBe(
          "Veuillez saisir le numéro de sécurité sociale NIF du citoyen (13 chiffres) ou cocher la case « Le citoyen ne peut pas fournir son numéro ».",
        );
      }
    });

    it("requires multiple specific fields when multiple teams are selected", () => {
      const dataWithMultipleTeams = {
        ...validData,
        requestedTeams: [
          {
            label: "CAF - Paris",
            value: "caf-paris",
            specificFields: [
              {
                name: "caf" as const,
                label: "Identifiant CAF",
                errorMessage: "Veuillez saisir l'identifiant CAF.",
                hintText: "7 chiffres",
              },
            ],
          },
          {
            label: "Pôle Emploi",
            value: "pole-emploi",
            specificFields: [
              {
                name: "nir" as const,
                label: "Numéro NIR",
                errorMessage: "Veuillez saisir le numéro NIR.",
                hintText: "13 ou 15 chiffres",
              },
            ],
          },
        ],
        caf: "", // Empty CAF
        nir: "", // Empty NIR
      };
      const result = reportFormSchema.safeParse(dataWithMultipleTeams);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.issues;
        const cafError = errors.find((issue) => issue.path.includes("caf"));
        const nirError = errors.find((issue) => issue.path.includes("nir"));
        expect(cafError?.message).toBe(
          "Veuillez saisir l'identifiant CAF du citoyen (7 chiffres) ou cocher la case « Le citoyen ne peut pas fournir son identifiant ».",
        );
        expect(nirError?.message).toBe(
          "Veuillez saisir le numéro de sécurité sociale NIR du citoyen (13 ou 15 chiffres) ou cocher la case « Le citoyen ne peut pas fournir son numéro ».",
        );
      }
    });

    it("allows optional fields when no requestedTeam requires them", () => {
      const dataWithoutSpecificFields = {
        ...validData,
        requestedTeams: [
          {
            label: "Service Social",
            value: "service-social",
            specificFields: [], // No specific fields required
          },
        ],
        caf: undefined, // Should be optional
        nir: undefined, // Should be optional
        nif: undefined, // Should be optional
      };
      const result = reportFormSchema.safeParse(dataWithoutSpecificFields);
      expect(result.success).toBe(true);
    });

    it("uses fallback error messages when specificField has no custom message", () => {
      const dataWithDefaultMessage = {
        ...validData,
        requestedTeams: [
          {
            label: "CAF - Paris",
            value: "caf-paris",
            specificFields: [
              {
                name: "caf" as const,
                label: "Identifiant CAF",
                errorMessage: "", // Empty error message - should use fallback
                hintText: "7 chiffres",
              },
            ],
          },
        ],
        caf: "",
      };
      const result = reportFormSchema.safeParse(dataWithDefaultMessage);
      expect(result.success).toBe(false);
      if (!result.success) {
        const cafError = result.error.issues.find((issue) =>
          issue.path.includes("caf"),
        );
        expect(cafError?.message).toBe(
          "Veuillez saisir l'identifiant CAF du citoyen (7 chiffres) ou cocher la case « Le citoyen ne peut pas fournir son identifiant ».",
        );
      }
    });

    it("allows null values when citizen cannot provide the number", () => {
      const dataWithNullValues = {
        ...validData,
        requestedTeams: [
          {
            label: "CAF - Paris",
            value: "caf-paris",
            specificFields: [
              {
                name: "caf" as const,
                label: "Identifiant CAF",
                errorMessage: "Veuillez saisir l'identifiant CAF.",
                hintText: "7 chiffres",
              },
            ],
          },
          {
            label: "Pôle Emploi",
            value: "pole-emploi",
            specificFields: [
              {
                name: "nir" as const,
                label: "Numéro NIR",
                errorMessage: "Veuillez saisir le numéro NIR.",
                hintText: "13 ou 15 chiffres",
              },
            ],
          },
        ],
        caf: null, // null = citizen cannot provide
        nir: null, // null = citizen cannot provide
      };
      const result = reportFormSchema.safeParse(dataWithNullValues);
      expect(result.success).toBe(true); // Should be valid
    });

    it("distinguishes between null (cannot provide) and empty string (required but not filled)", () => {
      const dataWithMixedValues = {
        ...validData,
        requestedTeams: [
          {
            label: "Multi Service",
            value: "multi-service",
            specificFields: [
              {
                name: "caf" as const,
                label: "Identifiant CAF",
                errorMessage: "CAF requis.",
                hintText: "7 chiffres",
              },
              {
                name: "nir" as const,
                label: "Numéro NIR",
                errorMessage: "NIR requis.",
                hintText: "13 ou 15 chiffres",
              },
            ],
          },
        ],
        caf: null, // Should be valid (cannot provide)
        nir: "", // Should be invalid (required but empty)
      };
      const result = reportFormSchema.safeParse(dataWithMixedValues);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.issues;
        const cafError = errors.find((issue) => issue.path.includes("caf"));
        const nirError = errors.find((issue) => issue.path.includes("nir"));

        expect(cafError).toBeUndefined(); // No error for null CAF
        expect(nirError?.message).toBe(
          "Veuillez saisir le numéro de sécurité sociale NIR du citoyen (13 ou 15 chiffres) ou cocher la case « Le citoyen ne peut pas fournir son numéro ».",
        ); // Error for empty NIR
      }
    });

    it("rejects invalid CAF format", () => {
      const data = {
        ...validData,
        caf: "123456", // Invalid: only 6 digits instead of 7
      };
      const result = reportFormSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const cafError = result.error.issues.find((issue) =>
          issue.path.includes("caf"),
        );
        expect(cafError?.message).toBe(
          "Veuillez saisir l'identifiant CAF du citoyen (7 chiffres) ou cocher la case « Le citoyen ne peut pas fournir son identifiant ».",
        );
      }
    });

    it("rejects invalid NIR format", () => {
      const data = {
        ...validData,
        nir: "12345678901234", // Invalid: only 14 characters instead of 13 or 15
      };
      const result = reportFormSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const nirError = result.error.issues.find((issue) =>
          issue.path.includes("nir"),
        );
        expect(nirError?.message).toBe(
          "Veuillez saisir le numéro de sécurité sociale NIR du citoyen (13 ou 15 chiffres) ou cocher la case « Le citoyen ne peut pas fournir son numéro ».",
        );
      }
    });

    it("rejects invalid NIF format", () => {
      const data = {
        ...validData,
        nif: "123456789012", // Invalid: only 12 digits instead of 13
      };
      const result = reportFormSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const nifError = result.error.issues.find((issue) =>
          issue.path.includes("nif"),
        );
        expect(nifError?.message).toBe(
          "Veuillez saisir le numéro de sécurité sociale NIF du citoyen (13 chiffres) ou cocher la case « Le citoyen ne peut pas fournir son numéro ».",
        );
      }
    });

    it("rejects non-numeric characters in CAF field", () => {
      const data = {
        ...validData,
        caf: "12345a7", // Invalid: contains letter
        nir: "123456789012345", // Valid format for comparison
      };
      const result = reportFormSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const cafError = result.error.issues.find((issue) =>
          issue.path.includes("caf"),
        );
        expect(cafError?.message).toBe(
          "Veuillez saisir l'identifiant CAF du citoyen (7 chiffres) ou cocher la case « Le citoyen ne peut pas fournir son identifiant ».",
        );
      }
    });

    it("accepts NIR with 13 digits", () => {
      const data = {
        ...validData,
        nir: "1234567890123", // Valid: 13 digits
      };
      const result = reportFormSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("accepts NIR with 15 digits", () => {
      const data = {
        ...validData,
        nir: "123456789012345", // Valid: 15 digits
      };
      const result = reportFormSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("accepts NIR with 13 characters including letters (Corsica)", () => {
      const data = {
        ...validData,
        nir: "123456789012A", // Valid: 13 characters with letter (Corsica format)
      };
      const result = reportFormSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("accepts NIR with 15 characters including letters (Corsica)", () => {
      const data = {
        ...validData,
        nir: "1234567890123AB", // Valid: 15 characters with letters (Corsica format)
      };
      const result = reportFormSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("identity field error messages mention the fallback checkbox", () => {
    it.each([
      {
        field: "caf" as const,
        invalidValue: "12",
        wording: /Le citoyen ne peut pas fournir son identifiant/,
      },
      {
        field: "nir" as const,
        invalidValue: "12",
        wording: /Le citoyen ne peut pas fournir son numéro/,
      },
      {
        field: "nif" as const,
        invalidValue: "12",
        wording: /Le citoyen ne peut pas fournir son numéro/,
      },
    ])(
      "$field error message references the fallback checkbox",
      ({ field, invalidValue, wording }) => {
        const data = { ...validData, [field]: invalidValue };
        const result = reportFormSchema.safeParse(data);
        expect(result.success).toBe(false);
        if (!result.success) {
          const issue = result.error.issues.find((i) => i.path.includes(field));
          expect(issue?.message).toMatch(wording);
        }
      },
    );
  });
});

describe("requestFormSchemaWithFileObjects", () => {
  // Valid data with file objects instead of File instances
  const validDataWithFileObjects = {
    area: [{ label: "Paris", value: "paris" }],
    applicantTeam: [{ label: "Structure Paris", value: "structure-paris" }],
    requestedTeams: [
      {
        label: "CAF - Paris",
        value: "caf-paris",
        specificFields: [
          {
            name: "caf" as const,
            label: "Identifiant CAF",
            errorMessage: "Veuillez saisir l'identifiant CAF du citoyen.",
            hintText: "7 chiffres",
          },
        ],
      },
    ],
    subject: "Test subject",
    description: "Test description",
    files: [
      {
        id: "file-1",
        name: "document.pdf",
        size: 1024,
        type: "application/pdf",
        lastModified: new Date(),
      },
    ],
    caf: "1234567",
    nir: "123456789012345",
    firstName: "Jean",
    lastName: "Dupont",
    birthDate: "2000-01-01",
    phone: undefined,
    address: "",
    citizenPermissionConfirmed: true,
    colleagues: [],
    nif: "1234567890123",
  };

  it("accepts valid data with file objects", () => {
    expect(() =>
      reportFormSchemaWithFileObjects.parse(validDataWithFileObjects),
    ).not.toThrow();
  });

  it("accepts empty files array", () => {
    const data = {
      ...validDataWithFileObjects,
      files: [],
    };
    const result = reportFormSchemaWithFileObjects.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("rejects files with missing required properties", () => {
    const data = {
      ...validDataWithFileObjects,
      files: [
        {
          id: "file-1",
          name: "document.pdf",
          // Missing size, type, lastModified
        },
      ] as unknown as {
        id: string;
        name: string;
        size: number;
        type: string;
        lastModified: number;
      }[],
    };
    const result = reportFormSchemaWithFileObjects.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("validates file object properties types", () => {
    const data = {
      ...validDataWithFileObjects,
      files: [
        {
          id: 123, // Should be string
          name: "document.pdf",
          size: "1024", // Should be number
          type: "application/pdf",
          lastModified: "invalid", // Should be number
        },
      ] as unknown as {
        id: string;
        name: string;
        size: number;
        type: string;
        lastModified: number;
      }[],
    };
    const result = reportFormSchemaWithFileObjects.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("inherits all base schema validations", () => {
    // Test that missing subject still fails
    const data = {
      ...validDataWithFileObjects,
      subject: "",
    };
    const result = reportFormSchemaWithFileObjects.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Veuillez saisir le sujet du signalement du citoyen. Attention : le sujet ne doit pas contenir de données personnelles (nom ou numéro de sécurité sociale par exemple)",
      );
    }
  });
});
