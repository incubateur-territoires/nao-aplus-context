"use client";

import Button from "@codegouvfr/react-dsfr/Button";
import { useState } from "react";

export function CopyUrlButton() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    } catch (err) {
      console.error("Failed to copy URL: ", err);
    }
  }

  return (
    <Button
      priority={copied ? "secondary" : "tertiary"}
      iconId={copied ? "ri-check-line" : "ri-file-copy-line"}
      size="small"
      onClick={handleCopy}
      title={copied ? "Lien copié !" : "Copier le lien du signalement"}
    >
      {copied ? "Lien copié !" : "Copier le lien du signalement"}
    </Button>
  );
}
