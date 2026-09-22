import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Step3 } from "./step-3";
import { RequestFormWrapper } from "@/test/utils/request-form.wrapper";

const mockPush = jest.fn();

jest.mock("next/navigation", () => {
  const actual = jest.requireActual("next/navigation");
  return {
    ...actual,
    useRouter: () => ({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
    }),
  };
});

describe("Step3", () => {
  it("renders all fields", () => {
    render(<Step3 />, { wrapper: RequestFormWrapper });
    expect(screen.getByLabelText(/Sujet du signalement/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Description du blocage/i),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /Étape 4 : récapitulatif et validation/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: (name) => name.includes("Retour à l") && name.includes("étape 2"),
      }),
    ).toBeInTheDocument();
  });

  it("submits valid data and navigates to step 4", async () => {
    const user = userEvent.setup();
    render(<Step3 />, { wrapper: RequestFormWrapper });
    await user.type(
      screen.getByLabelText(/Sujet du signalement/i),
      "Test sujet",
    );
    await user.type(
      screen.getByLabelText(/Description du blocage/i),
      "Test description",
    );
    await user.click(
      screen.getByRole("button", {
        name: /Étape 4 : récapitulatif et validation/i,
      }),
    );
    expect(mockPush).toHaveBeenCalledWith("/signalement?step=4");
  });

  it("does not block submit if optional fields are empty", async () => {
    const user = userEvent.setup();
    render(<Step3 />, { wrapper: RequestFormWrapper });
    await user.type(screen.getByLabelText(/Sujet du signalement/i), "sujet");
    await user.type(screen.getByLabelText(/Description du blocage/i), "desc");
    await user.click(
      screen.getByRole("button", {
        name: /Étape 4 : récapitulatif et validation/i,
      }),
    );
    expect(mockPush).toHaveBeenCalledWith("/signalement?step=4");
  });

  it("navigates to step 2 when clicking the link", async () => {
    render(<Step3 />, { wrapper: RequestFormWrapper });
    const link = screen.getByRole("button", { name: /Retour à l'étape 2/i });
    expect(link).toHaveAttribute("href", "/signalement?step=2");
  });

  // it("shows error when required fields are empty", async () => {
  //   const user = userEvent.setup();
  //   render(<Step3 />, { wrapper: RequestFormWrapper });

  //   await user.click(
  //     screen.getByRole("button", {
  //       name: /Étape 4 : récapitulatif et validation/i,
  //     })
  //   );

  //   expect(screen.getByText(/Le sujet est requis/i)).toBeInTheDocument();
  //   expect(screen.getByText(/La description est requise/i)).toBeInTheDocument();
  //   expect(mockPush).not.toHaveBeenCalled();
  // });

  // it("shows error for invalid NIR format", async () => {
  //   const user = userEvent.setup();
  //   render(<Step3 />, { wrapper: RequestFormWrapper });

  //   await user.type(
  //     screen.getByLabelText(/Sujet du signalement/i),
  //     "Test sujet"
  //   );
  //   await user.type(
  //     screen.getByLabelText(/Description du blocage/i),
  //     "Test description"
  //   );
  //   await user.type(
  //     screen.getByLabelText(/Numéro de sécurité sociale NIR/i),
  //     "1234567890123"
  //   );

  //   await user.click(
  //     screen.getByRole("button", {
  //       name: /Étape 4 : récapitulatif et validation/i,
  //     })
  //   );

  //   expect(
  //     screen.getByText(/Le numéro NIR doit contenir 15 chiffres/i)
  //   ).toBeInTheDocument();
  //   expect(mockPush).not.toHaveBeenCalled();
  // });

  // it("shows error for invalid phone number format", async () => {
  //   const user = userEvent.setup();
  //   render(<Step3 />, { wrapper: RequestFormWrapper });

  //   await user.type(
  //     screen.getByLabelText(/Sujet du signalement/i),
  //     "Test sujet"
  //   );
  //   await user.type(
  //     screen.getByLabelText(/Description du blocage/i),
  //     "Test description"
  //   );
  //   await user.type(screen.getByLabelText(/Numéro de téléphone/i), "123");

  //   await user.click(
  //     screen.getByRole("button", {
  //       name: /Étape 4 : récapitulatif et validation/i,
  //     })
  //   );

  //   expect(
  //     screen.getByText(/Le numéro de téléphone doit contenir 10 chiffres/i)
  //   ).toBeInTheDocument();
  //   expect(mockPush).not.toHaveBeenCalled();
  // });
});
