import { APICallError, RetryError } from "ai";
import { classifyPipelineError, PIPELINE_ERROR_KINDS } from "./pipeline-error";
import { AlbertQuotaError } from "./providers";

function apiError(statusCode?: number): APICallError {
  return new APICallError({
    message: "appel refusé",
    url: "https://example.invalid/v1/chat/completions",
    requestBodyValues: {},
    statusCode,
  });
}

describe("classifyPipelineError", () => {
  it("classe d'après la dernière erreur quand le SDK a épuisé ses tentatives", () => {
    const outage = new RetryError({
      message: "tentatives épuisées",
      reason: "maxRetriesExceeded",
      errors: [apiError(503), apiError(503)],
    });
    const refused = new RetryError({
      message: "erreur non réessayable",
      reason: "errorNotRetryable",
      errors: [apiError(503), apiError(400)],
    });
    expect(classifyPipelineError(outage)).toBe(PIPELINE_ERROR_KINDS.OUTAGE);
    expect(classifyPipelineError(refused)).toBe(PIPELINE_ERROR_KINDS.REFUSED);
  });

  it("classe un quota épuisé en panne", () => {
    expect(classifyPipelineError(new AlbertQuotaError())).toBe(
      PIPELINE_ERROR_KINDS.OUTAGE,
    );
  });

  it.each([429, 500, 502, 503])("classe un statut %s en panne", (status) => {
    expect(classifyPipelineError(apiError(status))).toBe(
      PIPELINE_ERROR_KINDS.OUTAGE,
    );
  });

  it("classe une erreur d'appel sans statut (réseau) en panne", () => {
    expect(classifyPipelineError(apiError(undefined))).toBe(
      PIPELINE_ERROR_KINDS.OUTAGE,
    );
  });

  it.each([401, 403, 404])(
    "classe un statut %s en panne : c'est la configuration qui est en cause, pas le contenu",
    (status) => {
      expect(classifyPipelineError(apiError(status))).toBe(
        PIPELINE_ERROR_KINDS.OUTAGE,
      );
    },
  );

  it.each([400, 413, 422])(
    "classe un statut %s en refus : le fournisseur a examiné ce contenu",
    (status) => {
      expect(classifyPipelineError(apiError(status))).toBe(
        PIPELINE_ERROR_KINDS.REFUSED,
      );
    },
  );

  it.each(["AbortError", "TimeoutError"])(
    "classe une interruption %s en panne",
    (name) => {
      expect(classifyPipelineError(new DOMException("délai", name))).toBe(
        PIPELINE_ERROR_KINDS.OUTAGE,
      );
    },
  );

  it("classe un échec de connexion en panne", () => {
    expect(classifyPipelineError(new TypeError("fetch failed"))).toBe(
      PIPELINE_ERROR_KINDS.OUTAGE,
    );
  });

  it("ne classe pas une erreur de code : elle doit remonter", () => {
    expect(classifyPipelineError(new TypeError("x is not a function"))).toBe(
      null,
    );
    expect(classifyPipelineError(new Error("bug"))).toBe(null);
    expect(classifyPipelineError("chaîne")).toBe(null);
  });
});
