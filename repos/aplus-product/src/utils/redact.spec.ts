import { redactEmails } from "./redact";

describe("redactEmails", () => {
  it("replaces an address quoted in a transport error", () => {
    expect(redactEmails("Invalid recipient: jean.dupont+a@exemple.test")).toBe(
      "Invalid recipient: [adresse]",
    );
  });

  it("replaces every address in the message", () => {
    expect(redactEmails("a@exemple.test et b@autre.example rejetés")).toBe(
      "[adresse] et [adresse] rejetés",
    );
  });

  it("leaves a message without an address untouched", () => {
    expect(redactEmails("Template is not active")).toBe(
      "Template is not active",
    );
  });
});
