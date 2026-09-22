import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { GroupCheckboxList } from "./group-checkbox-list";
import { InviteGroupsFormValues } from "../invite-groups.schema";
import { TeamWithIncludes } from "@/types/request-group-selection";
import { OrganizationRole, TeamType } from "@/generated/prisma/enums";
import React from "react";
import { createMockReportTeam } from "@/test/mocks";

const mockGroups: TeamWithIncludes[] = [
  {
    ...createMockReportTeam({
      id: "group-1",
      name: "Group 1",
      organizationId: "org-1",
      role: OrganizationRole.OPERATOR,
    }),
    organization: {
      id: "org-1",
      id_v1: "org-1-v1",
      name: "Organization 1",
      shortName: "ORG1",
      type: TeamType.OPERATOR,
      tags: [],
      specificFields: [],
      additionalInformation: null,
      role: OrganizationRole.OPERATOR,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
  {
    ...createMockReportTeam({
      id: "group-2",
      name: "Group 2",
      organizationId: "org-2",
      role: OrganizationRole.OPERATOR,
    }),
    organization: {
      id: "org-2",
      id_v1: "org-2-v1",
      name: "Organization 2",
      shortName: "ORG2",
      type: TeamType.OPERATOR,
      tags: [],
      specificFields: [],
      additionalInformation: "Additional info for org 2",
      role: OrganizationRole.OPERATOR,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
];

function FormWrapper({
  children,
  defaultValues,
  errors,
}: {
  children: React.ReactNode;
  defaultValues?: Partial<InviteGroupsFormValues>;
  errors?: Record<string, { message: string }>;
}) {
  const methods = useForm<InviteGroupsFormValues>({
    defaultValues: {
      areaId: "",
      teamIds: [],
      message: "",
      ...defaultValues,
    },
  });

  React.useEffect(() => {
    if (errors && Object.keys(errors).length > 0) {
      Object.entries(errors).forEach(([key, error]) => {
        methods.setError(key as keyof InviteGroupsFormValues, error);
      });
    }
  }, [errors, methods]);

  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe("GroupCheckboxList", () => {
  it("renders all groups as checkboxes", () => {
    render(
      <FormWrapper>
        <GroupCheckboxList filteredNotInvitedTeams={mockGroups} />
      </FormWrapper>,
    );

    expect(screen.getByText("Group 1")).toBeInTheDocument();
    expect(screen.getByText(/ORG1/)).toBeInTheDocument();
    expect(screen.getByText("Group 2")).toBeInTheDocument();
    expect(screen.getByText(/ORG2/)).toBeInTheDocument();
  });

  it("nomme le fieldset par les textes visibles et décrit l'erreur via aria-describedby (a11y)", () => {
    render(
      <FormWrapper>
        <GroupCheckboxList filteredNotInvitedTeams={mockGroups} />
      </FormWrapper>,
    );

    const fieldset = document.getElementById("invite-teams-fieldset");
    expect(fieldset).toBeInTheDocument();
    // Le nom du groupe = textes visibles uniquement (pas le message d'erreur).
    expect(fieldset).toHaveAttribute(
      "aria-labelledby",
      "equipe-operateur-label equipe-operateur-hint",
    );
    // Le message d'erreur est exposé comme description.
    expect(fieldset).toHaveAttribute(
      "aria-describedby",
      "invite-teams-fieldset-messages",
    );
    // Le groupe de messages cité existe dans le fieldset.
    expect(
      document.getElementById("invite-teams-fieldset-messages"),
    ).toBeInTheDocument();
  });

  it("updates form value when checkbox is clicked", async () => {
    const user = userEvent.setup();
    let formValues: InviteGroupsFormValues | undefined;

    function TestComponent() {
      const form = useForm<InviteGroupsFormValues>({
        defaultValues: {
          areaId: "",
          teamIds: [],
          message: "",
        },
      });

      formValues = form.watch();

      return (
        <FormProvider {...form}>
          <GroupCheckboxList filteredNotInvitedTeams={mockGroups} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    const checkbox = screen.getByDisplayValue("group-1");
    await user.click(checkbox);

    expect(formValues?.teamIds).toContain("group-1");
  });

  it("renders selected groups as checked", () => {
    render(
      <FormWrapper defaultValues={{ teamIds: ["group-1"] }}>
        <GroupCheckboxList filteredNotInvitedTeams={mockGroups} />
      </FormWrapper>,
    );

    const checkbox = screen.getByDisplayValue("group-1") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("allows multiple groups to be selected", async () => {
    const user = userEvent.setup();
    let formValues: InviteGroupsFormValues | undefined;

    function TestComponent() {
      const form = useForm<InviteGroupsFormValues>({
        defaultValues: {
          areaId: "",
          teamIds: [],
          message: "",
        },
      });

      formValues = form.watch();

      return (
        <FormProvider {...form}>
          <GroupCheckboxList filteredNotInvitedTeams={mockGroups} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    const checkbox1 = screen.getByDisplayValue("group-1");
    const checkbox2 = screen.getByDisplayValue("group-2");

    await user.click(checkbox1);
    await user.click(checkbox2);

    expect(formValues?.teamIds).toContain("group-1");
    expect(formValues?.teamIds).toContain("group-2");
  });

  it("allows deselecting a group", async () => {
    const user = userEvent.setup();
    let formValues: InviteGroupsFormValues | undefined;

    function TestComponent() {
      const form = useForm<InviteGroupsFormValues>({
        defaultValues: {
          areaId: "",
          teamIds: ["group-1", "group-2"],
          message: "",
        },
      });

      formValues = form.watch();

      return (
        <FormProvider {...form}>
          <GroupCheckboxList filteredNotInvitedTeams={mockGroups} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    const checkbox1 = screen.getByDisplayValue("group-1");
    await user.click(checkbox1);

    expect(formValues?.teamIds).not.toContain("group-1");
    expect(formValues?.teamIds).toContain("group-2");
  });

  it("shows additional information when group is checked", () => {
    render(
      <FormWrapper defaultValues={{ teamIds: ["group-2"] }}>
        <GroupCheckboxList filteredNotInvitedTeams={mockGroups} />
      </FormWrapper>,
    );

    expect(screen.getByText("Additional info for org 2")).toBeInTheDocument();
  });

  it("does not show additional information when group is unchecked", () => {
    render(
      <FormWrapper defaultValues={{ teamIds: [] }}>
        <GroupCheckboxList filteredNotInvitedTeams={mockGroups} />
      </FormWrapper>,
    );

    expect(
      screen.queryByText("Additional info for org 2"),
    ).not.toBeInTheDocument();
  });

  it("handles empty groups list", () => {
    render(
      <FormWrapper>
        <GroupCheckboxList filteredNotInvitedTeams={[]} />
      </FormWrapper>,
    );

    expect(screen.queryByText("Group 1")).not.toBeInTheDocument();
  });

  it("handles undefined groups list", () => {
    render(
      <FormWrapper>
        <GroupCheckboxList filteredNotInvitedTeams={undefined} />
      </FormWrapper>,
    );

    expect(screen.queryByText("Group 1")).not.toBeInTheDocument();
  });

  describe("Error Handling", () => {
    it("displays error state when form has validation errors", async () => {
      render(
        <FormWrapper
          errors={{
            teamIds: {
              message:
                "Veuillez sélectionner au moins une équipe opérateur à inviter",
            },
          }}
        >
          <GroupCheckboxList filteredNotInvitedTeams={mockGroups} />
        </FormWrapper>,
      );

      await waitFor(() => {
        const checkboxContainer = screen.getByTestId(
          "requested-group-checkbox",
        );
        const fieldset = checkboxContainer.querySelector(".custom-checkbox");
        expect(fieldset).toHaveClass("fr-fieldset--error");
      });
    });

    it("displays error message when form has validation errors", async () => {
      const errorMessage =
        "Veuillez sélectionner au moins une équipe opérateur à inviter";

      render(
        <FormWrapper
          errors={{
            teamIds: { message: errorMessage },
          }}
        >
          <GroupCheckboxList filteredNotInvitedTeams={mockGroups} />
        </FormWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it("does not display error message when no errors exist", () => {
      render(
        <FormWrapper>
          <GroupCheckboxList filteredNotInvitedTeams={mockGroups} />
        </FormWrapper>,
      );

      expect(
        screen.queryByText(
          "Veuillez sélectionner au moins une équipe opérateur à inviter",
        ),
      ).not.toBeInTheDocument();
    });

    it("shows default state when no errors exist", () => {
      render(
        <FormWrapper>
          <GroupCheckboxList filteredNotInvitedTeams={mockGroups} />
        </FormWrapper>,
      );

      const checkboxContainer = screen.getByTestId("requested-group-checkbox");
      const fieldset = checkboxContainer.querySelector(".custom-checkbox");
      expect(fieldset).not.toHaveClass("fr-fieldset--error");
    });
  });
});
