import { createLogger } from "@/utils/logger";

describe("createLogger", () => {
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    stdoutSpy = jest
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    stderrSpy = jest
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("écrit les infos sur stdout avec le scope en préfixe", () => {
    createLogger("Report Deletion CRON").info("Processing complete");

    expect(stdoutSpy).toHaveBeenCalledWith(
      "[Report Deletion CRON] Processing complete\n",
    );
  });

  it("écrit les erreurs sur stderr", () => {
    createLogger("Report Deletion CRON").error("Boom");

    expect(stderrSpy).toHaveBeenCalledWith("[Report Deletion CRON] Boom\n");
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it("sérialise les métadonnées en JSON", () => {
    createLogger("CRON").info("Done", { reportsDeleted: 3, errors: 0 });

    expect(stdoutSpy).toHaveBeenCalledWith(
      '[CRON] Done {"reportsDeleted":3,"errors":0}\n',
    );
  });

  it("sérialise les Error avec leur message plutôt qu'un objet vide", () => {
    createLogger("CRON").error("Échec", { error: new Error("timeout S3") });

    const line = stderrSpy.mock.calls[0][0] as string;
    expect(line).toContain('"message":"timeout S3"');
  });

  it("ne casse pas sur des métadonnées circulaires", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => createLogger("CRON").info("Boucle", circular)).not.toThrow();
    expect(stdoutSpy).toHaveBeenCalledWith(
      "[CRON] Boucle [meta non sérialisable]\n",
    );
  });
});
