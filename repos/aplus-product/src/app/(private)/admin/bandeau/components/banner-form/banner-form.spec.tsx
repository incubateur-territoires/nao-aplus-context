import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BannerForm } from "./banner-form";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface Banner {
  isActive: boolean;
  severity: "info" | "warning" | "alert";
  content: string;
  displayOnPublicPages: boolean;
}

interface SelectProps {
  label: string;
  nativeSelectProps?: React.SelectHTMLAttributes<HTMLSelectElement>;
  children?: React.ReactNode;
}

interface InputProps {
  label: string;
  hintText?: string;
  textArea?: boolean;
  nativeTextAreaProps?: React.TextareaHTMLAttributes<HTMLTextAreaElement>;
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  priority?: "primary" | "secondary" | "tertiary";
}

interface NoticeProps {
  description: React.ReactNode;
}

jest.mock("@codegouvfr/react-dsfr/Select", () => ({
  __esModule: true,
  default: function MockSelect({
    label,
    nativeSelectProps,
    children,
  }: SelectProps) {
    return (
      <label>
        {label}
        <select {...nativeSelectProps}>{children}</select>
      </label>
    );
  },
}));

jest.mock("@codegouvfr/react-dsfr/Input", () => ({
  __esModule: true,
  default: function MockInput({
    label,
    hintText,
    textArea,
    nativeTextAreaProps,
  }: InputProps) {
    if (!textArea) {
      return null;
    }

    return (
      <label>
        {label}
        {hintText ? <span>{hintText}</span> : null}
        <textarea {...nativeTextAreaProps} />
      </label>
    );
  },
}));

jest.mock("@codegouvfr/react-dsfr/Button", () => ({
  __esModule: true,
  default: function MockButton({ children, ...props }: ButtonProps) {
    return <button {...props}>{children}</button>;
  },
}));

jest.mock("@codegouvfr/react-dsfr/Badge", () => ({
  __esModule: true,
  default: function MockBadge({
    children,
  }: {
    children: React.ReactNode;
    severity?: string;
  }) {
    return <span>{children}</span>;
  },
}));

jest.mock("@codegouvfr/react-dsfr/ToggleSwitch", () => ({
  __esModule: true,
  default: function MockToggleSwitch({
    label,
    checked,
    onChange,
    disabled,
  }: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
  }) {
    return (
      <label>
        {label}
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
      </label>
    );
  },
}));

jest.mock("@codegouvfr/react-dsfr/Notice", () => ({
  __esModule: true,
  default: function MockNotice({ description }: NoticeProps) {
    return <div>{description}</div>;
  },
}));

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(),
}));

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

const mockUpsertMutate = jest.fn();
const mockDeleteMutate = jest.fn();
const mockInvalidateQueries = jest.fn();

let bannerData: Banner | null = null;
let isUpsertPending = false;
let isDeletePending = false;

function hasMutationKey(
  mutationOptions: unknown,
  target: "upsert" | "delete",
): boolean {
  if (!mutationOptions || typeof mutationOptions !== "object") {
    return false;
  }

  if (!("mutationKey" in mutationOptions)) {
    return false;
  }

  const candidate = mutationOptions.mutationKey;
  if (!Array.isArray(candidate)) {
    return false;
  }

  return candidate.includes(target);
}

describe("BannerForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    bannerData = null;
    isUpsertPending = false;
    isDeletePending = false;

    (useTRPC as jest.Mock).mockReturnValue({
      banner: {
        getAdmin: {
          queryOptions: jest.fn(() => ({ queryKey: ["banner", "getAdmin"] })),
        },
        upsert: {
          mutationOptions: jest.fn(
            (
              options: Partial<{
                onSuccess: () => void;
              }>,
            ) => ({
              mutationKey: ["banner", "upsert"],
              ...options,
            }),
          ),
        },
        delete: {
          mutationOptions: jest.fn(
            (
              options: Partial<{
                onSuccess: () => void;
              }>,
            ) => ({
              mutationKey: ["banner", "delete"],
              ...options,
            }),
          ),
        },
      },
    });

    (useQuery as jest.Mock).mockImplementation(() => ({
      data: bannerData,
    }));

    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });

    (useMutation as jest.Mock).mockImplementation(
      (mutationOptions: unknown) => {
        if (hasMutationKey(mutationOptions, "upsert")) {
          return {
            mutate: mockUpsertMutate,
            isPending: isUpsertPending,
          };
        }

        return {
          mutate: mockDeleteMutate,
          isPending: isDeletePending,
        };
      },
    );
  });

  it("shows publish button when banner is not published", () => {
    render(<BannerForm />);

    expect(
      screen.getByRole("button", {
        name: "Publier le bandeau d'information",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Non publié")).toBeInTheDocument();
  });

  it("shows depublish button when banner is published", () => {
    bannerData = {
      isActive: true,
      severity: "warning",
      content: "Bandeau actif",
      displayOnPublicPages: false,
    };

    render(<BannerForm />);

    expect(
      screen.getByRole("button", {
        name: "Dépublier le bandeau d'information",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Publié")).toBeInTheDocument();
  });

  it("calls upsert on toggle click when banner is not published", async () => {
    const user = userEvent.setup();
    render(<BannerForm />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "Nouveau bandeau");

    await user.click(
      screen.getByRole("button", {
        name: "Publier le bandeau d'information",
      }),
    );

    expect(mockUpsertMutate).toHaveBeenCalledWith({
      severity: "info",
      content: "Nouveau bandeau",
      displayOnPublicPages: false,
    });
    expect(mockDeleteMutate).not.toHaveBeenCalled();
  });

  it("calls delete on toggle click when banner is published", async () => {
    const user = userEvent.setup();
    bannerData = {
      isActive: true,
      severity: "alert",
      content: "Bandeau publié",
      displayOnPublicPages: false,
    };

    render(<BannerForm />);

    await user.click(
      screen.getByRole("button", {
        name: "Dépublier le bandeau d'information",
      }),
    );

    expect(mockDeleteMutate).toHaveBeenCalledWith();
    expect(mockUpsertMutate).not.toHaveBeenCalled();
  });

  it("disables toggle button when not published and content is empty", () => {
    render(<BannerForm />);

    expect(
      screen.getByRole("button", {
        name: "Publier le bandeau d'information",
      }),
    ).toBeDisabled();
  });
});
