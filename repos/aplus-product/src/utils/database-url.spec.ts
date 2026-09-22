import { resolveDatabaseUrl } from "./database-url";

describe("resolveDatabaseUrl", () => {
  it("lit DATABASE_URL sans DB_TARGET", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: "postgres://a" })).toEqual({
      target: undefined,
      envVar: "DATABASE_URL",
      url: "postgres://a",
    });
  });

  it("ignore un DB_TARGET vide", () => {
    expect(
      resolveDatabaseUrl({ DB_TARGET: " ", DATABASE_URL: "postgres://a" }).url,
    ).toBe("postgres://a");
  });

  it("lit STAGING_DATABASE_URL avec DB_TARGET=staging, même sans DATABASE_URL", () => {
    expect(
      resolveDatabaseUrl({
        DB_TARGET: "staging",
        STAGING_DATABASE_URL: "postgres://staging",
      }),
    ).toEqual({
      target: "staging",
      envVar: "STAGING_DATABASE_URL",
      url: "postgres://staging",
    });
  });

  it("renvoie le nom de la variable attendue quand elle manque", () => {
    expect(resolveDatabaseUrl({ DB_TARGET: "prod" })).toEqual({
      target: "prod",
      envVar: "PROD_DATABASE_URL",
      url: undefined,
    });
  });

  it("refuse un DB_TARGET inconnu au lieu de retomber sur DATABASE_URL", () => {
    expect(() =>
      resolveDatabaseUrl({ DB_TARGET: "stagin", DATABASE_URL: "postgres://a" }),
    ).toThrow(/DB_TARGET="stagin" inconnu/);
  });
});
