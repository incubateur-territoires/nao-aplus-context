"use client";

import { useId } from "react";
import Input from "@codegouvfr/react-dsfr/Input";

interface ReportsTableSearchProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export function ReportsTableSearch({
  searchQuery,
  setSearchQuery,
}: ReportsTableSearchProps) {
  // id unique : ce composant est monté plusieurs fois sur la même page
  // (signalements créés + à examiner). DSFR l'utilise pour lier label/input.
  const inputId = useId();
  return (
    <div>
      <Input
        addon={
          <span className="bg-blue-primary p-2 rounded-t-l-md text-white fr-icon-search-line -mt-px"></span>
        }
        className="w-full mt-2"
        id={inputId}
        label={
          <>
            Rechercher
            <span className="sr-only">
              {" "}
              — Les résultats se mettent à jour automatiquement lors de la
              saisie dans le champ.
            </span>
          </>
        }
        nativeLabelProps={{ className: "fr-h6 block mb-2" }}
        nativeInputProps={{
          placeholder: "Rechercher un citoyen, un sujet...",
          type: "text",
          value: searchQuery,
          onChange: (e) => setSearchQuery(e.target.value),
        }}
      />
    </div>
  );
}
