import {
  ANONYMIZED_REPORT_FILTER_LABELS,
  ANONYMIZED_REPORT_FILTER_OPTIONS,
  ANSWER_SIDE,
  anonymizedReportsHref,
  answerOperator,
  answerSide,
  displayedTaggingOf,
  parseAnonymizedReportSearch,
  storedVariantsOf,
  teamLabelOf,
} from "@/utils/anonymized-report";
import { GOLDEN_TAG_AXES } from "@/utils/golden-dataset-golden-tags";
import {
  OTHER_GOLDEN_TAG,
  UNDETERMINED_GOLDEN_TAG,
} from "@/utils/golden-dataset-tag";

const PROCEDURE = "demande rsa";
const BLOCKAGE = "détresse numérique";

describe("teamLabelOf", () => {
  it("returns the adjudicated spelling of a stored label", () => {
    expect(teamLabelOf("procedureTag", "demande rsa")).toBe("demande rsa");
    expect(teamLabelOf("procedureTag", "  Demande  RSA ")).toBe("demande rsa");
    expect(teamLabelOf("blockageTag", "DETRESSE NUMERIQUE")).toBe(
      "détresse numérique",
    );
  });

  it("keeps a label the projection sends to the other category", () => {
    expect(teamLabelOf("blockageTag", "déménagement")).toBe("déménagement");
  });

  it("hides null, unknown labels, labels of the other axis and exit tags", () => {
    expect(teamLabelOf("procedureTag", null)).toBeNull();
    expect(teamLabelOf("procedureTag", "pas un libellé")).toBeNull();
    expect(teamLabelOf("procedureTag", "dette")).toBeNull();
    for (const axis of GOLDEN_TAG_AXES) {
      expect(teamLabelOf(axis, OTHER_GOLDEN_TAG)).toBeNull();
      expect(teamLabelOf(axis, UNDETERMINED_GOLDEN_TAG)).toBeNull();
      expect(teamLabelOf(axis, "Inconnu")).toBeNull();
    }
  });

  it("shows the no-blockage answer on the blockage axis only", () => {
    expect(teamLabelOf("blockageTag", "Aucun")).toBe("aucun");
    expect(teamLabelOf("procedureTag", "aucun")).toBeNull();
  });
});

describe("displayedTaggingOf", () => {
  it("returns the adjudicated team label of each axis", () => {
    expect(
      displayedTaggingOf({
        procedureLabel: "Demande RSA",
        blockageLabel: "detresse numerique",
      }),
    ).toEqual({
      procedureLabel: "demande rsa",
      blockageLabel: "détresse numérique",
    });
  });

  it("keeps a label filed under « autre » and « aucun », drops « inconnu »", () => {
    expect(
      displayedTaggingOf({
        procedureLabel: "inconnu",
        blockageLabel: "déménagement",
      }),
    ).toEqual({ procedureLabel: null, blockageLabel: "déménagement" });
    expect(
      displayedTaggingOf({ procedureLabel: null, blockageLabel: "Aucun" }),
    ).toEqual({ procedureLabel: null, blockageLabel: "aucun" });
  });
});

describe("ANONYMIZED_REPORT_FILTER_OPTIONS", () => {
  it("lists the team labels in closed-tag order, then those filed under « autre »", () => {
    expect(
      ANONYMIZED_REPORT_FILTER_OPTIONS.procedureTag.main.slice(0, 5),
    ).toEqual([
      "demande code provisoire",
      "compte en ligne",
      "demande rsa",
      "mise à jour informations",
      "Suivi déclaration ressources",
    ]);
    expect(ANONYMIZED_REPORT_FILTER_OPTIONS.blockageTag).toEqual({
      main: [
        "accès mail",
        "compte en ligne inaccessible",
        "code d'accès non reçu",
        "document non reçu",
        "bug informatique",
        "télétransmission",
        "versement bloqué",
        "absence paiement",
        "dette",
        "détresse numérique",
        "refus sans explication",
        "rejet sans explication",
        "dossier incomplet",
        "erreur dossier",
        "aucun",
      ],
      others: ["déménagement", "formulaire inadapté"],
    });
  });

  it("files the team's own procedures under « autre », never in main", () => {
    const { main, others } = ANONYMIZED_REPORT_FILTER_OPTIONS.procedureTag;

    expect(others.slice(0, 3)).toEqual([
      "avis d'imposition",
      "crédit d'impôts",
      "chèque énergie",
    ]);
    expect(main).not.toContain("avis d'imposition");
    expect(main).toContain("demande rsa");
    expect(others).not.toContain("demande rsa");
  });

  it("offers no closed tag nor exit as a label", () => {
    for (const axis of GOLDEN_TAG_AXES) {
      expect(ANONYMIZED_REPORT_FILTER_LABELS[axis]).not.toContain(
        OTHER_GOLDEN_TAG,
      );
      expect(ANONYMIZED_REPORT_FILTER_LABELS[axis]).not.toContain(
        UNDETERMINED_GOLDEN_TAG,
      );
    }
    expect(ANONYMIZED_REPORT_FILTER_LABELS.procedureTag).not.toContain("RSA");
    expect(ANONYMIZED_REPORT_FILTER_LABELS.procedureTag).toContain(
      "demande rsa",
    );
  });

  it("accepts main then others as the flat label list", () => {
    expect(ANONYMIZED_REPORT_FILTER_LABELS.blockageTag.slice(-3)).toEqual([
      "aucun",
      "déménagement",
      "formulaire inadapté",
    ]);
  });
});

