"use client";

import { useMemo } from "react";
import Button from "@codegouvfr/react-dsfr/Button";
import { createModal } from "@codegouvfr/react-dsfr/Modal";

interface ReactivateUserButtonProps {
  userId: string;
  onReactivateUser: (userId: string) => void;
  size?: "small" | "medium" | "large";
}

export function ReactivateUserButton({
  userId,
  onReactivateUser,
  size = "small",
}: ReactivateUserButtonProps) {
  const modal = useMemo(
    () =>
      createModal({
        id: `reactivate-user-modal-${userId}`,
        isOpenedByDefault: false,
      }),
    [userId],
  );

  return (
    <>
      <Button
        type="button"
        priority="secondary"
        size={size}
        iconId="ri-user-follow-line"
        onClick={() => modal.open()}
      >
        Réactiver l&apos;utilisateur
      </Button>
      <modal.Component
        title="Réactiver l'utilisateur"
        buttons={[
          {
            doClosesModal: true,
            children: "Annuler",
            priority: "secondary",
          },
          {
            doClosesModal: false,
            children: "Réactiver le compte",
            onClick: () => {
              onReactivateUser(userId);
              modal.close();
            },
          },
        ]}
      >
        <p>
          Si l&apos;utilisateur faisait partie d&apos;autres équipes, il sera
          réactivé pour toutes ces équipes.
        </p>
        <p>
          Si l&apos;utilisateur était auteur de signalements, ces signalements
          lui seront réattribués.
        </p>
      </modal.Component>
    </>
  );
}
