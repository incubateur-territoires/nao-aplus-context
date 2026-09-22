import { render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { NotificationsSection } from "./notifications-section";
import { useTRPC } from "@/trpc/client";
import { NotificationFrequency } from "@/generated/prisma/enums";
import { ProfileFormValues } from "../profile-schema";

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(),
}));

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: jest.fn(),
  };
});

function FormWrapper({
  children,
  defaultValues,
}: {
  children: React.ReactNode;
  defaultValues?: Partial<ProfileFormValues>;
}) {
  const methods = useForm<ProfileFormValues>({
    defaultValues: {
      firstName: "John",
      lastName: "Doe",
      phone: "",
      profession: "",
      notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
      ...defaultValues,
    },
  });

  return <FormProvider {...methods}>{children}</FormProvider>;
}

function createWrapper(defaultValues?: Partial<ProfileFormValues>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <FormWrapper defaultValues={defaultValues}>{children}</FormWrapper>
      </QueryClientProvider>
    );
  };
}

interface MockQueryOptions {
  isManager?: boolean;
  isManagerLoading?: boolean;
  isSupervisor?: boolean;
  isSupervisorLoading?: boolean;
  canDisableNotifications?: boolean;
}

function mockUseQueryWith({
  isManager = false,
  isManagerLoading = false,
  isSupervisor = false,
  isSupervisorLoading = false,
  canDisableNotifications = true,
}: MockQueryOptions) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (useQuery as jest.Mock).mockImplementation((options: any) => {
    if (options?.queryKey?.[1] === "canDisableNotifications") {
      return { data: canDisableNotifications };
    }
    if (options?.queryKey?.[1] === "isSupervisor") {
      return { data: isSupervisor, isLoading: isSupervisorLoading };
    }
    return { data: isManager, isLoading: isManagerLoading };
  });
}

describe("NotificationsSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useTRPC as jest.Mock).mockReturnValue({
      user: {
        isManager: {
          queryOptions: () => ({
            queryKey: ["user", "isManager"],
            queryFn: async () => false,
          }),
        },
        isSupervisor: {
          queryOptions: () => ({
            queryKey: ["user", "isSupervisor"],
            queryFn: async () => false,
          }),
        },
        canDisableNotifications: {
          queryOptions: () => ({
            queryKey: ["user", "canDisableNotifications"],
            queryFn: async () => true,
          }),
        },
      },
    });
  });

  it("renders the notifications section title", () => {
    mockUseQueryWith({ isManager: false });

    render(<NotificationsSection />, { wrapper: createWrapper() });

    expect(screen.getByText("Notifications par e-mail")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Choisissez la fréquence de réception des notifications :",
      ),
    ).toBeInTheDocument();
  });

  it("shows all options including NONE for managers", () => {
    mockUseQueryWith({ isManager: true, canDisableNotifications: true });

    render(<NotificationsSection />, { wrapper: createWrapper() });

    expect(
      screen.getByLabelText(/recevoir un e-mail à chaque sollicitation/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/recevoir 2 récapitulatifs par jour/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/recevoir 1 récapitulatif par jour/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/ne recevoir aucune notification/i),
    ).toBeInTheDocument();
  });

  it("hides NONE option for non-managers and non-supervisors", () => {
    mockUseQueryWith({ isManager: false, isSupervisor: false });

    render(<NotificationsSection />, { wrapper: createWrapper() });

    expect(
      screen.getByLabelText(/recevoir un e-mail à chaque sollicitation/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/recevoir 2 récapitulatifs par jour/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/recevoir 1 récapitulatif par jour/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/ne recevoir aucune notification/i),
    ).not.toBeInTheDocument();
  });

  it("shows NONE option for supervisors", () => {
    mockUseQueryWith({ isSupervisor: true, isManager: false });

    render(<NotificationsSection />, { wrapper: createWrapper() });

    expect(
      screen.getByLabelText(/ne recevoir aucune notification/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/ne recevoir aucune notification/i),
    ).not.toBeDisabled();
  });

  it("hides NONE option when isManager query is loading", () => {
    mockUseQueryWith({ isManagerLoading: true });

    render(<NotificationsSection />, { wrapper: createWrapper() });

    expect(
      screen.queryByLabelText(/ne recevoir aucune notification/i),
    ).not.toBeInTheDocument();
  });

  it("selects the correct option based on form value", () => {
    mockUseQueryWith({ isManager: true, canDisableNotifications: true });

    render(<NotificationsSection />, {
      wrapper: createWrapper({
        notificationFrequency: NotificationFrequency.TWICE_DAILY,
      }),
    });

    const twiceDailyRadio = screen.getByLabelText(
      /recevoir 2 récapitulatifs par jour/i,
    );
    expect(twiceDailyRadio).toBeChecked();
  });

  it("disables NONE option when canDisableNotifications is false", () => {
    mockUseQueryWith({ isManager: true, canDisableNotifications: false });

    render(<NotificationsSection />, { wrapper: createWrapper() });

    const noneRadio = screen.getByLabelText(/ne recevoir aucune notification/i);
    expect(noneRadio).toBeDisabled();
    expect(
      screen.getByText(
        /vous êtes le seul membre actif avec des notifications activées/i,
      ),
    ).toBeInTheDocument();
  });

  it("enables NONE option when canDisableNotifications is true", () => {
    mockUseQueryWith({ isManager: true, canDisableNotifications: true });

    render(<NotificationsSection />, { wrapper: createWrapper() });

    const noneRadio = screen.getByLabelText(/ne recevoir aucune notification/i);
    expect(noneRadio).not.toBeDisabled();
    expect(
      screen.queryByText(
        /vous êtes le seul membre actif avec des notifications activées/i,
      ),
    ).not.toBeInTheDocument();
  });
});
