import { HeroSection } from "./section/hero-section";
import { HowItWorksSection } from "./section/how-it-works-section";
import { WhyUseSection } from "./section/why-use-section";
import { KeyFiguresSection } from "./section/key-figures-section";
import { TestimonialsSection } from "./section/testimonials-section";
import { PartnersSection } from "./section/partners-section";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { HydrateClient } from "@/trpc/hydrate-client";

export const metadata = {
  title: "La messagerie des professionnels des services publics",
  description:
    "Administration+ est la messagerie qui met en relation les professionnels des services publics pour résoudre les blocages administratifs urgents et/ou complexes des citoyens.",
};

export default function AccueilPage() {
  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <HeroSection />
      <HowItWorksSection />
      <WhyUseSection />
      <KeyFiguresSection />
      <TestimonialsSection />
      <PartnersSection />
    </HydrateClient>
  );
}
