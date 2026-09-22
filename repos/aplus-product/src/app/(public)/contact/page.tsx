import { HydrateClient } from "@/trpc/hydrate-client";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { Container } from "@/app/component/container/container";
import { ContactForm } from "@/app/component/contact-form/contact-form";
import { ContactFeedbackProvider } from "@/app/component/contact-feedback-provider/contact-feedback-provider";
import { ContactSuccessAlert } from "@/app/component/contact-success-alert/contact-success-alert";
import {
  ContactFormLink,
  CONTACT_FORM_ANCHOR,
} from "@/app/component/contact-form-link/contact-form-link";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { ROUTE } from "@/app/constant/route";
import Alert from "@codegouvfr/react-dsfr/Alert";
import CallOut from "@codegouvfr/react-dsfr/CallOut";
import Accordion from "@codegouvfr/react-dsfr/Accordion";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
};

const FAQ_ITEMS = [
  {
    label:
      "Je n'arrive pas à me connecter / mon adresse e-mail n'est pas reconnue, que faire ?",
    content: (
      <>
        <p>
          Si vous êtes un conseiller France services, vous n&apos;avez pas
          automatiquement un compte sur Administration+. Demandez au responsable
          de l&apos;équipe de vous{" "}
          <Link
            href="https://docs.aplus.beta.gouv.fr/vous-etes-responsable-dequipe/ajouter-un-membre-a-une-equipe"
            target="_blank"
            rel="noopener noreferrer"
          >
            ajouter à l&apos;équipe
            <span className="sr-only"> - nouvelle fenêtre</span>
          </Link>
          .
        </p>
        <p>
          Si votre adresse e-mail n&apos;est pas reconnue sur Administration+,
          cela veut dire qu&apos;il n&apos;y a pas de compte A+ lié à cette
          adresse e-mail. Si vous connaissez le responsable d&apos;équipe de
          votre structure, demandez-lui de vous{" "}
          <Link
            href="https://docs.aplus.beta.gouv.fr/vous-etes-responsable-dequipe/ajouter-un-membre-a-une-equipe"
            target="_blank"
            rel="noopener noreferrer"
          >
            ajouter à l&apos;équipe
            <span className="sr-only"> - nouvelle fenêtre</span>
          </Link>
          . Si ce n&apos;est pas le cas, vous pouvez{" "}
          <ContactFormLink>nous contacter</ContactFormLink>.
        </p>
      </>
    ),
  },
  {
    label: "Comment créer mon mot de passe ?",
    content: (
      <p>
        Consultez la page d&apos;aide dédiée :{" "}
        <Link
          href="https://docs.aplus.beta.gouv.fr/questions-frequentes-faq/comment-creer-mon-mot-de-passe"
          target="_blank"
          rel="noopener noreferrer"
        >
          Comment créer mon mot de passe ?
          <span className="sr-only"> - nouvelle fenêtre</span>
        </Link>
      </p>
    ),
  },
  {
    label: "Comment changer mon mot de passe ?",
    content: (
      <p>
        Consultez la page d&apos;aide dédiée :{" "}
        <Link
          href="https://docs.aplus.beta.gouv.fr/questions-frequentes-faq/comment-changer-mon-mot-de-passe"
          target="_blank"
          rel="noopener noreferrer"
        >
          Comment changer mon mot de passe ?
          <span className="sr-only"> - nouvelle fenêtre</span>
        </Link>
      </p>
    ),
  },
  {
    label: "Comment ajouter un collègue à mon équipe A+ ?",
    content: (
      <>
        <p>
          Seul un responsable d&apos;équipe peut ajouter un membre à son équipe.
        </p>
        <ul>
          <li>
            Si vous êtes responsable d&apos;équipe, voici{" "}
            <Link
              href="https://docs.aplus.beta.gouv.fr/vous-etes-responsable-dequipe/ajouter-un-membre-a-une-equipe"
              target="_blank"
              rel="noopener noreferrer"
            >
              comment ajouter un collègue à votre équipe A+
              <span className="sr-only"> - nouvelle fenêtre</span>
            </Link>
            .
          </li>
          <li>
            Si vous n&apos;êtes pas responsable d&apos;équipe, vous devez
            demander à votre responsable de s&apos;en occuper.
          </li>
        </ul>
        <p>
          En cas de problème, vous pouvez{" "}
          <ContactFormLink>nous contacter</ContactFormLink>.
        </p>
      </>
    ),
  },
  {
    label:
      "Comment échanger en visioconférence avec un membre de l'équipe A+ ?",
    content: (
      <p>
        Consultez la page d&apos;aide dédiée :{" "}
        <Link
          href="https://docs.aplus.beta.gouv.fr/contacter-lequipe"
          target="_blank"
          rel="noopener noreferrer"
        >
          Échanger en visioconférence avec un membre de l&apos;équipe produit
          <span className="sr-only"> - nouvelle fenêtre</span>
        </Link>
      </p>
    ),
  },
  {
    label:
      "Comment changer mon nom, mon prénom, ma profession ou mon numéro de téléphone ?",
    content: (
      <p>
        Consultez la page d&apos;aide dédiée :{" "}
        <Link
          href="https://docs.aplus.beta.gouv.fr/questions-frequentes-faq/comment-changer-mon-nom-mon-prenom-ma-profession-ou-mon-numero-de-telephone"
          target="_blank"
          rel="noopener noreferrer"
        >
          Comment changer mes informations personnelles ?
          <span className="sr-only"> - nouvelle fenêtre</span>
        </Link>
      </p>
    ),
  },
];

