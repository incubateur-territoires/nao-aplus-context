import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import {
  GoldenDatasetOverview,
  type OverviewAnnotator,
  type OverviewItem,
  type OverviewRun,
} from "./golden-dataset-overview";

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(),
}));

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

const ANNOTATORS: OverviewAnnotator[] = [
  {
    annotatorId: "charles-1",
    firstName: "Charles",
    lastName: "d'Oiron",
    annotated: 2,
  },
  {
    annotatorId: "charles-2",
    firstName: "Charles",
    lastName: "Le Prévost",
    annotated: 1,
  },
  { annotatorId: "manon", firstName: "Manon", lastName: "Duval", annotated: 0 },
];

const RUNS: OverviewRun[] = [
  {
    runId: "run-mistral-froid",
    model: "editeur-a/Modele-Small-24B",
    temperature: 0.2,
    predicted: 2,
  },
  {
    runId: "run-mistral-chaud",
    model: "editeur-a/Modele-Small-24B",
    temperature: 1,
    predicted: 1,
  },
  {
    runId: "run-oss",
    model: "editeur-b/modele-oss-120b",
    temperature: 0.2,
    predicted: 2,
  },
];

const MODELE_FROID = "Modele-Small-24B (température 0,2)";
const MODELE_CHAUD = "Modele-Small-24B (température 1)";
const MODELE_OSS = "modele-oss-120b";
const REFERENCE_LABEL = "Référence";
const AGREEMENT_TITLE = "Accord entre annotateurs";

const ITEMS: OverviewItem[] = [
  {
    position: 1,
    organization: "CAF du Nord",
    subject: "Allocation suspendue",
    description: "Le dossier de [PRENOM] est bloqué depuis trois mois.",
    goldenBlockageTag: null,
    goldenProcedureTag: null,
    annotations: [
      {
        annotatorId: "charles-1",
        blockageTag: "dossier bloqué",
        procedureTag: "rsa",
      },
      {
        annotatorId: "charles-2",
        blockageTag: "pièce manquante",
        procedureTag: null,
      },
    ],
    predictions: [
      {
        runId: "run-mistral-froid",
        blockageTag: "dossier bloqué",
        procedureTag: "rsa",
      },
      {
        runId: "run-mistral-chaud",
        blockageTag: "retard de paiement",
        procedureTag: "prime activité",
      },
      {
        runId: "run-oss",
        blockageTag: "pièce manquante",
        procedureTag: null,
      },
    ],
  },
  {
    position: 2,
    organization: "CPAM de Lille",
    subject: "Carte vitale non reçue",
    description: "La carte de [PRENOM] n'est jamais arrivée.",
    goldenBlockageTag: null,
    goldenProcedureTag: null,
    annotations: [
      {
        annotatorId: "charles-1",
        blockageTag: "délai anormal",
        procedureTag: "carte vitale",
      },
    ],
    predictions: [
      {
        runId: "run-mistral-froid",
        blockageTag: "délai anormal",
        procedureTag: "carte vitale",
      },
      {
        runId: "run-oss",
        blockageTag: "courrier perdu",
        procedureTag: "carte vitale",
      },
    ],
  },
];

/** Deux annotateurs d'accord sur les deux axes, rien encore retenu. */
const UNANIMOUS_ITEM: OverviewItem = {
  position: 4,
  organization: "CAF du Sud",
  subject: "Prime non versée",
  description: "La prime de [PRENOM] n'a pas été versée.",
  goldenBlockageTag: null,
  goldenProcedureTag: null,
  annotations: [
    {
      annotatorId: "charles-1",
      blockageTag: "retard de paiement",
      procedureTag: "prime activité",
    },
    {
      annotatorId: "charles-2",
      blockageTag: "Retard de paiement",
      procedureTag: "prime activité",
    },
  ],
  predictions: [],
};

/** Annoté par une seule personne : ses paires ne comparent rien. */
const MANON_ONLY_ITEM: OverviewItem = {
  position: 6,
  organization: "France Travail",
  subject: "Inscription refusée",
  description: "L'inscription de [PRENOM] a été refusée.",
  goldenBlockageTag: null,
  goldenProcedureTag: null,
  annotations: [
    {
      annotatorId: "manon",
      blockageTag: "compte inactif",
      procedureTag: "inscription",
    },
  ],
  predictions: [],
};

/** Les deux axes retenus : l'item est adjugé. */
const ADJUDICATED_ITEM: OverviewItem = {
  position: 5,
  organization: "DGFIP",
  subject: "Avis d'imposition manquant",
  description: "L'avis de [PRENOM] n'est pas accessible.",
  goldenBlockageTag: "compte inactif",
  goldenProcedureTag: "impôts",
  annotations: [
    {
      annotatorId: "charles-1",
      blockageTag: "compte inactif",
      procedureTag: "impôts",
    },
  ],
  predictions: [],
};

