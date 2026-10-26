import { render, screen } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { CguAcceptanceGuard } from "./cgu-acceptance-guard";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { ROUTE } from "@/app/constant/route";
import { MOCK_IDS } from "@/test/mocks";

jest.mock("@/app/component/auth-provider/auth-provider", () => ({
  useSession: jest.fn(),
}));

jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    user: {
      getCguStatus: {
        queryOptions: () => ({ queryKey: ["getCguStatus"] }),
        queryKey: () => ["getCguStatus"],
      },
    },
  }),
}));

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

const CHILD_TEXT = "Contenu privé";

function setup({
  authenticated = true,
  answered = true,
  mustAccept = true,
  pathname = ROUTE.ALL_REPORTS,
}: {
  authenticated?: boolean;
  answered?: boolean;
  mustAccept?: boolean;
  pathname?: string;
} = {}) {
  const replace = jest.fn();

  (usePathname as jest.Mock).mockReturnValue(pathname);
  (useRouter as jest.Mock).mockReturnValue({ replace });
  (useSession as jest.Mock).mockReturnValue({
    data: authenticated ? { user: { id: MOCK_IDS.USER_1 } } : null,
    isPending: false,
  });
  (useQuery as jest.Mock).mockReturnValue({
    data: answered ? { mustAccept } : undefined,
  });

  render(
    <CguAcceptanceGuard>
      <p>{CHILD_TEXT}</p>
    </CguAcceptanceGuard>,
  );

  return { replace };
}

describe("CguAcceptanceGuard", () => {
  it("redirige vers la page d'acceptation quand les CGU en vigueur ne sont pas acceptées", () => {
    const { replace } = setup();

    expect(replace).toHaveBeenCalledWith(
      `${ROUTE.CGU_ACCEPTANCE}?returnTo=${encodeURIComponent(ROUTE.ALL_REPORTS)}`,
    );
    expect(screen.queryByText(CHILD_TEXT)).not.toBeInTheDocument();
  });

  it("laisse passer l'utilisateur qui a déjà accepté la version en vigueur", () => {
    const { replace } = setup({ mustAccept: false });

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument();
  });

  it("laisse passer un visiteur non connecté sans interroger le serveur", () => {
    const { replace } = setup({ authenticated: false, answered: false });

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument();
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it("laisse passer une session perdue dont le statut périmé reste en cache", () => {
    const { replace } = setup({ authenticated: false, pathname: ROUTE.LOGIN });

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument();
  });

  it("laisse passer tant que le statut des CGU n'est pas connu", () => {
    const { replace } = setup({ answered: false });

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument();
  });

  it.each([
    ROUTE.CGU_ACCEPTANCE,
    ROUTE.COMPLETE_PROFILE,
    ROUTE.SETUP_2FA,
    ROUTE.VERIFY_2FA,
    ROUTE.CGU,
  ])("ne redirige pas depuis %s", (pathname) => {
    const { replace } = setup({ pathname });

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument();
  });
});
