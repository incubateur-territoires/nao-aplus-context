"use client";

import { SEARCH_PARAMS } from "@/app/constant/route";
import { useFocusOnVisible } from "@/app/hooks/use-focus-on-visible";
import Alert from "@codegouvfr/react-dsfr/Alert";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function ReportCreatedAlert() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const alertRef = useFocusOnVisible(show);

  useEffect(() => {
    if (searchParams.get("success") === SEARCH_PARAMS.REPORT_CREATED) {
      setShow(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("success");
      const remaining = params.toString();
      const newUrl = remaining ? `${pathname}?${remaining}` : pathname;
      router.replace(newUrl);
    }
  }, [searchParams, router, pathname]);

  if (!show) return null;

  return (
    <div ref={alertRef} tabIndex={-1} className="mb-4">
      <Alert
        severity="success"
        role="status"
        title="Le signalement a bien été créé."
        closable
        onClose={() => setShow(false)}
      />
    </div>
  );
}
