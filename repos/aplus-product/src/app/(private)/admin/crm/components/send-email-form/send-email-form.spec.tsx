import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SendEmailForm } from "./send-email-form";

interface SendEmailInput {
  contactId: string;
  subject: string;
  content: string;
}

interface MutationCallbacks {
  onSuccess?: () => Promise<void> | void;
  onError?: (error: { message: string }) => void;
}

let mockCallbacks: MutationCallbacks = {};
let mockNextError: { message: string } | null = null;
const mockMutate = jest.fn();
const mockInvalidateQueries = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useMutation: jest.fn((options: MutationCallbacks) => {
    mockCallbacks = options;
    return {
      mutate: (input: SendEmailInput) => {
        mockMutate(input);
        if (mockNextError) {
          mockCallbacks.onError?.(mockNextError);
        } else {
          mockCallbacks.onSuccess?.();
        }
      },
      isPending: false,
    };
  }),
  useQueryClient: jest.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
}));

const mockGetContactByIdQueryKey = jest.fn(() => ["getContactById"]);

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(() => ({
    crm: {
      getContactById: { queryKey: mockGetContactByIdQueryKey },
      sendEmail: {
        mutationOptions: jest.fn((options: MutationCallbacks) => options),
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

async function fillAndSubmit(subject: string, content: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Objet"), subject);
  await user.type(screen.getByLabelText("Message"), content);
  await user.click(screen.getByRole("button", { name: "Envoyer le message" }));
}

describe("SendEmailForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNextError = null;
  });

  it("affiche les champs objet et message", () => {
    render(<SendEmailForm contactId="contact-1" />, {
      wrapper: createWrapper(),
    });

    expect(
      screen.getByRole("heading", { name: "Envoyer un message" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Objet")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toBeInTheDocument();
  });

  it("refuse un formulaire vide", async () => {
    const user = userEvent.setup();
    render(<SendEmailForm contactId="contact-1" />, {
      wrapper: createWrapper(),
    });

    await user.click(
      screen.getByRole("button", { name: "Envoyer le message" }),
    );

    expect(
      await screen.findByText("L'objet est obligatoire"),
    ).toBeInTheDocument();
    expect(screen.getByText("Le message est obligatoire")).toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("envoie le message puis vide le formulaire et confirme", async () => {
    render(<SendEmailForm contactId="contact-1" />, {
      wrapper: createWrapper(),
    });

    await fillAndSubmit("Demande de rendez-vous", "Bonjour, êtes-vous libre ?");

    expect(mockMutate).toHaveBeenCalledWith({
      contactId: "contact-1",
      subject: "Demande de rendez-vous",
      content: "Bonjour, êtes-vous libre ?",
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["getContactById"],
    });
    expect(
      await screen.findByText("Le message a bien été envoyé."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Objet")).toHaveValue("");
    expect(screen.getByLabelText("Message")).toHaveValue("");
  });

  it("remonte le message d'erreur du routeur", async () => {
    mockNextError = {
      message: "Vous avez envoyé trop de messages. Veuillez réessayer.",
    };

    render(<SendEmailForm contactId="contact-1" />, {
      wrapper: createWrapper(),
    });

    await fillAndSubmit("Relance", "Deuxième relance.");

    expect(
      await screen.findByText("Le message n'a pas été envoyé."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Vous avez envoyé trop de messages. Veuillez réessayer.",
      ),
    ).toBeInTheDocument();
  });
});