describe("storedVariantsOf", () => {
  it("keeps the stored spellings of the requested label only", () => {
    expect(
      storedVariantsOf("détresse numérique", [
        "détresse numérique",
        "Detresse numerique",
        null,
        "dette",
        "détresse",
      ]),
    ).toEqual(["détresse numérique", "Detresse numerique"]);
  });

  it("is empty when no stored value matches", () => {
    expect(storedVariantsOf("dette", [null, "accès mail"])).toEqual([]);
  });
});

describe("answerSide", () => {
  const report = { authorId: "author", coAuthorIds: ["co-author"] };

  it("puts the author and co-authors on the applicant side", () => {
    expect(answerSide("author", report)).toBe(ANSWER_SIDE.APPLICANT);
    expect(answerSide("co-author", report)).toBe(ANSWER_SIDE.APPLICANT);
  });

  it("puts anyone else on the operator side", () => {
    expect(answerSide("someone-else", report)).toBe(ANSWER_SIDE.OPERATOR);
  });
});

describe("answerOperator", () => {
  const caf = {
    id: "caf-01",
    organization: { name: "Caisse", shortName: "CAF" },
  };
  const cpam = { id: "cpam-01", organization: { name: "CPAM", shortName: "" } };

  it("names the organization of the author's requested team", () => {
    expect(answerOperator([caf, cpam], ["cpam-01"])).toBe("CPAM");
    expect(answerOperator([caf, cpam], ["caf-01"])).toBe("CAF");
  });

  it("returns null when no author team is requested", () => {
    expect(answerOperator([caf], ["cpam-01"])).toBeNull();
    expect(answerOperator([], ["cpam-01"])).toBeNull();
  });
});

describe("parseAnonymizedReportSearch", () => {
  it("defaults to the first page without filters", () => {
    expect(parseAnonymizedReportSearch({})).toEqual({
      page: 1,
      procedureLabel: undefined,
      blockageLabel: undefined,
      id: undefined,
    });
  });

  it("reads page, team labels and selection", () => {
    expect(
      parseAnonymizedReportSearch({
        page: "3",
        operateur: "CAF",
        tous: "1",
        demarche: PROCEDURE,
        blocage: "déménagement",
        id: "report-1",
      }),
    ).toEqual({
      page: 3,
      operator: "CAF",
      includeUntagged: true,
      procedureLabel: "demande rsa",
      blockageLabel: "déménagement",
      id: "report-1",
    });
  });

  it("ignores values that cannot be a valid search", () => {
    expect(
      parseAnonymizedReportSearch({
        page: "-2",
        operateur: "",
        tous: "oui",
        demarche: PROCEDURE.toUpperCase(),
        blocage: OTHER_GOLDEN_TAG,
        id: "",
      }),
    ).toEqual({
      page: 1,
      procedureLabel: undefined,
      blockageLabel: undefined,
      id: undefined,
    });
    expect(
      parseAnonymizedReportSearch({ demarche: "RSA" }).procedureLabel,
    ).toBeUndefined();
    expect(
      parseAnonymizedReportSearch({ demarche: BLOCKAGE }).procedureLabel,
    ).toBeUndefined();
    expect(parseAnonymizedReportSearch({ page: "1.5" }).page).toBe(1);
  });

  it("ignores the former category keys", () => {
    expect(
      parseAnonymizedReportSearch({
        "demarche-categorie": "RSA",
        "blocage-categorie": "aucun",
      }),
    ).toEqual({
      page: 1,
      procedureLabel: undefined,
      blockageLabel: undefined,
      id: undefined,
    });
  });

  it("takes the first value of a repeated parameter", () => {
    expect(parseAnonymizedReportSearch({ page: ["2", "5"] }).page).toBe(2);
  });
});

describe("anonymizedReportsHref", () => {
  it("omits defaults", () => {
    expect(anonymizedReportsHref({ page: 1 })).toBe(
      "/admin/signalements-anonymises",
    );
  });

  it("writes each team label under its axis key", () => {
    expect(
      anonymizedReportsHref({
        page: 2,
        operator: "CAF",
        includeUntagged: true,
        procedureLabel: "demande rsa",
        blockageLabel: "dette",
      }),
    ).toBe(
      "/admin/signalements-anonymises?page=2&operateur=CAF&tous=1&demarche=demande+rsa&blocage=dette",
    );
  });

  it("round-trips through parseAnonymizedReportSearch", () => {
    const search = {
      page: 2,
      operator: "CAF",
      includeUntagged: true,
      procedureLabel: PROCEDURE,
      blockageLabel: BLOCKAGE,
      id: "report-1",
    };
    const query = anonymizedReportsHref(search).split("?")[1];

    expect(
      parseAnonymizedReportSearch(
        Object.fromEntries(new URLSearchParams(query)),
      ),
    ).toEqual({
      page: 2,
      operator: "CAF",
      includeUntagged: true,
      procedureLabel: "demande rsa",
      blockageLabel: "détresse numérique",
      id: "report-1",
    });
  });
});
