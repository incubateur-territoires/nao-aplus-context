import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation } from "@tanstack/react-query";
import { CguAcceptanceContent } from "./cgu-acceptance-content";
import { ROUTE } from "@/app/constant/route";

jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    user: {
      getCguStatus: {
        queryKey: () => ["getCguStatus"],
      },
      acceptCgu: {
        mutationOptions: (options: object) => options,
      },
    },
  }),
}));

const mockInvalidateQueries = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useMutation: jest.fn(),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const SUBMIT_LABEL = "Valider les conditions générales d'utilisation";
const ATTESTATION_ERROR =
  "Cochez cette case pour valider les conditions générales d'utilisation.";

function setup({ isError = false }: { isError?: boolean } = {}) {
  const mutate = jest.fn();
  let mutationOptions: { onSuccess?: () => Promise<void> } = {};

  (useMutation as jest.Mock).mockImplementation((options) => {
    mutationOptions = options;
    return { mutate, isPending: false, isError };
  });

  render(<CguAcceptanceContent />);

  return { mutate, triggerSuccess: () => mutationOptions.onSuccess?.() };
}

describe("CguAcceptanceContent", () => {
  it("refuse la validation sans attestation, et le dit sur la case", async () => {
    const { mutate } = setup();

    expect(screen.queryByText(ATTESTATION_ERROR)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: SUBMIT_LABEL }));

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByText(ATTESTATION_ERROR)).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toHaveFocus();
  });

  it("efface l'erreur d'attestation dès que la case est cochée", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: SUBMIT_LABEL }));
    await userEvent.click(screen.getByRole("checkbox"));

    expect(screen.queryByText(ATTESTATION_ERROR)).not.toBeInTheDocument();
  });

  it("enregistre l'acceptation une seule fois au clic", async () => {
    const { mutate } = setup();

    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: SUBMIT_LABEL }));

    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("rafraîchit le statut puis ramène sur la page demandée", async () => {
    window.history.replaceState(
      {},
      "",
      `${ROUTE.CGU_ACCEPTANCE}?returnTo=%2Fsignalement%2Fabc`,
    );
    const { triggerSuccess } = setup();

    await triggerSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["getCguStatus"],
    });
    expect(mockReplace).toHaveBeenCalledWith("/signalement/abc");
  });

  it("affiche l'échec sans démonter le formulaire", () => {
    setup({ isError: true });

    expect(
      screen.getByText("L'acceptation n'a pas pu être enregistrée"),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: SUBMIT_LABEL })).toBeEnabled();
    expect(
      screen.getByRole("link", {
        name: /conditions générales d'utilisation du 1er octobre 2026/,
      }),
    ).toBeInTheDocument();
  });
});
