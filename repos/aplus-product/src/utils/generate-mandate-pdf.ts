import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { formatToLongDate, onlyHours } from "@/utils/format";

interface MandateData {
  citizenName: string;
  birthDate: string;
  teamName: string;
}

const PAGE_MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89; // A4
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const LINE_HEIGHT = 14;
const PARAGRAPH_SPACING = 8;
const FONT_SIZE = 10;
const TITLE_FONT_SIZE = 16;
const HEADER_FONT_SIZE = 8;
const BULLET = "\u2022";
const FOOTER_MARGIN = 50;

interface PageContext {
  pdfDoc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  boldFont: PDFFont;
}

function addNewPage(ctx: PageContext): void {
  ctx.page = ctx.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.y = PAGE_HEIGHT - PAGE_MARGIN;
}

function ensureSpace(ctx: PageContext, needed: number): void {
  if (ctx.y - needed < FOOTER_MARGIN) {
    addNewPage(ctx);
  }
}

function splitSegments(
  text: string,
  boldSegments: string[],
): { text: string; bold: boolean }[] {
  const segments: { text: string; bold: boolean }[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    let earliestIndex = remaining.length;
    let earliestSegment = "";

    for (const bold of boldSegments) {
      const idx = remaining.indexOf(bold);
      if (idx !== -1 && idx < earliestIndex) {
        earliestIndex = idx;
        earliestSegment = bold;
      }
    }

    if (earliestIndex > 0) {
      segments.push({ text: remaining.slice(0, earliestIndex), bold: false });
    }
    if (earliestSegment) {
      segments.push({ text: earliestSegment, bold: true });
      remaining = remaining.slice(earliestIndex + earliestSegment.length);
    } else {
      break;
    }
  }

  return segments;
}

function drawWrappedText(
  ctx: PageContext,
  text: string,
  boldSegments: string[] = [],
): void {
  if (boldSegments.length === 0) {
    // Simple case: no bold, use basic word wrap
    const words = text.split(" ");
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = ctx.font.widthOfTextAtSize(testLine, FONT_SIZE);
      if (width > CONTENT_WIDTH && currentLine) {
        ensureSpace(ctx, LINE_HEIGHT);
        ctx.page.drawText(currentLine, {
          x: PAGE_MARGIN,
          y: ctx.y,
          size: FONT_SIZE,
          font: ctx.font,
        });
        ctx.y -= LINE_HEIGHT;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      ensureSpace(ctx, LINE_HEIGHT);
      ctx.page.drawText(currentLine, {
        x: PAGE_MARGIN,
        y: ctx.y,
        size: FONT_SIZE,
        font: ctx.font,
      });
      ctx.y -= LINE_HEIGHT;
    }
    return;
  }

  // Bold segments: render word by word tracking font changes
  const segments = splitSegments(text, boldSegments);
  let currentX = PAGE_MARGIN;

  for (const segment of segments) {
    const words = segment.text.split(" ");
    const segFont = segment.bold ? ctx.boldFont : ctx.font;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (!word && i > 0) continue;

      const needsSpace = currentX > PAGE_MARGIN;
      const displayWord = needsSpace ? ` ${word}` : word;
      const wordWidth = segFont.widthOfTextAtSize(displayWord, FONT_SIZE);

      if (
        currentX + wordWidth > PAGE_MARGIN + CONTENT_WIDTH &&
        currentX > PAGE_MARGIN
      ) {
        ctx.y -= LINE_HEIGHT;
        ensureSpace(ctx, LINE_HEIGHT);
        currentX = PAGE_MARGIN;
        ctx.page.drawText(word, {
          x: currentX,
          y: ctx.y,
          size: FONT_SIZE,
          font: segFont,
        });
        currentX += segFont.widthOfTextAtSize(word, FONT_SIZE);
      } else {
        ctx.page.drawText(displayWord, {
          x: currentX,
          y: ctx.y,
          size: FONT_SIZE,
          font: segFont,
        });
        currentX += wordWidth;
      }
    }
  }

  ctx.y -= LINE_HEIGHT;
}

