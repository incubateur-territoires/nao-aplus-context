"use client";

import { useState, useRef } from "react";
import Button from "@codegouvfr/react-dsfr/Button";
import Tag from "@codegouvfr/react-dsfr/Tag";
import { AddedMemberRow } from "../added-member-row/added-member-row";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface PendingMember {
  email: string;
  isManager: boolean;
}

export function AddMemberForm({
  isOperatorGroup = false,
  teamId,
  hasMembers = true,
  onAddSuccess,
}: {
  teamId: string;
  isOperatorGroup?: boolean;
  hasMembers?: boolean;
  onAddSuccess?: (emails: string[]) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [emailTags, setEmailTags] = useState<string[]>([]);
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: addUserToTeam, isPending: isAddingUsers } = useMutation(
    trpc.team.addUserToTeam.mutationOptions({
      onSuccess: async (_data, variables) => {
        await queryClient.refetchQueries(
          trpc.team.getTeamById.queryOptions(teamId),
        );
        const addedEmails = variables.users.map((u) => u.email);
        setEmailTags([]);
        setPendingMembers([]);
        setServerError(null);
        onAddSuccess?.(addedEmails);
      },
      onError: (error) => {
        setServerError(error.message || "Une erreur est survenue");
        console.error("Error adding users to team:", error);
      },
    }),
  );

  function addEmail(email: string) {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    if (!isValidEmail(trimmed)) {
      setError(
        `"${trimmed}" n'est pas une adresse e-mail au format attendu, exemple : nom@domaine.fr`,
      );
      return;
    }

    if (emailTags.includes(trimmed)) {
      setError(`"${trimmed}" est déjà dans la liste`);
      return;
    }

    const isFirstMember = !hasMembers && pendingMembers.length === 0;
    setEmailTags((prev) => [...prev, trimmed]);
    setPendingMembers((prev) => [
      ...prev.filter((m) => m.email !== trimmed),
      { email: trimmed, isManager: isFirstMember },
    ]);
    setInputValue("");
    setError(null);
    setServerError(null);
  }

  function removeEmail(email: string) {
    setEmailTags((prev) => prev.filter((e) => e !== email));
    setPendingMembers((prev) => prev.filter((m) => m.email !== email));
    // RGAA : replacer le focus sur le champ après suppression d'un tag e-mail
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      addEmail(inputValue);
    }

    if (e.key === "Backspace" && inputValue === "" && emailTags.length > 0) {
      removeEmail(emailTags[emailTags.length - 1]);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    const emails = pastedText.split(/[,;\s]+/).filter(Boolean);
    emails.forEach(addEmail);
  }

  function handleRemovePendingMember(email: string) {
    setPendingMembers((prev) => prev.filter((m) => m.email !== email));
    setEmailTags((prev) => prev.filter((e) => e !== email));
  }

  function handleEmailChange(oldEmail: string, newEmail: string) {
    const trimmed = newEmail.trim().toLowerCase();
    if (!isValidEmail(trimmed)) {
      return;
    }
    setPendingMembers((prev) =>
      prev.map((m) => (m.email === oldEmail ? { ...m, email: trimmed } : m)),
    );
    setEmailTags((prev) => prev.map((e) => (e === oldEmail ? trimmed : e)));
  }

  function handleManagerToggle(email: string, isManager: boolean) {
    setPendingMembers((prev) =>
      prev.map((m) => (m.email === email ? { ...m, isManager } : m)),
    );
  }

  async function handleConfirmAddMembers() {
    setServerError(null);
    await addUserToTeam({ teamId, users: pendingMembers });
  }

  return (
    <div className="flex flex-col gap-6">
      <h5 className="text-[22px] leading-[28px] font-bold text-[#161616] m-0">
        Ajouter un ou plusieurs membres
      </h5>

      <div className="border border-[#ddd] p-6 flex flex-col ">
        <div className="fr-input-group">
          <label
            className="fr-label"
            htmlFor="email-input"
            aria-describedby="email-input-description"
          >
            Adresses e-mail des nouveaux membres
            <span className="fr-hint-text">Champ obligatoire</span>
          </label>
          <div
            className="flex flex-wrap gap-2 p-2 border-black border-b-2  bg-gray-100 min-h-[44px] cursor-text"
            onClick={() => inputRef.current?.focus()}
          >
            <input
              ref={inputRef}
              id="email-input"
              type="text"
              value={inputValue}
              aria-describedby="email-input-description"
              onChange={(e) => {
                setInputValue(e.target.value);
                setError(null);
                setServerError(null);
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onBlur={() => {
                if (inputValue.trim()) addEmail(inputValue);
              }}
              className="flex-1 min-w-[200px] border-none outline-none bg-transparent"
            />
            {emailTags.length > 0 && (
              <ul className="flex flex-wrap gap-2 list-none p-0 m-0 w-full">
                {emailTags.map((email) => (
                  <li key={email} className="m-0 p-0">
                    <Tag
                      dismissible
                      nativeButtonProps={{
                        onClick: (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeEmail(email);
                        },
                        "aria-label": `Retirer ${email}`,
                      }}
                      small
                    >
                      {email}
                    </Tag>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {error ? <p className="fr-error-text">{error}</p> : null}{" "}
          {serverError ? <p className="fr-error-text">{serverError}</p> : null}
          <p id="email-input-description" className="fr-info-text">
            Saisissez une ou plusieurs adresses e-mail. Appuyez sur Entrée,
            espace ou virgule pour valider chaque adresse.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {pendingMembers.map((member, index) => (
          <AddedMemberRow
            key={member.email}
            email={member.email}
            isOperatorGroup={isOperatorGroup}
            defaultIsManager={member.isManager}
            isManagerLocked={!hasMembers && index === 0}
            onRemove={() => handleRemovePendingMember(member.email)}
            onEmailChange={(newEmail) =>
              handleEmailChange(member.email, newEmail)
            }
            onManagerToggle={(isManager) =>
              handleManagerToggle(member.email, isManager)
            }
            showConfirmDelete={false}
            onCancelDelete={() => {}}
          />
        ))}
        {pendingMembers.length > 0 && (
          <div className="flex justify-end mt-2">
            <Button
              onClick={handleConfirmAddMembers}
              iconId="ri-user-add-line"
              size="large"
              disabled={isAddingUsers}
            >
              {isAddingUsers
                ? "Ajout en cours..."
                : `Ajouter ${pendingMembers.length} ${
                    pendingMembers.length > 1 ? "membres" : "membre"
                  }`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
