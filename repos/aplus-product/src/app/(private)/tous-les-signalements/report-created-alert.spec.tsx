import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportCreatedAlert } from "./report-created-alert";
import {
  mockUseSearchParams,
  mockUseRouter,
  mockUsePathname,
} from "@/test/utils/global-mocks";

// Mock Element.scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = jest.fn();

function setupSearchParams(params: Record<string, string>) {
  const urlParams = new URLSearchParams(params);
  mockUseSearchParams.mockReturnValue({
    get: jest.fn((key: string) => urlParams.get(key)),
    toString: () => urlParams.toString(),
  } as unknown as ReturnType<typeof mockUseSearchParams>);
}

describe("ReportCreatedAlert", () => {
  let mockReplace: jest.Mock;

  beforeEach(() => {
    mockReplace = jest.fn();
    mockUseRouter.mockReturnValue({
      push: jest.fn(),
      replace: mockReplace,
      prefetch: jest.fn(),
    });
    mockUsePathname.mockReturnValue("/tous-les-signalements");
  });

  it("displays success alert when success=report_created is in search params", async () => {
    setupSearchParams({ success: "report_created" });

    render(<ReportCreatedAlert />);

    await waitFor(() => {
      expect(
        screen.getByText("Le signalement a bien été créé."),
      ).toBeInTheDocument();
    });
  });

  it("cleans the success param from the URL after displaying", async () => {
    setupSearchParams({ success: "report_created" });

    render(<ReportCreatedAlert />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/tous-les-signalements");
    });
  });

  it("preserves other search params when cleaning the success param", async () => {
    setupSearchParams({ success: "report_created", page: "2" });

    render(<ReportCreatedAlert />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/tous-les-signalements?page=2");
    });
  });

  it("does not display alert when success param is absent", () => {
    setupSearchParams({});

    render(<ReportCreatedAlert />);

    expect(
      screen.queryByText("Le signalement a bien été créé."),
    ).not.toBeInTheDocument();
  });

  it("does not display alert when success param has a different value", () => {
    setupSearchParams({ success: "other_value" });

    render(<ReportCreatedAlert />);

    expect(
      screen.queryByText("Le signalement a bien été créé."),
    ).not.toBeInTheDocument();
  });

  it("hides alert when close button is clicked", async () => {
    const user = userEvent.setup();
    setupSearchParams({ success: "report_created" });

    render(<ReportCreatedAlert />);

    await waitFor(() => {
      expect(
        screen.getByText("Le signalement a bien été créé."),
      ).toBeInTheDocument();
    });

    const closeButton = screen.getByRole("button", { name: /masquer/i });
    await user.click(closeButton);

    expect(
      screen.queryByText("Le signalement a bien été créé."),
    ).not.toBeInTheDocument();
  });
});
