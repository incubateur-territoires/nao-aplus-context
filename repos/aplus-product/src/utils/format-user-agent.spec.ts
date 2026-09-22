import { formatUserAgent } from "./format-user-agent";

describe("formatUserAgent", () => {
  it("returns null for empty or missing agents", () => {
    expect(formatUserAgent(null)).toBeNull();
    expect(formatUserAgent(undefined)).toBeNull();
    expect(formatUserAgent("")).toBeNull();
  });

  it("detects Chrome on macOS", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(formatUserAgent(ua)).toBe("Chrome sur macOS");
  });

  it("detects Firefox on Windows", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";
    expect(formatUserAgent(ua)).toBe("Firefox sur Windows");
  });

  it("detects Safari on iOS", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(formatUserAgent(ua)).toBe("Safari sur iOS");
  });

  it("detects Edge before Chrome", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
    expect(formatUserAgent(ua)).toBe("Edge sur Windows");
  });

  it("detects Chrome on Android", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    expect(formatUserAgent(ua)).toBe("Chrome sur Android");
  });

  it("returns the browser alone when the OS is unknown", () => {
    expect(formatUserAgent("Chrome/120.0.0.0")).toBe("Chrome");
  });

  it("returns null for unrecognized agents", () => {
    expect(formatUserAgent("some-random-bot/1.0")).toBeNull();
  });
});