function drawBulletItem(
  ctx: PageContext,
  text: string,
  boldSegments: string[] = [],
): void {
  const bulletIndent = 15;
  ensureSpace(ctx, LINE_HEIGHT);
  ctx.page.drawText(BULLET, {
    x: PAGE_MARGIN,
    y: ctx.y,
    size: FONT_SIZE,
    font: ctx.font,
  });

  // Temporarily adjust margins for indented text
  const savedDrawWrapped = () => {
    if (boldSegments.length === 0) {
      const words = text.split(" ");
      let currentLine = "";
      const indentedWidth = CONTENT_WIDTH - bulletIndent;
      const indentX = PAGE_MARGIN + bulletIndent;

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = ctx.font.widthOfTextAtSize(testLine, FONT_SIZE);
        if (width > indentedWidth && currentLine) {
          ensureSpace(ctx, LINE_HEIGHT);
          ctx.page.drawText(currentLine, {
            x: indentX,
            y: ctx.y,
            size: FONT_SIZE,
            font: ctx.font,
          });
          ctx.y -= LINE_HEIGHT;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        ensureSpace(ctx, LINE_HEIGHT);
        ctx.page.drawText(currentLine, {
          x: indentX,
          y: ctx.y,
          size: FONT_SIZE,
          font: ctx.font,
        });
        ctx.y -= LINE_HEIGHT;
      }
    } else {
      const segments = splitSegments(text, boldSegments);
      const indentedWidth = CONTENT_WIDTH - bulletIndent;
      const indentX = PAGE_MARGIN + bulletIndent;
      let currentX = indentX;

      for (const segment of segments) {
        const words = segment.text.split(" ");
        const segFont = segment.bold ? ctx.boldFont : ctx.font;

        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          if (!word && i > 0) continue;

          const needsSpace = currentX > indentX;
          const displayWord = needsSpace ? ` ${word}` : word;
          const wordWidth = segFont.widthOfTextAtSize(displayWord, FONT_SIZE);

          if (
            currentX + wordWidth > indentX + indentedWidth &&
            currentX > indentX
          ) {
            ctx.y -= LINE_HEIGHT;
            ensureSpace(ctx, LINE_HEIGHT);
            currentX = indentX;
            ctx.page.drawText(word, {
              x: currentX,
              y: ctx.y,
              size: FONT_SIZE,
              font: segFont,
            });
            currentX += segFont.widthOfTextAtSize(word, FONT_SIZE);
          } else {
            ctx.page.drawText(displayWord, {
              x: currentX,
              y: ctx.y,
              size: FONT_SIZE,
              font: segFont,
            });
            currentX += wordWidth;
          }
        }
      }
      ctx.y -= LINE_HEIGHT;
    }
  };

  savedDrawWrapped();
}

