"use client";

import { useState, useEffect, useRef } from "react";
import Button from "@codegouvfr/react-dsfr/Button";
import ToggleSwitch from "@codegouvfr/react-dsfr/ToggleSwitch";
import { EditMemberEmailForm } from "../edit-member-email-form/edit-member-email-form";

interface AddedMemberRowProps {
  email: string;
  isOperatorGroup?: boolean;
  onRemove: () => void;
  onEmailChange?: (newEmail: string) => void;
  onManagerToggle?: (isManager: boolean) => void;
  defaultIsManager?: boolean;
  isManagerLocked?: boolean;
  showConfirmDelete?: boolean;
  onCancelDelete?: () => void;
}

export function AddedMemberRow({
  email,
  isOperatorGroup = false,
  onRemove,
  onEmailChange,
  onManagerToggle,
  defaultIsManager = false,
  isManagerLocked = false,
  showConfirmDelete: showConfirmDeleteProp,
  onCancelDelete,
}: AddedMemberRowProps) {
  const [isManager, setIsManager] = useState(defaultIsManager);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const confirmDeleteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showConfirmDeleteProp !== undefined) {
      setShowConfirmDelete(showConfirmDeleteProp);
    }
  }, [showConfirmDeleteProp]);

  useEffect(() => {
    if (showConfirmDelete) {
      confirmDeleteRef.current?.focus();
    }
  }, [showConfirmDelete]);

  function handleToggle(checked: boolean) {
    setIsManager(checked);
    onManagerToggle?.(checked);
  }

  function handleEmailValidate(newEmail: string) {
    onEmailChange?.(newEmail);
    setIsEditingEmail(false);
  }

  function handleConfirmDelete() {
    onRemove();
    setShowConfirmDelete(false);
    onCancelDelete?.();
  }

  function handleCancelDelete() {
    setShowConfirmDelete(false);
    onCancelDelete?.();
  }

  if (showConfirmDelete) {
    return (
      <div
        ref={confirmDeleteRef}
        tabIndex={-1}
        className="border border-[#ddd] flex flex-col gap-6 p-10"
      >
        <div className="flex items-start justify-between gap-4 mt-2 mb-1">
          <p className="text-[16px] leading-[24px] text-[#3a3a3a] m-0 max-w-md">
            Êtes-vous sûr de vouloir supprimer{" "}
            <span className="font-bold">{email}</span> des membres à ajouter ?
          </p>
          <div className="flex gap-4">
            <Button iconId="ri-delete-bin-line" onClick={handleConfirmDelete}>
              Confirmer la suppression
            </Button>
            <Button priority="secondary" onClick={handleCancelDelete}>
              Annuler
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isEditingEmail) {
    return (
      <div className="border border-[#ddd] flex flex-col gap-6 p-10">
        <EditMemberEmailForm
          currentEmail={email}
          onValidate={handleEmailValidate}
          onCancel={() => setIsEditingEmail(false)}
        />
      </div>
    );
  }

  return (
    <div className="border border-[#ddd] flex flex-col gap-6 p-10">
      <div className="flex items-center justify-between gap-4  ">
        <div className="flex flex-col gap-2">
          <h6 className="text-[20px] leading-[28px] font-bold text-[#161616] m-0">
            {email}
          </h6>
          {onEmailChange && (
            <button
              type="button"
              onClick={() => setIsEditingEmail(true)}
              className="text-[14px] leading-[24px] text-blue-primary underline hover:no-underline bg-transparent border-none p-0 cursor-pointer text-left underline-offset-4"
            >
              Modifier l&apos;adresse e-mail
            </button>
          )}
        </div>

        <div className="flex items-center gap-8 w-1/2 justify-between ">
          <div className="flex flex-col items-end gap-1">
            <ToggleSwitch
              className="whitespace-nowrap"
              label="Responsable de l'équipe"
              checked={isManager}
              onChange={isManagerLocked ? () => {} : handleToggle}
              disabled={isManagerLocked}
              showCheckedHint={false}
            />
            {isManagerLocked && (
              <p className="text-[12px] text-[#666] m-0">
                Le premier membre doit être responsable de l&apos;équipe.
              </p>
            )}
          </div>

          <Button
            iconId="ri-delete-bin-line"
            priority="secondary"
            title="Supprimer"
            onClick={() => setShowConfirmDelete(true)}
          />
        </div>
      </div>

      {isOperatorGroup && (
        <div className="flex bg-[#eee]">
          <div className="w-1 bg-[#6a6af4] shrink-0" />
          <div className="py-4 px-8 pb-8">
            <p className="text-[16px] leading-[24px] text-[#3a3a3a] m-0">
              {email} aura accès au contenu (données personnelles des citoyens
              et pièces jointes) des signalements en cours ainsi qu&apos;aux
              signalements à venir.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
