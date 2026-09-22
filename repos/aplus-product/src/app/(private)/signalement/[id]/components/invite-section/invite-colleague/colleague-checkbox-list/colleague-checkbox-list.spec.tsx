import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { ColleagueCheckboxList } from "./colleague-checkbox-list";
import { User } from "@/generated/prisma/client";
import { InviteColleagueFormValues } from "../invite-colleague.schema";
import { USER_ROLES } from "@/test/mocks";

const mockColleagues: User[] = [
  {
    id: "1",
    phone: "0123456789",
    profession: "Developer",
    name: "Jean Dupont",
    firstName: "Jean",
    lastName: "Dupont",
    email: "jean.dupont@example.com",
    emailVerified: false,
    role: USER_ROLES.USER,
    isInactive: null,
    cguAcceptedAt: null,
    lastActivityAt: new Date(),
    inactivityWarningsSentAt: [],
    notificationFrequency: "EACH_SOLICITATION" as const,
    lastDigestSentAt: null,
    newsLetterAcceptedAt: null,
    internalSupportComment: null,
    deletedAt: null,
    banned: false,
    banReason: null,
    banExpires: null,
    twoFactorEnabled: false,
    notificationsViewedBefore: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    phone: "0123456789",
    profession: "Developer",
    name: "Marie Martin",
    firstName: "Marie",
    lastName: "Martin",
    email: "marie.martin@example.com",
    emailVerified: false,
    role: USER_ROLES.USER,
    isInactive: null,
    cguAcceptedAt: null,
    lastActivityAt: new Date(),
    inactivityWarningsSentAt: [],
    notificationFrequency: "EACH_SOLICITATION" as const,
    lastDigestSentAt: null,
    newsLetterAcceptedAt: null,
    internalSupportComment: null,
    deletedAt: null,
    banned: false,
    banReason: null,
    banExpires: null,
    twoFactorEnabled: false,
    notificationsViewedBefore: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

function FormWrapper({
  children,
  defaultValues,
}: {
  children: React.ReactNode;
  defaultValues?: Partial<InviteColleagueFormValues>;
}) {
  const methods = useForm<InviteColleagueFormValues>({
    defaultValues: {
      colleagueIds: [],
      message: "",
      ...defaultValues,
    },
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe("ColleagueCheckboxList", () => {
  it("renders all colleagues as checkboxes", () => {
    render(
      <FormWrapper>
        <ColleagueCheckboxList colleagues={mockColleagues} />
      </FormWrapper>,
    );

    expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
    expect(screen.getByText("Marie Martin")).toBeInTheDocument();
  });

  it("updates form value when checkbox is clicked", async () => {
    const user = userEvent.setup();
    let formValues: InviteColleagueFormValues | undefined;

    function TestComponent() {
      const form = useForm<InviteColleagueFormValues>({
        defaultValues: {
          colleagueIds: [],
          message: "",
        },
      });

      formValues = form.watch();

      return (
        <FormProvider {...form}>
          <ColleagueCheckboxList colleagues={mockColleagues} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    const checkbox = screen.getByLabelText("Jean Dupont");
    await user.click(checkbox);

    expect(formValues?.colleagueIds).toContain("1");
  });

  it("renders selected colleagues as checked", () => {
    render(
      <FormWrapper defaultValues={{ colleagueIds: ["1"] }}>
        <ColleagueCheckboxList colleagues={mockColleagues} />
      </FormWrapper>,
    );

    const checkbox = screen.getByLabelText("Jean Dupont") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });
});
