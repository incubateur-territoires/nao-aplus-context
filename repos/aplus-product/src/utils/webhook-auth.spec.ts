import { validateWebhookToken } from "./webhook-auth";

describe("validateWebhookToken", () => {
  it("accepte un token identique au secret attendu", () => {
    expect(validateWebhookToken("s3cr3t-token", "s3cr3t-token")).toBe(true);
  });

  it("refuse un token faux de même longueur", () => {
    expect(validateWebhookToken("s3cr3t-tokeX", "s3cr3t-token")).toBe(false);
  });

  it("refuse un token de longueur différente", () => {
    expect(validateWebhookToken("s3cr3t", "s3cr3t-token")).toBe(false);
  });

  it("refuse un token plus long que le secret", () => {
    expect(validateWebhookToken("s3cr3t-token-plus", "s3cr3t-token")).toBe(
      false,
    );
  });

  it("refuse un token absent", () => {
    expect(validateWebhookToken(null, "s3cr3t-token")).toBe(false);
  });

  it("refuse quand le secret n'est pas configuré", () => {
    expect(validateWebhookToken("s3cr3t-token", undefined)).toBe(false);
  });

  it("refuse quand le secret est une chaîne vide", () => {
    expect(validateWebhookToken("", "")).toBe(false);
  });
});
