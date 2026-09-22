"use client";

import { useRef, useState } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import { Button } from "@codegouvfr/react-dsfr/Button";
import homeAnimation from "./animation/home_animation.json";

export function HeroSection() {
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  function toggleAnimation() {
    if (isPlaying) {
      lottieRef.current?.pause();
    } else {
      lottieRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  }

  function scrollToHowItWorks(event: React.MouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById("comment-ca-marche");
    if (!target) return;
    event.preventDefault();
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // Déplace le focus vers la section cible pour les utilisateurs clavier /
    // lecteur d'écran (RGAA), sans provoquer de saut brusque : le défilement
    // animé est géré séparément via scrollIntoView.
    target.focus({ preventScroll: true });
    target.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }

  return (
    <section
      className="relative pt-10 pb-20"
      style={{
        background: "linear-gradient(180deg, #F5F5FE 0%, #FFF 100%)",
      }}
    >
      <div
        className="relative mx-auto max-w-[1200px] bg-white p-5 md:p-10 lg:p-20"
        style={{
          boxShadow:
            "-20px 0 40px rgba(0, 0, 145, 0.04), 20px 0 40px rgba(0, 0, 145, 0.04)",
        }}
      >
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
          <div className="flex flex-1 flex-col items-start gap-10 pt-10 lg:pt-40">
            <div className="flex flex-col gap-4 max-w-[504px]">
              <h1 className="fr-h1 mb-0">Administration+</h1>
              <p className="text-xl leading-8">
                La messagerie qui met en relation{" "}
                <strong>les professionnels</strong> (aidants et opérateurs) des
                services publics pour{" "}
                <strong>
                  résoudre les blocages administratifs urgents et/ou complexes
                  des citoyens.
                </strong>
              </p>
            </div>
            <Button
              size="large"
              linkProps={{
                href: "#comment-ca-marche",
                onClick: scrollToHowItWorks,
              }}
            >
              Comment ça marche ?
            </Button>
          </div>
          <div className="shrink-0 w-full lg:w-[504px] flex flex-col items-center gap-4">
            <Lottie
              lottieRef={lottieRef}
              animationData={homeAnimation}
              loop
              autoplay
              // RGAA 1.2 : animation décorative, ignorée par les technologies
              // d'assistance (le contenu utile est présent en texte par ailleurs).
              aria-hidden="true"
              className="w-full h-auto"
            />
            <Button
              type="button"
              onClick={toggleAnimation}
              className="relative z-20 inline-flex items-center gap-2 border border-[#ddd] bg-white px-4 py-2 text-base font-medium text-blue-primary hover:bg-gray-50 min-w-[260px] justify-center"
            >
              <span
                className={
                  isPlaying
                    ? "fr-icon-pause-circle-line"
                    : "fr-icon-play-circle-line"
                }
                aria-hidden="true"
              />
              {isPlaying ? "Arrêter l'animation" : "Reprendre l'animation"}
            </Button>
          </div>
        </div>
      </div>
      <div
        className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none"
        style={{
          height: "300px",
          background: "linear-gradient(to bottom, transparent 0%, white 50%)",
        }}
      />
    </section>
  );
}
