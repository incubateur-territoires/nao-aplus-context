import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server/unstable-core-do-not-import";
import { ContactMessageDirection } from "@/generated/prisma/enums";
import type { AppRouter } from "@/trpc/routers/_app";
import { ContactThread } from "./contact-thread";

type ContactMessage =
  inferRouterOutputs<AppRouter>["crm"]["getContactById"]["messages"][number];

const outboundMessage: ContactMessage = {
  id: "message-1",
  createdAt: new Date("2024-01-15T09:30:00Z"),
  contactId: "contact-1",
  direction: ContactMessageDirection.OUTBOUND,
  subject: "Prise de contact",
  textContent: "Bonjour, pouvons-nous échanger sur le dossier ?",
  brevoMessageId: "brevo-1",
  sentById: "user-1",
  sentBy: { id: "user-1", firstName: "Sacha", lastName: "Leroy" },
};

const inboundMessage: ContactMessage = {
  ...outboundMessage,
  id: "message-2",
  createdAt: new Date("2024-01-16T14:05:00Z"),
  direction: ContactMessageDirection.INBOUND,
  subject: "Re: Prise de contact",
  textContent: "Bien reçu, je reviens vers vous.",
  brevoMessageId: "brevo-2",
  sentById: null,
  sentBy: null,
};

let mockMessages: ContactMessage[] = [];

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn(() => ({
    data: { id: "contact-1", messages: mockMessages },
    isLoading: false,
  })),
}));

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(() => ({
    crm: {
      getContactById: {
        queryOptions: jest.fn(() => ({ queryKey: ["getContactById"] })),
      },
    },
  })),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("ContactThread", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMessages = [];
  });

  it("annonce l'absence d'échange", () => {
    render(<ContactThread contactId="contact-1" />, {
      wrapper: createWrapper(),
    });

    expect(
      screen.getByText("Aucun échange avec ce contact pour le moment."),
    ).toBeInTheDocument();
  });

  it("affiche l'objet, le contenu et la date de chaque message", () => {
    mockMessages = [outboundMessage, inboundMessage];

    render(<ContactThread contactId="contact-1" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("Prise de contact")).toBeInTheDocument();
    expect(
      screen.getByText("Bonjour, pouvons-nous échanger sur le dossier ?"),
    ).toBeInTheDocument();
    expect(screen.getByText("15 janvier 2024, 10h30")).toBeInTheDocument();
    expect(screen.getByText("Re: Prise de contact")).toBeInTheDocument();
    expect(screen.getByText("16 janvier 2024, 15h05")).toBeInTheDocument();
  });

  it("distingue par un libellé les messages envoyés et reçus", () => {
    mockMessages = [outboundMessage, inboundMessage];

    render(<ContactThread contactId="contact-1" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("Envoyé par Sacha Leroy")).toBeInTheDocument();
    expect(screen.getByText("Reçu du contact")).toBeInTheDocument();
  });

  it("attribue le message au service quand l'expéditeur a été supprimé", () => {
    mockMessages = [{ ...outboundMessage, sentById: null, sentBy: null }];

    render(<ContactThread contactId="contact-1" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("Envoyé par Administration+")).toBeInTheDocument();
  });

  it("conserve l'ordre chronologique renvoyé par le routeur", () => {
    mockMessages = [outboundMessage, inboundMessage];

    render(<ContactThread contactId="contact-1" />, {
      wrapper: createWrapper(),
    });

    const subjects = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(subjects[0]).toContain("Prise de contact");
    expect(subjects[1]).toContain("Re: Prise de contact");
  });
});