export async function generateMandatePdf(
  data: MandateData,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const now = new Date();
  const ctx: PageContext = { pdfDoc, page, y: 0, font, boldFont };

  const dateStr = now.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = onlyHours(now, "Europe/Paris");

  // Header
  page.drawText(`${dateStr} ${timeStr}`, {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 30,
    size: HEADER_FONT_SIZE,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  const headerRight = `Administration+ - Mandat du ${formatToLongDate(now, "Europe/Paris")}`;
  const headerRightWidth = font.widthOfTextAtSize(
    headerRight,
    HEADER_FONT_SIZE,
  );
  page.drawText(headerRight, {
    x: PAGE_WIDTH - PAGE_MARGIN - headerRightWidth,
    y: PAGE_HEIGHT - 30,
    size: HEADER_FONT_SIZE,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Title
  const title = "Mandat Administration+";
  const titleWidth = boldFont.widthOfTextAtSize(title, TITLE_FONT_SIZE);
  page.drawText(title, {
    x: (PAGE_WIDTH - titleWidth) / 2,
    y: PAGE_HEIGHT - 70,
    size: TITLE_FONT_SIZE,
    font: boldFont,
  });

  ctx.y = PAGE_HEIGHT - 110;

  const { citizenName, birthDate, teamName } = data;

  // Paragraph 1
  drawWrappedText(
    ctx,
    `Je m'appelle : ${citizenName} (je suis le mandant), n\u00E9(e) le ${birthDate}.`,
    [citizenName, birthDate],
  );
  ctx.y -= PARAGRAPH_SPACING;

  // Paragraph 2
  drawWrappedText(
    ctx,
    `Je mandate ${teamName} (c'est le mandataire) pour d\u00E9bloquer ma situation administrative via/en utilisant la plateforme Administration+.`,
    [teamName],
  );
  ctx.y -= PARAGRAPH_SPACING;

  // Paragraph 3
  drawWrappedText(
    ctx,
    `J'autorise ${teamName} \u00E0 utiliser \u00E0 cette fin toutes les donn\u00E9es \u00E0 caract\u00E8re personnel fournies strictement n\u00E9cessaires \u00E0 la r\u00E9alisation des d\u00E9marches administratives en lien avec mon signalement, pour la dur\u00E9e de son traitement.`,
    [teamName],
  );
  ctx.y -= PARAGRAPH_SPACING;

  // Paragraph 4
  drawWrappedText(
    ctx,
    "Cette autorisation est conforme aux articles 1984 et suivants du Code civil. Les d\u00E9marches seront accomplies en ligne, en utilisant Administration+.",
  );
  ctx.y -= PARAGRAPH_SPACING;

  // Paragraph 5
  drawWrappedText(ctx, "Je peux annuler mon autorisation \u00E0 tout moment.");
  ctx.y -= PARAGRAPH_SPACING;

  // Section: Mandant rights
  drawWrappedText(ctx, `Pour que ${teamName} puisse agir \u00E0 ma place :`, [
    teamName,
  ]);
  ctx.y -= 4;

  drawBulletItem(
    ctx,
    `Je reconnais que l'aidant habilit\u00E9 par ${teamName} m'a rappel\u00E9 l'objet de son intervention, et m'a inform\u00E9 sur la n\u00E9cessit\u00E9 et l'utilit\u00E9 de informations collect\u00E9es ;`,
    [teamName],
  );
  ctx.y -= 4;

  drawBulletItem(
    ctx,
    `J'autorise les aidants habilit\u00E9s par ${teamName} \u00E0 utiliser mes donn\u00E9es \u00E0 caract\u00E8re personnel dans le cadre de ce mandat. Je sais que j'ai des droits sur les informations me concernant : information, acc\u00E8s, rectification, suppression, opposition.`,
    [teamName],
  );
  ctx.y -= PARAGRAPH_SPACING;

  // Section: Mandataire obligations
  drawWrappedText(ctx, `Les aidants habilit\u00E9s par ${teamName} doivent :`, [
    teamName,
  ]);
  ctx.y -= 4;

  const obligations = [
    "effectuer les d\u00E9marches \u00E0 partir des informations que je leur ai donn\u00E9es ;",
    "collecter et conserver seulement les informations n\u00E9cessaires aux d\u00E9marches bloqu\u00E9es ou \u00E0 celles \u00E0 qui s'y rattachent ;",
    "utiliser et communiquer seulement les informations n\u00E9cessaires aux d\u00E9marches bloqu\u00E9es ou \u00E0 celles qui s'y rattachent ;",
    "m'informer et demander mon autorisation avant d'effectuer d'autres d\u00E9marches ;",
    "s'interdire de rendre publiques mes informations personnelles ;",
    "prendre toutes les pr\u00E9cautions pour assurer la s\u00E9curit\u00E9 de mes informations personnelles.",
  ];

  for (const obligation of obligations) {
    drawBulletItem(ctx, obligation);
    ctx.y -= 4;
  }
  ctx.y -= PARAGRAPH_SPACING - 4;

  // Paragraph: contract
  drawWrappedText(
    ctx,
    `A partir du moment o\u00F9 un aidant habilit\u00E9 par ${teamName} r\u00E9alise \u00E0 ma place une d\u00E9marche [via Administration+], il accepte de le faire dans les conditions d\u00E9crites dans ce mandat, qui est un contrat.`,
    [teamName],
  );
  ctx.y -= PARAGRAPH_SPACING;

  // Paragraph: duration
  drawWrappedText(
    ctx,
    "Mon autorisation est donn\u00E9e et accept\u00E9e pour la dur\u00E9e de traitement du signalement.",
  );
  ctx.y -= PARAGRAPH_SPACING;

  // Paragraph: end conditions
  drawWrappedText(
    ctx,
    "Le pr\u00E9sent mandat peut notamment prendre fin \u00E0 compter de la notification du d\u00E9blocage de ma situation administrative, ou si je change d'avis, si le mandataire change d'avis ou si je donne mon autorisation \u00E0 un aidant d'une autre structure. \u00C0 d\u00E9faut, il est valable pour une dur\u00E9e d'un an renouvelable.",
  );
  ctx.y -= PARAGRAPH_SPACING;

  // Paragraph: responsibility
  drawWrappedText(
    ctx,
    "L'aidant habilit\u00E9 par le pr\u00E9sent mandat doit accomplir \u00E0 ma place les d\u00E9marches n\u00E9cessaires tant que ce mandat est valable. Il peut \u00EAtre tenu responsable s'il ne respecte pas les conditions d\u00E9crites dans ce document, ne r\u00E9alise pas les d\u00E9marches ou outrepasse son mandat, conform\u00E9ment aux dispositions du code civil.",
  );
  ctx.y -= PARAGRAPH_SPACING;

  // Signature line
  drawWrappedText(ctx, "Date, lieu et signature du mandant et du mandataire");

  // Footer note on the last page
  const lastPage = ctx.page;
  const footerText =
    "* Cette suppression est automatis\u00E9e sur Administration+ conform\u00E9ment aux articles 1.4.5 et 2.3 de nos Conditions G\u00E9n\u00E9rales d'Utilisation";
  const footerWords = footerText.split(" ");
  const footerLines: string[] = [];
  let footerLine = "";
  for (const word of footerWords) {
    const test = footerLine ? `${footerLine} ${word}` : word;
    if (
      font.widthOfTextAtSize(test, HEADER_FONT_SIZE) > CONTENT_WIDTH &&
      footerLine
    ) {
      footerLines.push(footerLine);
      footerLine = word;
    } else {
      footerLine = test;
    }
  }
  if (footerLine) footerLines.push(footerLine);

  let footerY = 30 + (footerLines.length - 1) * 12;
  for (const line of footerLines) {
    lastPage.drawText(line, {
      x: PAGE_MARGIN,
      y: footerY,
      size: HEADER_FONT_SIZE,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    footerY -= 12;
  }

  return pdfDoc.save();
}
