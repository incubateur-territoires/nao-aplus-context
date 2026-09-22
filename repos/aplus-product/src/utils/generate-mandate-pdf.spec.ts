import { PDFDocument } from "pdf-lib";
import { generateMandatePdf } from "./generate-mandate-pdf";

describe("generateMandatePdf", () => {
  it("generates a valid PDF", async () => {
    const pdfBytes = await generateMandatePdf({
      citizenName: "Jean Dupont",
      birthDate: "01/01/1990",
      teamName: "Équipe CCAS Marseille",
    });

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(0);

    // Verify it can be loaded as a valid PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    expect(pdfDoc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("generates a PDF with at least one page", async () => {
    const pdfBytes = await generateMandatePdf({
      citizenName: "Marie Martin",
      birthDate: "15/06/1985",
      teamName: "Équipe Test",
    });

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const page = pdfDoc.getPage(0);

    // A4 format
    const { width, height } = page.getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });

  it("handles empty team name without error", async () => {
    const pdfBytes = await generateMandatePdf({
      citizenName: "Jean Dupont",
      birthDate: "01/01/1990",
      teamName: "",
    });

    const pdfDoc = await PDFDocument.load(pdfBytes);
    expect(pdfDoc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("handles long team names without error", async () => {
    const pdfBytes = await generateMandatePdf({
      citizenName: "Jean Dupont",
      birthDate: "01/01/1990",
      teamName:
        "CCAS Marseille, CAF Bouches-du-Rhône, CPAM Bouches-du-Rhône, Préfecture des Bouches-du-Rhône",
    });

    const pdfDoc = await PDFDocument.load(pdfBytes);
    expect(pdfDoc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("handles long citizen names and special characters", async () => {
    const pdfBytes = await generateMandatePdf({
      citizenName: "Jean-François Müller-Éduardoñ",
      birthDate: "01/01/1990",
      teamName: "Équipe Test",
    });

    const pdfDoc = await PDFDocument.load(pdfBytes);
    expect(pdfDoc.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
