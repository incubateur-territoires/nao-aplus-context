import "@testing-library/jest-dom";
import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TaggingFeedback } from "./tagging-feedback";

jest.mock("@tanstack/react-query", () =>
  jest.requireActual("@tanstack/react-query"),
);

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "report-1" }),
}));

const mockGet = jest.fn();
const mockSetVerdict = jest.fn();
const mockHide = jest.fn();

jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    taggingFeedback: {
      get: {
        queryOptions: (input: { reportId: string }) => ({
          queryKey: [["taggingFeedback", "get"], { input }],
          queryFn: () => mockGet(input),
        }),
      },
      setVerdict: {
        mutationOptions: (options: object) => ({
          ...options,
          mutationFn: mockSetVerdict,
        }),
      },
      hide: {
        mutationOptions: (options: object) => ({
          ...options,
          mutationFn: mockHide,
        }),
      },
    },
  }),
}));

const TAGGING = {
  taggingId: "tagging-1",
  axes: [
    {
      axis: "procedure",
      label: "mise à jour carrière",
      isCorrect: null,
    },
    {
      axis: "blockage",
      label: "document non reçu",
      isCorrect: true,
    },
  ],
};

function renderFeedback() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return render(<TaggingFeedback />, { wrapper: Wrapper });
}

describe("TaggingFeedback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue(TAGGING);
    mockSetVerdict.mockResolvedValue(undefined);
    mockHide.mockResolvedValue(undefined);
  });

  it("renders nothing when there is no tag to evaluate", async () => {
    mockGet.mockResolvedValue(null);
    const { container } = renderFeedback();

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows one fieldset per tag with the stored verdict checked", async () => {
    renderFeedback();

    const procedure = await screen.findByRole("group", {
      name: "Démarche du citoyen : Mise à jour carrière",
    });
    const blockage = screen.getByRole("group", {
      name: "Blocage rencontré : Document non reçu",
    });

    expect(screen.getByText("Mise à jour carrière")).toBeInTheDocument();
    expect(
      within(procedure).getByRole("radio", { name: "Correct" }),
    ).not.toBeChecked();
    expect(
      within(blockage).getByRole("radio", { name: "Correct" }),
    ).toBeChecked();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("links to the automatic tags documentation in a new window", async () => {
    renderFeedback();

    const link = await screen.findByRole("link", {
      name: "En savoir + sur les tags automatiques (bêta) - nouvelle fenêtre",
    });
    expect(link).toHaveAttribute(
      "href",
      "https://docs.aplus.beta.gouv.fr/notes-de-version-au-28-septembre-2026/tags-automatiques-beta",
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("saves a vote and thanks the user once every tag is evaluated", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValueOnce(TAGGING).mockResolvedValue({
      ...TAGGING,
      axes: TAGGING.axes.map((entry) => ({
        ...entry,
        isCorrect: entry.isCorrect ?? false,
      })),
    });
    renderFeedback();

    const procedure = await screen.findByRole("group", {
      name: "Démarche du citoyen : Mise à jour carrière",
    });
    await user.click(
      within(procedure).getByRole("radio", { name: "Incorrect" }),
    );

    expect(mockSetVerdict.mock.calls[0][0]).toEqual({
      taggingId: "tagging-1",
      axis: "procedure",
      isCorrect: false,
    });
    await waitFor(() =>
      expect(
        within(procedure).getByRole("radio", { name: "Incorrect" }),
      ).toBeChecked(),
    );
    expect(
      await screen.findByText("Merci de votre évaluation."),
    ).toBeInTheDocument();
  });

  it("does not thank on load when every tag was already evaluated", async () => {
    mockGet.mockResolvedValue({
      ...TAGGING,
      axes: TAGGING.axes.map((entry) => ({
        ...entry,
        isCorrect: true,
      })),
    });
    renderFeedback();

    await screen.findByRole("group", {
      name: "Démarche du citoyen : Mise à jour carrière",
    });
    expect(
      screen.queryByText("Merci de votre évaluation."),
    ).not.toBeInTheDocument();
  });

  it("hides the block for this view with « Masquer »", async () => {
    const user = userEvent.setup();
    renderFeedback();

    await user.click(await screen.findByRole("button", { name: "Masquer" }));

    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(mockHide).not.toHaveBeenCalled();
  });

  it("hides the block for good and refetches", async () => {
    const user = userEvent.setup();
    renderFeedback();

    await screen.findByRole("group", {
      name: "Démarche du citoyen : Mise à jour carrière",
    });
    mockGet.mockResolvedValue(null);
    await user.click(
      screen.getByRole("button", { name: "Ne plus jamais afficher ce bloc" }),
    );

    expect(mockHide).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole("group")).not.toBeInTheDocument(),
    );
  });
});
