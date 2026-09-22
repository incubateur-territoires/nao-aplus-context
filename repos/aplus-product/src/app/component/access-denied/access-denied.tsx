"use client";

import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function AccessDeniedAlert() {
  const searchParams = useSearchParams();
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    const error = searchParams.get("error");
    const message = searchParams.get("message");

    if (error === "access_denied" && message) {
      setShowAlert(true);

      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setShowAlert(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  if (!showAlert) return null;

  const message = searchParams.get("message") || "Accès refusé";

  return (
    <div className="mb-4">
      <Alert
        severity="error"
        title="Accès refusé"
        description={message}
        closable
        onClose={() => setShowAlert(false)}
      />
    </div>
  );
}
