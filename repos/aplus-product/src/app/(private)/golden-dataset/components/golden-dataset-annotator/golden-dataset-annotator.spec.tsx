import { fireEvent, render, screen } from "@testing-library/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { mockUseRouter, mockUseSearchParams } from "@/test/utils/global-mocks";
import { GoldenDatasetAnnotator } from "./golden-dataset-annotator";

const pushState = jest
  .spyOn(window.history, "pushState")
  .mockImplementation(() => {});

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(),
}));

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

interface Annotation {
  blockageTag: string | null;
  procedureTag: string | null;
}

interface ProgressEntry {
  annotatorId: string;
  firstName: string;
  annotated: number;
}

interface ItemData {
  total: number;
  position: number;
  item: { subject: string; description: string; organization: string };
  annotation: Annotation | null;
  annotatedPositions: number[];
  currentAnnotatorId: string;
  progress: ProgressEntry[];
}

const ITEM: ItemData = {
  total: 100,
  position: 12,
  item: {
    organization: "CAF du Nord",
    subject: "Allocation suspendue sans motif",
    description: "Le dossier de [PRENOM] est bloqué depuis trois mois.",
  },
  annotation: null,
  annotatedPositions: [1, 2, 3],
  currentAnnotatorId: "annotator-2",
  progress: [
    { annotatorId: "annotator-1", firstName: "Alice", annotated: 42 },
    { annotatorId: "annotator-2", firstName: "Bruno", annotated: 3 },
    { annotatorId: "annotator-3", firstName: "Zoé", annotated: 3 },
  ],
};

const GET_ITEM_PATH_KEY = ["goldenDataset", "getItem"];

interface SetupOptions {
  data?: ItemData | null;
  isLoading?: boolean;
  error?: { message: string } | null;
  isPending?: boolean;
  search?: string;
  saveError?: { message: string } | null;
}

function setup({
  data = ITEM,
  isLoading = false,
  error = null,
  isPending = false,
  search = "n=12",
  saveError = null,
}: SetupOptions = {}) {
  const mutate = jest.fn();
  const push = jest.fn();
  const getItemQueryOptions = jest.fn().mockReturnValue({});
  const getItemQueryKey = jest.fn().mockReturnValue(GET_ITEM_PATH_KEY);
  const setQueryData = jest.fn();
  const prefetchQuery = jest.fn();

  mockUseSearchParams.mockReturnValue(new URLSearchParams(search));
  mockUseRouter.mockReturnValue({
    push,
    replace: jest.fn(),
    prefetch: jest.fn(),
  });
  (useTRPC as jest.Mock).mockReturnValue({
    goldenDataset: {
      getItem: {
        queryOptions: getItemQueryOptions,
        queryKey: getItemQueryKey,
      },
      saveAnnotation: { mutationOptions: jest.fn().mockReturnValue({}) },
    },
  });
  (useQueryClient as jest.Mock).mockReturnValue({
    setQueryData,
    prefetchQuery,
  });
  (useQuery as jest.Mock).mockReturnValue({ data, isLoading, error });
  (useMutation as jest.Mock).mockReturnValue({
    mutate,
    isPending,
    error: saveError,
  });

  return {
    mutate,
    push,
    getItemQueryOptions,
    getItemQueryKey,
    setQueryData,
    prefetchQuery,
  };
}

