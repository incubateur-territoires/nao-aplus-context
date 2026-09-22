import { ROUTE } from "@/app/constant/route";
import { Button } from "@codegouvfr/react-dsfr/Button";

interface CreateReportProps {
  hasNoReports?: boolean;
}

export function CreateReport({ hasNoReports }: CreateReportProps) {
  return (
    <div className="bg-white p-4 sm:p-8 md:p-12 lg:p-20 flex flex-col gap-6 mt-10 ">
      {hasNoReports ? (
        <p className="m-0">Aucun signalement à afficher</p>
      ) : (
        <h2 className="text-[32px] font-bold leading-[40px] text-[#161616] m-0">
          Créer un nouveau signalement
        </h2>
      )}
      <p>
        Pour créer un signalement, vous aurez besoin des nom, prénom et date de
        naissance du citoyen.
        <br />
        Certaines informations complémentaires (identifiant CAF, NIR) peuvent
        également être nécessaires.
      </p>
      <div className="flex justify-end">
        <Button
          size="large"
          className="hover:bg-blue-primary hover:text-white"
          iconId="ri-add-line"
          linkProps={{
            href: ROUTE.NEW_REPORT_STEP_1,
          }}
        >
          Créer un nouveau signalement
        </Button>
      </div>
    </div>
  );
}
