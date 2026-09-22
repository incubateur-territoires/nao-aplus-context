"use client";

import Button from "@codegouvfr/react-dsfr/Button";
import Input from "@codegouvfr/react-dsfr/Input";
import Badge from "@codegouvfr/react-dsfr/Badge";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { USER_ROLES } from "@/constants/user-roles";
import { ROUTE } from "@/app/constant/route";

interface EmailSectionProps {
  email: string;
}

export function EmailSection({ email }: EmailSectionProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === USER_ROLES.ADMIN;
  const hasTwoFactor = session?.user?.twoFactorEnabled === true;

  return (
    <section className="flex flex-col ">
      <h2 className="text-[32px] font-bold leading-[40px] text-[#161616]">
        Identifiants de connexion
      </h2>

      <Input
        label="Adresse e-mail"
        disabled
        nativeInputProps={{
          type: "email",
          value: email,
          readOnly: true,
        }}
      />

      <div className="flex items-start gap-2 text-[#0063cb] text-xs leading-5">
        <span
          aria-hidden="true"
          className="fr-icon-information-line fr-icon-sm mt-[2px]"
        />
        <p className="text-xs">
          Vous ne pouvez pas modifier votre adresse e-mail vous-même. Si vous
          souhaitez changer d&apos;adresse e-mail,{" "}
          <Link href="/contact">contactez notre support</Link>.
        </p>
      </div>

      <div className="flex flex-col  mt-8">
        <Input
          label="Mot de passe"
          disabled
          nativeInputProps={{
            type: "password",
            value: "************",
            readOnly: true,
          }}
        />
        <Button
          type="button"
          priority="secondary"
          onClick={() => router.push("/mot-de-passe-oublie")}
        >
          Changer votre mot de passe
        </Button>
      </div>

      {isAdmin && (
        <div className="flex flex-col mt-8">
          <h3 className="text-xl font-bold mb-2">
            Vérification en deux étapes (2FA)
          </h3>
          <div className="flex items-center gap-3 mb-4">
            <span>Statut :</span>
            {hasTwoFactor ? (
              <Badge severity="success">Activé</Badge>
            ) : (
              <Badge severity="warning">Non activé</Badge>
            )}
          </div>
          {!hasTwoFactor && (
            <Button
              type="button"
              priority="secondary"
              onClick={() => router.push(ROUTE.SETUP_2FA)}
            >
              Configurer le 2FA
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
