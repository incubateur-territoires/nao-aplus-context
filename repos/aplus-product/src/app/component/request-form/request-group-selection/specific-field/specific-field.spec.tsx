import { render, screen } from "@testing-library/react";
import { SpecificField } from "./specific-field";
import { ControllerRenderProps } from "react-hook-form";
import { ReportFormValues } from "../../request-form";
import { createMockTeamWithIncludes } from "@/test/mocks";

const mockRequestedGroup = createMockTeamWithIncludes({
  id: "team-1",
  name: "Test Team",
  organization: {
    id: "org-1",
    name: "Test Organization",
    additionalInformation: "Additional info text",
    shortName: "TEST",
  },
  organizationId: "org-1",
});

const mockField: ControllerRenderProps<ReportFormValues, "requestedTeams"> = {
  value: [],
  onChange: jest.fn(),
  onBlur: jest.fn(),
  name: "requestedTeams",
  ref: jest.fn(),
};

describe("SpecificField", () => {
  it("renders team name and organization shortName", () => {
    render(
      <SpecificField requestedGroup={mockRequestedGroup} field={mockField} />,
    );

    expect(screen.getByText("Test Team")).toBeInTheDocument();
    expect(screen.getByText(/TEST/)).toBeInTheDocument();
  });

  it("does not show additional info when not checked", () => {
    render(
      <SpecificField requestedGroup={mockRequestedGroup} field={mockField} />,
    );

    expect(screen.queryByText("Additional info text")).not.toBeInTheDocument();
  });

  it("shows additional info when checked", () => {
    const checkedField = {
      ...mockField,
      value: [{ label: "Test Team", value: "team-1", specificFields: [] }],
    };

    render(
      <SpecificField
        requestedGroup={mockRequestedGroup}
        field={checkedField}
      />,
    );

    expect(screen.getByText("Additional info text")).toBeInTheDocument();
  });
});
