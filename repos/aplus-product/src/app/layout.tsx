import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { SkipLinks } from "@codegouvfr/react-dsfr/SkipLinks";

import { Header } from "@codegouvfr/react-dsfr/Header";
import { Footer } from "@codegouvfr/react-dsfr/Footer";
// import { headerFooterDisplayItem } from "@codegouvfr/react-dsfr/Display";
import { Navigation } from "./component/header/navigation/navigation-server";
import { LoginHeaderItem } from "./component/header/login-header-item/login-header-item";
import {
  getHtmlAttributes,
  DsfrHead,
} from "../dsfr-bootstrap/server-only-index";
import { DsfrProvider } from "../dsfr-bootstrap";
import { ROUTE } from "./constant/route";

/* styles */
import "@/app/global.css";
import { TRPCReactProvider } from "@/trpc/client";
import Link from "next/link";
import { DevToolsWidget } from "./component/dev-tools-widget/dev-tools-widget";
import { AuthProvider } from "./component/auth-provider/auth-provider";
import { AnalyticsProvider } from "./component/analytics-provider/analytics-provider";
import { ImpersonationBanner } from "./component/impersonation-banner/impersonation-banner";
import { SiteBanner } from "./component/site-banner/site-banner";
import { TwoFactorGuard } from "./component/two-factor-guard/two-factor-guard";
import { ProfileCompletionGuard } from "./component/profile-completion-guard/profile-completion-guard";
import { NoTeamGuard } from "./component/no-team-guard/no-team-guard";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ZammadChat } from "./component/zammad-chat/zammad-chat";
import prisma from "@/lib/prisma";
import { MaintenancePage } from "./maintenance";
import { MatomoAnalytics } from "./services/matomo/matomo.client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Administration+",
    template: "%s | Administration+",
  },
  description:
    "Administration+ est le service qui permet de résoudre les blocages administratifs complexes ou urgents.",
};

