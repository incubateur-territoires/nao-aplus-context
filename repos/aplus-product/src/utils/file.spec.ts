import { findUnreadableFiles } from "./file";

describe("findUnreadableFiles", () => {
  it("returns an empty array when all files are readable", async () => {
    const files = [
      new File(["hello"], "a.pdf", { type: "application/pdf" }),
      new File(["world"], "b.png", { type: "image/png" }),
    ];

    await expect(findUnreadableFiles(files)).resolves.toEqual([]);
  });

  it("returns an empty array when there is no file", async () => {
    await expect(findUnreadableFiles([])).resolves.toEqual([]);
  });

  it("returns the files whose content can no longer be read", async () => {
    const readableFile = new File(["ok"], "readable.pdf", {
      type: "application/pdf",
    });
    const deletedFile = new File(["gone"], "deleted.pdf", {
      type: "application/pdf",
    });

    const originalReadAsArrayBuffer = FileReader.prototype.readAsArrayBuffer;
    jest
      .spyOn(FileReader.prototype, "readAsArrayBuffer")
      .mockImplementation(function (this: FileReader, blob: Blob) {
        if (blob === deletedFile) {
          Object.defineProperty(this, "error", {
            value: new DOMException("not found", "NotFoundError"),
            configurable: true,
          });
          this.onerror?.(
            new ProgressEvent("error") as ProgressEvent<FileReader>,
          );
          return;
        }
        originalReadAsArrayBuffer.call(this, blob);
      });

    try {
      await expect(
        findUnreadableFiles([readableFile, deletedFile]),
      ).resolves.toEqual([deletedFile]);
    } finally {
      jest.restoreAllMocks();
    }
  });
});
