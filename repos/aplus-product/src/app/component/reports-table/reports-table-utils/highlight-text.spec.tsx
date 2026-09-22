import { render } from "@testing-library/react";
import { highlightText } from "./highlight-text";

describe("highlightText", () => {
  it("returns original text when query is empty", () => {
    const result = highlightText("Hello World", "");
    expect(result).toBe("Hello World");
  });

  it("returns original text when query is whitespace only", () => {
    const result = highlightText("Hello World", "   ");
    expect(result).toBe("Hello World");
  });

  it("highlights single occurrence", () => {
    const { container } = render(<>{highlightText("Hello World", "World")}</>);
    const span = container.querySelector("span");
    expect(span).toBeInTheDocument();
    expect(span?.textContent).toBe("World");
    expect(span).toHaveStyle({ backgroundColor: "#BFDBFE" });
    expect(container.textContent).toBe("Hello World");
  });

  it("highlights multiple occurrences", () => {
    const { container } = render(
      <>{highlightText("Hello Hello World", "Hello")}</>,
    );
    const spanElements = container.querySelectorAll("span");
    expect(spanElements).toHaveLength(2);
    spanElements.forEach((el) => {
      expect(el.textContent).toBe("Hello");
      expect(el).toHaveStyle({ backgroundColor: "#BFDBFE" });
    });
    expect(container.textContent).toBe("Hello Hello World");
  });

  it("is case-insensitive", () => {
    const { container } = render(<>{highlightText("Hello WORLD", "world")}</>);
    const span = container.querySelector("span");
    expect(span).toBeInTheDocument();
    expect(span?.textContent).toBe("WORLD");
    expect(span).toHaveStyle({ backgroundColor: "#BFDBFE" });
  });

  it("preserves original case in highlighted text", () => {
    const { container } = render(<>{highlightText("Hello WORLD", "world")}</>);
    const span = container.querySelector("span");
    expect(span?.textContent).toBe("WORLD");
    expect(span).toHaveStyle({ backgroundColor: "#BFDBFE" });
  });

  it("handles special characters in query", () => {
    const { container } = render(
      <>{highlightText("Test (query) here", "(query)")}</>,
    );
    const span = container.querySelector("span");
    expect(span).toBeInTheDocument();
    expect(span?.textContent).toBe("(query)");
    expect(span).toHaveStyle({ backgroundColor: "#BFDBFE" });
  });

  it("handles query at start of text", () => {
    const { container } = render(<>{highlightText("Hello World", "Hello")}</>);
    const span = container.querySelector("span");
    expect(span).toBeInTheDocument();
    expect(span?.textContent).toBe("Hello");
    expect(span).toHaveStyle({ backgroundColor: "#BFDBFE" });
    expect(container.textContent).toBe("Hello World");
  });

  it("handles query at end of text", () => {
    const { container } = render(<>{highlightText("Hello World", "World")}</>);
    const span = container.querySelector("span");
    expect(span).toBeInTheDocument();
    expect(span?.textContent).toBe("World");
    expect(span).toHaveStyle({ backgroundColor: "#BFDBFE" });
    expect(container.textContent).toBe("Hello World");
  });

  it("handles overlapping matches correctly", () => {
    const { container } = render(<>{highlightText("aaa", "aa")}</>);
    const spanElements = container.querySelectorAll("span");
    // Should find "aa" at index 0, then "aa" at index 1 (overlapping)
    expect(spanElements.length).toBeGreaterThan(0);
    spanElements.forEach((el) => {
      expect(el).toHaveStyle({ backgroundColor: "#BFDBFE" });
    });
    expect(container.textContent).toBe("aaa");
  });

  it("returns original text when no match found", () => {
    const result = highlightText("Hello World", "xyz");
    expect(result).toBe("Hello World");
  });

  it("handles empty text", () => {
    const result = highlightText("", "query");
    expect(result).toBe("");
  });

  it("highlights multiple words separately in multi-word query", () => {
    const { container } = render(<>{highlightText("John Doe", "john doe")}</>);
    const spanElements = container.querySelectorAll("span");
    expect(spanElements).toHaveLength(2);
    expect(spanElements[0].textContent).toBe("John");
    expect(spanElements[1].textContent).toBe("Doe");
    spanElements.forEach((el) => {
      expect(el).toHaveStyle({ backgroundColor: "#BFDBFE" });
    });
  });

  it("highlights words from multi-word query that appear in text", () => {
    const { container } = render(
      <>{highlightText("Manon Quiestengalère", "manon quiestengalère")}</>,
    );
    const spanElements = container.querySelectorAll("span");
    expect(spanElements.length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).toBe("Manon Quiestengalère");
  });

  it("handles multi-word query with extra spaces", () => {
    const { container } = render(
      <>{highlightText("John Doe", "john   doe")}</>,
    );
    const spanElements = container.querySelectorAll("span");
    expect(spanElements).toHaveLength(2);
  });
});
