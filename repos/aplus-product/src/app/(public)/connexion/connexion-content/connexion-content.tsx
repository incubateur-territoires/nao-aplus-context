"use client";

/* chore */
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

/* components */
import { SigninForm } from "./signin-form/signin-form";
// import { ProConnectSignIn } from "./pro-connect/pro-connext";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ROUTE } from "@/app/constant/route";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { Container } from "@/app/component/container/container";
import { ImpersonationWidget } from "@/app/component/impersonation-widget/impersonation-widget";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { getSafeReturnTo } from "@/utils/return-to";

//TODO: implement error alert

export function Content() {
  const { data: session, refetch } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const logout = searchParams.get("logout");
  const [isImpersonationOpen, setIsImpersonationOpen] = useState(false);
  const emailParam = searchParams.get("email");
  const [prefillEmail, setPrefillEmail] = useState<string | undefined>(
    emailParam ?? undefined,
  );
  const [prefillPassword, setPrefillPassword] = useState<string>();

  // Clear cache and user store on logout - needed for browser-only cache clearing
  useEffect(() => {
    if (logout === "1") {
      // Clear React Query cache
      queryClient.clear();
      // Remove logout parameter from URL
      const newSearchParams = new URLSearchParams(searchParams.toString());
      newSearchParams.delete("logout");
      const newUrl = newSearchParams.toString()
        ? `?${newSearchParams.toString()}`
        : "";
      router.replace(`/connexion${newUrl}`);
    }
  }, [logout, queryClient, router, searchParams]);

  // Ne redirige que sur une session revérifiée côté serveur : après une
  // révocation serveur (désactivation, changement de rôle), le proxy renvoie
  // ici alors que le cache ["session"] est encore peuplé — rediriger sur ce
  // cache périmé faisait boucler /connexion ↔ returnTo avec un header
  // toujours « connecté ». Le refetch met aussi le cache (donc le header)
  // à jour.
  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    void refetch().then((freshSession) => {
      if (cancelled) return;
      if (freshSession?.user) {
        router.replace(getSafeReturnTo(searchParams.get("returnTo")));
      } else {
        // Session révoquée : le header/la navigation sont des Server
        // Components du layout racine, rendus « connecté » avant la
        // révocation et conservés tels quels par le Router Cache en
        // navigation douce. On force leur re-rendu côté serveur.
        router.refresh();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session, refetch, router, searchParams]);

  return (
    <div className="min-h-screen bg-blue-background border border-transparent">
      <Container>
        <Breadcrumb
          currentPageLabel="Connexion à Administration+"
          homeLinkProps={{
            href: ROUTE.HOME,
          }}
          segments={[]}
        />
        <div className="max-w-[640px] mx-auto px-4 ">
          <h1>Connexion à Administration+</h1>

          <div className="flex flex-col gap-10">
            {/* Password Login Block */}
            <div className="bg-white p-8 lg:p-16">
              {/* Encart informatif statique : pas de role="alert" (région live
                  assertive inadaptée à un contenu permanent), texte en <p> (RGAA 8.9) */}
              <div className="fr-alert fr-alert--info mb-8">
                <p className="fr-alert__title">
                  La connexion par lien magique n&apos;est plus possible.
                </p>
                <p>
                  La connexion par mot de passe est désormais obligatoire.{" "}
                  <Link href={ROUTE.FORGOT_PASSWORD}>
                    Rendez-vous sur la page Mot de passe oublié
                  </Link>{" "}
                  et saisissez votre adresse e-mail pour créer votre nouveau mot
                  de passe.
                </p>
              </div>
              <SigninForm
                key={prefillEmail}
                onOpenTestUsers={() => setIsImpersonationOpen(true)}
                prefillEmail={prefillEmail}
                prefillPassword={prefillPassword}
              />
            </div>

            {/* ProConnect Block */}
            {/* <div className="bg-white p-8 lg:p-16 ">
              <h2 className="text-[32px] font-bold leading-[40px] text-[#161616] mb-8">
                Connexion avec ProConnect
              </h2>
              <ProConnectSignIn />
            </div> */}
          </div>
        </div>
      </Container>

      <ImpersonationWidget
        open={isImpersonationOpen}
        onOpenChange={setIsImpersonationOpen}
        onPrefillLogin={(email, password) => {
          setPrefillEmail(email);
          setPrefillPassword(password);
        }}
      />
    </div>
  );
}