export default async function RootLayout({
  children,
}: {
  children: React.JSX.Element;
}) {
  const maintenance = await prisma.maintenanceMode.findFirst({
    where: { isActive: true },
  });

  if (maintenance) {
    return <MaintenancePage />;
  }

  const lang = "fr";

  const IS_DEV = process.env.NODE_ENV === "development";
  const SHOW_EMAIL_DEBUG =
    IS_DEV || process.env.NEXT_PUBLIC_ENABLE_DEBUG_TOOLS === "true";

  return (
    <html {...getHtmlAttributes({ lang })}>
      <head>
        <DsfrHead
          preloadFonts={[
            //"Marianne-Light",
            //"Marianne-Light_Italic",
            "Marianne-Regular",
            //"Marianne-Regular_Italic",
            "Marianne-Medium",
            //"Marianne-Medium_Italic",
            "Marianne-Bold",
            //"Marianne-Bold_Italic",
            //"Spectral-Regular",
            //"Spectral-ExtraBold"
          ]}
        />
      </head>
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <AppRouterCacheProvider>
          <DsfrProvider lang={lang}>
            <TRPCReactProvider>
              <AuthProvider>
                <AnalyticsProvider>
                  <SkipLinks
                    links={[
                      {
                        label: "Accéder au contenu",
                        anchor: "#content",
                      },
                      {
                        label: "Accéder au menu",
                        anchor: "#menu",
                      },
                      {
                        label: "Accéder au pied de page",
                        anchor: "#footer",
                      },
                    ]}
                  />
                  <Header
                    brandTop={
                      <>
                        agence
                        <br /> nationale
                        <br /> de la cohésion
                        <br /> des territoires
                      </>
                    }
                    serviceTagline="Résoudre les blocages administratifs complexes ou urgents"
                    serviceTitle="Administration+"
                    operatorLogo={{
                      imgUrl: "/assets/logo/a+.svg",
                      // RGAA 1.2 : logo décoratif, le titre du service "Administration+"
                      // est déjà rendu en texte par le Header.
                      alt: "",
                      orientation: "horizontal",
                    }}
                    homeLinkProps={{
                      href: ROUTE.HOME,
                      title: "Accueil - Administration+",
                    }}
                    quickAccessItems={[
                      {
                        iconId: "ri-question-line",
                        linkProps: {
                          href: "https://docs.aplus.beta.gouv.fr/",
                          target: "_blank",
                          rel: "noopener noreferrer",
                        },
                        text: (
                          <>
                            Aide
                            <span className="sr-only"> - nouvelle fenêtre</span>
                          </>
                        ),
                      },
                      <LoginHeaderItem key={0} />,
                    ]}
                    navigation={<Navigation />}
                  />
                  <ImpersonationBanner />
                  <ProfileCompletionGuard>
                    <TwoFactorGuard>
                      <NoTeamGuard>
                        <main
                          id="content"
                          role="main"
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            fontWeight: "normal",
                            height: "100%",
                          }}
                        >
                          <SiteBanner />
                          {children}
                        </main>
                      </NoTeamGuard>
                    </TwoFactorGuard>
                  </ProfileCompletionGuard>
                  {process.env.NEXT_PUBLIC_ENABLE_DEBUG_TOOLS === "true" ? (
                    <Suspense fallback={null}>
                      <DevToolsWidget showEmailDebug={SHOW_EMAIL_DEBUG} />
                    </Suspense>
                  ) : null}
                  <ZammadChat />
                  <Suspense fallback={null}>
                    <MatomoAnalytics />
                  </Suspense>
                  <Footer
                    id="footer"
                    homeLinkProps={{
                      href: ROUTE.HOME,
                      // RGAA 6.1 : title vidé pour éviter une restitution vocale
                      // répétitive (le nom du lien provient de l'alt du logo).
                      title: "",
                    }}
                    operatorLogo={{
                      imgUrl: "/assets/logo/a+.svg",
                      // RGAA 6.1 : intitulé de lien explicite, sans la notion de "logo".
                      alt: "Administration+, retour à l'accueil",
                      orientation: "horizontal",
                    }}
                    accessibility="fully compliant"
                    accessibilityLinkProps={{
                      href: ROUTE.ACCESSIBILITE,
                    }}
                    contentDescription={
                      <>
                        Administration+ est le service qui permet de résoudre
                        les blocages administratifs complexes ou urgents.
                        Administration+ fait partie de l’
                        <Link
                          href="https://incubateur.anct.gouv.fr"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Incubateur des Territoires
                          <span className="sr-only"> - nouvelle fenêtre</span>
                        </Link>
                        , membre du réseau d’incubateurs 
                        <Link
                          href="https://beta.gouv.fr/"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          beta.gouv.fr
                          <span className="sr-only"> - nouvelle fenêtre</span>
                        </Link>
                        .
                      </>
                    }
                    bottomItems={[
                      <Link
                        className="text-xs"
                        href="/mentions-legales"
                        key="mentions-legales"
                      >
                        Mentions légales
                      </Link>,
                      <Link className="text-xs" href={ROUTE.CGU} key="cgu">
                        Conditions générales d&apos;utilisation
                      </Link>,
                      <Link
                        className="text-xs"
                        href={ROUTE.DONNEES_PERSONNELLES}
                        key="politique-de-confidentialite"
                      >
                        Politique de confidentialité
                      </Link>,
                      <Link
                        className="text-xs"
                        href={ROUTE.STATISTIQUES}
                        key="statistiques"
                      >
                        Statistiques
                      </Link>,
                      <Link
                        className="text-xs"
                        href={ROUTE.PLAN_DU_SITE}
                        key="plan-du-site"
                      >
                        Plan du site
                      </Link>,
                      <Link className="text-xs" href="/contact" key="contact">
                        Contact
                      </Link>,
                      <Link
                        className="text-xs"
                        href="https://gitlab.com/incubateur-territoires/startups/administration-plus/administration-plus"
                        target="_blank"
                        rel="noopener noreferrer"
                        key="code-source"
                      >
                        Code source
                        <span className="sr-only"> - nouvelle fenêtre</span>
                      </Link>,
                    ]}
                  />
                </AnalyticsProvider>
              </AuthProvider>
            </TRPCReactProvider>
          </DsfrProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