/** Un même texte sur les deux axes : seul l'axe retenu doit s'afficher pressé. */
const SAME_TEXT_ON_BOTH_AXES: OverviewItem = {
  position: 3,
  organization: "France Travail",
  subject: "Radiation contestée",
  description: "Le dossier de [PRENOM] a été clos.",
  goldenBlockageTag: null,
  goldenProcedureTag: "radiation",
  annotations: [
    {
      annotatorId: "charles-1",
      blockageTag: "radiation",
      procedureTag: "radiation",
    },
  ],
  predictions: [],
};

interface OverviewData {
  total: number;
  annotators: OverviewAnnotator[];
  runs: OverviewRun[];
  items: OverviewItem[];
}

interface SetupOptions {
  data?: OverviewData | null;
  isLoading?: boolean;
  error?: { message: string } | null;
  adjudicationError?: { message: string } | null;
}

interface ChosenTags {
  position: number;
  blockageTag: string | null;
  procedureTag: string | null;
}

interface MutationCallbacks {
  mutationKey?: string[];
  scope?: { id: string };
  onMutate?: (chosen: ChosenTags) => Promise<{ previous?: OverviewData }>;
  onError?: (
    error: Error,
    chosen: ChosenTags,
    context: { previous?: OverviewData } | undefined,
  ) => void;
  onSuccess?: () => void;
}

const DATA: OverviewData = {
  total: 2,
  annotators: ANNOTATORS,
  runs: RUNS,
  items: ITEMS,
};

const OVERVIEW_KEY = ["goldenDataset", "overview"];
const CHOOSE_KEY = ["goldenDataset", "chooseGoldenTags"];
const ADJUDICATE_KEY = ["goldenDataset", "adjudicateUnanimous"];

/**
 * La mutation est mockée, donc `mutate` ne déclencherait aucun rappel. On
 * laisse `mutationOptions` rendre ses arguments et on rejoue `onMutate` à
 * chaque appel : l'écriture optimiste du cache reste ainsi exercée par le clic
 * lui-même, et non par un appel direct depuis le test.
 *
 * Deux mutations sont montées dans le composant. `mutationOptions` leur ajoute
 * une clé distincte comme le fait celui de tRPC, sans quoi la seconde effacerait
 * les rappels de la première.
 */
function setup({
  data = DATA,
  isLoading = false,
  error = null,
  adjudicationError = null,
}: SetupOptions = {}) {
  const mutate = jest.fn();
  const adjudicateMutate = jest.fn();
  const setQueryData = jest.fn();
  const cancelQueries = jest.fn().mockResolvedValue(undefined);
  const invalidateQueries = jest.fn();
  const getQueryData = jest.fn().mockReturnValue(data);
  const optionsByKey = new Map<string, MutationCallbacks>();

  function optionsFor(key: string[]): MutationCallbacks {
    return optionsByKey.get(String(key)) ?? {};
  }

  (useTRPC as jest.Mock).mockReturnValue({
    goldenDataset: {
      overview: {
        queryOptions: jest.fn().mockReturnValue({}),
        queryKey: jest.fn().mockReturnValue(OVERVIEW_KEY),
      },
      chooseGoldenTags: {
        mutationOptions: jest.fn((options: MutationCallbacks) => ({
          ...options,
          mutationKey: CHOOSE_KEY,
        })),
      },
      adjudicateUnanimous: {
        mutationOptions: jest.fn((options: MutationCallbacks) => ({
          ...options,
          mutationKey: ADJUDICATE_KEY,
        })),
      },
    },
  });
  (useQueryClient as jest.Mock).mockReturnValue({
    cancelQueries,
    getQueryData,
    invalidateQueries,
    setQueryData,
  });
  (useQuery as jest.Mock).mockReturnValue({ data, isLoading, error });
  (useMutation as jest.Mock).mockImplementation(
    (options: MutationCallbacks) => {
      const isAdjudication =
        String(options.mutationKey) === String(ADJUDICATE_KEY);
      optionsByKey.set(String(options.mutationKey), options);

      return {
        isPending: false,
        error: isAdjudication ? adjudicationError : null,
        mutate: (chosen: ChosenTags) => {
          void options.onMutate?.(chosen);
          (isAdjudication ? adjudicateMutate : mutate)(chosen);
        },
      };
    },
  );

  return {
    mutate,
    adjudicateMutate,
    setQueryData,
    cancelQueries,
    getQueryData,
    invalidateQueries,
    mutationScope: () => optionsFor(CHOOSE_KEY).scope,
    succeedAdjudication: () => optionsFor(ADJUDICATE_KEY).onSuccess?.(),
    failLastMutation: (chosen: ChosenTags, previous?: OverviewData) =>
      optionsFor(CHOOSE_KEY).onError?.(new Error("Écriture refusée"), chosen, {
        previous,
      }),
  };
}

