import { parseBrevoInboundPayload } from "./brevo-inbound";

describe("parseBrevoInboundPayload", () => {
  it("extrait l'adresse depuis From", () => {
    const messages = parseBrevoInboundPayload({
      items: [
        {
          From: { Address: "expediteur@example.com", Name: "Expéditeur" },
          Subject: "Demande de pièce",
          RawTextBody: "Bonjour",
          MessageId: "brevo-1",
        },
      ],
    });

    expect(messages).toEqual([
      {
        senderEmail: "expediteur@example.com",
        subject: "Demande de pièce",
        textContent: "Bonjour",
        brevoMessageId: "brevo-1",
      },
    ]);
  });

  it("retombe sur Sender quand c'est une chaîne", () => {
    const messages = parseBrevoInboundPayload({
      items: [
        {
          Sender: "sender@example.com",
          RawTextBody: "Bonjour",
          MessageId: "brevo-2",
        },
      ],
    });

    expect(messages?.[0]?.senderEmail).toBe("sender@example.com");
  });

  it("retombe sur Sender quand c'est un objet", () => {
    const messages = parseBrevoInboundPayload({
      items: [
        {
          Sender: { Address: "sender@example.com", Name: "Expéditeur" },
          RawTextBody: "Bonjour",
          MessageId: "brevo-3",
        },
      ],
    });

    expect(messages?.[0]?.senderEmail).toBe("sender@example.com");
  });

  it("préfère From à Sender quand les deux sont présents", () => {
    const messages = parseBrevoInboundPayload({
      items: [
        {
          From: { Address: "from@example.com" },
          Sender: "sender@example.com",
          MessageId: "brevo-4",
        },
      ],
    });

    expect(messages?.[0]?.senderEmail).toBe("from@example.com");
  });

  it("retombe sur ExtractedMarkdownMessage sans RawTextBody", () => {
    const messages = parseBrevoInboundPayload({
      items: [
        {
          From: { Address: "expediteur@example.com" },
          ExtractedMarkdownMessage: "Contenu markdown",
          MessageId: "brevo-5",
        },
      ],
    });

    expect(messages?.[0]?.textContent).toBe("Contenu markdown");
  });

  it("rend un corps vide quand aucun contenu n'est fourni", () => {
    const messages = parseBrevoInboundPayload({
      items: [
        { From: { Address: "expediteur@example.com" }, MessageId: "brevo-6" },
      ],
    });

    expect(messages?.[0]?.textContent).toBe("");
  });

  it("applique un sujet de repli quand Subject est absent", () => {
    const messages = parseBrevoInboundPayload({
      items: [
        { From: { Address: "expediteur@example.com" }, MessageId: "brevo-7" },
      ],
    });

    expect(messages?.[0]?.subject).toBe("(sans objet)");
  });

  it("normalise la casse et les espaces de l'adresse", () => {
    const messages = parseBrevoInboundPayload({
      items: [
        {
          From: { Address: "  Expediteur@Example.COM " },
          MessageId: "brevo-8",
        },
      ],
    });

    expect(messages?.[0]?.senderEmail).toBe("expediteur@example.com");
  });

  it("écarte un item sans From ni Sender", () => {
    const messages = parseBrevoInboundPayload({
      items: [{ Subject: "Sans expéditeur", MessageId: "brevo-9" }],
    });

    expect(messages).toEqual([]);
  });

  it("écarte un item sans MessageId", () => {
    const messages = parseBrevoInboundPayload({
      items: [{ From: { Address: "expediteur@example.com" } }],
    });

    expect(messages).toEqual([]);
  });

  it("conserve les items exploitables d'un lot partiellement invalide", () => {
    const messages = parseBrevoInboundPayload({
      items: [
        { Subject: "Sans expéditeur" },
        { From: { Address: "expediteur@example.com" }, MessageId: "brevo-10" },
      ],
    });

    expect(messages).toHaveLength(1);
    expect(messages?.[0]?.brevoMessageId).toBe("brevo-10");
  });

  it("ignore les champs inconnus de Brevo", () => {
    const messages = parseBrevoInboundPayload({
      items: [
        {
          From: { Address: "expediteur@example.com" },
          MessageId: "brevo-11",
          Attachments: [{ Name: "piece.pdf" }],
          SpamScore: 0.1,
        },
      ],
      SomethingElse: true,
    });

    expect(messages).toEqual([
      {
        senderEmail: "expediteur@example.com",
        subject: "(sans objet)",
        textContent: "",
        brevoMessageId: "brevo-11",
      },
    ]);
  });

  it("ignore un champ au type inattendu sans perdre l'item", () => {
    const messages = parseBrevoInboundPayload({
      items: [
        {
          From: { Address: "expediteur@example.com" },
          Subject: 42,
          MessageId: "brevo-12",
        },
      ],
    });

    expect(messages?.[0]?.subject).toBe("(sans objet)");
  });

  it("retourne un tableau vide pour un lot vide", () => {
    expect(parseBrevoInboundPayload({ items: [] })).toEqual([]);
  });

  it("retourne null quand items n'est pas un tableau", () => {
    expect(parseBrevoInboundPayload({ items: "nope" })).toBeNull();
  });

  it("retourne null quand items est absent", () => {
    expect(parseBrevoInboundPayload({})).toBeNull();
  });

  it("retourne null quand le payload n'est pas un objet", () => {
    expect(parseBrevoInboundPayload("nope")).toBeNull();
    expect(parseBrevoInboundPayload(null)).toBeNull();
  });

  it("retourne null au-delà de 100 items", () => {
    const item = { From: { Address: "a@example.com" }, MessageId: "<m>" };
    expect(
      parseBrevoInboundPayload({ items: Array(100).fill(item) }),
    ).toHaveLength(100);
    expect(
      parseBrevoInboundPayload({ items: Array(101).fill(item) }),
    ).toBeNull();
  });
});
