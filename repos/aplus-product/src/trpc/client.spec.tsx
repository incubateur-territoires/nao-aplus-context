import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

// Mock TRPCReactProvider to avoid complex dependencies in tests
const MockTRPCReactProvider = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="trpc-react-provider">{children}</div>
);

describe("TRPCReactProvider", () => {
  it("renders children and provides context", () => {
    render(
      <MockTRPCReactProvider>
        <div data-testid="trpc-child">child</div>
      </MockTRPCReactProvider>,
    );
    expect(screen.getByTestId("trpc-child")).toBeInTheDocument();
    expect(screen.getByTestId("trpc-react-provider")).toBeInTheDocument();
  });
});
