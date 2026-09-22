import { HydrateClient } from "@/trpc/hydrate-client";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { Container } from "@/app/component/container/container";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import Link from "next/link";
import { ROUTE } from "@/app/constant/route";

export const metadata = {
  title: "Plan du site",
};

export default async function PlanDuSite() {
  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <Breadcrumb
            currentPageLabel="Plan du site"
            homeLinkProps={{
              href: ROUTE.HOME,
            }}
            segments={[]}
          />
          <div className="my-6">
            <h1>Plan du site</h1>
            <div className="p-4 md:p-20 bg-white mt-8 relative flex flex-col gap-12">
              <section className="flex flex-col gap-4">
                <h2 className="fr-h3 mb-0">Pages publiques</h2>
                <div className="pl-4">
                  <ul className="pl-4 mb-0">
                    <li>
                      <Link href={ROUTE.HOME}>Accueil</Link>
                    </li>
                    <li>
                      <Link href={ROUTE.CONTACT}>Contact</Link>
                    </li>
                    <li>
                      <Link
                        href={ROUTE.HELP}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Aide
                        <span className="sr-only"> - nouvelle fenêtre</span>
                      </Link>
                    </li>
                    <li>
                      <Link href={ROUTE.STATISTIQUES}>Statistiques</Link>
                    </li>
                  </ul>
                </div>
              </section>

              <section className="flex flex-col gap-4">
                <h2 className="fr-h3 mb-0">Espace membre</h2>
                <p className="px-4 mb-0">
                  Pages accessibles aux utilisateurs connectés uniquement.
                </p>

                <div className="pl-4 flex flex-col gap-4">
                  <h3 className="fr-h6 mb-0">Utilisateurs connectés</h3>
                  <div className="pl-4">
                    <ul className="pl-4 mb-0">
                      <li>
                        <Link href={ROUTE.ALL_REPORTS}>
                          Tous les signalements
                        </Link>
                      </li>
                      <li>
                        <Link href={ROUTE.REPORT}>Créer un signalement</Link>
                      </li>
                      <li>
                        <Link href={ROUTE.TEAMS}>Équipes</Link>
                      </li>
                      <li>
                        <Link href={ROUTE.PROFILE}>Profil</Link>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="pl-4 flex flex-col gap-4">
                  <h3 className="fr-h6 mb-0">
                    Responsables d&apos;équipes et superviseurs uniquement
                  </h3>
                  <div className="pl-4">
                    <ul className="pl-4 mb-0">
                      <li>
                        <Link href={ROUTE.USERS}>Utilisateurs</Link>
                      </li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="flex flex-col gap-4">
                <h2 className="fr-h3 mb-0">Informations générales</h2>
                <div className="pl-4">
                  <ul className="pl-4 mb-0">
                    <li>
                      <Link href={ROUTE.ACCESSIBILITE}>
                        Déclaration d&apos;accessibilité
                      </Link>
                    </li>
                    <li>
                      <Link href={ROUTE.MENTIONS_LEGALES}>
                        Mentions légales
                      </Link>
                    </li>
                    <li>
                      <Link href={ROUTE.CGU}>
                        Conditions générales d&apos;utilisation
                      </Link>
                    </li>
                    <li>
                      <Link href={ROUTE.DONNEES_PERSONNELLES}>
                        Politique de confidentialité
                      </Link>
                    </li>
                    <li>
                      <Link href={ROUTE.PLAN_DU_SITE}>Plan du site</Link>
                    </li>
                  </ul>
                </div>
              </section>
            </div>
          </div>
        </Container>
      </div>
    </HydrateClient>
  );
}
