/* dsfr */
import { Content } from "./connexion-content/connexion-content";
import { StartDsfrOnHydration } from "../../../dsfr-bootstrap";
import { Suspense } from "react";

export const metadata = {
  title: "Connexion",
};

export default async function Connexion() {
  return (
    <div>
      <StartDsfrOnHydration />
      <Suspense fallback={<div>Loading...</div>}>
        <Content />
      </Suspense>
    </div>
  );
}
