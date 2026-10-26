import { render, screen } from "@testing-library/react";
import ContactPage from "./page";

jest.mock("@/trpc/hydrate-client", () => ({
  HydrateClient: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/dsfr-bootstrap", () => ({ StartDsfrOnHydration: () => null }));
jest.mock("@/app/component/contact-form/contact-form", () => ({
  ContactForm: () => null,
}));

describe("ContactPage", () => {
  it("invite à échanger avec l'équipe sans annoncer d'horaires de tchat", async () => {
    render(await ContactPage());

    expect(
      screen.getByRole("heading", { name: "Échangez avec l'équipe d'A+" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/11h à 12h/)).not.toBeInTheDocument();
  });
});
