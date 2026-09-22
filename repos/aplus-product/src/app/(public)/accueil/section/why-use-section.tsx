import Image from "next/image";
import { ScreenshotCarousel } from "./screenshot-carousel";

const BENEFITS = [
  {
    icon: "fr-icon-flashlight-fill",
    title: "Rapidité",
    description:
      "Les signalements sont pris en charge sous 3 jours. 80% des blocages sont résolus sous 7 jours.",
  },
  {
    icon: "fr-icon-lock-fill",
    title: "Sécurité",
    description:
      "Seules les personnes concernées par le signalement ont accès aux informations du citoyen. Les données personnelles ne sortent pas d'Administration+.",
  },
  {
    iconSrc: "/assets/homepage/picto-tracabilite.svg",
    title: "Traçabilité",
    description:
      "Le suivi des signalements est facilité. Les signalements restent accessibles 6 mois après leur fermeture.",
  },
  {
    iconSrc: "/assets/homepage/picto-simplicite.svg",
    title: "Simplicité",
    description:
      "Un seul signalement peut être envoyé à plusieurs personnes et plusieurs administrations en une fois.",
  },
];

export function WhyUseSection() {
  return (
    <section className="bg-white mb-30  xl:overflow-x-clip">
      <div className="px-5 md:max-w-[1200px] mx-auto py-30 flex items-end">
        <h2 className="fr-h1 mb-0">Pourquoi utiliser Administration+ ?</h2>
      </div>
      <div className="px-5 md:max-w-[1200px] mx-auto py-10 xl:flex xl:items-start xl:gap-10">
        <div className="xl:w-[580px] xl:shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {BENEFITS.map((benefit) => (
              <div key={benefit.title} className="flex flex-col gap-4">
                {benefit.icon ? (
                  <span
                    className={`${benefit.icon} text-blue-primary`}
                    aria-hidden="true"
                  />
                ) : (
                  <Image
                    src={benefit.iconSrc!}
                    alt=""
                    width={20}
                    height={24}
                    aria-hidden="true"
                  />
                )}
                <h3 className="fr-h6 mb-0">{benefit.title}</h3>
                <p className="text-base leading-6">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
        {/* Desktop xl+ : carousel dans le flow, déborde à droite grâce à overflow-x-clip sur la section */}
        <div className="hidden xl:block xl:w-[55vw] xl:shrink-0">
          <ScreenshotCarousel />
        </div>
      </div>
      {/* Mobile / tablette : carousel en dessous, pleine largeur */}
      <div className="xl:hidden px-5 md:max-w-[1200px] mx-auto pb-10">
        <ScreenshotCarousel />
      </div>
    </section>
  );
}
