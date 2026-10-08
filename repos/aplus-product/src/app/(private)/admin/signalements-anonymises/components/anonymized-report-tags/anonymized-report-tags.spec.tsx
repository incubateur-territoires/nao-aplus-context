import { render, screen } from "@testing-library/react";
import { AnonymizedReportTags } from "./anonymized-report-tags";

describe("AnonymizedReportTags", () => {
  it("colours the team tag of each axis", () => {
    render(
      <AnonymizedReportTags
        procedureLabel="demande rsa"
        blockageLabel="dette"
      />,
    );

    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual(["Démarche : demande rsa", "Blocage : dette"]);
    expect(screen.getByText("demande rsa")).toHaveClass("fr-badge--blue-ecume");
    expect(screen.getByText("dette")).toHaveClass("fr-badge--purple-glycine");
  });

  it("shows only the tagged axis", () => {
    render(
      <AnonymizedReportTags
        procedureLabel={null}
        blockageLabel="déménagement"
      />,
    );

    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual(["Blocage : déménagement"]);
  });

  it("uses the small size in the list", () => {
    render(
      <AnonymizedReportTags
        procedureLabel="demande rsa"
        blockageLabel={null}
        small
      />,
    );

    expect(screen.getByText("demande rsa")).toHaveClass("fr-badge--sm");
  });

  it("renders nothing without tags", () => {
    const { container } = render(
      <AnonymizedReportTags procedureLabel={null} blockageLabel={null} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
