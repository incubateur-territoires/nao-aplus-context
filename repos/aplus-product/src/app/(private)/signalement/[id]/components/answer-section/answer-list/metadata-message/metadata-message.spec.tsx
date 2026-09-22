import { render, screen } from "@testing-library/react";
import { MetadataMessage } from "./metadata-message";

describe("MetadataMessage", () => {
  it("renders metadata message with HTML content", () => {
    const content =
      "<strong>ANTS Préfecture 62</strong> a rejoint la conversation";
    const createdAt = new Date("2025-06-05T14:11:00Z");

    render(
      <MetadataMessage
        content={content}
        createdAt={createdAt}
        shouldShowOnlyHours={false}
        userTimezone="Europe/Paris"
      />,
    );

    expect(screen.getByText("ANTS Préfecture 62")).toBeInTheDocument();
    expect(screen.getByText("a rejoint la conversation")).toBeInTheDocument();
    expect(screen.getByText(/05 juin 2025, \d{2}h\d{2}/)).toBeInTheDocument();
  });

  it("renders with only hours when shouldShowOnlyHours is true", () => {
    const content = "Test metadata message";
    const createdAt = new Date("2025-06-05T14:11:00Z");

    render(
      <MetadataMessage
        content={content}
        createdAt={createdAt}
        shouldShowOnlyHours={true}
        userTimezone="Europe/Paris"
      />,
    );

    expect(screen.getByText(/05 juin 2025, \d{2}h\d{2}/)).toBeInTheDocument();
  });
});