describe("GoldenDatasetAnnotator", () => {
  it("affiche la progression et le signalement caviardé", () => {
    setup();
    render(<GoldenDatasetAnnotator />);

    expect(screen.getByText("Signalement 12 / 100")).toBeInTheDocument();
    expect(screen.getByText("CAF du Nord")).toBeInTheDocument();
    expect(
      screen.getByText("Allocation suspendue sans motif"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Le dossier de [PRENOM] est bloqué depuis trois mois."),
    ).toBeInTheDocument();
  });

  it("affiche la progression de chaque annotateur", () => {
    setup();
    render(<GoldenDatasetAnnotator />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("42/100")).toBeInTheDocument();
    expect(screen.getByText("Zoé")).toBeInTheDocument();
    expect(screen.getAllByText("3/100")).toHaveLength(2);
  });

  it("met en évidence l'annotateur courant", () => {
    setup();
    render(<GoldenDatasetAnnotator />);

    expect(screen.getByText("Bruno").tagName).toBe("STRONG");
    expect(screen.getByText("Alice").tagName).toBe("SPAN");
  });

  it("titre la zone de saisie pour la séparer du signalement", () => {
    setup();
    render(<GoldenDatasetAnnotator />);

    expect(
      screen.getByRole("heading", { name: "Votre annotation" }),
    ).toBeInTheDocument();
  });

  it("lit la position dans le paramètre n de l'URL", () => {
    const { getItemQueryOptions } = setup({
      search: "n=42",
      data: { ...ITEM, position: 42 },
    });
    render(<GoldenDatasetAnnotator />);

    expect(getItemQueryOptions).toHaveBeenCalledWith({ position: 42 });
    expect(screen.getByText("Signalement 42 / 100")).toBeInTheDocument();
  });

  it.each(["n=abc", "n=0", "n=-3", ""])(
    "retombe sur la position 1 quand le paramètre vaut « %s »",
    (search) => {
      const { getItemQueryOptions } = setup({
        search,
        data: { ...ITEM, position: 1 },
      });
      render(<GoldenDatasetAnnotator />);

      expect(getItemQueryOptions).toHaveBeenCalledWith({ position: 1 });
      expect(screen.getByText("Signalement 1 / 100")).toBeInTheDocument();
    },
  );

  it("pré-remplit les champs avec l'annotation existante", () => {
    setup({
      data: {
        ...ITEM,
        annotation: {
          blockageTag: "dossier bloqué",
          procedureTag: "prime activité",
        },
      },
    });
    render(<GoldenDatasetAnnotator />);

    expect(screen.getByLabelText(/Tag blocage/)).toHaveValue("dossier bloqué");
    expect(screen.getByLabelText(/Tag démarche/)).toHaveValue("prime activité");
  });

  it("laisse les champs vides quand le signalement n'est pas annoté", () => {
    setup();
    render(<GoldenDatasetAnnotator />);

    expect(screen.getByLabelText(/Tag blocage/)).toHaveValue("");
    expect(screen.getByLabelText(/Tag démarche/)).toHaveValue("");
  });

  it("resynchronise les champs quand la position change", () => {
    setup();
    const { rerender } = render(<GoldenDatasetAnnotator />);

    fireEvent.change(screen.getByLabelText(/Tag blocage/), {
      target: { value: "brouillon" },
    });

    (useQuery as jest.Mock).mockReturnValue({
      data: {
        ...ITEM,
        position: 13,
        annotation: { blockageTag: "dossier bloqué", procedureTag: null },
      },
      isLoading: false,
      error: null,
    });
    rerender(<GoldenDatasetAnnotator />);

    expect(screen.getByLabelText(/Tag blocage/)).toHaveValue("dossier bloqué");
    expect(screen.getByLabelText(/Tag démarche/)).toHaveValue("");
  });

  it("précharge les positions voisines du signalement affiché", () => {
    const { getItemQueryOptions, prefetchQuery } = setup();
    render(<GoldenDatasetAnnotator />);

    expect(getItemQueryOptions).toHaveBeenCalledWith({ position: 11 });
    expect(getItemQueryOptions).toHaveBeenCalledWith({ position: 13 });
    expect(prefetchQuery).toHaveBeenCalledTimes(2);
  });

  it("ne précharge pas hors des bornes du corpus", () => {
    const { getItemQueryOptions, prefetchQuery } = setup({
      search: "n=1",
      data: { ...ITEM, position: 1 },
    });
    render(<GoldenDatasetAnnotator />);

    expect(getItemQueryOptions).not.toHaveBeenCalledWith({ position: 0 });
    expect(getItemQueryOptions).toHaveBeenCalledWith({ position: 2 });
    expect(prefetchQuery).toHaveBeenCalledTimes(1);
  });

  it("affiche la position des données quand l'URL pointe déjà la suivante", () => {
    setup({ search: "n=13" });
    render(<GoldenDatasetAnnotator />);

    expect(screen.getByText("Signalement 12 / 100")).toBeInTheDocument();
  });

  it("enregistre la position affichée, pas celle de l'URL, pendant un chargement", () => {
    const { mutate } = setup({ search: "n=13" });
    render(<GoldenDatasetAnnotator />);

    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));

    expect(mutate).toHaveBeenCalledWith(
      { position: 12, blockageTag: "", procedureTag: "" },
      { onSuccess: expect.any(Function) },
    );
    expect(pushState).toHaveBeenCalledWith(null, "", "/golden-dataset?n=13");
  });

  it("garde le signalement affiché pendant un chargement plutôt qu'un écran vide", () => {
    setup({ isLoading: true });
    render(<GoldenDatasetAnnotator />);

    expect(
      screen.queryByText("Chargement du signalement…"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Le dossier de [PRENOM] est bloqué depuis trois mois."),
    ).toBeInTheDocument();
  });

  it("préserve la saisie quand la même position est rechargée", () => {
    setup();
    const { rerender } = render(<GoldenDatasetAnnotator />);

    fireEvent.change(screen.getByLabelText(/Tag blocage/), {
      target: { value: "brouillon" },
    });

    (useQuery as jest.Mock).mockReturnValue({
      data: { ...ITEM },
      isLoading: false,
      error: null,
    });
    rerender(<GoldenDatasetAnnotator />);

    expect(screen.getByLabelText(/Tag blocage/)).toHaveValue("brouillon");
  });

  it("signale un tag de six mots et bloque la navigation", () => {
    const { mutate } = setup();
    render(<GoldenDatasetAnnotator />);

    fireEvent.change(screen.getByLabelText(/Tag blocage/), {
      target: { value: "un deux trois quatre cinq six" },
    });

    expect(
      screen.getByText("Le tag doit rester court : 5 mots au maximum."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));

    expect(mutate).not.toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
  });

  it("lance l'enregistrement et navigue vers la position suivante sans l'attendre", () => {
    const { mutate } = setup();
    render(<GoldenDatasetAnnotator />);

    fireEvent.change(screen.getByLabelText(/Tag blocage/), {
      target: { value: "dossier bloqué" },
    });
    fireEvent.change(screen.getByLabelText(/Tag démarche/), {
      target: { value: "rsa" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));

    expect(mutate).toHaveBeenCalledWith(
      { position: 12, blockageTag: "dossier bloqué", procedureTag: "rsa" },
      { onSuccess: expect.any(Function) },
    );
    expect(pushState).toHaveBeenCalledWith(null, "", "/golden-dataset?n=13");
  });

  it("lance l'enregistrement et navigue vers la position précédente sans l'attendre", () => {
    const { mutate } = setup();
    render(<GoldenDatasetAnnotator />);

    fireEvent.click(screen.getByRole("button", { name: "Précédent" }));

    expect(mutate).toHaveBeenCalledWith(
      { position: 12, blockageTag: "", procedureTag: "" },
      { onSuccess: expect.any(Function) },
    );
    expect(pushState).toHaveBeenCalledWith(null, "", "/golden-dataset?n=11");
  });

  it("écrit l'annotation dans le cache au retour de l'enregistrement, sans quoi un retour arrière du navigateur resservirait des champs vides", () => {
    const { mutate, getItemQueryKey, setQueryData } = setup();
    render(<GoldenDatasetAnnotator />);

    fireEvent.change(screen.getByLabelText(/Tag blocage/), {
      target: { value: "  retard   de dossier " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));

    expect(pushState).toHaveBeenCalledWith(null, "", "/golden-dataset?n=13");
    expect(setQueryData).not.toHaveBeenCalled();

    const { onSuccess } = mutate.mock.calls[0][1];
    onSuccess();

    expect(getItemQueryKey).toHaveBeenCalledWith({ position: 12 });
    expect(setQueryData).toHaveBeenCalledWith(
      GET_ITEM_PATH_KEY,
      expect.any(Function),
    );

    const updater = setQueryData.mock.calls[0][1];
    expect(updater(ITEM)).toEqual({
      ...ITEM,
      annotation: { blockageTag: "retard de dossier", procedureTag: null },
    });
    expect(updater(undefined)).toBeUndefined();
  });

  it("n'écrit pas le cache tant que l'enregistrement n'a pas abouti", () => {
    const { mutate, setQueryData } = setup();
    render(<GoldenDatasetAnnotator />);

    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));

    expect(mutate).toHaveBeenCalled();
    expect(pushState).toHaveBeenCalledWith(null, "", "/golden-dataset?n=13");
    expect(setQueryData).not.toHaveBeenCalled();
  });

  it("laisse l'échec d'enregistrement visible à l'écran", () => {
    setup({ saveError: { message: "écriture refusée" } });
    render(<GoldenDatasetAnnotator />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "L'enregistrement a échoué. écriture refusée",
    );
  });

  it("désactive « Précédent » à la première position", () => {
    setup({ search: "n=1", data: { ...ITEM, position: 1 } });
    render(<GoldenDatasetAnnotator />);

    expect(screen.getByRole("button", { name: "Précédent" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Suivant" })).toBeEnabled();
  });

  it("remplace « Suivant » par un enregistrement à la dernière position", () => {
    setup({ search: "n=100", data: { ...ITEM, position: 100 } });
    render(<GoldenDatasetAnnotator />);

    expect(
      screen.queryByRole("button", { name: "Suivant" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enregistrer mon annotation" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Précédent" })).toBeEnabled();
  });

  it("enregistre la dernière annotation, sans quoi elle serait perdue", () => {
    const { mutate, push } = setup({
      search: "n=100",
      data: { ...ITEM, position: 100 },
    });
    render(<GoldenDatasetAnnotator />);

    fireEvent.change(screen.getByLabelText(/Tag blocage/), {
      target: { value: "dossier bloqué" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer mon annotation" }),
    );

    expect(mutate).toHaveBeenCalledWith(
      { position: 100, blockageTag: "dossier bloqué", procedureTag: "" },
      { onSuccess: expect.any(Function) },
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("attend l'écriture avant d'ouvrir la restitution, qui relit le serveur", () => {
    const { mutate, push } = setup({
      search: "n=100",
      data: { ...ITEM, position: 100 },
    });
    render(<GoldenDatasetAnnotator />);

    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer mon annotation" }),
    );

    const { onSuccess } = mutate.mock.calls[0][1];
    onSuccess();

    expect(push).toHaveBeenCalledWith("/golden-dataset/resultats");
  });

  it("bloque l'enregistrement final quand un tag est invalide", () => {
    const { mutate, push } = setup({
      search: "n=100",
      data: { ...ITEM, position: 100 },
    });
    render(<GoldenDatasetAnnotator />);

    fireEvent.change(screen.getByLabelText(/Tag blocage/), {
      target: { value: "un deux trois quatre cinq six" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer mon annotation" }),
    );

    expect(mutate).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("désactive l'enregistrement final pendant l'écriture", () => {
    setup({
      search: "n=100",
      data: { ...ITEM, position: 100 },
      isPending: true,
    });
    render(<GoldenDatasetAnnotator />);

    expect(
      screen.getByRole("button", { name: "Enregistrer mon annotation" }),
    ).toBeDisabled();
  });

  it("désactive les deux boutons pendant l'enregistrement", () => {
    setup({ isPending: true });
    render(<GoldenDatasetAnnotator />);

    expect(screen.getByRole("button", { name: "Précédent" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Suivant" })).toBeDisabled();
  });

  it("affiche un état de chargement", () => {
    setup({ data: null, isLoading: true });
    render(<GoldenDatasetAnnotator />);

    expect(screen.getByText("Chargement du signalement…")).toBeInTheDocument();
  });

  it("affiche le message d'erreur de la requête", () => {
    setup({
      data: null,
      error: { message: "Le corpus n'a pas encore été constitué." },
    });
    render(<GoldenDatasetAnnotator />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Le corpus n'a pas encore été constitué.",
    );
  });

  it("renvoie vers la page de restitution depuis le dernier signalement", () => {
    setup({ search: "n=100", data: { ...ITEM, position: 100 } });
    render(<GoldenDatasetAnnotator />);

    expect(
      screen.getByRole("link", { name: "Voir la restitution des annotations" }),
    ).toHaveAttribute("href", "/golden-dataset/resultats");
  });

  it("n'affiche pas la restitution avant le dernier signalement", () => {
    setup();
    render(<GoldenDatasetAnnotator />);

    expect(
      screen.queryByRole("link", {
        name: "Voir la restitution des annotations",
      }),
    ).not.toBeInTheDocument();
  });

  it("pose le focus sur le tag blocage à l'arrivée sur un signalement", () => {
    setup();
    const { rerender } = render(<GoldenDatasetAnnotator />);

    expect(screen.getByLabelText(/Tag blocage/)).toHaveFocus();

    screen.getByLabelText(/Tag démarche/).focus();
    (useQuery as jest.Mock).mockReturnValue({
      data: { ...ITEM, position: 13 },
      isLoading: false,
      error: null,
    });
    rerender(<GoldenDatasetAnnotator />);

    expect(screen.getByLabelText(/Tag blocage/)).toHaveFocus();
  });

  it("ne reprend pas le focus quand la position ne change pas", () => {
    setup();
    const { rerender } = render(<GoldenDatasetAnnotator />);

    screen.getByLabelText(/Tag démarche/).focus();
    rerender(<GoldenDatasetAnnotator />);

    expect(screen.getByLabelText(/Tag démarche/)).toHaveFocus();
  });
});
