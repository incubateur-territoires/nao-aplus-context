import "@testing-library/jest-dom";
import React, { useState } from "react";
import { render, screen, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { useFocusOnVisible } from "./use-focus-on-visible";

// jsdom n'implémente pas scrollIntoView
const scrollIntoViewMock = jest.fn();
Element.prototype.scrollIntoView = scrollIntoViewMock;

beforeEach(() => {
  scrollIntoViewMock.mockClear();
});

// Composant de test : affiche un conteneur focusable quand `visible` est vrai
function TestComponent({ visible }: { visible: boolean }) {
  const ref = useFocusOnVisible<HTMLDivElement>(visible);
  return (
    <div>
      {visible && (
        <div ref={ref} tabIndex={-1} data-testid="target">
          Message
        </div>
      )}
    </div>
  );
}

describe("useFocusOnVisible", () => {
  it("déplace le focus et scrolle vers le conteneur quand il devient visible", () => {
    const { rerender } = render(<TestComponent visible={false} />);
    expect(screen.queryByTestId("target")).not.toBeInTheDocument();

    rerender(<TestComponent visible={true} />);

    const target = screen.getByTestId("target");
    expect(target).toHaveFocus();
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
  });

  it("ne fait rien tant que la condition reste fausse", () => {
    render(<TestComponent visible={false} />);
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it("ne scrolle pas quand l'option scroll est désactivée", () => {
    function NoScrollComponent() {
      const [visible, setVisible] = useState(false);
      const ref = useFocusOnVisible<HTMLDivElement>(visible, { scroll: false });
      return (
        <div>
          <button onClick={() => setVisible(true)}>show</button>
          {visible && (
            <div ref={ref} tabIndex={-1} data-testid="target">
              Message
            </div>
          )}
        </div>
      );
    }

    render(<NoScrollComponent />);
    act(() => {
      screen.getByText("show").click();
    });

    expect(screen.getByTestId("target")).toHaveFocus();
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it("retourne une ref stable", () => {
    const { result, rerender } = renderHook(
      ({ visible }) => useFocusOnVisible(visible),
      { initialProps: { visible: false } },
    );
    const firstRef = result.current;
    rerender({ visible: true });
    expect(result.current).toBe(firstRef);
  });
});
