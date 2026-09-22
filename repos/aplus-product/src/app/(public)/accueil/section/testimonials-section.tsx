import Image from "next/image";

const TESTIMONIALS = [
  {
    quote:
      "Gain de temps, sécurisation des échanges de données. Je n'ai pas de suppléance téléphonique alors que des collègues peuvent prendre mon relais sur A+.",
    author: "Un agent opérateur de service public",
    avatar: "/assets/homepage/women-talking-pana.svg",
  },
  {
    quote:
      "[A+] permet de centraliser les demandes des France Services, évite d'engorger la PFS et nos mails, outil sécurisé.",
    author: "Opérateur CPAM et responsable du pilotage",
    avatar: "/assets/homepage/content-team-pana.svg",
  },
  {
    quote:
      "Bon outil, pratique pour fluidifier les échanges. A mon sens préférable à un appel téléphonique car nous disposons des éléments écrits et pouvons solliciter les services métiers avant d'apporter la solution à France services.",
    author: "Un agent en préfecture",
    avatar: "/assets/homepage/men-pana.svg",
  },
  {
    quote:
      "Cela permet un gain de temps car on peut contacter facilement un partenaire pour une question sur son champs d'intervention et obtenir une réponse assez rapidement.",
    author: "Un conseiller France Services",
    avatar: "/assets/homepage/men-talking-pana.svg",
  },
];

function TestimonialCard({
  quote,
  author,
  avatar,
}: {
  quote: string;
  author: string;
  avatar: string;
}) {
  // RGAA 9.4 : citation structurée en figure/blockquote/figcaption.
  return (
    <figure className="border border-[#ddd] flex flex-col gap-4 px-6 py-10 m-0">
      <Image
        src="/assets/homepage/quote.svg"
        alt=""
        width={24}
        height={18}
        aria-hidden="true"
      />
      <blockquote className="text-base leading-6 text-[#3a3a3a] m-0">
        {quote}
      </blockquote>
      <figcaption className="flex items-center gap-2.5">
        <Image src={avatar} alt="" width={64} height={64} aria-hidden="true" />
        <span className="font-bold text-base leading-6 text-[#3a3a3a] flex-1">
          {author}
        </span>
      </figcaption>
    </figure>
  );
}

export function TestimonialsSection() {
  return (
    <section className="bg-white">
      <div className="px-5 max-w-[1200px] mx-auto py-10 flex items-end h-auto lg:h-[200px]">
        <h2 className="fr-h1 mb-0">Témoignages</h2>
      </div>
      <div className="relative py-10 flex flex-col lg:flex-row gap-6 overflow-hidden    ">
        {/* Left illustration - 1/3 de la largeur */}
        <div className="hidden relative lg:flex flex-col items-end justify-end w-1/3 shrink-0">
          <Image
            src="/assets/homepage/woman.svg"
            alt=""
            fill
            className="object-contain"
            aria-hidden="true"
          />
        </div>

        {/* Testimonial columns */}
        <div className="flex flex-col md:flex-row gap-6 flex-1 px-5 lg:px-0 w-full  mr-[calc(50%-580px)] ">
          <div className="flex flex-col gap-6 flex-1">
            <TestimonialCard {...TESTIMONIALS[0]} />
            <TestimonialCard {...TESTIMONIALS[1]} />
          </div>
          <div className="flex flex-col gap-6 flex-1">
            <TestimonialCard {...TESTIMONIALS[2]} />
            <TestimonialCard {...TESTIMONIALS[3]} />
          </div>
        </div>
      </div>
    </section>
  );
}
