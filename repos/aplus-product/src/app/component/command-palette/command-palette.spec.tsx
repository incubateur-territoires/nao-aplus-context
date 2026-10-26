import {
  fireEvent,
  render,
  screen,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "./command-palette";
import {
  mockTRPC,
  mockUseQuery,
  mockUseRouter,
} from "@/test/utils/global-mocks";

const REPORT_ID = "3f2b8c1e-9a4d-4e2f-8b7a-1c5d6e7f8a9b";

const searchResult = {
  reports: [
    {
      id: REPORT_ID,
      subject: "Blocage APL",
      status: "IN_TREATMENT",
      createdAt: new Date("2026-10-01T10:00:00Z"),
      author: { firstName: "Alice", lastName: "Martin" },
    },
  ],
  users: [
    {
      id: "user-42",
      firstName: "Alice",
      lastName: "Martin",
      email: "alice@example.org",
      role: "user",
    },
  ],
  teams: [
    {
      id: "team-7",
      name: "France Services Alpha",
      organization: { shortName: "FS" },
    },
  ],
};

const push = jest.fn();

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = jest.fn();
  Object.assign(mockTRPC, {
    quickSearch: {
      search: {
        queryOptions: (input: { query: string }, opts: object) => ({
          queryKey: ["quickSearch", input],
          ...opts,
        }),
      },
    },
  });
});

beforeEach(() => {
  window.sessionStorage.clear();
  push.mockReset();
  mockUseRouter.mockReturnValue({
    push,
    replace: jest.fn(),
    prefetch: jest.fn(),
  });
  mockUseQuery.mockImplementation((options: { enabled?: boolean }) => ({
    data: options.enabled ? searchResult : undefined,
    isFetching: false,
  }));
});

function openPalette() {
  fireEvent.keyDown(window, { key: "k", metaKey: true });
}

describe("CommandPalette", () => {
  it("stays closed until Cmd+K is pressed", () => {
    render(<CommandPalette />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    openPalette();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Étiquetage IA")).toBeInTheDocument();
  });

  it("also opens with Ctrl+K", () => {
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: "K", ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("filters admin pages and opens the chosen one with Enter", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);
    openPalette();

    await user.type(screen.getByRole("combobox"), "etiquetage");
    expect(screen.queryByText("CRM")).not.toBeInTheDocument();
    await user.keyboard("{Enter}");

    expect(push).toHaveBeenCalledWith("/admin/etiquetage");
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
  });

  it("selects the first result once it arrives so Enter opens it", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);
    openPalette();

    await user.type(screen.getByRole("combobox"), `/signalement/${REPORT_ID}`);
    await screen.findByText("Blocage APL");
    await user.keyboard("{Enter}");

    expect(push).toHaveBeenCalledWith(`/signalement/${REPORT_ID}`);
  });

  it("lists matching reports, users and teams and remembers the opened one", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);
    openPalette();

    await user.type(screen.getByRole("combobox"), "martin");

    expect(await screen.findByText("Blocage APL")).toBeInTheDocument();
    expect(screen.getByText("France Services Alpha")).toBeInTheDocument();
    await user.click(screen.getByText("alice@example.org"));

    expect(push).toHaveBeenCalledWith("/utilisateurs/modifier/user-42");
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));

    openPalette();
    expect(screen.getByText("Récents")).toBeInTheDocument();
    expect(screen.getByText("Alice Martin")).toBeInTheDocument();
    expect(screen.queryByText("Blocage APL")).not.toBeInTheDocument();
  });
});