export default async function ContactPage() {
  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <Breadcrumb
            currentPageLabel="Contact"
            homeLinkProps={{
              href: ROUTE.HOME,
            }}
            segments={[]}
          />
          <ContactFeedbackProvider>
            <ContactSuccessAlert />
            <div className="gap-4 my-6">
              <h1>Comment pouvons-nous vous aider ?</h1>
              <div className="p-4 md:p-20 bg-white mt-8">
                <Alert
                  severity="info"
                  title="Échangez avec l'équipe d'A+ par tchat de 11h à 12h"
                  description={
                    <>
                      <p className="mb-8">
                        Si le message ci-dessous est visible en bas à droite de
                        votre écran, cliquez dessus pour dialoguer avec notre
                        équipe.
                      </p>
                      <svg
                        width="360"
                        height="40"
                        viewBox="0 0 360 40"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                        role="presentation"
                        className="max-w-full h-auto"
                      >
                        <path
                          d="M0 8C0 3.58172 3.58172 0 8 0H352C356.418 0 360 3.58172 360 8V40H0V8Z"
                          fill="#529DDF"
                        />
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M28.0417 25.8333L26 28.75L23.9584 25.8333H18.5C18.0398 25.8333 17.6667 25.4602 17.6667 25V13.3333C17.6667 12.8731 18.0398 12.5 18.5 12.5H33.5C33.9603 12.5 34.3334 12.8731 34.3334 13.3333V25C34.3334 25.4602 33.9603 25.8333 33.5 25.8333H28.0417Z"
                          fill="white"
                        />
                        <path
                          d="M50.64 25.192C51.92 25.192 52.928 24.568 53.568 23.656L55.36 25.032C54.336 26.424 52.672 27.32 50.64 27.32C47.104 27.32 44.688 24.6 44.688 21.4C44.688 18.2 47.104 15.48 50.64 15.48C52.672 15.48 54.336 16.392 55.36 17.752L53.568 19.144C52.928 18.232 51.92 17.608 50.64 17.608C48.528 17.608 47.024 19.256 47.024 21.4C47.024 23.544 48.528 25.192 50.64 25.192ZM57.0598 27V15H59.0918V19.576C59.6518 19.032 60.4038 18.616 61.4758 18.616C63.2198 18.616 64.6118 19.816 64.6118 22.2V27H62.5638V22.28C62.5638 21.208 61.9718 20.536 60.9638 20.536C59.9398 20.536 59.3958 21.224 59.0918 21.736V27H57.0598ZM69.1911 27.24C67.5751 27.24 66.4711 26.312 66.4711 24.824C66.4711 23.608 67.4151 22.696 69.1431 22.408L71.6071 21.992V21.784C71.6071 20.936 70.9671 20.392 70.0391 20.392C69.2551 20.392 68.6471 20.76 68.2151 21.352L66.7271 20.216C67.4471 19.224 68.6311 18.616 70.1031 18.616C72.4391 18.616 73.6391 20.008 73.6391 21.784V27H71.6071V26.216C71.0951 26.84 70.1351 27.24 69.1911 27.24ZM68.4871 24.728C68.4871 25.272 68.9191 25.624 69.6071 25.624C70.5351 25.624 71.2071 25.192 71.6071 24.552V23.416L69.6871 23.736C68.8391 23.88 68.4871 24.232 68.4871 24.728ZM76.478 24.056V20.76H74.974V18.936H76.478V16.92H78.526V18.936H80.99V20.76H78.526V24.056C78.526 24.952 79.006 25.304 79.806 25.304C80.366 25.304 80.734 25.24 81.006 25.128V26.904C80.606 27.08 80.126 27.16 79.454 27.16C77.438 27.16 76.478 26.024 76.478 24.056ZM83.4468 24.056V20.76H81.9428V18.936H83.4468V16.92H85.4948V18.936H87.9588V20.76H85.4948V24.056C85.4948 24.952 85.9748 25.304 86.7748 25.304C87.3348 25.304 87.7028 25.24 87.9748 25.128V26.904C87.5748 27.08 87.0948 27.16 86.4227 27.16C84.4068 27.16 83.4468 26.024 83.4468 24.056ZM97.0463 25.688C96.2943 26.696 95.0463 27.32 93.5263 27.32C90.6623 27.32 89.0463 25.32 89.0463 22.968C89.0463 20.584 90.5503 18.616 93.1903 18.616C95.4303 18.616 96.9023 20.136 96.9023 22.248C96.9023 22.696 96.8383 23.112 96.7743 23.384H91.1263C91.3183 24.888 92.2463 25.496 93.5103 25.496C94.3903 25.496 95.1583 25.112 95.5903 24.536L97.0463 25.688ZM93.1423 20.28C92.1023 20.28 91.4143 20.856 91.1903 21.912H94.9023C94.8703 21.096 94.2783 20.28 93.1423 20.28ZM98.4585 27V25.176L102.555 20.76H98.5865V18.936H105.099V20.76L101.003 25.176H105.211V27H98.4585ZM114.054 27.224C112.47 27.224 111.398 26.344 111.398 24.968C111.398 23.752 112.326 22.888 114.038 22.6L116.758 22.152V21.592C116.758 20.472 115.958 19.832 114.806 19.832C113.878 19.832 113.126 20.264 112.63 20.952L111.606 20.168C112.31 19.208 113.446 18.616 114.854 18.616C116.902 18.616 118.118 19.816 118.118 21.592V27H116.758V25.976C116.15 26.76 115.094 27.224 114.054 27.224ZM112.774 24.92C112.774 25.608 113.334 26.104 114.278 26.104C115.35 26.104 116.23 25.592 116.758 24.728V23.144L114.374 23.544C113.27 23.736 112.774 24.232 112.774 24.92ZM119.552 18.936H121.024L123.6 25.576L126.176 18.936H127.648L124.496 27H122.704L119.552 18.936ZM136.358 25.672C135.606 26.68 134.406 27.32 132.902 27.32C130.182 27.32 128.502 25.32 128.502 22.968C128.502 20.52 130.07 18.616 132.566 18.616C134.758 18.616 136.182 20.152 136.182 22.136C136.182 22.456 136.134 22.76 136.086 22.984H129.894C129.942 24.92 131.174 26.088 132.902 26.088C133.942 26.088 134.822 25.608 135.35 24.888L136.358 25.672ZM132.534 19.768C131.206 19.768 130.278 20.552 129.99 21.944H134.822C134.774 20.76 133.958 19.768 132.534 19.768ZM142.168 26.04C143.16 26.04 143.976 25.56 144.472 24.856L145.544 25.672C144.792 26.68 143.624 27.32 142.152 27.32C139.48 27.32 137.768 25.32 137.768 22.968C137.768 20.616 139.48 18.616 142.152 18.616C143.608 18.616 144.792 19.272 145.544 20.264L144.472 21.08C143.976 20.376 143.16 19.896 142.152 19.896C140.424 19.896 139.192 21.256 139.192 22.968C139.192 24.696 140.424 26.04 142.168 26.04ZM151.721 27V18.936H153.081V19.848C153.737 19.128 154.569 18.616 155.769 18.616C157.577 18.616 158.921 19.832 158.921 22.12V27H157.561V22.168C157.561 20.728 156.745 19.896 155.497 19.896C154.329 19.896 153.593 20.568 153.081 21.416V27H151.721ZM165.339 18.616C167.931 18.616 169.707 20.616 169.707 22.968C169.707 25.32 167.931 27.32 165.339 27.32C162.731 27.32 160.971 25.32 160.971 22.968C160.971 20.616 162.731 18.616 165.339 18.616ZM165.355 26.04C167.035 26.04 168.267 24.632 168.267 22.968C168.267 21.288 167.035 19.896 165.355 19.896C163.627 19.896 162.395 21.288 162.395 22.968C162.395 24.648 163.627 26.04 165.355 26.04ZM177.509 23.544V18.936H178.869V23.496C178.869 25.912 177.477 27.32 175.285 27.32C173.109 27.32 171.717 25.912 171.717 23.496V18.936H173.077V23.544C173.077 25.128 173.925 26.04 175.301 26.04C176.645 26.04 177.509 25.128 177.509 23.544ZM180.654 25.896L181.614 25.08C182.174 25.784 182.846 26.184 183.662 26.184C184.558 26.184 185.07 25.64 185.07 24.936C185.07 23.128 181.038 23.768 181.038 20.92C181.038 19.656 182.11 18.616 183.662 18.616C184.814 18.616 185.806 19.16 186.366 19.944L185.422 20.744C184.99 20.136 184.382 19.752 183.678 19.752C182.814 19.752 182.35 20.264 182.35 20.888C182.35 22.696 186.398 22.12 186.398 24.872C186.382 26.376 185.182 27.32 183.678 27.32C182.398 27.32 181.39 26.808 180.654 25.896ZM193.388 23.736L193.132 15.8H194.684L194.428 23.736H193.388ZM193.932 27.176C193.356 27.176 192.892 26.712 192.892 26.152C192.892 25.608 193.356 25.144 193.932 25.144C194.492 25.144 194.94 25.608 194.94 26.152C194.94 26.712 194.492 27.176 193.932 27.176Z"
                          fill="white"
                        />
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M332 18.828L327.05 23.778L325.636 22.364L332 16L338.364 22.364L336.95 23.778L332 18.828Z"
                          fill="white"
                        />
                      </svg>
                    </>
                  }
                  className="fr-mb-4w"
                />

                <CallOut
                  title="Vous avez besoin de renseignements ?"
                  titleAs="h3"
                  buttonProps={{
                    children: (
                      <>
                        Consulter l&apos;aide en ligne
                        <span className="sr-only"> - nouvelle fenêtre</span>
                      </>
                    ),
                    linkProps: {
                      href: ROUTE.HELP,
                      target: "_blank",
                      rel: "noopener noreferrer",
                    },
                  }}
                  className="fr-mb-4w"
                >
                  Vous trouverez dans notre{" "}
                  <Link
                    href={ROUTE.HELP}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    centre d&apos;aide
                    <span className="sr-only"> - nouvelle fenêtre</span>
                  </Link>{" "}
                  :
                  <br />• des{" "}
                  <Link
                    href="https://docs.aplus.beta.gouv.fr/comprendre-administration-plus"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    informations générales
                    <span className="sr-only"> - nouvelle fenêtre</span>
                  </Link>{" "}
                  pour les nouveaux membres
                  <br />• des contenus destinés{" "}
                  <Link
                    href="https://docs.aplus.beta.gouv.fr/vous-etes-auteur-de-signalement"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    aux aidants
                    <span className="sr-only"> - nouvelle fenêtre</span>
                  </Link>
                  ,{" "}
                  <Link
                    href="https://docs.aplus.beta.gouv.fr/vous-etes-destinataire-de-signalement"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    aux opérateurs
                    <span className="sr-only"> - nouvelle fenêtre</span>
                  </Link>{" "}
                  et aux{" "}
                  <Link
                    href="https://docs.aplus.beta.gouv.fr/vous-etes-responsable-dequipe"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    responsables d&apos;équipes
                    <span className="sr-only"> - nouvelle fenêtre</span>
                  </Link>
                  <br />• une{" "}
                  <Link
                    href="https://docs.aplus.beta.gouv.fr/questions-frequentes-faq"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    FAQ
                    <span className="sr-only"> - nouvelle fenêtre</span>
                  </Link>{" "}
                  qui regroupe les questions les plus fréquemment posées au
                  support
                </CallOut>

                <h2 className="fr-mt-6w">Quelle est votre question ?</h2>

                <div className="fr-mt-3w">
                  {FAQ_ITEMS.map((item) => (
                    <Accordion key={item.label} label={item.label}>
                      {item.content}
                    </Accordion>
                  ))}
                </div>
              </div>

              <div
                id={CONTACT_FORM_ANCHOR}
                tabIndex={-1}
                className="p-4 md:p-20 bg-white mt-8 scroll-mt-4"
              >
                <ContactForm />
              </div>
            </div>
          </ContactFeedbackProvider>
        </Container>
      </div>
    </HydrateClient>
  );
}
