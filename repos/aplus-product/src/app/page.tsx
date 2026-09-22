import { HeroSection } from "./(public)/accueil/section/hero-section";
import { HowItWorksSection } from "./(public)/accueil/section/how-it-works-section";
import { WhyUseSection } from "./(public)/accueil/section/why-use-section";
import { KeyFiguresSection } from "./(public)/accueil/section/key-figures-section";
import { TestimonialsSection } from "./(public)/accueil/section/testimonials-section";
import { PartnersSection } from "./(public)/accueil/section/partners-section";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { HydrateClient } from "@/trpc/hydrate-client";

export const metadata = {
  title:
    "La messagerie des professionnels des services publics | Administration+",
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
