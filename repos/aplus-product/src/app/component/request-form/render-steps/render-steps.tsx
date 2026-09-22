import { useSearchParams, useRouter } from "next/navigation";
import { useFormContext } from "react-hook-form";
import { Step1 } from "../steps/step-1/step-1";
import { Step2 } from "../steps/step-2/step-2";
import { Step3 } from "../steps/step-3/step-3";
import { Step4 } from "../steps/step-4/step-4";
import { useEffect } from "react";
import { ROUTE, SEARCH_PARAMS } from "@/app/constant/route";
import type { ReportFormValues } from "../request-form";

export function RenderSteps() {
  const params = useSearchParams();
  const step = params.get("step");
  const router = useRouter();
  const { getValues } = useFormContext<ReportFormValues>();

  useEffect(() => {
    if (step && step !== "1") {
      const requestedTeams = getValues("requestedTeams");
      if (!requestedTeams || requestedTeams.length === 0) {
        router.replace(
          `${ROUTE.NEW_REPORT_STEP_1}&${SEARCH_PARAMS.FORM_EXPIRED}=true`,
        );
        return;
      }
    }
  }, [step, getValues, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 0);
    return () => clearTimeout(timer);
  }, [step]);
  switch (step) {
    case "1":
      return <Step1 />;
    case "2":
      return <Step2 />;
    case "3":
      return <Step3 />;
    case "4":
      return <Step4 />;
    default:
      return <Step1 />;
  }
}
