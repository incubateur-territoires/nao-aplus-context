"use client";

import { useState } from "react";
import Button from "@codegouvfr/react-dsfr/Button";
import Input from "@codegouvfr/react-dsfr/Input";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface EditMemberEmailFormProps {
  currentEmail: string;
  onValidate: (newEmail: string) => void;
  onCancel: () => void;
}

export function EditMemberEmailForm({
  currentEmail,
  onValidate,
  onCancel,
}: EditMemberEmailFormProps) {
  const [email, setEmail] = useState(currentEmail);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();

    if (!trimmed) {
      setError("Veuillez saisir une adresse e-mail");
      return;
    }

    if (!isValidEmail(trimmed)) {
      setError(
        `"${trimmed}" n'est pas une adresse e-mail au format attendu, exemple : nom@domaine.fr`,
      );
      return;
    }

    setError(null);
    onValidate(trimmed);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
    if (error) setError(null);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-4 items-start -mt-2 -mb-1"
      noValidate
    >
      <Input
        label="Adresse e-mail du membre à ajouter"
        state={error ? "error" : "default"}
        stateRelatedMessage={error ?? undefined}
        nativeInputProps={{
          type: "email",
          value: email,
          onChange: handleChange,
        }}
        className=" mb-0"
      />
      <div className="flex gap-4 pt-8">
        <Button type="submit" iconId="ri-check-line" iconPosition="left">
          Valider la modification
        </Button>
        <Button type="button" priority="secondary" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