/** Rejoue sur les données l'écriture que le clic a poussée dans le cache. */
function optimisticData(setQueryData: jest.Mock): OverviewData {
  const [key, updater] = setQueryData.mock.calls[0];

  expect(key).toBe(OVERVIEW_KEY);

  return updater(DATA);
}

function tagButton(
  card: HTMLElement,
  sourceLabel: string,
  columnLabel: string,
): HTMLElement {
  return within(cellFor(card, sourceLabel, columnLabel)).getByRole("button");
}

/** `onMutate` attend l'annulation des refetchs, donc le clic se laisse vider. */
async function clickButton(button: HTMLElement) {
  await act(async () => {
    fireEvent.click(button);
  });
}

async function clickTag(
  card: HTMLElement,
  sourceLabel: string,
  columnLabel: string,
) {
  await clickButton(tagButton(card, sourceLabel, columnLabel));
}

async function retainTag(cell: HTMLElement, text: string) {
  fireEvent.change(within(cell).getByRole("textbox"), {
    target: { value: text },
  });
  await clickButton(within(cell).getByRole("button", { name: "Retenir" }));
}

function pressedLabelsIn(card: HTMLElement, columnLabel: string): string[] {
  return sourceLabelsOf(card).flatMap((label) => {
    const cell = cellFor(card, label ?? "", columnLabel);
    const button = within(cell).queryByRole("button");

    return button?.getAttribute("aria-pressed") === "true"
      ? [button.textContent ?? ""]
      : [];
  });
}

function cardOf(subject: string): HTMLElement {
  return screen.getByText(subject).closest("article") as HTMLElement;
}

function headerLabelsOf(card: HTMLElement): (string | null)[] {
  return within(card)
    .getAllByRole("columnheader")
    .map((header) => header.textContent);
}

function bodyRowsOf(card: HTMLElement): HTMLElement[] {
  const [, body] = within(card).getAllByRole("rowgroup");

  return within(body).getAllByRole("row");
}

function firstCellTextOf(row: HTMLElement): string {
  return within(row).getAllByRole("cell")[0].textContent ?? "";
}

/**
 * La ligne Référence porte plusieurs boutons par cellule et n'appartient à
 * aucune source : les helpers qui lisent les lignes de sources l'écartent, sans
 * quoi ils désigneraient une cellule ambiguë.
 */
function sourceRowsOf(card: HTMLElement): HTMLElement[] {
  return bodyRowsOf(card).filter(
    (row) => firstCellTextOf(row) !== REFERENCE_LABEL,
  );
}

function referenceCell(card: HTMLElement, columnLabel: string): HTMLElement {
  const row = bodyRowsOf(card).find(
    (candidate) => firstCellTextOf(candidate) === REFERENCE_LABEL,
  ) as HTMLElement;

  return within(row).getAllByRole("cell")[
    headerLabelsOf(card).indexOf(columnLabel)
  ];
}

/**
 * La cellule de libellé d'une ligne modèle porte le marqueur « modèle » sous
 * son libellé. Le retirer laisse désigner les deux sortes de sources par leur
 * seul libellé.
 */
function sourceLabelsOf(card: HTMLElement): (string | undefined)[] {
  return sourceRowsOf(card).map((row) =>
    within(row)
      .getAllByRole("cell")[0]
      .textContent?.replace(/modèle$/, ""),
  );
}

function progressSection(): HTMLElement {
  return screen
    .getByRole("heading", { name: "Avancement" })
    .closest("section") as HTMLElement;
}

/**
 * Les listes d'avancement sont les enfants directs de la section ; celles de
 * l'accord entre annotateurs vivent sous leur propre titre.
 */
function progressLists(): HTMLElement[] {
  const section = progressSection();

  return within(section)
    .getAllByRole("list")
    .filter((list) => list.parentElement === section);
}

function agreementSection(): HTMLElement {
  return screen
    .getByRole("heading", { name: AGREEMENT_TITLE })
    .closest("section") as HTMLElement;
}

function itemSubjects(): string[] {
  return screen
    .queryAllByRole("article")
    .map(
      (card) =>
        within(card).getByRole("heading", { level: 3 }).textContent ?? "",
    );
}

/** Lit une cellule au croisement d'une source et d'une colonne, comme l'œil. */
function cellFor(
  card: HTMLElement,
  sourceLabel: string,
  columnLabel: string,
): HTMLElement {
  const row = sourceRowsOf(card)[sourceLabelsOf(card).indexOf(sourceLabel)];
  const column = headerLabelsOf(card).indexOf(columnLabel);

  return within(row).getAllByRole("cell")[column];
}

