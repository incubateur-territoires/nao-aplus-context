import { checkPredictTarget } from "./golden-dataset-predict-guard";

const STAGING_URL = "postgres://user:secret@base-de-staging:5432/staging";
const PRODUCTION_URL = "postgres://user:secret@base-de-prod:5432/prod";

describe("checkPredictTarget", () => {
  it("refuse DB_TARGET=prod", () => {
    const verdict = checkPredictTarget({ DB_TARGET: "prod" });

    expect(verdict.ok).toBe(false);
  });

  it("refuse DB_TARGET=production, quelles que soient la casse et les espaces", () => {
    expect(checkPredictTarget({ DB_TARGET: " Production " }).ok).toBe(false);
    expect(checkPredictTarget({ DB_TARGET: "PROD" }).ok).toBe(false);
  });

  it("refuse une DATABASE_URL identique à PROD_DATABASE_URL", () => {
    const verdict = checkPredictTarget({
      DATABASE_URL: PRODUCTION_URL,
      PROD_DATABASE_URL: PRODUCTION_URL,
    });

    expect(verdict.ok).toBe(false);
  });

  it("refuse aussi quand seule une espace parasite les distingue", () => {
    const verdict = checkPredictTarget({
      DATABASE_URL: `${PRODUCTION_URL}\n`,
      PROD_DATABASE_URL: PRODUCTION_URL,
    });

    expect(verdict.ok).toBe(false);
  });

  it("explique le refus sans le laisser passer silencieusement", () => {
    const verdict = checkPredictTarget({ DB_TARGET: "prod" });

    expect(verdict.ok === false && verdict.reason.length > 0).toBe(true);
  });

  it("accepte le staging", () => {
    const verdict = checkPredictTarget({
      DB_TARGET: "staging",
      DATABASE_URL: STAGING_URL,
      PROD_DATABASE_URL: PRODUCTION_URL,
    });

    expect(verdict.ok).toBe(true);
  });

  it("accepte un environnement sans PROD_DATABASE_URL", () => {
    expect(checkPredictTarget({ DATABASE_URL: STAGING_URL }).ok).toBe(true);
  });

  it("ne confond pas deux variables vides avec la production", () => {
    const verdict = checkPredictTarget({
      DATABASE_URL: "",
      PROD_DATABASE_URL: "",
    });

    expect(verdict.ok).toBe(true);
  });
});
