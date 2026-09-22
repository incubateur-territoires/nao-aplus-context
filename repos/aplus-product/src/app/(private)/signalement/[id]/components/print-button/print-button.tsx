"use client";

import Button from "@codegouvfr/react-dsfr/Button";

export function PrintButton() {
  function handlePrint() {
    window.print();
  }

  return (
    <Button
      priority="tertiary"
      iconId="ri-printer-line"
      size="large"
      onClick={handlePrint}
      title="Imprimer le signalement"
      className="print:hidden w-full"
    >
      Imprimer le signalement
    </Button>
  );
}
