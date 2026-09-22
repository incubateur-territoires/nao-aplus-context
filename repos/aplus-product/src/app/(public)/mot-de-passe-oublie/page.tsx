/* dsfr */
import Content from "./content/content";
import { StartDsfrOnHydration } from "../../../dsfr-bootstrap";

export const metadata = {
  title: "Mot de passe oublié",
};

export default async function Connexion() {
  return (
    <div>
      <StartDsfrOnHydration />
      <Content />
    </div>
  );
}
