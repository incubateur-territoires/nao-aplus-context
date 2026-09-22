import { HydrateClient } from "@/trpc/hydrate-client";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { Container } from "@/app/component/container/container";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { ROUTE } from "@/app/constant/route";

export const metadata = {
  title: "Mentions légales",
};

export default async function MentionsLegales() {
  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <Breadcrumb
            currentPageLabel="Mentions légales"
            homeLinkProps={{
              href: ROUTE.HOME,
            }}
            segments={[]}
          />
          <div className="my-6 ">
            <h1>Mentions légales</h1>
            <div className="p-4 md:p-20 bg-white mt-8 relative">
              <h2>Éditeur de la plateforme</h2>
              <p>
                Administration+ est édité au sein de l&apos;Incubateur des
                Territoires de l&apos;Agence nationale de la cohésion des
                territoires (ANCT) située :
              </p>
              <p>
                20 avenue de Ségur
                <br />
                75007 Paris
                <br />
                France <br /> Téléphone : 01 85 58 60 00
              </p>

              <h2 className="mt-8">Directeur de la publication</h2>
              <p>
                Le directeur de publication est Monsieur Henri PREVOST,
                Directeur général de l&apos;ANCT.
              </p>

              <h2 className="mt-8">Hébergement de la plateforme</h2>
              <p>
                La plateforme est hébergée par : <br />
                Scalingo
                <br />
                13 rue Jacques Peirotes
                <br />
                67000 Strasbourg
                <br />
                France
              </p>

              <h2 className="mt-8">Accessibilité</h2>
              <p>
                La conformité aux normes d&apos;accessibilité numérique est un
                objectif majeur de la plateforme. Une démarche de mise en
                accessibilité a été entrepris avec la refonte du service pour
                s&apos;approcher des 100% de respect des critères RGAA. Un audit
                de la plateforme sera programmée courant du deuxième trimestre
                2026.
              </p>

              <h2 className="mt-8">Sécurité</h2>
              <p>
                La plateforme est protégée par un certificat électronique,
                matérialisé pour la grande majorité des navigateurs par un
                cadenas dans la barre d&apos;adresse et l&apos;url
                &quot;https&quot;, len garantissant que les échanges entre votre
                navigateur et le serveur sont chiffrés et ne peuvent être
                interceptés.
              </p>
              <p>
                En aucun cas, les services associés à la plateforme ne seront à
                l&apos;origine d&apos;envoi d&apos;e-mails pour vous demander la
                saisie d&apos;informations personnelles.
              </p>
            </div>
          </div>
        </Container>
      </div>
    </HydrateClient>
  );
}
