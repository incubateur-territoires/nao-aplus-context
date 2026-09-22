import type { ReactNode } from "react";

interface Step {
  icon: string;
  day: string;
  dayDetail?: string;
  description: ReactNode;
}

const STEPS: Step[] = [
  {
    icon: "fr-icon-questionnaire-line",
    day: "JOUR 1",
    description: (
      <>
        Le citoyen expose son blocage à un aidant. L&apos;aidant crée un
        signalement <strong>sur Administration+</strong>
      </>
    ),
  },
  {
    icon: "fr-icon-government-line",
    day: "JOUR 4",
    dayDetail: "(au plus tard)",
    description:
      "Un opérateur de l'administration concernée prend en charge le signalement",
  },
  {
    icon: "fr-icon-check-line",
    day: "JOUR 7",
    dayDetail: "(en moyenne)",
    description:
      "L'opérateur informe le citoyen et/ou l'aidant de la résolution du blocage",
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="comment-ca-marche"
      // tabIndex=-1 rend la section focusable par programme (sans l'ajouter à
      // l'ordre de tabulation) pour recevoir le focus depuis le CTA « Comment
      // ça marche ? » (RGAA).
      tabIndex={-1}
      className="-mt-20 relative z-10 outline-none"
    >
      <div className="bg-white pb-10 flex items-end max-w-[1200px] mx-auto px-5">
        <h2 className="fr-h1 mb-0 ">Comment ça marche ?</h2>
      </div>
      <div className="bg-blue-background px-5 py-10 md:py-20  mx-auto">
        <div className="text-center mb-10">
          <p className="text-lg leading-7 mb-0">
            Résolution du blocage d&apos;un citoyen via Administration+
          </p>
          <p className="text-lg font-bold leading-7">Durée moyenne : 7 jours</p>
        </div>

        {/* Timeline - desktop */}
        {/* RGAA 9.3 : étapes chronologiques structurées en liste ordonnée. */}
        <ol className="hidden lg:flex justify-center gap-20 list-none p-0 m-0">
          {STEPS.map((step, index) => (
            <li key={step.day} className="w-[264px] flex flex-col items-center">
              <div className="bg-white rounded-3xl size-12 flex items-center justify-center">
                <span
                  className={`${step.icon} text-blue-primary`}
                  aria-hidden="true"
                />
              </div>
              <p className="text-sm font-bold leading-6 mb-0 mt-4 w-full text-center">
                {step.day}
              </p>
              {/* Ligne de détail toujours présente (placeholder si absente) pour
                  égaliser la hauteur des colonnes et aligner les points. */}
              <p
                className="text-sm leading-6 mb-0 w-full text-center"
                aria-hidden={step.dayDetail ? undefined : true}
              >
                {step.dayDetail ?? " "}
              </p>
              {/* Point + trait de liaison (décoratif) */}
              <div className="relative mt-4 flex flex-col items-center w-full">
                {index < STEPS.length - 1 && (
                  <div
                    aria-hidden="true"
                    className="absolute top-[7px] left-1/2 h-0.5 w-[344px] bg-blue-primary"
                  />
                )}
                <div className="size-4 rounded-full bg-blue-primary relative z-10" />
                <div className="w-0.5 h-10 bg-[#DDD] mt-2" />
              </div>
              <p className="text-base leading-6 mt-2 w-full">
                {step.description}
              </p>
            </li>
          ))}
        </ol>

        {/* Timeline - mobile */}
        {/* RGAA 9.3 : étapes chronologiques structurées en liste ordonnée. */}
        <ol className="flex flex-col gap-8 lg:hidden list-none p-0 m-0">
          {STEPS.map((step) => (
            <TimelineStep key={step.day} {...step} />
          ))}
        </ol>

        {/* Définition d'un blocage : critères de prise en charge */}
        <BlocageCriteria />
      </div>
    </section>
  );
}

function BlocageCriteria() {
  return (
    <div className="bg-white p-8 mx-auto max-w-[952px] mt-10">
      <p className="text-base leading-6 mb-0">
        Les blocages traités sur A+ répondent à au moins 1 des 2 critères
        suivants :
      </p>
      <ul className="text-base leading-6 mb-0">
        <li>
          <strong>paralysie</strong>&nbsp;:&nbsp;le citoyen a déjà essayé, sans
          succès, de faire valoir ses droits auprès de l&apos;administration
          concernée
        </li>
        <li>
          <strong>urgence</strong>&nbsp;:&nbsp;le citoyen est dans une situation
          critique qui nécessite une intervention rapide (difficultés
          financières par exemple)
        </li>
      </ul>
    </div>
  );
}

function TimelineStep({ icon, day, dayDetail, description }: Step) {
  return (
    <li className="flex gap-4 items-start">
      <div className="flex flex-col items-center gap-2 shrink-0">
        <div className="bg-white rounded-3xl size-12 flex items-center justify-center">
          <span className={`${icon} text-blue-primary`} aria-hidden="true" />
        </div>
      </div>
      <div>
        <p className="text-sm font-bold leading-6 mb-0">{day}</p>
        {dayDetail && <p className="text-sm leading-6 mb-1">{dayDetail}</p>}
        <p className="text-base leading-6">{description}</p>
      </div>
    </li>
  );
}
