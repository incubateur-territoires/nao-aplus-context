"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@codegouvfr/react-dsfr/Button";

const SLIDES = [
  {
    src: "/assets/homepage/01-tous-les-signalements.png",
    alt: "Vue de tous les signalements avec leur état et les actions possibles",
  },
  {
    src: "/assets/homepage/02-nouveau-signalement.png",
    alt: "Formulaire de création d'un nouveau signalement avec choix des destinataires",
  },
  {
    src: "/assets/homepage/03-conversation.png",
    alt: "Conversation entre les agents sur un signalement en cours de traitement",
  },
];

const INTERVAL_MS = 5000;

export function ScreenshotCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAutoPlay = useCallback(function startAutoPlay() {
    intervalRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, INTERVAL_MS);
  }, []);

  const stopAutoPlay = useCallback(function stopAutoPlay() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isPlaying) {
      startAutoPlay();
    }
    return () => stopAutoPlay();
  }, [isPlaying, startAutoPlay, stopAutoPlay]);

  function toggleAnimation() {
    setIsPlaying((prev) => !prev);
  }

  function goToSlide(index: number) {
    setCurrentSlide(index);
    if (isPlaying) {
      stopAutoPlay();
      startAutoPlay();
    }
  }

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Captures d'écran de l'interface Administration+"
    >
      <div className="relative overflow-hidden ">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {SLIDES.map((slide, index) => (
            <div
              key={slide.src}
              role="group"
              aria-roledescription="slide"
              aria-label={`Diapositive ${index + 1} sur ${SLIDES.length}`}
              className="w-full shrink-0"
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                width={850}
                height={589}
                className="w-full h-auto"
                priority={index === 0}
              />
            </div>
          ))}
        </div>
      </div>

      <div
        className="flex items-center gap-3 mt-4"
        role="group"
        aria-label="Contrôles du carousel"
      >
        {SLIDES.map((_, index) => (
          <Button
            key={index}
            type="button"
            priority={currentSlide === index ? "primary" : "secondary"}
            size="small"
            onClick={() => goToSlide(index)}
            aria-label={`Aller à la diapositive ${index + 1}`}
            aria-selected={currentSlide === index ? "true" : undefined}
          >
            {index + 1}
          </Button>
        ))}
        <Button
          type="button"
          priority="tertiary"
          size="small"
          iconId={
            isPlaying ? "fr-icon-pause-circle-line" : "fr-icon-play-circle-line"
          }
          onClick={toggleAnimation}
        >
          {isPlaying ? "Arrêter l'animation" : "Reprendre l'animation"}
        </Button>
      </div>
    </div>
  );
}