describe("GoldenDatasetOverview", () => {
  it("affiche le contenu du signalement au-dessus des annotations", () => {
    setup();
    render(<GoldenDatasetOverview />);

    const card = cardOf("Allocation suspendue");
    expect(
      within(card).getByText("Signalement 1 / 2 · CAF du Nord"),
    ).toBeInTheDocument();
    expect(
      within(card).getByText(
        "Le dossier de [PRENOM] est bloqué depuis trois mois.",
      ),
    ).toBeInTheDocument();
  });

  it("met une source par ligne et les deux tags en colonnes", () => {
    setup();
    render(<GoldenDatasetOverview />);

    const card = cardOf("Allocation suspendue");

    expect(headerLabelsOf(card)).toEqual(["", "Blocage", "Démarche"]);
    expect(sourceLabelsOf(card)).toEqual([
      "Charles d'Oiron",
      "Charles Le Prévost",
      "Manon",
      MODELE_FROID,
      MODELE_CHAUD,
      MODELE_OSS,
    ]);
  });

  it("range chaque tag sur la ligne de son auteur, sans quoi deux annotateurs de même prénom se confondent", () => {
    setup();
    render(<GoldenDatasetOverview />);

    const card = cardOf("Allocation suspendue");

    expect(cellFor(card, "Charles d'Oiron", "Blocage")).toHaveTextContent(
      "dossier bloqué",
    );
    expect(cellFor(card, "Charles d'Oiron", "Démarche")).toHaveTextContent(
      "rsa",
    );
    expect(cellFor(card, "Charles Le Prévost", "Blocage")).toHaveTextContent(
      "pièce manquante",
    );
  });

  it("laisse un tiret quand le tag manque", () => {
    setup();
    render(<GoldenDatasetOverview />);

    const card = cardOf("Allocation suspendue");

    expect(cellFor(card, "Charles Le Prévost", "Démarche")).toHaveTextContent(
      "–",
    );
  });

  it("vide la ligne d'un annotateur qui a sauté ce signalement", () => {
    setup();
    render(<GoldenDatasetOverview />);

    const card = cardOf("Carte vitale non reçue");

    expect(cellFor(card, "Charles Le Prévost", "Blocage")).toHaveTextContent(
      "–",
    );
    expect(cellFor(card, "Manon", "Démarche")).toHaveTextContent("–");
    expect(cellFor(card, "Charles d'Oiron", "Blocage")).toHaveTextContent(
      "délai anormal",
    );
  });

  it("liste tous les admins, même celui qui n'a rien annoté", () => {
    setup();
    render(<GoldenDatasetOverview />);

    const [humans] = progressLists();

    expect(within(humans).getByText("Manon")).toBeInTheDocument();
    expect(within(humans).getByText("0/2")).toBeInTheDocument();
    expect(within(humans).getByText("2/2")).toBeInTheDocument();
  });

  it("liste l'avancement de chaque série de modèles à part des humains", () => {
    setup();
    render(<GoldenDatasetOverview />);

    const [, models] = progressLists();

    expect(within(models).getByText(MODELE_FROID)).toBeInTheDocument();
    expect(within(models).getByText(MODELE_CHAUD)).toBeInTheDocument();
    expect(within(models).getByText(MODELE_OSS)).toBeInTheDocument();
    expect(within(models).getAllByText("modèle")).toHaveLength(3);
    expect(
      within(models).getByText(MODELE_CHAUD).closest("li"),
    ).toHaveTextContent("1/2");
  });

  it("n'affiche pas de seconde liste quand aucune série n'a tourné", () => {
    setup({ data: { ...DATA, runs: [] } });
    render(<GoldenDatasetOverview />);

    expect(progressLists()).toHaveLength(1);
  });

  it("range chaque prédiction sur la ligne de sa série", () => {
    setup();
    render(<GoldenDatasetOverview />);

    const card = cardOf("Allocation suspendue");

    expect(cellFor(card, MODELE_FROID, "Blocage")).toHaveTextContent(
      "dossier bloqué",
    );
    expect(cellFor(card, MODELE_CHAUD, "Blocage")).toHaveTextContent(
      "retard de paiement",
    );
    expect(cellFor(card, MODELE_CHAUD, "Démarche")).toHaveTextContent(
      "prime activité",
    );
    expect(cellFor(card, MODELE_OSS, "Blocage")).toHaveTextContent(
      "pièce manquante",
    );
    expect(cellFor(card, MODELE_OSS, "Démarche")).toHaveTextContent("–");
  });

  it("laisse un tiret dans les cellules d'une série incomplète", () => {
    setup();
    render(<GoldenDatasetOverview />);

    const card = cardOf("Carte vitale non reçue");

    expect(cellFor(card, MODELE_CHAUD, "Blocage")).toHaveTextContent("–");
    expect(cellFor(card, MODELE_CHAUD, "Démarche")).toHaveTextContent("–");
    expect(cellFor(card, MODELE_FROID, "Blocage")).toHaveTextContent(
      "délai anormal",
    );
  });

  it("n'ajoute aucune ligne quand aucune série n'a tourné", () => {
    setup({ data: { ...DATA, runs: [] } });
    render(<GoldenDatasetOverview />);

    const card = cardOf("Allocation suspendue");

    expect(headerLabelsOf(card)).toEqual(["", "Blocage", "Démarche"]);
    expect(sourceLabelsOf(card)).toEqual([
      "Charles d'Oiron",
      "Charles Le Prévost",
      "Manon",
    ]);
  });

  it("marque la ligne d'une série, pour ne pas la lire comme un humain", () => {
    setup();
    render(<GoldenDatasetOverview />);

    const rows = sourceRowsOf(cardOf("Allocation suspendue"));

    expect(rows[0]).toHaveTextContent("Charles d'Oiron");
    expect(rows[0]).not.toHaveTextContent("modèle");
    expect(rows[3]).toHaveTextContent("modèle");
  });

  it("distingue un tag de modèle d'un tag humain", () => {
    setup();
    render(<GoldenDatasetOverview />);

    const card = cardOf("Allocation suspendue");

    expect(
      cellFor(card, MODELE_FROID, "Blocage").querySelector(".fr-tag--sm"),
    ).toBeInTheDocument();
    expect(
      cellFor(card, "Charles d'Oiron", "Blocage").querySelector(".fr-tag--sm"),
    ).not.toBeInTheDocument();
  });

  it("affiche une carte par signalement du corpus", () => {
    setup();
    render(<GoldenDatasetOverview />);

    expect(screen.getByText("Allocation suspendue")).toBeInTheDocument();
    expect(screen.getByText("Carte vitale non reçue")).toBeInTheDocument();
  });

  it("affiche un état de chargement", () => {
    setup({ data: null, isLoading: true });
    render(<GoldenDatasetOverview />);

    expect(screen.getByText("Chargement des annotations…")).toBeInTheDocument();
  });

  it("affiche le message d'erreur de la requête", () => {
    setup({
      data: null,
      error: { message: "Le corpus n'a pas encore été constitué." },
    });
    render(<GoldenDatasetOverview />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Le corpus n'a pas encore été constitué.",
    );
  });

  it("ne fait pas un bouton d'une cellule sans tag", () => {
    setup();
    render(<GoldenDatasetOverview />);

    const card = cardOf("Allocation suspendue");

    expect(
      within(cellFor(card, "Charles Le Prévost", "Démarche")).queryByRole(
        "button",
      ),
    ).not.toBeInTheDocument();
    expect(
      within(cellFor(card, "Manon", "Blocage")).queryByRole("button"),
    ).not.toBeInTheDocument();
  });

  it("presse toutes les sources qui portent le texte retenu, dans son axe seul", () => {
    setup({
      data: {
        ...DATA,
        items: [{ ...ITEMS[0], goldenBlockageTag: "dossier bloqué" }, ITEMS[1]],
      },
    });
    render(<GoldenDatasetOverview />);

    const card = cardOf("Allocation suspendue");

    expect(pressedLabelsIn(card, "Blocage")).toEqual([
      "dossier bloqué",
      "dossier bloqué",
    ]);
    expect(pressedLabelsIn(card, "Démarche")).toEqual([]);
  });

  it("ne presse que l'axe retenu quand les deux portent le même texte", () => {
    setup({ data: { ...DATA, items: [SAME_TEXT_ON_BOTH_AXES] } });
    render(<GoldenDatasetOverview />);

    const card = cardOf("Radiation contestée");

    expect(pressedLabelsIn(card, "Démarche")).toEqual(["radiation"]);
    expect(pressedLabelsIn(card, "Blocage")).toEqual([]);
  });

  it("ne presse rien dans les autres signalements", () => {
    setup({
      data: {
        ...DATA,
        items: [{ ...ITEMS[0], goldenBlockageTag: "dossier bloqué" }, ITEMS[1]],
      },
    });
    render(<GoldenDatasetOverview />);

    expect(
      pressedLabelsIn(cardOf("Carte vitale non reçue"), "Blocage"),
    ).toEqual([]);
  });

  it("supporte un retenu que plus aucune source ne propose", () => {
    setup({
      data: {
        ...DATA,
        items: [{ ...ITEMS[0], goldenBlockageTag: "tag disparu" }, ITEMS[1]],
      },
    });
    render(<GoldenDatasetOverview />);

    const card = cardOf("Allocation suspendue");

    expect(pressedLabelsIn(card, "Blocage")).toEqual([]);
    expect(cellFor(card, "Charles d'Oiron", "Blocage")).toHaveTextContent(
      "dossier bloqué",
    );
  });

  it("retient le texte cliqué et presse toutes ses occurrences", async () => {
    const { mutate, setQueryData } = setup();
    const { rerender } = render(<GoldenDatasetOverview />);

    await clickTag(
      cardOf("Allocation suspendue"),
      "Charles d'Oiron",
      "Blocage",
    );

    expect(mutate).toHaveBeenCalledWith({
      position: 1,
      blockageTag: "dossier bloqué",
      procedureTag: null,
    });

    setup({ data: optimisticData(setQueryData) });
    rerender(<GoldenDatasetOverview />);

    expect(pressedLabelsIn(cardOf("Allocation suspendue"), "Blocage")).toEqual([
      "dossier bloqué",
      "dossier bloqué",
    ]);
  });

  it("relâche le texte déjà retenu au second clic", async () => {
    const { mutate } = setup({
      data: {
        ...DATA,
        items: [{ ...ITEMS[0], goldenBlockageTag: "dossier bloqué" }, ITEMS[1]],
      },
    });
    render(<GoldenDatasetOverview />);

    await clickTag(
      cardOf("Allocation suspendue"),
      "Charles d'Oiron",
      "Blocage",
    );

    expect(mutate).toHaveBeenCalledWith({
      position: 1,
      blockageTag: null,
      procedureTag: null,
    });
  });

  it("reconnaît le retenu à la casse près, et le clic le relâche", async () => {
    const { mutate } = setup({
      data: {
        ...DATA,
        items: [{ ...ITEMS[0], goldenBlockageTag: "Dossier Bloqué" }, ITEMS[1]],
      },
    });
    render(<GoldenDatasetOverview />);

    const card = cardOf("Allocation suspendue");

    expect(pressedLabelsIn(card, "Blocage")).toEqual([
      "dossier bloqué",
      "dossier bloqué",
    ]);

    await clickTag(card, "Charles d'Oiron", "Blocage");

    expect(mutate).toHaveBeenCalledWith({
      position: 1,
      blockageTag: null,
      procedureTag: null,
    });
  });

  it("remplace le retenu quand on clique un autre tag du même axe", async () => {
    const { mutate } = setup({
      data: {
        ...DATA,
        items: [{ ...ITEMS[0], goldenBlockageTag: "dossier bloqué" }, ITEMS[1]],
      },
    });
    render(<GoldenDatasetOverview />);

    await clickTag(cardOf("Allocation suspendue"), MODELE_CHAUD, "Blocage");

    expect(mutate).toHaveBeenCalledWith({
      position: 1,
      blockageTag: "retard de paiement",
      procedureTag: null,
    });
  });

  it("laisse l'axe voisin intact quand on retient sur l'autre", async () => {
    const { mutate } = setup({
      data: {
        ...DATA,
        items: [{ ...ITEMS[0], goldenBlockageTag: "dossier bloqué" }, ITEMS[1]],
      },
    });
    render(<GoldenDatasetOverview />);

    await clickTag(cardOf("Allocation suspendue"), MODELE_CHAUD, "Démarche");

    expect(mutate).toHaveBeenCalledWith({
      position: 1,
      blockageTag: "dossier bloqué",
      procedureTag: "prime activité",
    });
  });

  it("nomme l'action que le bouton déclenche", () => {
    setup({
      data: {
        ...DATA,
        items: [{ ...ITEMS[0], goldenBlockageTag: "dossier bloqué" }, ITEMS[1]],
      },
    });
    render(<GoldenDatasetOverview />);

    const card = cardOf("Allocation suspendue");

    expect(tagButton(card, "Charles d'Oiron", "Blocage")).toHaveAttribute(
      "title",
      "Ne plus retenir ce tag",
    );
    expect(tagButton(card, MODELE_CHAUD, "Blocage")).toHaveAttribute(
      "title",
      "Retenir ce tag",
    );
  });

  it("annule les refetchs en vol avant d'écrire le cache", async () => {
    const { cancelQueries } = setup();
    render(<GoldenDatasetOverview />);

    await clickTag(
      cardOf("Allocation suspendue"),
      "Charles d'Oiron",
      "Blocage",
    );

    expect(cancelQueries).toHaveBeenCalledWith({ queryKey: OVERVIEW_KEY });
  });

  it("sérialise les écritures par un scope, sans quoi deux clics rapprochés commitent dans le désordre", () => {
    const { mutationScope } = setup();
    render(<GoldenDatasetOverview />);

    expect(mutationScope()).toEqual({
      id: "golden-dataset-choose-golden-tags",
    });
  });

  it("n'écrit que le signalement cliqué dans le cache", async () => {
    const { setQueryData } = setup();
    render(<GoldenDatasetOverview />);

    await clickTag(
      cardOf("Carte vitale non reçue"),
      "Charles d'Oiron",
      "Démarche",
    );

    const items = optimisticData(setQueryData).items;
    expect(items[0]).toBe(ITEMS[0]);
    expect(items[1]).toMatchObject({
      position: 2,
      goldenBlockageTag: null,
      goldenProcedureTag: "carte vitale",
    });
  });

  it("restaure le cache précédent quand l'écriture échoue", async () => {
    const { setQueryData, failLastMutation } = setup();
    render(<GoldenDatasetOverview />);

    await clickTag(
      cardOf("Allocation suspendue"),
      "Charles d'Oiron",
      "Blocage",
    );
    failLastMutation(
      { position: 1, blockageTag: "dossier bloqué", procedureTag: null },
      DATA,
    );

    expect(setQueryData).toHaveBeenLastCalledWith(OVERVIEW_KEY, DATA);
  });

  it("signale un corpus vide", () => {
    setup({
      data: { total: 0, annotators: ANNOTATORS, runs: RUNS, items: [] },
    });
    render(<GoldenDatasetOverview />);

    expect(
      screen.getByText("Aucun signalement dans le corpus."),
    ).toBeInTheDocument();
  });

  it("compte les signalements dont les deux tags de référence sont posés", () => {
    setup({
      data: {
        total: 2,
        annotators: ANNOTATORS,
        runs: [],
        items: [ITEMS[0], ADJUDICATED_ITEM],
      },
    });
    render(<GoldenDatasetOverview />);

    expect(
      within(progressSection()).getByText("Adjugés").closest("p"),
    ).toHaveTextContent("Adjugés 1/2");
  });

  it("affiche le taux d'accord des axes comparables et tait les autres", () => {
    setup();
    render(<GoldenDatasetOverview />);

    const block = agreementSection();

    expect(within(block).getByText("Blocage").closest("p")).toHaveTextContent(
      "0 % (0/1)",
    );
    expect(within(block).queryByText("Démarche")).not.toBeInTheDocument();
  });

  it("détaille l'accord de chaque paire d'annotateurs", () => {
    setup();
    render(<GoldenDatasetOverview />);

    expect(
      within(agreementSection())
        .getByText("Charles d'Oiron · Charles Le Prévost")
        .closest("li"),
    ).toHaveTextContent("0 % (0/1)");
  });

  it("masque les paires qui n'ont aucun signalement en commun", () => {
    setup({ data: { ...DATA, items: [ITEMS[0], MANON_ONLY_ITEM] } });
    render(<GoldenDatasetOverview />);

    const block = agreementSection();

    expect(
      within(block).getByText("Charles d'Oiron · Charles Le Prévost"),
    ).toBeInTheDocument();
    expect(within(block).queryByText(/Manon/)).not.toBeInTheDocument();
  });

  it("n'affiche aucun accord quand un seul annotateur a tagué", () => {
    setup({ data: { ...DATA, items: [ITEMS[1]] } });
    render(<GoldenDatasetOverview />);

    expect(
      screen.queryByRole("heading", { name: AGREEMENT_TITLE }),
    ).not.toBeInTheDocument();
  });

  it("affiche dans la ligne Référence un retenu qu'aucune source ne porte", async () => {
    const { mutate } = setup({
      data: {
        ...DATA,
        items: [{ ...ITEMS[0], goldenBlockageTag: "tag disparu" }, ITEMS[1]],
      },
    });
    render(<GoldenDatasetOverview />);

    const cell = referenceCell(cardOf("Allocation suspendue"), "Blocage");
    const chosen = within(cell).getByRole("button", { name: "tag disparu" });

    expect(chosen).toHaveAttribute("aria-pressed", "true");

    await clickButton(chosen);

    expect(mutate).toHaveBeenCalledWith({
      position: 1,
      blockageTag: null,
      procedureTag: null,
    });
  });

  it("retient « inconnu » depuis la ligne Référence", async () => {
    const { mutate } = setup();
    render(<GoldenDatasetOverview />);

    const cell = referenceCell(cardOf("Allocation suspendue"), "Blocage");
    const unknown = within(cell).getByRole("button", { name: "inconnu" });

    expect(unknown).toHaveAttribute("aria-pressed", "false");

    await clickButton(unknown);

    expect(mutate).toHaveBeenCalledWith({
      position: 1,
      blockageTag: "inconnu",
      procedureTag: null,
    });
  });

  it("relâche « inconnu » sans le dédoubler quand il est déjà retenu", async () => {
    const { mutate } = setup({
      data: {
        ...DATA,
        items: [{ ...ITEMS[0], goldenBlockageTag: "inconnu" }, ITEMS[1]],
      },
    });
    render(<GoldenDatasetOverview />);

    const cell = referenceCell(cardOf("Allocation suspendue"), "Blocage");

    expect(
      within(cell).getAllByRole("button", { name: "inconnu" }),
    ).toHaveLength(1);

    const unknown = within(cell).getByRole("button", { name: "inconnu" });
    expect(unknown).toHaveAttribute("aria-pressed", "true");

    await clickButton(unknown);

    expect(mutate).toHaveBeenCalledWith({
      position: 1,
      blockageTag: null,
      procedureTag: null,
    });
  });

  it("nomme la saisie libre par son axe", () => {
    setup();
    render(<GoldenDatasetOverview />);

    const card = cardOf("Allocation suspendue");

    expect(
      within(referenceCell(card, "Blocage")).getByRole("textbox", {
        name: "Retenir un autre tag de blocage",
      }),
    ).toBeInTheDocument();
    expect(
      within(referenceCell(card, "Démarche")).getByRole("textbox", {
        name: "Retenir un autre tag de démarche",
      }),
    ).toBeInTheDocument();
  });

  it("retient le tag saisi et laisse l'axe voisin intact", async () => {
    const { mutate } = setup({
      data: {
        ...DATA,
        items: [{ ...ITEMS[0], goldenProcedureTag: "rsa" }, ITEMS[1]],
      },
    });
    render(<GoldenDatasetOverview />);

    await retainTag(
      referenceCell(cardOf("Allocation suspendue"), "Blocage"),
      "pièce manquante",
    );

    expect(mutate).toHaveBeenCalledWith({
      position: 1,
      blockageTag: "pièce manquante",
      procedureTag: "rsa",
    });
  });

  it("retient encore le tag saisi quand c'est déjà celui retenu", async () => {
    const { mutate } = setup({
      data: {
        ...DATA,
        items: [{ ...ITEMS[0], goldenBlockageTag: "dossier bloqué" }, ITEMS[1]],
      },
    });
    render(<GoldenDatasetOverview />);

    await retainTag(
      referenceCell(cardOf("Allocation suspendue"), "Blocage"),
      "dossier bloqué",
    );

    expect(mutate).toHaveBeenCalledWith({
      position: 1,
      blockageTag: "dossier bloqué",
      procedureTag: null,
    });
  });

  it("refuse une saisie trop longue sans rien écrire", async () => {
    const { mutate } = setup();
    render(<GoldenDatasetOverview />);

    const cell = referenceCell(cardOf("Allocation suspendue"), "Blocage");
    await retainTag(cell, "un deux trois quatre cinq six");

    expect(
      within(cell).getByText("Le tag doit rester court : 5 mots au maximum."),
    ).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("restreint la liste au groupe filtré et compte chaque groupe", () => {
    const subjects = [
      "Allocation suspendue",
      "Prime non versée",
      "Avis d'imposition manquant",
      "Carte vitale non reçue",
    ];
    setup({
      data: {
        total: 4,
        annotators: ANNOTATORS,
        runs: [],
        items: [ITEMS[0], UNANIMOUS_ITEM, ADJUDICATED_ITEM, ITEMS[1]],
      },
    });
    render(<GoldenDatasetOverview />);

    expect(screen.getByRole("button", { name: "Tous (4)" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(itemSubjects()).toEqual(subjects);

    fireEvent.click(screen.getByRole("button", { name: "Unanimes (1)" }));
    expect(itemSubjects()).toEqual(["Prime non versée"]);

    fireEvent.click(screen.getByRole("button", { name: "Adjugés (1)" }));
    expect(itemSubjects()).toEqual(["Avis d'imposition manquant"]);

    fireEvent.click(screen.getByRole("button", { name: "À discuter (2)" }));
    expect(itemSubjects()).toEqual([
      "Allocation suspendue",
      "Carte vitale non reçue",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Tous (4)" }));
    expect(itemSubjects()).toEqual(subjects);
  });

  it("annonce le nombre d'axes que le remplissage écrirait", async () => {
    const { adjudicateMutate } = setup({
      data: { ...DATA, items: [ITEMS[0], UNANIMOUS_ITEM] },
    });
    render(<GoldenDatasetOverview />);

    await clickButton(
      screen.getByRole("button", { name: "Retenir les 2 unanimes" }),
    );

    expect(adjudicateMutate).toHaveBeenCalled();
  });

  it("désactive le remplissage quand aucun axe n'est unanime", () => {
    setup();
    render(<GoldenDatasetOverview />);

    expect(
      screen.getByRole("button", { name: "Retenir les 0 unanimes" }),
    ).toBeDisabled();
  });

  it("recharge le corpus après un remplissage, la réponse ne disant pas ce qui a été écrit", () => {
    const { succeedAdjudication, invalidateQueries } = setup();
    render(<GoldenDatasetOverview />);

    succeedAdjudication();

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: OVERVIEW_KEY });
  });

  it("affiche l'échec du remplissage des unanimes", () => {
    setup({ adjudicationError: { message: "Écriture refusée" } });
    render(<GoldenDatasetOverview />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Le remplissage a échoué. Écriture refusée",
    );
  });
});
